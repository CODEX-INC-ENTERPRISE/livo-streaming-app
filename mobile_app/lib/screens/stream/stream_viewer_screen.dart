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
import '../../providers/user_provider.dart';
import '../../widgets/stream/gift_sheet.dart';

class StreamViewerScreen extends StatefulWidget {
  final String streamId;
  const StreamViewerScreen({super.key, required this.streamId});

  @override
  State<StreamViewerScreen> createState() => _StreamViewerScreenState();
}

class _StreamViewerScreenState extends State<StreamViewerScreen> {
  final StreamService _streamService = StreamService();
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _chatFocus = FocusNode();

  bool _isJoining = true;
  bool _isLeaving = false;
  String? _error;
  int? _remoteUid;
  bool _isFollowing = false;
  bool _isSendingMessage = false;

  final List<VirtualGift> _giftQueue = [];
  VirtualGift? _currentGiftAnimation;

  StreamSubscription? _remoteJoinedSub;
  StreamSubscription? _remoteOfflineSub;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    WidgetsBinding.instance.addPostFrameCallback((_) => _joinStream());
  }

  Future<void> _joinStream() async {
    final streamProvider = context.read<LiveStreamProvider>();
    try {
      final stream = await streamProvider.joinStream(widget.streamId);

      // Reset engine in case of stale singleton state
      await _streamService.reset();
      await _streamService.initialize();
      _remoteJoinedSub = _streamService.onRemoteUserJoined.listen((uid) {
        if (mounted) setState(() => _remoteUid = uid);
      });
      _remoteOfflineSub = _streamService.onRemoteUserOffline.listen((uid) {
        if (mounted && _remoteUid == uid) setState(() => _remoteUid = null);
      });
      await _streamService.joinAsViewer(
        channelId: stream.agoraChannelId ?? stream.id,
        token: stream.agoraToken ?? '',
      );
      if (mounted) setState(() => _isJoining = false);
    } catch (e) {
      Logger.error('Failed to join stream', e);
      if (mounted) setState(() { _isJoining = false; _error = 'Failed to join stream.'; });
    }
  }

  Future<void> _leaveStream() async {
    setState(() => _isLeaving = true);
    try {
      await _streamService.leaveChannel(isHost: false);
      if (mounted) {
        await context.read<LiveStreamProvider>().leaveStream();
        Navigator.pop(context);
      }
    } catch (e) {
      Logger.error('Failed to leave stream', e);
      if (mounted) Navigator.pop(context);
    }
  }

  Future<void> _sendMessage() async {
    final text = _chatController.text.trim();
    if (text.isEmpty || _isSendingMessage) return;
    setState(() => _isSendingMessage = true);
    try {
      await context.read<LiveStreamProvider>().sendChatMessage(text);
      _chatController.clear();
      _scrollToBottom();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send message')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSendingMessage = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _toggleFollow(String hostId) async {
    final userProvider = context.read<UserProvider>();
    try {
      if (_isFollowing) {
        await userProvider.unfollowUser(hostId);
      } else {
        await userProvider.followUser(hostId);
      }
      if (mounted) setState(() => _isFollowing = !_isFollowing);
    } catch (_) {}
  }

  void _playNextGift() {
    if (_giftQueue.isEmpty) { setState(() => _currentGiftAnimation = null); return; }
    setState(() => _currentGiftAnimation = _giftQueue.removeAt(0));
  }

  @override
  void dispose() {
    _remoteJoinedSub?.cancel();
    _remoteOfflineSub?.cancel();
    _streamService.leaveChannel(isHost: false);
    _chatController.dispose();
    _scrollController.dispose();
    _chatFocus.dispose();
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isJoining) return _buildLoading();
    if (_error != null) return _buildError();
    return _buildViewer();
  }

  Widget _buildLoading() => const Scaffold(
    backgroundColor: Colors.black,
    body: Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        CircularProgressIndicator(color: AppColors.primaryGreen),
        SizedBox(height: 16),
        Text('Joining stream...', style: TextStyle(color: Colors.white, fontSize: 16)),
      ]),
    ),
  );

  Widget _buildError() => Scaffold(
    backgroundColor: Colors.black,
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 48),
          const SizedBox(height: 16),
          Text(_error!, style: const TextStyle(color: Colors.white), textAlign: TextAlign.center),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: () => Navigator.pop(context), child: const Text('Go Back')),
        ]),
      ),
    ),
  );

  Widget _buildViewer() {
    return Consumer<LiveStreamProvider>(
      builder: (context, streamProvider, _) {
        final stream = streamProvider.currentStream;

        // Stream ended
        if (stream != null && stream.isEnded) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            showDialog(
              context: context,
              barrierDismissible: false,
              builder: (ctx) => AlertDialog(
                backgroundColor: AppColors.darkSurface,
                title: const Text('Stream Ended', style: TextStyle(color: Colors.white)),
                content: const Text('The host has ended this stream.',
                    style: TextStyle(color: AppColors.darkTextSecondary)),
                actions: [ElevatedButton(
                  onPressed: () { Navigator.pop(ctx); Navigator.pop(context); },
                  child: const Text('OK'),
                )],
              ),
            );
          });
        }

        final messages = stream?.chatHistory ?? [];
        final viewerCount = stream?.currentViewerCount ?? 0;
        final currentUserId = context.read<AuthProvider>().currentUser?.id ?? '';
        final isMuted = stream?.isUserMuted(currentUserId) ?? false;
        final hostName = stream?.hostName ?? 'Host';
        final hostAvatar = stream?.hostAvatarUrl ?? '';
        final hostId = stream?.hostId ?? '';
        final streamTitle = stream?.title ?? '';

        return Scaffold(
          backgroundColor: Colors.black,
          resizeToAvoidBottomInset: true,
          body: Stack(
            children: [
              // ── Full-screen video ──────────────────────────────────────────
              Positioned.fill(
                child: _remoteUid != null
                    ? _streamService.buildRemoteView(
                        channelId: stream?.agoraChannelId ?? widget.streamId,
                        remoteUid: _remoteUid!,
                      )
                    : Container(
                        color: Colors.black,
                        child: const Center(
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            CircularProgressIndicator(color: AppColors.primaryGreen),
                            SizedBox(height: 12),
                            Text('Waiting for host...', style: TextStyle(color: Colors.white70)),
                          ]),
                        ),
                      ),
              ),

              // ── Top host info bar ──────────────────────────────────────────
              Positioned(
                top: MediaQuery.of(context).padding.top + 8,
                left: 12,
                right: 12,
                child: _HostInfoBar(
                  hostName: hostName,
                  hostAvatar: hostAvatar,
                  hostId: hostId,
                  streamTitle: streamTitle,
                  viewerCount: viewerCount,
                  isFollowing: _isFollowing,
                  isLeaving: _isLeaving,
                  onFollow: () => _toggleFollow(hostId),
                  onLeave: _leaveStream,
                ),
              ),

              // ── Chat messages ──────────────────────────────────────────────
              Positioned(
                left: 0,
                right: 0,
                bottom: 72,
                height: MediaQuery.of(context).size.height * 0.42,
                child: _ChatOverlay(
                  messages: messages,
                  scrollController: _scrollController,
                  currentUserId: currentUserId,
                ),
              ),

              // ── Like button (right side) ───────────────────────────────────
              const Positioned(
                right: 12,
                bottom: 140,
                child: _LikeButton(),
              ),

              // ── Bottom input bar ───────────────────────────────────────────
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _BottomBar(
                  controller: _chatController,
                  focusNode: _chatFocus,
                  isMuted: isMuted,
                  isSending: _isSendingMessage,
                  streamId: widget.streamId,
                  onSend: _sendMessage,
                  onGiftSent: _playNextGift,
                ),
              ),

              // ── Gift animation overlay ─────────────────────────────────────
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
          ),
        );
      },
    );
  }
}

