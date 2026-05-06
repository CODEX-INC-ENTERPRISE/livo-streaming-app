import 'package:flutter/material.dart';
import 'package:provider/provider.dart' hide StreamProvider;
import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../models/stream.dart';
import '../../providers/auth_provider.dart';
import '../../providers/stream_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();
  static const int _pageSize = 20;
  int _page = 1;
  bool _isFetchingMore = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitial());
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    _page = 1;
    await context
        .read<LiveStreamProvider>()
        .loadActiveStreams(page: _page, limit: _pageSize);
  }

  Future<void> _onRefresh() async {
    _page = 1;
    await context
        .read<LiveStreamProvider>()
        .loadActiveStreams(page: _page, limit: _pageSize, refresh: true);
  }

  void _onScroll() {
    if (_isFetchingMore) return;
    final provider = context.read<LiveStreamProvider>();
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (provider.hasMore && !provider.isLoading) _fetchNextPage();
    }
  }

  Future<void> _fetchNextPage() async {
    setState(() => _isFetchingMore = true);
    _page++;
    await context
        .read<LiveStreamProvider>()
        .loadActiveStreams(page: _page, limit: _pageSize);
    if (mounted) setState(() => _isFetchingMore = false);
  }

  void _joinStream(LiveStream stream) {
    Navigator.pushNamed(context, AppRoutes.streamView, arguments: stream.id);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LiveStreamProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  // Logo
                  Image.asset(
                    'assets/images/home_logo.png',
                    height: 32,
                    errorBuilder: (_, __, ___) => RichText(
                      text: const TextSpan(
                        children: [
                          WidgetSpan(
                            child: Icon(Icons.play_arrow,
                                color: AppColors.primaryGreen, size: 28),
                          ),
                          TextSpan(
                            text: ' livo',
                            style: TextStyle(
                              color: AppColors.primaryGreen,
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'PlusJakartaSans',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(),
                  // Search button — navigates to discover tab via bottom nav
                  _IconCircleButton(
                    icon: Icons.search,
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.discover),
                  ),
                  const SizedBox(width: 10),
                  // Notification button
                  _IconCircleButton(
                    icon: Icons.notifications_outlined,
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.notifications),
                  ),
                ],
              ),
            ),

            // ── Tab bar ──────────────────────────────────────────────────────
            TabBar(
              controller: _tabController,
              labelColor: AppColors.textPrimary,
              unselectedLabelColor: AppColors.textSecondary,
              labelStyle: const TextStyle(
                fontFamily: 'PlusJakartaSans',
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
              unselectedLabelStyle: const TextStyle(
                fontFamily: 'PlusJakartaSans',
                fontWeight: FontWeight.w400,
                fontSize: 15,
              ),
              indicatorColor: AppColors.primaryGreen,
              indicatorWeight: 2.5,
              indicatorSize: TabBarIndicatorSize.label,
              dividerColor: Colors.transparent,
              tabs: const [
                Tab(text: 'Following'),
                Tab(text: 'For You'),
              ],
            ),

            // ── Content ──────────────────────────────────────────────────────
            Expanded(
              child: Builder(
                builder: (context) {
                  final followingIds =
                      context.watch<AuthProvider>().currentUser?.followingIds ?? [];
                  final followingStreams = provider.activeStreams
                      .where((s) => followingIds.contains(s.hostId))
                      .toList();

                  return TabBarView(
                    controller: _tabController,
                    children: [
                      // Following tab — only streams from followed hosts
                      _StreamGrid(
                        provider: provider,
                        streams: followingStreams,
                        scrollController: _scrollController,
                        isFetchingMore: _isFetchingMore,
                        onRefresh: _onRefresh,
                        onStreamTap: _joinStream,
                        onLoadInitial: _loadInitial,
                        emptyMessage: followingIds.isEmpty
                            ? 'Follow hosts to see their streams here'
                            : 'No live streams from people you follow',
                        emptyIcon: followingIds.isEmpty
                            ? Icons.person_add_outlined
                            : Icons.videocam_off_outlined,
                      ),
                      // For You tab — all streams
                      _StreamGrid(
                        provider: provider,
                        streams: provider.activeStreams,
                        scrollController: ScrollController(),
                        isFetchingMore: false,
                        onRefresh: _onRefresh,
                        onStreamTap: _joinStream,
                        onLoadInitial: _loadInitial,
                        emptyMessage: 'No live streams right now',
                        emptyIcon: Icons.videocam_off_outlined,
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Icon Circle Button ───────────────────────────────────────────────────────

class _IconCircleButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _IconCircleButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.mediumGrey, width: 1),
        ),
        child: Icon(icon, size: 20, color: AppColors.textPrimary),
      ),
    );
  }
}

// ─── Stream Grid ──────────────────────────────────────────────────────────────

class _StreamGrid extends StatelessWidget {
  final LiveStreamProvider provider;
  final List<LiveStream> streams;
  final ScrollController scrollController;
  final bool isFetchingMore;
  final Future<void> Function() onRefresh;
  final void Function(LiveStream) onStreamTap;
  final Future<void> Function() onLoadInitial;
  final String emptyMessage;
  final IconData emptyIcon;

  const _StreamGrid({
    required this.provider,
    required this.streams,
    required this.scrollController,
    required this.isFetchingMore,
    required this.onRefresh,
    required this.onStreamTap,
    required this.onLoadInitial,
    this.emptyMessage = 'No live streams right now',
    this.emptyIcon = Icons.videocam_off_outlined,
  });

  @override
  Widget build(BuildContext context) {
    if (provider.isLoading && provider.activeStreams.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.error != null && provider.activeStreams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 56, color: AppColors.error),
            const SizedBox(height: 12),
            Text(provider.error!),
            const SizedBox(height: 16),
            ElevatedButton(
                onPressed: onLoadInitial, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (streams.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        color: AppColors.primaryGreen,
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(
              child: Column(
                children: [
                  Icon(emptyIcon, size: 64, color: AppColors.mediumGrey),
                  const SizedBox(height: 12),
                  Text(emptyMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary)),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primaryGreen,
      child: GridView.builder(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 16,
          childAspectRatio: 0.62,
        ),
        itemCount: streams.length + (isFetchingMore ? 2 : 0),
        itemBuilder: (context, index) {
          if (index >= streams.length) {
            return const SizedBox.shrink();
          }
          final stream = streams[index];
          return _StreamCard(
            stream: stream,
            onTap: () => onStreamTap(stream),
          );
        },
      ),
    );
  }
}

// ─── Stream Card ──────────────────────────────────────────────────────────────

class _StreamCard extends StatelessWidget {
  final LiveStream stream;
  final VoidCallback onTap;

  const _StreamCard({required this.stream, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Thumbnail
        Expanded(
          child: GestureDetector(
            onTap: onTap,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Background image or dark placeholder
                  Container(color: const Color(0xFF2D2D2D)),

                  // Live badge
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.liveRed,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Live',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),

                  // Viewer count
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withAlpha(140),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.visibility,
                              size: 11, color: Colors.white),
                          const SizedBox(width: 3),
                          Text(
                            _formatCount(stream.currentViewerCount),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Title overlay at bottom
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(8, 20, 8, 8),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [Colors.black87, Colors.transparent],
                        ),
                      ),
                      child: Text(
                        stream.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        const SizedBox(height: 8),

        // Host info row
        Row(
          children: [
            // Host avatar
            CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.lightGrey,
              backgroundImage: stream.hostAvatarUrl != null &&
                      stream.hostAvatarUrl!.isNotEmpty
                  ? NetworkImage(stream.hostAvatarUrl!)
                  : null,
              child: (stream.hostAvatarUrl == null || stream.hostAvatarUrl!.isEmpty)
                  ? const Icon(Icons.person, size: 16, color: AppColors.grey)
                  : null,
            ),
            const SizedBox(width: 6),
            // Host name + followers
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stream.hostName ?? _shortHostName(stream.hostId),
                    style: const TextStyle(
                      fontFamily: 'PlusJakartaSans',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${_formatCount(stream.peakViewerCount)} Followers',
                    style: const TextStyle(
                      fontFamily: 'PlusJakartaSans',
                      fontSize: 10,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            // Watch Live button
            GestureDetector(
              onTap: onTap,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Watch\nLive',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}k';
    return count.toString();
  }

  String _shortHostName(String hostId) {
    if (hostId.length > 10) return 'Host ${hostId.substring(0, 6)}';
    return 'Host $hostId';
  }
}
