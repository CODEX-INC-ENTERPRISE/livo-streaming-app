import 'dart:async';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/widgets.dart';
import '../config/env_config.dart';
import '../utils/logger.dart';

/// Agora streaming service for live video broadcast and viewing.
///
/// Hosts call [startBroadcasting], viewers call [joinAsViewer].
/// Both call [leaveChannel] when done.
class StreamService {
  static final StreamService _instance = StreamService._internal();
  factory StreamService() => _instance;
  StreamService._internal();

  RtcEngine? _engine;
  bool _isInitialized = false;

  // Stream controllers for Agora callbacks
  final StreamController<int> _remoteUserJoinedController =
      StreamController<int>.broadcast();
  final StreamController<int> _remoteUserOfflineController =
      StreamController<int>.broadcast();
  final StreamController<RtcStats> _statsController =
      StreamController<RtcStats>.broadcast();
  final StreamController<String> _errorController =
      StreamController<String>.broadcast();
  final StreamController<bool> _localVideoStateController =
      StreamController<bool>.broadcast();

  /// Fires when a remote user joins the channel (uid).
  Stream<int> get onRemoteUserJoined => _remoteUserJoinedController.stream;

  /// Fires when a remote user goes offline (uid).
  Stream<int> get onRemoteUserOffline => _remoteUserOfflineController.stream;

  /// Fires periodically with channel statistics.
  Stream<RtcStats> get onStats => _statsController.stream;

  /// Fires on Agora SDK errors.
  Stream<String> get onError => _errorController.stream;

  /// Fires when local video state changes (true = publishing).
  Stream<bool> get onLocalVideoState => _localVideoStateController.stream;

  bool get isInitialized => _isInitialized;

  // ─── Initialization ──────────────────────────────────────────────────────────

  /// Initialize the Agora RTC engine. Must be called before any other method.
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      _engine = createAgoraRtcEngine();
      await _engine!.initialize(RtcEngineContext(
        appId: EnvConfig.agoraAppId,
        channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
      ));

      _registerEventHandlers();

      // Enable video module
      await _engine!.enableVideo();