// ─── Host info bar ────────────────────────────────────────────────────────────

class _HostInfoBar extends StatelessWidget {
  final String hostName;
  final String hostAvatar;
  final String hostId;
  final String streamTitle;
  final int viewerCount;
  final bool isFollowing;
  final bool isLeaving;
  final VoidCallback onFollow;
  final VoidCallback onLeave;

  const _HostInfoBar({
    required this.hostName,
    required this.hostAvatar,
    required this.hostId,
    required this.streamTitle,
    required this.viewerCount,
    required this.isFollowing,
    required this.isLeaving,
    required this.onFollow,
    required this.onLeave,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.darkBorder,
              backgroundImage: hostAvatar.isNotEmpty ? NetworkImage(hostAvatar) : null,
              child: hostAvatar.isEmpty
                  ? Text(hostName.isNotEmpty ? hostName[0].toUpperCase() : 'H',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))
                  : null,
            ),
            const SizedBox(width: 8),

            // Name + diamonds
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(
                      hostName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        fontFamily: 'PlusJakartaSans',
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text('🔥', style: TextStyle(fontSize: 13)),
                  ]),
                  Row(children: [
                    const Icon(Icons.favorite, color: AppColors.primaryGreen, size: 12),
                    const SizedBox(width: 3),
                    Text(
                      _formatCount(viewerCount * 63), // simulated diamond count
                      style: const TextStyle(
                        color: AppColors.primaryGreen,
                        fontSize: 12,
                        fontFamily: 'PlusJakartaSans',
                      ),
                    ),
                  ]),
                ],
              ),
            ),

            // Follow button
            GestureDetector(
              onTap: onFollow,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: isFollowing ? Colors.transparent : AppColors.primaryGreen,
                  borderRadius: BorderRadius.circular(20),
                  border: isFollowing
                      ? Border.all(color: Colors.white54)
                      : null,
                ),
                child: Text(
                  isFollowing ? 'Following' : '+ Follow',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'PlusJakartaSans',
                  ),
                ),
              ),
            ),

            const SizedBox(width: 10),

            // Viewer avatars + count
            _ViewerAvatarStack(count: viewerCount),

            const SizedBox(width: 10),

            // Close button
            GestureDetector(
              onTap: isLeaving ? null : onLeave,
              child: isLeaving
                  ? const SizedBox(
                      width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.close, color: Colors.white, size: 22),
            ),
          ],
        ),

        const SizedBox(height: 6),

        // Daily ranking badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.45),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('🔥', style: TextStyle(fontSize: 12)),
              SizedBox(width: 4),
              Text(
                'Daily Ranking',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontFamily: 'PlusJakartaSans',
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 6),

        // LIVE badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.liveRed,
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Text(
            'Live',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 12,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }

  String _formatCount(int n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return '$n';
  }
}

