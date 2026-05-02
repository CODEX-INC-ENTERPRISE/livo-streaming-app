import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/services/api_service.dart';
import '../../core/services/stream_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';
import '../../models/virtual_gift.dart';
import '../../providers/auth_provider.dart';
import '../../providers/stream_provider.dart';
import '../../widgets/stream/stream_chat_widget.dart';
import '../../widgets/stream/gift_sheet.dart';
import '../../widgets/stream/moderation_menu.dart';

/// Screen for hosts to broadcast a live stream.
///
/// Accepts [streamTitle] as a required argument. The screen starts the
/// stream on the backend, initialises Agora broadcasting, and provides
/// real-time chat, gift animations, and moderation controls.
class StreamBroadcastScreen extends StatefulWidget {
  final String streamTitle;

  const StreamBroadcastScreen({super.key, required this.streamTitle});

  @override
  State<StreamBroadcastScreen> createState() => _StreamBroadcastScreenState();
}

class _StreamBroadcastScreenState extends State<StreamBroadcastScreen> {
  final StreamService _streamService = StreamService();

  bool _isStarting = true;
  bool _isEnding = false;
  bool _isMicMuted = false;
  bool _isCameraOff = false;
  String? _error;

  // Gift animation queue
  final List<VirtualGift> _giftQueue = [];
  VirtualGift? _currentGiftAnimation;
  StreamSubscription? _giftSub;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    WidgetsBinding.instance.addPostFrameCallback((_) => _startStream());
  }

  Future<void> _startStream() async {
    final streamProvider = context.read<LiveStreamProvider>();
    try {
      // 1. Start stream on backend
      final stream = await streamProvider.startStream(widget.streamTitle);

      // 2. Initialize Agora and start broadcasting
      await _streamService.initialize();
      await _streamService.startBroadcasting(
        channelId: stream.agoraChannelId ?? stream.id,
        token: '', // Token provided by backend in production
      );

      if (mounted) setState(() => _isStarting = false);
    } on ApiException catch (e) {
      Logger.error('Failed to start broadcast', e);
      if (!mounted) return;

      // Special case: already has an active stream — offer to end it
      if (e.statusCode == 400 && e.message.toLowerCase().contains('already has an active stream')) {
        setState(() => _isStarting = false);
        _showAlreadyActiveStreamDialog();
        return;
      }

      setState(() {
        _isStarting = false;
        _error = e.message;
      });
    } catch (e) {
      Logger.error('Failed to start broadcast', e);
      if (mounted) {
        setState(() {
          _isStarting = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  void _showAlreadyActiveStreamDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.darkSurface,
        title: const Text('Active Stream Found',
            style: TextStyle(color: Colors.white)),
        content: const Text(
          'You already have an active stream. Would you like to end it and start a new one?',
          style: TextStyle(color: AppColors.darkTextSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context); // go back
            },
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.mediumGrey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.liveRed),
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _isStarting = true);
              try {
                await context.read<LiveStreamProvider>().endStream();
                await _startStream();
              } catch (e) {
                if (mounted) {
                  setState(() {
                    _isStarting = false;
                    _error = 'Failed to end previous stream. Please try again.';
                  });
                }
              }
            },
            child: const Text('End & Start New'),
          ),
        ],
      ),
    );
  }

  Future<void> _endStream() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.darkSurface,
        title: const Text('End Stream?',
            style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to end the stream? All viewers will be disconnected.',
          style: TextStyle(color: AppColors.darkTextSecondary),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('End Stream'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isEnding = true);
    try {
      await _streamService.leaveChannel();
      await context.read<LiveStreamProvider>().endStream();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      Logger.error('Failed to end stream', e);
      if (mounted) {
        setState(() => _isEnding = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to end stream')),
        );
      }
    }
  }

  void _playNextGift() {
    if (_giftQueue.isEmpty) {
      setState(() => _currentGiftAnimation = null);
      return;
    }
    setState(() => _currentGiftAnimation = _giftQueue.removeAt(0));
  }

  void _openModerationMenu(String userId, String displayName) {
    final stream = context.read<LiveStreamProvider>().currentStream;
    if (stream == null) return;
    ModerationMenu.show(
      context,
      streamId: stream.id,
      targetUserId: userId,
      targetDisplayName: displayName,
      isHost: true,
    );
  }

  @override
  void dispose() {
    _giftSub?.cancel();
    _streamService.leaveChannel();
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _isStarting
          ? _buildLoadingView()
          : _error != null
              ? _buildErrorView()
              : _buildBroadcastView(),
    );
  }

  Widget _buildLoadingView() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: AppColors.primaryGreen),
          SizedBox(height: 16),
          Text('Starting stream...',
              style: TextStyle(color: Colors.white, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(_error!,
                style: const TextStyle(color: Colors.white),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBroadcastView() {
    return Consumer<LiveStreamProvider>(
      builder: (context, streamProvider, _) {
        final stream = streamProvider.currentStream;
        final messages = stream?.chatHistory ?? [];
        final viewerCount = stream?.currentViewerCount ?? 0;

        return Stack(
          children: [
            // Local camera preview (full screen)
            Positioned.fill(child: _streamService.buildLocalView()),

            // Top bar: LIVE badge + viewer count + end button
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 16,
              right: 16,
              child: _TopBar(
                viewerCount: viewerCount,
                streamTitle: widget.streamTitle,
                isEnding: _isEnding,
                onEnd: _endStream,
              ),
            ),

            // Chat overlay (bottom-left, 60% height)
            Positioned(
              left: 0,
              right: 80,
              bottom: 100,
              height: MediaQuery.of(context).size.height * 0.45,
              child: IgnorePointer(
                ignoring: false,
                child: StreamChatWidget(
                  messages: messages,
                  showInput: false,
                  currentUserId: context.read<AuthProvider>().currentUser?.id,
                  onUserTap: _openModerationMenu,
                ),
              ),
            ),

            // Right-side controls
            Positioned(
              right: 12,
              bottom: 120,
              child: _HostControls(
                isMicMuted: _isMicMuted,
                isCameraOff: _isCameraOff,
                onToggleMic: () async {
                  setState(() => _isMicMuted = !_isMicMuted);
                  await _streamService.muteLocalAudio(_isMicMuted);
                },
                onToggleCamera: () async {
                  setState(() => _isCameraOff = !_isCameraOff);
                  await _streamService.muteLocalVideo(_isCameraOff);
                },
                onSwitchCamera: () => _streamService.switchCamera(),
              ),
            ),

            // Gift animation overlay
            if (_currentGiftAnimation != null)
              Positioned(
                left: 16,
                bottom: 160,
                child: GiftAnimationOverlay(
                  gift: _currentGiftAnimation!,
                  onComplete: _playNextGift,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _TopBar extends StatelessWidget {
  final int viewerCount;
  final String streamTitle;
  final bool isEnding;
  final VoidCallback onEnd;

  const _TopBar({
    required this.viewerCount,
    required this.streamTitle,
    required this.isEnding,
    required this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // LIVE badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.liveRed,
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Text(
            'LIVE',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 12,
              letterSpacing: 1,
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Viewer count
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.5),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              const Icon(Icons.remove_red_eye,
                  color: Colors.white, size: 14),
              const SizedBox(width: 4),
              Text(
                '$viewerCount',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const Spacer(),
        // End stream button
        GestureDetector(
          onTap: isEnding ? null : onEnd,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.error,
              borderRadius: BorderRadius.circular(8),
            ),
            child: isEnding
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text(
                    'End',
                    style: TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700),
                  ),
          ),
        ),
      ],
    );
  }
}

class _HostControls extends StatelessWidget {
  final bool isMicMuted;
  final bool isCameraOff;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCamera;
  final VoidCallback onSwitchCamera;

  const _HostControls({
    required this.isMicMuted,
    required this.isCameraOff,
    required this.onToggleMic,
    required this.onToggleCamera,
    required this.onSwitchCamera,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ControlButton(
          icon: isMicMuted ? Icons.mic_off : Icons.mic,
          color: isMicMuted ? AppColors.error : Colors.white,
          onTap: onToggleMic,
          tooltip: isMicMuted ? 'Unmute' : 'Mute',
        ),
        const SizedBox(height: 12),
        _ControlButton(
          icon: isCameraOff ? Icons.videocam_off : Icons.videocam,
          color: isCameraOff ? AppColors.error : Colors.white,
          onTap: onToggleCamera,
          tooltip: isCameraOff ? 'Enable camera' : 'Disable camera',
        ),
        const SizedBox(height: 12),
        _ControlButton(
          icon: Icons.flip_camera_ios,
          color: Colors.white,
          onTap: onSwitchCamera,
          tooltip: 'Switch camera',
        ),
      ],
    );
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final String tooltip;

  const _ControlButton({
    required this.icon,
    required this.color,
    required this.onTap,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.5),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 22),
        ),
      ),
    );
  }
}
