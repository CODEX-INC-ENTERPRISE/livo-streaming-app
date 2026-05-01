import 'package:flutter/material.dart';
import 'package:provider/provider.dart' hide StreamProvider;
import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../models/stream.dart';
import '../../providers/stream_provider.dart';
import '../../providers/auth_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  static const int _pageSize = 20;
  int _page = 1;
  bool _isFetchingMore = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitial());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    _page = 1;
    await context.read<LiveStreamProvider>().loadActiveStreams(page: _page, limit: _pageSize);
  }

  Future<void> _onRefresh() async {
    _page = 1;
    await context.read<LiveStreamProvider>().loadActiveStreams(page: _page, limit: _pageSize, refresh: true);
  }

  void _onScroll() {
    if (_isFetchingMore) return;
    final provider = context.read<LiveStreamProvider>();
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (provider.hasMore && !provider.isLoading) {
        _fetchNextPage();
      }
    }
  }

  Future<void> _fetchNextPage() async {
    setState(() => _isFetchingMore = true);
    _page++;
    await context.read<LiveStreamProvider>().loadActiveStreams(page: _page, limit: _pageSize);
    if (mounted) setState(() => _isFetchingMore = false);
  }

  void _joinStream(LiveStream stream) {
    Navigator.pushNamed(context, AppRoutes.streamView, arguments: stream);
  }

  void _showStartStreamDialog() {
    final titleController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Start Streaming'),
        content: TextField(
          controller: titleController,
          decoration: const InputDecoration(
            labelText: 'Stream Title',
            hintText: 'Enter a title for your stream',
          ),
          maxLength: 100,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final title = titleController.text.trim();
              if (title.isEmpty) return;
              Navigator.pop(ctx);
              try {
                final stream = await context.read<LiveStreamProvider>().startStream(title);
                if (mounted) {
                  Navigator.pushNamed(context, AppRoutes.streamStart, arguments: stream);
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to start stream: $e')),
                  );
                }
              }
            },
            child: const Text('Start'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final streamProvider = context.watch<LiveStreamProvider>();
    final authProvider = context.watch<AuthProvider>();
    final isHost = authProvider.currentUser?.isHost ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Streams'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            tooltip: 'Notifications',
            onPressed: () => Navigator.pushNamed(context, AppRoutes.notifications),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _onRefresh,
        color: AppColors.primaryGreen,
        child: _buildBody(streamProvider),
      ),
      floatingActionButton: isHost
          ? FloatingActionButton(
              onPressed: _showStartStreamDialog,
              backgroundColor: AppColors.primaryGreen,
              tooltip: 'Start Stream',
              child: const Icon(Icons.videocam, color: AppColors.white),
            )
          : null,
    );
  }

  Widget _buildBody(LiveStreamProvider provider) {
    if (provider.isLoading && provider.activeStreams.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.error != null && provider.activeStreams.isEmpty) {
      return _ErrorView(message: provider.error!, onRetry: _loadInitial);
    }

    if (provider.activeStreams.isEmpty) {
      return _EmptyView(onStartStream: _showStartStreamDialog);
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: provider.activeStreams.length + (_isFetchingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == provider.activeStreams.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        return _StreamCard(
          stream: provider.activeStreams[index],
          onTap: () => _joinStream(provider.activeStreams[index]),
        );
      },
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
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _StreamThumbnail(stream: stream),
            Padding(
              padding: const EdgeInsets.all(12),
              child: _StreamInfo(stream: stream),
            ),
          ],
        ),
      ),
    );
  }
}

class _StreamThumbnail extends StatelessWidget {
  final LiveStream stream;

  const _StreamThumbnail({required this.stream});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Thumbnail image or placeholder
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Container(
            color: AppColors.darkBackground,
            child: const Center(
              child: Icon(Icons.videocam, size: 48, color: AppColors.mediumGrey),
            ),
          ),
        ),
        // LIVE badge
        Positioned(
          top: 8,
          left: 8,
          child: _LiveBadge(),
        ),
        // Viewer count overlay
        Positioned(
          bottom: 8,
          right: 8,
          child: _ViewerCountBadge(count: stream.currentViewerCount),
        ),
      ],
    );
  }
}

class _LiveBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.liveRed,
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 6, color: AppColors.white),
          SizedBox(width: 4),
          Text(
            'LIVE',
            style: TextStyle(
              color: AppColors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _ViewerCountBadge extends StatelessWidget {
  final int count;

  const _ViewerCountBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.black.withAlpha(153),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.visibility, size: 12, color: AppColors.white),
          const SizedBox(width: 4),
          Text(
            _formatCount(count),
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String _formatCount(int count) {
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}k';
    return count.toString();
  }
}

class _StreamInfo extends StatelessWidget {
  final LiveStream stream;

  const _StreamInfo({required this.stream});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Host avatar
        CircleAvatar(
          radius: 20,
          backgroundColor: AppColors.lightGrey,
          child: const Icon(Icons.person, color: AppColors.grey, size: 22),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stream title
              Text(
                stream.title,
                style: theme.textTheme.labelLarge,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              // Host name (abbreviated ID until host profiles are loaded)
              Text(
                'Host · ${_shortId(stream.hostId)}',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 4),
              // Stats row
              Row(
                children: [
                  Icon(Icons.people_outline, size: 13, color: AppColors.textSecondary),
                  const SizedBox(width: 3),
                  Text(
                    '${stream.currentViewerCount} watching',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(width: 12),
                  Icon(Icons.card_giftcard_outlined, size: 13, color: AppColors.giftGold),
                  const SizedBox(width: 3),
                  Text(
                    '${stream.totalGiftsReceived} gifts',
                    style: theme.textTheme.bodySmall,
                  ),
                  const Spacer(),
                  Text(
                    _formatDuration(stream.duration),
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _shortId(String id) => id.length > 8 ? id.substring(0, 8) : id;

  String _formatDuration(Duration d) {
    if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes.remainder(60)}m';
    return '${d.inMinutes}m';
  }
}

// ─── Empty / Error States ─────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  final VoidCallback onStartStream;

  const _EmptyView({required this.onStartStream});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.videocam_off_outlined, size: 72, color: AppColors.mediumGrey),
            const SizedBox(height: 16),
            Text(
              'No live streams right now',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Pull down to refresh or be the first to go live.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textTertiary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 72, color: AppColors.error),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.error,
                  ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