// ─── Viewer avatar stack ──────────────────────────────────────────────────────

class _ViewerAvatarStack extends StatelessWidget {
  final int count;
  const _ViewerAvatarStack({required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 44,
          height: 24,
          child: Stack(
            children: [
              Positioned(
                left: 0,
                child: CircleAvatar(
                  radius: 12,
                  backgroundColor: Color(0xFF4CAF50),
                  child: Icon(Icons.person, size: 14, color: Colors.white),
                ),
              ),
              Positioned(
                left: 16,
                child: CircleAvatar(
                  radius: 12,
                  backgroundColor: Color(0xFF2196F3),
                  child: Icon(Icons.person, size: 14, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 4),
        Text(
          count > 100 ? '100+' : '$count',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            fontFamily: 'PlusJakartaSans',
          ),
        ),
      ],
    );
  }
}

// ─── Chat overlay ─────────────────────────────────────────────────────────────

class _ChatOverlay extends StatelessWidget {
  final List messages;
  final ScrollController scrollController;
  final String currentUserId;

  const _ChatOverlay({
    required this.messages,
    required this.scrollController,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) return const SizedBox.shrink();
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final msg = messages[index];
        final isJoin = msg.type == 'join';
        final isOwn = msg.senderId == currentUserId;

        if (isJoin) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: Colors.white.withValues(alpha: 0.15),
                child: const Icon(Icons.sentiment_satisfied_alt,
                    color: Colors.white70, size: 16),
              ),
              const SizedBox(width: 8),
              RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 13, fontFamily: 'PlusJakartaSans'),
                  children: [
                    TextSpan(
                      text: msg.senderName ?? 'Someone',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                    const TextSpan(
                      text: ' Joined',
                      style: TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
            ]),
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: isOwn
                    ? AppColors.primaryGreen.withValues(alpha: 0.6)
                    : Colors.white.withValues(alpha: 0.15),
                backgroundImage: (msg.senderAvatarUrl != null &&
                        (msg.senderAvatarUrl as String).isNotEmpty)
                    ? NetworkImage(msg.senderAvatarUrl as String)
                    : null,
                child: (msg.senderAvatarUrl == null ||
                        (msg.senderAvatarUrl as String).isEmpty)
                    ? Text(
                        (msg.senderName ?? 'U').isNotEmpty
                            ? (msg.senderName as String)[0].toUpperCase()
                            : 'U',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w700),
                      )
                    : null,
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      msg.senderName ?? 'User',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        fontFamily: 'PlusJakartaSans',
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      msg.message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontFamily: 'PlusJakartaSans',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Like button ──────────────────────────────────────────────────────────────

class _LikeButton extends StatefulWidget {
  const _LikeButton();
  @override
  State<_LikeButton> createState() => _LikeButtonState();
}

class _LikeButtonState extends State<_LikeButton>
    with SingleTickerProviderStateMixin {
  bool _liked = false;
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 200));
    _scale = Tween(begin: 1.0, end: 1.4)
        .chain(CurveTween(curve: Curves.elasticOut))
        .animate(_ctrl);
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  void _tap() {
    setState(() => _liked = !_liked);
    _ctrl.forward().then((_) => _ctrl.reverse());
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _tap,
      child: ScaleTransition(
        scale: _scale,
        child: Icon(
          _liked ? Icons.favorite : Icons.favorite_border,
          color: _liked ? AppColors.primaryGreen : Colors.white,
          size: 32,
        ),
      ),
    );
  }
}

