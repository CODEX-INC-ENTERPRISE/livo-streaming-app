import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';
import '../constants/environment.dart';
import '../services/auth_service.dart';
import '../utils/logger.dart';

/// Manages the Socket.io connection and exposes typed broadcast streams for
/// each WebSocket event category.
///
/// Usage:
/// ```dart
/// final socket = SocketService();
/// await socket.connect();
/// socket.chatEvents.listen((event) { ... });
/// ```
class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  io.Socket? _socket;
  final AuthService _authService = AuthService();

  // ─── Broadcast stream controllers ─────────────────────────────────────────────

  final _streamEventsCtrl =
      StreamController<Map<String, dynamic>>.broadcast();
  final _voiceEventsCtrl =
      StreamController<Map<String, dynamic>>.broadcast();
  final _chatEventsCtrl =
      StreamController<Map<String, dynamic>>.broadcast();
  final _notificationEventsCtrl =
      StreamController<Map<String, dynamic>>.broadcast();
  final _giftEventsCtrl =
      StreamController<Map<String, dynamic>>.broadcast();

  // ─── Public streams ───────────────────────────────────────────────────────────

  Stream<Map<String, dynamic>> get streamEvents => _streamEventsCtrl.stream;
  Stream<Map<String, dynamic>> get voiceEvents => _voiceEventsCtrl.stream;
  Stream<Map<String, dynamic>> get chatEvents => _chatEventsCtrl.stream;
  Stream<Map<String, dynamic>> get notificationEvents =>
      _notificationEventsCtrl.stream;
  Stream<Map<String, dynamic>> get giftEvents => _giftEventsCtrl.stream;

  // ─── Connection state ─────────────────────────────────────────────────────────

  bool get isConnected => _socket?.connected ?? false;
  String? get socketId => _socket?.id;

  int _reconnectAttempts = 0;

  // ─── Connect / disconnect ─────────────────────────────────────────────────────

  /// Establishes the Socket.io connection using the stored auth token.
  Future<void> connect() async {
    if (_socket != null && _socket!.connected) {
      Logger.debug('Socket already connected');
      return;
    }

    final token = await _authService.getCurrentToken();
    if (token == null) {
      throw Exception('Cannot connect socket: no auth token available.');
    }

    Logger.debug('Connecting to socket server: ${Environment.socketUrl}');

    _socket = io.io(
      Environment.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );

    _setupConnectionListeners();
    _setupEventListeners();

    _socket!.connect();
    Logger.info('Socket connection initiated');
  }

  /// Disconnects and disposes the socket without closing the stream controllers.
  Future<void> disconnect() async {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
      _reconnectAttempts = 0;
      Logger.info('Socket disconnected');
    }
  }

  // ─── Emit helpers ─────────────────────────────────────────────────────────────

  void _emit(String event, Map<String, dynamic> data) {
    if (_socket == null || !_socket!.connected) {
      throw Exception('Socket not connected. Call connect() first.');
    }
    _socket!.emit(event, data);
  }

  // Stream actions
  void joinStream(String streamId) =>
      _emit('stream:join', {'streamId': streamId});

  void leaveStream(String streamId) =>
      _emit('stream:leave', {'streamId': streamId});

  void sendStreamChat(String streamId, String message) {
    if (message.length > AppConstants.maxChatMessageLength) {
      throw Exception('Message exceeds ${AppConstants.maxChatMessageLength} characters.');
    }
    _emit('stream:chat', {'streamId': streamId, 'message': message});
  }

  void sendGift(String streamId, String giftId) =>
      _emit('stream:gift', {'streamId': streamId, 'giftId': giftId});

  // Voice room actions
  void joinVoiceRoom(String roomId) =>
      _emit('voice:join', {'roomId': roomId});

  void leaveVoiceRoom(String roomId) =>
      _emit('voice:leave', {'roomId': roomId});

  void raiseHand(String roomId) =>
      _emit('voice:raise-hand', {'roomId': roomId});

  void sendVoiceChat(String roomId, String message) {
    if (message.length > AppConstants.maxChatMessageLength) {
      throw Exception('Message exceeds ${AppConstants.maxChatMessageLength} characters.');
    }
    _emit('voice:chat', {'roomId': roomId, 'message': message});
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  /// Disconnects and closes all stream controllers. Call when the service is
  /// no longer needed (e.g., app shutdown).
  Future<void> dispose() async {
    await disconnect();
    await _streamEventsCtrl.close();
    await _voiceEventsCtrl.close();
    await _chatEventsCtrl.close();
    await _notificationEventsCtrl.close();
    await _giftEventsCtrl.close();
    Logger.debug('SocketService disposed');
  }

  // ─── Private: connection listeners ───────────────────────────────────────────

  void _setupConnectionListeners() {
    _socket!.onConnect((_) {
      Logger.info('Socket connected (id: ${_socket?.id})');
      _reconnectAttempts = 0;
    });

    _socket!.onConnectError((data) {
      Logger.error('Socket connection error', data);
      _scheduleReconnect();
    });

    _socket!.onDisconnect((_) {
      Logger.warning('Socket disconnected');
      _scheduleReconnect();
    });

    _socket!.onConnectTimeout((data) {
      Logger.error('Socket connection timeout', data);
      _scheduleReconnect();
    });

    _socket!.on('error', (data) => Logger.error('Socket error', data));
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= AppConstants.maxSocketReconnectAttempts) {
      Logger.error('Max socket reconnect attempts reached – giving up.');
      return;
    }

    _reconnectAttempts++;
    final delayMs =
        AppConstants.socketReconnectDelayMs * _reconnectAttempts;

    Logger.debug(
        'Reconnecting in ${delayMs}ms (attempt $_reconnectAttempts/${AppConstants.maxSocketReconnectAttempts})');

    Future.delayed(Duration(milliseconds: delayMs), () async {
      try {
        await connect();
      } catch (e) {
        Logger.error('Reconnect attempt $_reconnectAttempts failed', e);
      }
    });
  }

  // ─── Private: event listeners ─────────────────────────────────────────────────

  void _setupEventListeners() {
    // Stream events
    _on('stream:viewer-joined', _streamEventsCtrl, 'viewer_joined');
    _on('stream:viewer-left', _streamEventsCtrl, 'viewer_left');
    _on('stream:ended', _streamEventsCtrl, 'stream_ended');
    _on('stream:moderation', _streamEventsCtrl, 'moderation');

    // Chat events (stream + voice)
    _on('stream:chat-message', _chatEventsCtrl, 'stream_chat_message');
    _on('voice:chat', _chatEventsCtrl, 'voice_chat_message');

    // Gift events
    _on('stream:gift-sent', _giftEventsCtrl, 'gift_sent');

    // Voice room events
    _on('voice:participant-joined', _voiceEventsCtrl, 'participant_joined');
    _on('voice:participant-left', _voiceEventsCtrl, 'participant_left');
    _on('voice:role-changed', _voiceEventsCtrl, 'role_changed');
    _on('voice:hand-raised', _voiceEventsCtrl, 'hand_raised');

    // Notification events
    _on('notification:new', _notificationEventsCtrl, 'new_notification');
  }

  /// Registers a socket event listener that forwards payloads to [controller]
  /// with a `type` field set to [type].
  void _on(
    String event,
    StreamController<Map<String, dynamic>> controller,
    String type,
  ) {
    _socket!.on(event, (data) {
      Logger.socketEvent(event, data);
      if (!controller.isClosed) {
        controller.add({'type': type, 'data': data});
      }
    });
  }
}
