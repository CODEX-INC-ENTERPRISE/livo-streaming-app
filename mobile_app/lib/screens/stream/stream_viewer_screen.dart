import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/services/stream_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';
import '../../models/virtual_gift.dart';
import '../../providers/auth_provider.dart';
import '../../providers/stream_provider.dart';
import '../../widgets/stream/stream_chat_widget.dart';
import '../../widgets/stream/gift_sheet.dart';

/// Screen for viewers to watch a live stream.
///
/// Accepts [streamId] as a required argument. Joins the stream on the
/// backend, initialises Agora viewer mode, and provides real-time chat,
/// gift sending, and adaptive video quality.
class StreamViewerScreen extends StatefulWidget {
  final String streamId;

  const StreamViewerScreen({super.key, required this.streamId});

  @override
  State<StreamViewerScreen> createState() => _StreamViewerScreenState();
}

class _StreamViewerScreenState extends State<StreamViewerScreen> {
  final StreamService _streamService = StreamService();

  bool _isJoining = true;
  bool _isLeaving = false;
  String? _error;

  // Remote host UID from Agora
  int? _remoteUid;

  // Gift animation queue
  final List<VirtualGift> _giftQueue = [];
  VirtualGift? _currentGiftAnimation;

  // Subscriptions
  StreamSubscription? _remoteJoinedSub;
  StreamSubscription? _remoteOfflineSub;
  StreamSubscription? _giftEventSub;