      _isInitialized = true;
      Logger.info('Agora RTC engine initialized');
    } catch (e) {
      Logger.error('Failed to initialize Agora engine', e);
      rethrow;
    }
  }

  void _registerEventHandlers() {
    _engine!.registerEventHandler(RtcEngineEventHandler(
      onError: (err, msg) {
        Logger.error('Agora error: $err - $msg');
        _errorController.add('$err: $msg');
      },
      onJoinChannelSuccess: (connection, elapsed) {
        Logger.info(
            'Joined Agora channel: ${connection.channelId} (${elapsed}ms)');
      },
      onLeaveChannel: (connection, stats) {
        Logger.info('Left Agora channel: ${connection.channelId}');
      },
      onUserJoined: (connection, remoteUid, elapsed) {
        Logger.info('Remote user joined: $remoteUid');
        _remoteUserJoinedController.add(remoteUid);
      },
      onUserOffline: (connection, remoteUid, reason) {
        Logger.info('Remote user offline: $remoteUid, reason: $reason');
        _remoteUserOfflineController.add(remoteUid);
      },
      onRtcStats: (connection, stats) {
        _statsController.add(stats);
      },
      onLocalVideoStateChanged: (source, state, reason) {
        final isPublishing = state == LocalVideoStreamState.localVideoStreamStateCapturing ||
            state == LocalVideoStreamState.localVideoStreamStateEncoding;
        _localVideoStateController.add(isPublishing);
      },
      onRemoteVideoStateChanged: (connection, remoteUid, state, reason, elapsed) {
        Logger.debug('Remote video state changed: uid=$remoteUid state=$state');
      },
      onNetworkQuality: (connection, remoteUid, txQuality, rxQuality) {
        Logger.debug('Network quality: tx=$txQuality rx=$rxQuality');
      },
    ));
  }

  // ─── Host: Start Broadcasting ────────────────────────────────────────────────

  /// Start broadcasting as a host.
  ///
  /// [channelId] and [token] come from the backend stream start response.
  /// [uid] is the local user's numeric Agora UID (0 = auto-assign).
  Future<void> startBroadcasting({
    required String channelId,
    required String token,
    int uid = 0,
  }) async {
    await _ensureInitialized();

    try {
      // Set role to broadcaster
      await _engine!.setClientRole(role: ClientRoleType.clientRoleBroadcaster);

      // Configure video encoder: 1280x720, 30fps, 2000kbps
      await _engine!.setVideoEncoderConfiguration(const VideoEncoderConfiguration(
        dimensions: VideoDimensions(width: 1280, height: 720),
        frameRate: 30,
        bitrate: 2000,
        orientationMode: OrientationMode.orientationModeAdaptive,
        degradationPreference: DegradationPreference.maintainQuality,
      ));

      // Enable local video preview
      await _engine!.startPreview();

      // Join channel as broadcaster
      await _engine!.joinChannel(
        token: token,
        channelId: channelId,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          publishCameraTrack: true,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: false,
          autoSubscribeVideo: false,
        ),
      );

      Logger.info('Started broadcasting on channel: $channelId');
    } catch (e) {
      Logger.error('Failed to start broadcasting', e);
      rethrow;
    }
  }

  // ─── Viewer: Join Stream ─────────────────────────────────────────────────────

  /// Join a stream as a viewer (audience role).
  ///
  /// [channelId] and [token] come from the backend stream join response.
  Future<void> joinAsViewer({
    required String channelId,
    required String token,
    int uid = 0,
  }) async {
    await _ensureInitialized();

    try {
      // Set role to audience
      await _engine!.setClientRole(role: ClientRoleType.clientRoleAudience);

      // Join channel as audience
      await _engine!.joinChannel(
        token: token,
        channelId: channelId,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: ClientRoleType.clientRoleAudience,
          publishCameraTrack: false,
          publishMicrophoneTrack: false,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        ),
      );

      Logger.info('Joined stream as viewer on channel: $channelId');
    } catch (e) {
      Logger.error('Failed to join stream as viewer', e);
      rethrow;
    }
  }

  // ─── Leave Channel ───────────────────────────────────────────────────────────

  /// Leave the current Agora channel and stop preview if hosting.
  Future<void> leaveChannel() async {
    if (!_isInitialized || _engine == null) return;

    try {
      await _engine!.stopPreview();
      await _engine!.leaveChannel();
      Logger.info('Left Agora channel');
    } catch (e) {
      Logger.error('Failed to leave Agora channel', e);
      rethrow;
    }
  }

  // ─── Camera / Mic Controls ───────────────────────────────────────────────────

  Future<void> muteLocalAudio(bool mute) async {
    await _engine?.muteLocalAudioStream(mute);
  }

  Future<void> muteLocalVideo(bool mute) async {
    await _engine?.muteLocalVideoStream(mute);
  }

  Future<void> switchCamera() async {
    await _engine?.switchCamera();
  }

  // ─── Widget Builders ─────────────────────────────────────────────────────────

  /// Returns a widget that renders the local camera preview (host).
  Widget buildLocalView() {
    return AgoraVideoView(
      controller: VideoViewController(
        rtcEngine: _engine!,
        canvas: const VideoCanvas(uid: 0),
      ),
    );
  }

  /// Returns a widget that renders a remote user's video (viewer).
  Widget buildRemoteView({required String channelId, required int remoteUid}) {
    return AgoraVideoView(
      controller: VideoViewController.remote(
        rtcEngine: _engine!,
        canvas: VideoCanvas(uid: remoteUid),
        connection: RtcConnection(channelId: channelId),
      ),
    );
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  Future<void> dispose() async {
    if (_engine != null) {
      await leaveChannel();
      await _engine!.release();
      _engine = null;
      _isInitialized = false;
    }
    await _remoteUserJoinedController.close();
    await _remoteUserOfflineController.close();
    await _statsController.close();
    await _errorController.close();
    await _localVideoStateController.close();
    Logger.info('StreamService disposed');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  Future<void> _ensureInitialized() async {
    if (!_isInitialized) {
      await initialize();
    }
  }
}
