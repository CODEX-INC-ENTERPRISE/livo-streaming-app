import 'package:flutter/foundation.dart';
import '../models/stream.dart';
import '../core/services/api_service.dart';
import '../core/services/socket_service.dart';
import '../core/utils/logger.dart';

class StreamProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  final SocketService _socketService = SocketService();
  
  List<Stream> _activeStreams = [];
  Stream? _currentStream;
  bool _isLoading = false;
  String? _error;
  
  // Getters
  List<Stream> get activeStreams => _activeStreams;
  Stream? get currentStream => _currentStream;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isInStream => _currentStream != null;
  
  // Initialize provider
  Future<void> initialize() async {
    try {
      // Setup socket event listeners
      _setupSocketListeners();
      
      // Load active streams
      await loadActiveStreams();
    } catch (e) {
      Logger.error('Failed to initialize stream provider', e);
    }
  }
  
  // Setup socket event listeners
  void _setupSocketListeners() {
    _socketService.streamEvents.listen((event) {
      final type = event['type'] as String;
      final data = event['data'] as Map<String, dynamic>;
      
      switch (type) {
        case 'viewer_joined':
          _handleViewerJoined(data);
          break;
        case 'viewer_left':
          _handleViewerLeft(data);
          break;
        case 'chat_message':
          _handleChatMessage(data);
          break;
        case 'stream_ended':
          _handleStreamEnded(data);
          break;
        case 'moderation':
          _handleModeration(data);
          break;
      }
    });
  }
  
  // Load active streams
  Future<void> loadActiveStreams() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.get('/streams/active');
      
      if (response.statusCode == 200) {
        final streamsData = response.data as List<dynamic>;
        _activeStreams = streamsData
            .map((data) => Stream.fromJson(data as Map<String, dynamic>))
            .toList();
        
        Logger.info('Loaded ${_activeStreams.length} active streams');
      } else {
        throw Exception('Failed to load active streams');
      }
    } catch (e) {
      Logger.error('Failed to load active streams', e);
      _error = 'Failed to load streams';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Start a new stream
  Future<Stream> startStream(String title) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/streams/start',
        data: {'title': title},
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final streamData = response.data as Map<String, dynamic>;
        final stream = Stream.fromJson(streamData);
        
        // Add to active streams
        _activeStreams.insert(0, stream);
        
        // Set as current stream
        _currentStream = stream;
        
        // Join stream room via socket
        await _socketService.joinStream(stream.id);
        
        Logger.info('Stream started: ${stream.id}');
        return stream;
      } else {
        throw Exception('Failed to start stream');
      }
    } catch (e) {
      Logger.error('Failed to start stream', e);
      _error = 'Failed to start stream';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // End current stream
  Future<void> endStream() async {
    try {
      if (_currentStream == null) {
        throw Exception('No active stream to end');
      }
      
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/streams/${_currentStream!.id}/end',
      );
      
      if (response.statusCode == 200) {
        // Leave stream room via socket
        await _socketService.leaveStream(_currentStream!.id);
        
        // Remove from active streams
        _activeStreams.removeWhere((s) => s.id == _currentStream!.id);
        
        // Clear current stream
        _currentStream = null;
        
        Logger.info('Stream ended successfully');
      } else {
        throw Exception('Failed to end stream');
      }
    } catch (e) {
      Logger.error('Failed to end stream', e);
      _error = 'Failed to end stream';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Join a stream as viewer
  Future<Stream> joinStream(String streamId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/streams/$streamId/join',
      );
      
      if (response.statusCode == 200) {
        // Load stream details
        final streamResponse = await _apiService.get('/streams/$streamId');
        final streamData = streamResponse.data as Map<String, dynamic>;
        final stream = Stream.fromJson(streamData);
        
        // Set as current stream
        _currentStream = stream;
        
        // Join stream room via socket
        await _socketService.joinStream(streamId);
        
        Logger.info('Joined stream: $streamId');
        return stream;
      } else {
        throw Exception('Failed to join stream');
      }
    } catch (e) {
      Logger.error('Failed to join stream: $streamId', e);
      _error = 'Failed to join stream';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Leave current stream
  Future<void> leaveStream() async {
    try {
      if (_currentStream == null) {
        return;
      }
      
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final streamId = _currentStream!.id;
      
      final response = await _apiService.post(
        '/streams/$streamId/leave',
      );
      
      if (response.statusCode == 200) {
        // Leave stream room via socket
        await _socketService.leaveStream(streamId);
        
        // Clear current stream
        _currentStream = null;
        
        Logger.info('Left stream: $streamId');
      } else {
        throw Exception('Failed to leave stream');
      }
    } catch (e) {
      Logger.error('Failed to leave stream', e);
      _error = 'Failed to leave stream';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Send chat message in current stream
  Future<void> sendChatMessage(String message) async {
    try {
      if (_currentStream == null) {
        throw Exception('Not in a stream');
      }
      
      await _socketService.sendStreamChat(_currentStream!.id, message);
      Logger.debug('Chat message sent');
    } catch (e) {
      Logger.error('Failed to send chat message', e);
      _error = 'Failed to send message';
      rethrow;
    }
  }
  
  // Send virtual gift in current stream
  Future<void> sendGift(String giftId) async {
    try {
      if (_currentStream == null) {
        throw Exception('Not in a stream');
      }
      
      await _socketService.sendGift(_currentStream!.id, giftId);
      Logger.debug('Gift sent: $giftId');
    } catch (e) {
      Logger.error('Failed to send gift', e);
      _error = 'Failed to send gift';
      rethrow;
    }
  }
  
  // Handle socket events
  void _handleViewerJoined(Map<String, dynamic> data) {
    final streamId = data['streamId'] as String?;
    final userId = data['userId'] as String?;
    
    if (streamId == null || userId == null) return;
    
    // Update current stream if it matches
    if (_currentStream?.id == streamId) {
      final updatedViewers = List<String>.from(_currentStream!.currentViewerIds)
        ..add(userId);
      
      _currentStream = _currentStream!.copyWith(
        currentViewerIds: updatedViewers,
        peakViewerCount: _currentStream!.peakViewerCount + 1,
      );
      
      notifyListeners();
    }
    
    // Update in active streams list
    final index = _activeStreams.indexWhere((s) => s.id == streamId);
    if (index != -1) {
      final stream = _activeStreams[index];
      final updatedViewers = List<String>.from(stream.currentViewerIds)
        ..add(userId);
      
      _activeStreams[index] = stream.copyWith(
        currentViewerIds: updatedViewers,
      );
      
      notifyListeners();
    }
  }
  
  void _handleViewerLeft(Map<String, dynamic> data) {
    final streamId = data['streamId'] as String?;
    final userId = data['userId'] as String?;
    
    if (streamId == null || userId == null) return;
    
    // Update current stream if it matches
    if (_currentStream?.id == streamId) {
      final updatedViewers = List<String>.from(_currentStream!.currentViewerIds)
        ..remove(userId);
      
      _currentStream = _currentStream!.copyWith(
        currentViewerIds: updatedViewers,
      );
      
      notifyListeners();
    }
    
    // Update in active streams list
    final index = _activeStreams.indexWhere((s) => s.id == streamId);
    if (index != -1) {
      final stream = _activeStreams[index];
      final updatedViewers = List<String>.from(stream.currentViewerIds)
        ..remove(userId);
      
      _activeStreams[index] = stream.copyWith(
        currentViewerIds: updatedViewers,
      );
      
      notifyListeners();
    }
  }
  
  void _handleChatMessage(Map<String, dynamic> data) {
    final streamId = data['streamId'] as String?;
    final messageData = data['message'] as Map<String, dynamic>?;
    
    if (streamId == null || messageData == null) return;
    
    // Update current stream if it matches
    if (_currentStream?.id == streamId) {
      final message = ChatMessage.fromJson(messageData);
      final updatedChat = List<ChatMessage>.from(_currentStream!.chatHistory)
        ..add(message);
      
      _currentStream = _currentStream!.copyWith(
        chatHistory: updatedChat,
      );
      
      notifyListeners();
    }
  }
  
  void _handleStreamEnded(Map<String, dynamic> data) {
    final streamId = data['streamId'] as String?;
    
    if (streamId == null) return;
    
    // Remove from active streams
    _activeStreams.removeWhere((s) => s.id == streamId);
    
    // Clear current stream if it matches
    if (_currentStream?.id == streamId) {
      _currentStream = null;
    }
    
    notifyListeners();
  }
  
  void _handleModeration(Map<String, dynamic> data) {
    final streamId = data['streamId'] as String?;
    final action = data['action'] as String?;
    final targetUserId = data['targetUserId'] as String?;
    
    if (streamId == null || action == null || targetUserId == null) return;
    
    // Update current stream if it matches
    if (_currentStream?.id == streamId) {
      Stream updatedStream = _currentStream!;
      
      switch (action) {
        case 'mute':
          final updatedMuted = List<String>.from(updatedStream.mutedUserIds)
            ..add(targetUserId);
          updatedStream = updatedStream.copyWith(mutedUserIds: updatedMuted);
          break;
        case 'kick':
          final updatedKicked = List<String>.from(updatedStream.kickedUserIds)
            ..add(targetUserId);
          final updatedViewers = List<String>.from(updatedStream.currentViewerIds)
            ..remove(targetUserId);
          updatedStream = updatedStream.copyWith(
            kickedUserIds: updatedKicked,
            currentViewerIds: updatedViewers,
          );
          break;
        case 'block':
          // Block logic would be handled elsewhere
          break;
        case 'moderator':
          final updatedModerators = List<String>.from(updatedStream.moderatorIds)
            ..add(targetUserId);
          updatedStream = updatedStream.copyWith(moderatorIds: updatedModerators);
          break;
      }
      
      _currentStream = updatedStream;
      notifyListeners();
    }
  }
  
  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
  
  // Refresh streams
  Future<void> refreshStreams() async {
    await loadActiveStreams();
  }
  
  // Dispose
  @override
  void dispose() {
    // Leave current stream on dispose
    if (_currentStream != null) {
      _socketService.leaveStream(_currentStream!.id);
    }
    super.dispose();
  }
}