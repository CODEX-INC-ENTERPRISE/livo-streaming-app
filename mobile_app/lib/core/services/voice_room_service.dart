import 'dart:async';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import '../config/env_config.dart';
import '../utils/logger.dart';

/// Agora audio-only service for voice rooms.
///
/// Hosts and speakers call [enableMicrophone], listeners call
/// [disableMicrophone]. All participants call [joinChannel] and
/// [leaveChannel].
class VoiceRoomService {
  static final VoiceRoomService _instance = VoiceRoomService._internal();
  factory VoiceRoomService() => _instance;
  VoiceRoomService._internal();

  RtcEngine? _engine;
  bool _isInitialized = false;
  bool _isMuted = false;

  // Stream controllers for Agora callbacks
  final StreamController<int> _userJoinedController =
      StreamController<int>.broadcast();
  final StreamController<int> _userOfflineController =
      StreamController<int>.broadcast();
  final StreamController<String> _errorController =
      StreamController<String>.broadcast();
  final StreamController<bool> _audioVolumeController =
      StreamController<bool>.broadcast();

  /// Fires when a remote user joins the channel (uid).
  Stream<int> get onUserJoined => _userJoinedController.stream;

  /// Fires when a remote user goes offline (uid).
  Stream<int> get onUserOffline => _userOfflineController.stream;

  /// Fires on Agora SDK errors.
  Stream<String> get onError => _errorController.stream;

  /// Fires when local audio state changes (true = active/unmuted).
  Stream<bool> get onAudioState => _audioVolumeController.stream;

  bool get isInitialized => _isInitialized;
  bool get isMuted => _isMuted;

  // ─── Initialization ──────────────────────────────────────────────────────────

  /// Initialize the Agora RTC engine in audio-only mode.
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      _engine = createAgoraRtcEngine();
      await _engine!.initialize(RtcEngineContext(
        appId: EnvConfig.agoraAppId,
        channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
      ));

      // Audio-only: disable video module
      await _engine!.disableVideo();
      await _engine!.enableAudio();

      _registerEventHandlers();

      _isInitialized = true;
      Logger.info('VoiceRoomService: Agora audio engine initialized');
    } catch (e) {
      Logger.error('VoiceRoomService: Failed to initialize Agora engine', e);
      rethrow;
    }
  }

  void _registerEventHandlers() {
    _engine!.registerEventHandler(RtcEngineEventHandler(
      onError: (err, msg) {
        Logger.error('VoiceRoomService Agora error: $err - $msg');
        _errorController.add('$err: $msg');
      },
      onJoinChannelSuccess: (connection, elapsed) {
        Logger.info(
            'VoiceRoomService: Joined channel ${connection.channelId} (${elapsed}ms)');
      },
      onLeaveChannel: (connection, stats) {
        Logger.info('VoiceRoomService: Left channel ${connection.channelId}');
      },
      onUserJoined: (connection, remoteUid, elapsed) {
        Logger.info('VoiceRoomService: Remote user joined: $remoteUid');
        _userJoinedController.add(remoteUid);
      },
      onUserOffline: (connection, remoteUid, reason) {
        Logger.info('VoiceRoomService: Remote user offline: $remoteUid');
        _userOfflineController.add(remoteUid);
      },
      onLocalAudioStateChanged: (connection, state, reason) {
        final isActive = state == LocalAudioStreamState.localAudioStreamStateRecording ||
            state == LocalAudioStreamState.localAudioStreamStateEncoding;
        _audioVolumeController.add(isActive);
      },
    ));
  }

  // ─── Join / Leave ────────────────────────────────────────────────────────────

  /// Join a voice room channel as a speaker (microphone enabled).
  Future<void> joinAsSpeaker({
    required String channelId,
    required String token,
    int uid = 0,
  }) async {
    await _ensureInitialized();
    try {
      await _engine!.setClientRole(role: ClientRoleType.clientRoleBroadcaster);
      await _engine!.joinChannel(
        token: token,
        channelId: channelId,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: true,
        ),
      );
      _isMuted = false;
      Logger.info('VoiceRoomService: Joined as speaker on channel: $channelId');
    } catch (e) {
      Logger.error('VoiceRoomService: Failed to join as speaker', e);
      rethrow;
    }
  }

  /// Join a voice room channel as a listener (microphone disabled).
  Future<void> joinAsListener({
    required String channelId,
    required String token,
    int uid = 0,
  }) async {
    await _ensureInitialized();
    try {
      await _engine!.setClientRole(role: ClientRoleType.clientRoleAudience);
      await _engine!.joinChannel(
        token: token,
        channelId: channelId,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleAudience,
          publishMicrophoneTrack: false,
          autoSubscribeAudio: true,
        ),
      );
      _isMuted = true;
      Logger.info('VoiceRoomService: Joined as listener on channel: $channelId');
    } catch (e) {
      Logger.error('VoiceRoomService: Failed to join as listener', e);
      rethrow;
    }
  }

  /// Leave the current channel.
  Future<void> leaveChannel() async {
    if (!_isInitialized || _engine == null) return;
    try {
      await _engine!.leaveChannel();
      _isMuted = false;
      Logger.info('VoiceRoomService: Left channel');
    } catch (e) {
      Logger.error('VoiceRoomService: Failed to leave channel', e);
      rethrow;
    }
  }

  // ─── Role Switching ──────────────────────────────────────────────────────────

  /// Promote to speaker: switch role and enable microphone.
  Future<void> promoteToSpeaker() async {
    if (!_isInitialized || _engine == null) return;
    try {
      await _engine!.setClientRole(role: ClientRoleType.clientRoleBroadcaster);
      await _engine!.muteLocalAudioStream(false);
      _isMuted = false;
      _audioVolumeController.add(true);
      Logger.info('VoiceRoomService: Promoted to speaker');
    } catch (e) {
      Logger.error('VoiceRoomService: Failed to promote to speaker', e);
      rethrow;
    }
  }

  /// Demote to listener: switch role and disable microphone.
  Future<void> demoteToListener() async {
    if (!_isInitialized || _engine == null) return;
    try {
      await _engine!.muteLocalAudioStream(true);
      await _engine!.setClientRole(role: ClientRoleType.clientRoleAudience);
      _isMuted = true;
      _audioVolumeController.add(false);
      Logger.info('VoiceRoomService: Demoted to listener');
    } catch (e) {
      Logger.error('VoiceRoomService: Failed to demote to listener', e);
      rethrow;
    }
  }

  // ─── Mute / Unmute ───────────────────────────────────────────────────────────

  /// Toggle local microphone mute state. Only effective for speakers.
  Future<void> toggleMute() async {
    if (!_isInitialized || _engine == null) return;
    _isMuted = !_isMuted;
    await _engine!.muteLocalAudioStream(_isMuted);
    _audioVolumeController.add(!_isMuted);
    Logger.debug('VoiceRoomService: Muted = $_isMuted');
  }

  Future<void> setMuted(bool muted) async {
    if (!_isInitialized || _engine == null) return;
    _isMuted = muted;
    await _engine!.muteLocalAudioStream(muted);
    _audioVolumeController.add(!muted);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  Future<void> dispose() async {
    if (_engine != null) {
      await leaveChannel();
      await _engine!.release();
      _engine = null;
      _isInitialized = false;
    }
    await _userJoinedController.close();
    await _userOfflineController.close();
    await _errorController.close();
    await _audioVolumeController.close();
    Logger.info('VoiceRoomService disposed');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  Future<void> _ensureInitialized() async {
    if (!_isInitialized) await initialize();
  }
}
