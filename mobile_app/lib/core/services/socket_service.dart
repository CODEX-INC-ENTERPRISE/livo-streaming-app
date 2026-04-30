import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';
import '../constants/environment.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import '../utils/logger.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  io.Socket? _socket;
  final AuthService _authService = AuthService();
  final StorageService _storageService = StorageService();
  
  // Stream controllers for different event types
  final StreamController<Map<String, dynamic>> _streamEventsController = 
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _voiceEventsController = 
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _chatEventsController = 
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _notificationEventsController = 
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Map<String, dynamic>> _giftEventsController = 
      StreamController<Map<String, dynamic>>.broadcast();
  
  // Public streams
  Stream<Map<String, dynamic>> get streamEvents => _streamEventsController.stream;
  Stream<Map<String, dynamic>> get voiceEvents => _voiceEventsController.stream;
  Stream<Map<String, dynamic>> get chatEvents => _chatEventsController.stream;
  Stream<Map<String, dynamic>> get notificationEvents => _notificationEventsController.stream;
  Stream<Map<String, dynamic>> get giftEvents => _giftEventsController.stream;
  
  // Connection state
  bool get isConnected => _socket?.connected ?? false;
  String? get socketId => _socket?.id;
  
  // Reconnection settings
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = AppConstants.maxSocketReconnectAttempts;
  static const int _reconnectDelayMs = AppConstants.socketReconnectDelayMs;
  
  // Initialize socket connection
  Future<void> connect() async {
    try {
      if (_socket != null && _socket!.connected) {
        Logger.debug('Socket already connected');
        return;
      }
      
      final token = await _authService.getCurrentToken();
      if (token == null) {
        throw Exception('No authentication token available');
      }
      
      Logger.debug('Connecting to socket server');
      
      // Create socket with configuration
      _socket = io.io(
        Environment.socketUrl,
        io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
      );
      
      _setupEventListeners();
      _setupConnectionListeners();
      
      // Manually connect
      _socket!.connect();
      
      Logger.info('Socket connection initiated');
    } catch (e) {
      Logger.error('Failed to initialize socket connection', e);
      rethrow;
    }
  }
  
  // Disconnect socket
  Future<void> disconnect() async {
    try {
      if (_socket != null) {
        _socket!.disconnect();
        _socket!.dispose();
        _socket = null;
        _reconnectAttempts = 0;
        Logger.info('Socket disconnected');
      }
    } catch (e) {
      Logger.error('Failed to disconnect socket', e);
      rethrow;
    }
  }
  
  // Setup event listeners
  void _setupEventListeners() {
    if (_socket == null) return;
    
    // Stream events
    _socket!.on('stream:viewer-joined', (data) {
      Logger.socketEvent('stream:viewer-joined', data);
      _streamEventsController.add({
        'type': 'viewer_joined',
        'data': data,
      });
    });
    
    _socket!.on('stream:viewer-left', (data) {
      Logger.socketEvent('stream:viewer-left', data);
      _streamEventsController.add({
        'type': 'viewer_left',
        'data': data,
      });
    });
    
    _socket!.on('stream:chat-message', (data) {
      Logger.socketEvent('stream:chat-message', data);
      _chatEventsController.add({
        'type': 'chat_message',
        'data': data,
      });
    });
    
    _socket!.on('stream:gift-sent', (data) {
      Logger.socketEvent('stream:gift-sent', data);
      _giftEventsController.add({
        'type': 'gift_sent',
        'data': data,
      });
    });
    
    _socket!.on('stream:ended', (data) {
      Logger.socketEvent('stream:ended', data);
      _streamEventsController.add({
        'type': 'stream_ended',
        'data': data,
      });
    });
    
    _socket!.on('stream:moderation', (data) {
      Logger.socketEvent('stream:moderation', data);
      _streamEventsController.add({
        'type': 'moderation',
        'data': data,
      });
    });
    
    // Voice room events
    _socket!.on('voice:participant-joined', (data) {
      Logger.socketEvent('voice:participant-joined', data);
      _voiceEventsController.add({
        'type': 'participant_joined',
        'data': data,
      });
    });
    
    _socket!.on('voice:participant-left', (data) {
      Logger.socketEvent('voice:participant-left', data);
      _voiceEventsController.add({
        'type': 'participant_left',
        'data': data,
      });
    });
    
    _socket!.on('voice:role-changed', (data) {
      Logger.socketEvent('voice:role-changed', data);
      _voiceEventsController.add({
        'type': 'role_changed',
        'data': data,
      });
    });
    
    _socket!.on('voice:hand-raised', (data) {
      Logger.socketEvent('voice:hand-raised', data);
      _voiceEventsController.add({
        'type': 'hand_raised',
        'data': data,
      });
    });
    
    _socket!.on('voice:chat', (data) {
      Logger.socketEvent('voice:chat', data);
      _chatEventsController.add({
        'type': 'voice_chat',
        'data': data,
      });
    });
    
    // Notification events
    _socket!.on('notification:new', (data) {
      Logger.socketEvent('notification:new', data);
      _notificationEventsController.add({
        'type': 'new_notification',
        'data': data,
      });
    });
    
    // Error events
    _socket!.on('error', (data) {
      Logger.error('Socket error', data);
    });
    
    // Disconnect event
    _socket!.on('disconnect', (data) {
      Logger.socketEvent('disconnect', data);
    });
  }
  
  // Setup connection listeners
  void _setupConnectionListeners() {
    if (_socket == null) return;
    
    _socket!.onConnect((_) {
      Logger.info('Socket connected successfully');
      _reconnectAttempts = 0;
    });
    
    _socket!.onConnectError((data) {
      Logger.error('Socket connection error', data);
      _handleReconnection();
    });
    
    _socket!.onDisconnect((_) {
      Logger.warning('Socket disconnected');
      _handleReconnection();
    });
    
    _socket!.onConnectTimeout((data) {
      Logger.error('Socket connection timeout', data);
      _handleReconnection();
    });
  }
  
  // Handle reconnection
  void _handleReconnection() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      Logger.error('Max reconnection attempts reached');
      return;
    }
    
    _reconnectAttempts++;
    final delay = _reconnectDelayMs * _reconnectAttempts;
    
    Logger.debug('Attempting reconnection in ${delay}ms (attempt $_reconnectAttempts/$_maxReconnectAttempts)');
    
    Future.delayed(Duration(milliseconds: delay), () async {
      try {
        await connect();
      } catch (e) {
        Logger.error('Reconnection attempt failed', e);
      }
    });
  }
  
  // Join a stream room
  Future<void> joinStream(String streamId) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      Logger.debug('Joining stream room: $streamId');
      _socket!.emit('stream:join', {'streamId': streamId});
    } catch (e) {
      Logger.error('Failed to join stream room', e);
      rethrow;
    }
  }
  
  // Leave a stream room
  Future<void> leaveStream(String streamId) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      Logger.debug('Leaving stream room: $streamId');
      _socket!.emit('stream:leave', {'streamId': streamId});
    } catch (e) {
      Logger.error('Failed to leave stream room', e);
      rethrow;
    }
  }
  
  // Send chat message in stream
  Future<void> sendStreamChat(String streamId, String message) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      if (message.length > AppConstants.maxChatMessageLength) {
        throw Exception('Message too long');
      }
      
      Logger.debug('Sending stream chat message');
      _socket!.emit('stream:chat', {
        'streamId': streamId,
        'message': message,
      });
    } catch (e) {
      Logger.error('Failed to send stream chat message', e);
      rethrow;
    }
  }
  
  // Send virtual gift
  Future<void> sendGift(String streamId, String giftId) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      Logger.debug('Sending gift: $giftId to stream: $streamId');
      _socket!.emit('stream:gift', {
        'streamId': streamId,
        'giftId': giftId,
      });
    } catch (e) {
      Logger.error('Failed to send gift', e);
      rethrow;
    }
  }
  
  // Join voice room
  Future<void> joinVoiceRoom(String roomId) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      Logger.debug('Joining voice room: $roomId');
      _socket!.emit('voice:join', {'roomId': roomId});
    } catch (e) {
      Logger.error('Failed to join voice room', e);
      rethrow;
    }
  }
  
  // Leave voice room
  Future<void> leaveVoiceRoom(String roomId) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      Logger.debug('Leaving voice room: $roomId');
      _socket!.emit('voice:leave', {'roomId': roomId});
    } catch (e) {
      Logger.error('Failed to leave voice room', e);
      rethrow;
    }
  }
  
  // Raise hand in voice room
  Future<void> raiseHand(String roomId) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      Logger.debug('Raising hand in voice room: $roomId');
      _socket!.emit('voice:raise-hand', {'roomId': roomId});
    } catch (e) {
      Logger.error('Failed to raise hand', e);
      rethrow;
    }
  }
  
  // Send chat message in voice room
  Future<void> sendVoiceChat(String roomId, String message) async {
    try {
      if (_socket == null || !_socket!.connected) {
        throw Exception('Socket not connected');
      }
      
      if (message.length > AppConstants.maxChatMessageLength) {
        throw Exception('Message too long');
      }
      
      Logger.debug('Sending voice room chat message');
      _socket!.emit('voice:chat', {
        'roomId': roomId,
        'message': message,
      });
    } catch (e) {
      Logger.error('Failed to send voice room chat message', e);
      rethrow;
    }
  }
  
  // Cleanup
  Future<void> dispose() async {
    await disconnect();
    await _streamEventsController.close();
    await _voiceEventsController.close();
    await _chatEventsController.close();
    await _notificationEventsController.close();
    await _giftEventsController.close();
    Logger.debug('Socket service disposed');
  }
}