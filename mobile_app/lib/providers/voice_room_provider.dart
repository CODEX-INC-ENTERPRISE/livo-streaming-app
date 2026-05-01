import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/voice_room.dart';
import '../models/chat_message.dart';
import '../core/services/api_service.dart';
import '../core/services/socket_service.dart';
import '../core/services/voice_room_service.dart';
import '../core/utils/logger.dart';

/// Provider managing voice room state, API calls, and WebSocket events.
///
/// Requirements: 11.1, 11.4, 11.5, 12.1–12.6, 13.1–13.3
class VoiceRoomProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  final SocketService _socketService = SocketService();
  final VoiceRoomService _audioService = VoiceRoomService();

  VoiceRoom? _currentRoom;
  bool _isLoading = false;
  String? _error;

  // Local user state
  String? _currentUserId;
  ParticipantRole _myRole = ParticipantRole.listener;
  bool _isHandRaised = false;
  bool _isMuted = true;

  // Subscriptions
  StreamSubscription? _voiceEventSub;
  StreamSubscription? _chatEventSub;

  // Getters
  VoiceRoom? get currentRoom => _currentRoom;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isInRoom => _currentRoom != null;
  ParticipantRole get myRole => _myRole;
  bool get isHandRaised => _isHandRaised;
  bool get isMuted => _isMuted;
  bool get isSpeaker =>
      _myRole == ParticipantRole.speaker || _myRole == ParticipantRole.host;
  bool get isHost => _myRole == ParticipantRole.host;

  List<ChatMessage> get chatMessages => _currentRoom?.chatHistory ?? [];

  // ─── Initialization ──────────────────────────────────────────────────────────

  void setCurrentUser(String userId) {
    _currentUserId = userId;
  }

  void _setupSocketListeners() {
    _voiceEventSub = _socketService.voiceEvents.listen((event) {
      final type = event['type'] as String;
      final data = event['data'] as Map<String, dynamic>;
      switch (type) {
        case 'participant_joined':
          _handleParticipantJoined(data);
          break;
        case 'participant_left':
          _handleParticipantLeft(data);
          break;
        case 'role_changed':
          _handleRoleChanged(data);
          break;
        case 'hand_raised':
          _handleHandRaised(data);
          break;
      }
    });

    _chatEventSub = _socketService.chatEvents.listen((event) {
      if (event['type'] == 'voice_chat') {
        _handleChatMessage(event['data'] as Map<String, dynamic>);
      }
    });
  }

  // ─── Join / Leave ────────────────────────────────────────────────────────────

  /// Join a voice room. Fetches room details, joins via API, then Agora.
  Future<void> joinRoom(String roomId, String userId) async {
    _currentUserId = userId;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // 1. Join via backend API
      final joinResponse = await _apiService.post('/voice-rooms/$roomId/join');
      if (joinResponse.statusCode != 200 && joinResponse.statusCode != 201) {
        throw Exception('Failed to join voice room');
      }

      final joinData = joinResponse.data as Map<String, dynamic>;
      final audioToken = joinData['audioToken'] as String? ?? '';

      // 2. Fetch full room details
      final roomResponse = await _apiService.get('/voice-rooms/$roomId');
      if (roomResponse.statusCode == 200) {
        _currentRoom = VoiceRoom.fromJson(
            roomResponse.data as Map<String, dynamic>);
      }

      // 3. Determine role
      final myParticipant = _currentRoom?.getParticipant(userId);
      if (_currentRoom?.hostId == userId) {
        _myRole = ParticipantRole.host;
      } else if (myParticipant?.role == ParticipantRole.speaker) {
        _myRole = ParticipantRole.speaker;
      } else {
        _myRole = ParticipantRole.listener;
      }

      // 4. Join Agora audio channel
      final channelId = _currentRoom?.agoraChannelId ?? roomId;
      if (isSpeaker) {
        await _audioService.joinAsSpeaker(
            channelId: channelId, token: audioToken);
        _isMuted = false;
      } else {
        await _audioService.joinAsListener(
            channelId: channelId, token: audioToken);
        _isMuted = true;
      }

      // 5. Join socket room
      _socketService.joinVoiceRoom(roomId);

      // 6. Setup listeners
      _setupSocketListeners();

      Logger.info('VoiceRoomProvider: Joined room $roomId as $_myRole');
    } catch (e) {
      Logger.error('VoiceRoomProvider: Failed to join room', e);
      _error = 'Failed to join voice room';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Leave the current voice room.
  Future<void> leaveRoom() async {
    if (_currentRoom == null) return;
    final roomId = _currentRoom!.id;

    try {
      // Leave Agora channel
      await _audioService.leaveChannel();

      // Leave via backend API
      await _apiService.post('/voice-rooms/$roomId/leave');

      // Leave socket room
      _socketService.leaveVoiceRoom(roomId);

      // Cancel subscriptions
      await _voiceEventSub?.cancel();
      await _chatEventSub?.cancel();
      _voiceEventSub = null;
      _chatEventSub = null;

      _currentRoom = null;
      _myRole = ParticipantRole.listener;
      _isHandRaised = false;
      _isMuted = true;

      Logger.info('VoiceRoomProvider: Left room $roomId');
    } catch (e) {
      Logger.error('VoiceRoomProvider: Failed to leave room', e);
      _error = 'Failed to leave voice room';
    } finally {
      notifyListeners();
    }
  }

  // ─── Controls ────────────────────────────────────────────────────────────────

  /// Toggle local microphone mute (speakers only).
  Future<void> toggleMute() async {
    if (!isSpeaker) return;
    await _audioService.toggleMute();
    _isMuted = _audioService.isMuted;
    notifyListeners();
  }

  /// Raise hand to request speaker role (listeners only).
  Future<void> raiseHand() async {
    if (_currentRoom == null || isSpeaker) return;
    try {
      _socketService.raiseHand(_currentRoom!.id);
      _isHandRaised = true;

      // Optimistically update local participant
      _updateLocalParticipant(isHandRaised: true);
      notifyListeners();
    } catch (e) {
      Logger.error('VoiceRoomProvider: Failed to raise hand', e);
      _error = 'Failed to raise hand';
      notifyListeners();
    }
  }

  /// Lower hand (cancel raise hand request).
  Future<void> lowerHand() async {
    if (_currentRoom == null) return;
    _isHandRaised = false;
    _updateLocalParticipant(isHandRaised: false);
    notifyListeners();
  }

  /// Promote a listener to speaker (host only).
  Future<void> promoteToSpeaker(String targetUserId) async {
    if (_currentRoom == null || !isHost) return;
    try {
      await _apiService.post(
        '/voice-rooms/${_currentRoom!.id}/promote',
        data: {'targetUserId': targetUserId},
      );
      Logger.info('VoiceRoomProvider: Promoted $targetUserId to speaker');
    } catch (e) {
      Logger.error('VoiceRoomProvider: Failed to promote user', e);
      _error = 'Failed to promote user';
      notifyListeners();
    }
  }

  /// Demote a speaker to listener (host only).
  Future<void> demoteToListener(String targetUserId) async {
    if (_currentRoom == null || !isHost) return;
    try {
      await _apiService.post(
        '/voice-rooms/${_currentRoom!.id}/demote',
        data: {'targetUserId': targetUserId},
      );
      Logger.info('VoiceRoomProvider: Demoted $targetUserId to listener');
    } catch (e) {
      Logger.error('VoiceRoomProvider: Failed to demote user', e);
      _error = 'Failed to demote user';
      notifyListeners();
    }
  }

  // ─── Chat ────────────────────────────────────────────────────────────────────

  /// Send a text chat message in the current voice room.
  Future<void> sendChatMessage(String message) async {
    if (_currentRoom == null) throw Exception('Not in a voice room');
    _socketService.sendVoiceChat(_currentRoom!.id, message);
  }

  // ─── Socket Event Handlers ───────────────────────────────────────────────────

  void _handleParticipantJoined(Map<String, dynamic> data) {
    final roomId = data['roomId'] as String?;
    if (roomId == null || _currentRoom?.id != roomId) return;

    final participantData = data['participant'] as Map<String, dynamic>?;
    if (participantData == null) return;

    final participant = VoiceParticipant.fromJson(participantData);
    final updated = List<VoiceParticipant>.from(_currentRoom!.participants);

    // Add if not already present
    if (!updated.any((p) => p.userId == participant.userId)) {
      updated.add(participant);
    }

    _currentRoom = _currentRoom!.copyWith(participants: updated);
    notifyListeners();
  }

  void _handleParticipantLeft(Map<String, dynamic> data) {
    final roomId = data['roomId'] as String?;
    final userId = data['userId'] as String?;
    if (roomId == null || userId == null || _currentRoom?.id != roomId) return;

    final updated = _currentRoom!.participants
        .where((p) => p.userId != userId)
        .toList();

    _currentRoom = _currentRoom!.copyWith(participants: updated);
    notifyListeners();
  }

  void _handleRoleChanged(Map<String, dynamic> data) {
    final roomId = data['roomId'] as String?;
    final userId = data['userId'] as String?;
    final roleStr = data['role'] as String?;
    if (roomId == null || userId == null || roleStr == null) return;
    if (_currentRoom?.id != roomId) return;

    final newRole = ParticipantRole.values.firstWhere(
      (r) => r.name == roleStr,
      orElse: () => ParticipantRole.listener,
    );

    // Update participant list
    final updated = _currentRoom!.participants.map((p) {
      if (p.userId == userId) {
        return p.copyWith(role: newRole, isHandRaised: false);
      }
      return p;
    }).toList();

    _currentRoom = _currentRoom!.copyWith(participants: updated);

    // If this is the current user, update local role and Agora
    if (userId == _currentUserId) {
      final wasListener = !isSpeaker;
      _myRole = newRole;
      _isHandRaised = false;

      if (newRole == ParticipantRole.speaker && wasListener) {
        _audioService.promoteToSpeaker();
        _isMuted = false;
      } else if (newRole == ParticipantRole.listener) {
        _audioService.demoteToListener();
        _isMuted = true;
      }
    }

    notifyListeners();
  }

  void _handleHandRaised(Map<String, dynamic> data) {
    final roomId = data['roomId'] as String?;
    final userId = data['userId'] as String?;
    if (roomId == null || userId == null || _currentRoom?.id != roomId) return;

    final updated = _currentRoom!.participants.map((p) {
      if (p.userId == userId) return p.copyWith(isHandRaised: true);
      return p;
    }).toList();

    _currentRoom = _currentRoom!.copyWith(participants: updated);
    notifyListeners();
  }

  void _handleChatMessage(Map<String, dynamic> data) {
    final roomId = data['roomId'] as String?;
    final messageData = data['message'] as Map<String, dynamic>?;
    if (roomId == null || messageData == null) return;
    if (_currentRoom?.id != roomId) return;

    final message = ChatMessage.fromJson(messageData);
    final updatedChat = List<ChatMessage>.from(_currentRoom!.chatHistory)
      ..add(message);

    _currentRoom = _currentRoom!.copyWith(chatHistory: updatedChat);
    notifyListeners();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  void _updateLocalParticipant({bool? isHandRaised}) {
    if (_currentRoom == null || _currentUserId == null) return;
    final updated = _currentRoom!.participants.map((p) {
      if (p.userId == _currentUserId) {
        return p.copyWith(isHandRaised: isHandRaised ?? p.isHandRaised);
      }
      return p;
    }).toList();
    _currentRoom = _currentRoom!.copyWith(participants: updated);
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _voiceEventSub?.cancel();
    _chatEventSub?.cancel();
    if (_currentRoom != null) {
      _socketService.leaveVoiceRoom(_currentRoom!.id);
    }
    super.dispose();
  }
}