  // Chat visibility toggle
  bool _showChat = true;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    WidgetsBinding.instance.addPostFrameCallback((_) => _joinStream());
  }

  Future<void> _joinStream() async {
    final streamProvider = context.read<LiveStreamProvider>();
    try {
      // 1. Join stream on backend
      final stream = await streamProvider.joinStream(widget.streamId);

      // 2. Initialize Agora and join as viewer
      await _streamService.initialize();

      _remoteJoinedSub = _streamService.onRemoteUserJoined.listen((uid) {
        if (mounted) setState(() => _remoteUid = uid);
      });

      _remoteOfflineSub = _streamService.onRemoteUserOffline.listen((uid) {
        if (mounted && _remoteUid == uid) {
          setState(() => _remoteUid = null);
        }
      });

      // Listen for gift events from socket
      _giftEventSub = context
          .read<LiveStreamProvider>()
          .currentStream
          ?.chatHistory
          .isEmpty == true
          ? null
          : null; // Gift events handled via WalletProvider / socket

      await _streamService.joinAsViewer(
        channelId: stream.agoraChannelId ?? stream.id,
        token: '', // Token provided by backend in production
      );

      if (mounted) setState(() => _isJoining = false);
    } catch (e) {
      Logger.error('Failed to join stream', e);
      if (mounted) {
        setState(() {
          _isJoining = false;
          _error = 'Failed to join stream. Please try again.';
        });
      }
    }
  }

  Future<void> _leaveStream() async {
    setState(() => _isLeaving = true);
    try {
      await _streamService.leaveChannel(isHost: false);
      await context.read<LiveStreamProvider>().leaveStream();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      Logger.error('Failed to leave stream', e);
      if (mounted) {
        setState(() => _isLeaving = false);
        Navigator.pop(context); // pop anyway
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

  @override
  void dispose() {
    _remoteJoinedSub?.cancel();
    _remoteOfflineSub?.cancel();
    _giftEventSub?.cancel();
    _streamService.leaveChannel(isHost: false);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _isJoining
          ? _buildLoadingView()
          : _error != null
              ? _buildErrorView()
              : _buildViewerView(),
    );
  }

  Widget _buildLoadingView() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: AppColors.primaryGreen),
          SizedBox(height: 16),
          Text('Joining stream...',
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

  Widget _buildViewerView() {
    return Consumer<LiveStreamProvider>(
      builder: (context, streamProvider, _) {
        final stream = streamProvider.currentStream;

        // Stream ended – notify and pop
        if (stream == null || stream.isEnded) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (ctx) => AlertDialog(
                  backgroundColor: AppColors.darkSurface,
                  title: const Text('Stream Ended',
                      style: TextStyle(color: Colors.white)),
                  content: const Text(
                    'The host has ended this stream.',
                    style: TextStyle(color: AppColors.darkTextSecondary),
                  ),
                  actions: [
                    ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        Navigator.pop(context);
                      },
                      child: const Text('OK'),
                    ),
                  ],
                ),
              );
            }
          });
        }

        final messages = stream?.chatHistory ?? [];
        final viewerCount = stream?.currentViewerCount ?? 0;
        final currentUserId =
            context.read<AuthProvider>().currentUser?.id ?? '';
        final isMuted = stream?.isUserMuted(currentUserId) ?? false;

        return Stack(
          children: [
            // Remote video (full screen)
            Positioned.fill(
              child: _remoteUid != null
                  ? _streamService.buildRemoteView(
                      channelId: stream?.agoraChannelId ?? widget.streamId,
                      remoteUid: _remoteUid!,
                    )
                  : Container(
                      color: Colors.black,
                      child: const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            CircularProgressIndicator(
                                color: AppColors.primaryGreen),
                            SizedBox(height: 12),
                            Text('Waiting for host...',
                                style: TextStyle(color: Colors.white70)),
                          ],
                        ),
                      ),
                    ),
            ),

            // Top bar
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 16,
              right: 16,
              child: _ViewerTopBar(
                viewerCount: viewerCount,
                hostName: stream?.hostId ?? '',
                isLeaving: _isLeaving,
                onLeave: _leaveStream,
                showChat: _showChat,
                onToggleChat: () =>
                    setState(() => _showChat = !_showChat),
              ),
            ),

            // Chat overlay
            if (_showChat)
              Positioned(
                left: 0,
                right: 80,
                bottom: 80,
                height: MediaQuery.of(context).size.height * 0.45,
                child: StreamChatWidget(
                  messages: messages,
                  showInput: true,
                  currentUserId: currentUserId,
                  isMuted: isMuted,
                ),
              ),

            // Bottom action bar: gift button
            Positioned(
              right: 12,
              bottom: MediaQuery.of(context).padding.bottom + 16,
              child: _ViewerActions(
                streamId: widget.streamId,
                onGiftSent: () {
                  // Optionally trigger animation from gift event
                },
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

class _ViewerTopBar extends StatelessWidget {
  final int viewerCount;
  final String hostName;
  final bool isLeaving;
  final VoidCallback onLeave;
  final bool showChat;
  final VoidCallback onToggleChat;

  const _ViewerTopBar({
    required this.viewerCount,
    required this.hostName,
    required this.isLeaving,
    required this.onLeave,
    required this.showChat,
    required this.onToggleChat,
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
        // Toggle chat
        GestureDetector(
          onTap: onToggleChat,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.5),
              shape: BoxShape.circle,
            ),
            child: Icon(
              showChat ? Icons.chat_bubble : Icons.chat_bubble_outline,
              color: Colors.white,
              size: 18,
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Leave button
        GestureDetector(
          onTap: isLeaving ? null : onLeave,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.5),
              shape: BoxShape.circle,
            ),
            child: isLeaving
                ? const Padding(
                    padding: EdgeInsets.all(8),
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.close, color: Colors.white, size: 20),
          ),
        ),
      ],
    );
  }
}

class _ViewerActions extends StatelessWidget {
  final String streamId;
  final VoidCallback? onGiftSent;

  const _ViewerActions({required this.streamId, this.onGiftSent});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Gift button
        GestureDetector(
          onTap: () => GiftSheet.show(
            context,
            streamId: streamId,
            onGiftSent: onGiftSent,
          ),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.giftGold.withOpacity(0.9),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.giftGold.withOpacity(0.4),
                  blurRadius: 8,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(Icons.card_giftcard,
                color: Colors.white, size: 26),
          ),
        ),
      ],
    );
  }
}