// ─── Bottom bar ───────────────────────────────────────────────────────────────

class _BottomBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isMuted;
  final bool isSending;
  final String streamId;
  final VoidCallback onSend;
  final VoidCallback onGiftSent;

  const _BottomBar({
    required this.controller,
    required this.focusNode,
    required this.isMuted,
    required this.isSending,
    required this.streamId,
    required this.onSend,
    required this.onGiftSent,
  });

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 8, 12, bottom + 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
      ),
      child: Row(
        children: [
          // Chat input
          Expanded(
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                enabled: !isMuted,
                style: const TextStyle(color: Colors.white, fontSize: 14,
                    fontFamily: 'PlusJakartaSans'),
                decoration: InputDecoration(
                  hintText: isMuted ? 'You are muted' : 'Type...',
                  hintStyle: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 14,
                    fontFamily: 'PlusJakartaSans',
                  ),
                  border: InputBorder.none,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  counterText: '',
                  // Emoji icon inside field
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.sentiment_satisfied_alt,
                        color: Colors.white70, size: 20),
                    onPressed: () {},
                    padding: EdgeInsets.zero,
                  ),
                ),
                onSubmitted: (_) => onSend(),
              ),
            ),
          ),

          const SizedBox(width: 10),

          // Emoji reaction button
          _BarIcon(
            icon: Icons.sentiment_satisfied_alt_outlined,
            onTap: () {},
          ),

          const SizedBox(width: 8),

          // Gift button
          _BarIcon(
            icon: Icons.card_giftcard_outlined,
            onTap: () => GiftSheet.show(
              context,
              streamId: streamId,
              onGiftSent: onGiftSent,
            ),
          ),

          const SizedBox(width: 8),

          // Share button with viewer count badge
          Stack(
            clipBehavior: Clip.none,
            children: [
              _BarIcon(
                icon: Icons.reply_outlined,
                onTap: () => _shareStream(context),
              ),
              Positioned(
                top: -4,
                right: -4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.primaryGreen,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    '3',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _shareStream(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Share link copied!')),
    );
  }
}

class _BarIcon extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _BarIcon({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Icon(icon, color: Colors.white, size: 26),
    );
  }
}
