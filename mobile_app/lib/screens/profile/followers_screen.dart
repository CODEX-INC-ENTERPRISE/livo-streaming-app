import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../models/user.dart';
import '../../providers/user_provider.dart';

/// Displays a paginated list of a user's followers or following.
///
/// Route: [AppRoutes.followers] or [AppRoutes.following]
/// Arguments: `Map<String, dynamic>` with keys:
///   - `userId` (String, required)
///   - `displayName` (String?, optional – used in the title)
///   - `mode` (String, 'followers' | 'following', defaults to 'followers')
class FollowersScreen extends StatefulWidget {
  final String userId;
  final String? displayName;
  final FollowListMode mode;

  const FollowersScreen({
    super.key,
    required this.userId,
    this.displayName,
    this.mode = FollowListMode.followers,
  });

  @override
  State<FollowersScreen> createState() => _FollowersScreenState();
}

enum FollowListMode { followers, following }

class _FollowersScreenState extends State<FollowersScreen> {
  final ScrollController _scrollController = ScrollController();

  List<User> _users = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  String? _error;
  int _page = 1;
  static const int _pageSize = 30;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadPage(reset: true);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isFetchingMore || !_hasMore) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadPage();
    }
  }

  Future<void> _loadPage({bool reset = false}) async {
    if (reset) {
      setState(() {
        _page = 1;
        _users = [];
        _hasMore = true;
        _isLoading = true;
        _error = null;
      });
    } else {
      if (_isFetchingMore) return;
      setState(() => _isFetchingMore = true);
    }

    try {
      final userProvider = context.read<UserProvider>();
      List<User> fetched;

      if (widget.mode == FollowListMode.followers) {
        fetched = await userProvider.getUserFollowers(
          widget.userId,
          page: _page,
          limit: _pageSize,
        );
      } else {
        fetched = await userProvider.getUserFollowing(
          widget.userId,
          page: _page,
          limit: _pageSize,
        );
      }

      if (mounted) {
        setState(() {
          if (reset) {
            _users = fetched;
          } else {
            _users = [..._users, ...fetched];
          }
          _hasMore = fetched.length >= _pageSize;
          _page++;
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load users';
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    }
  }

  String get _title {
    final name = widget.displayName ?? 'User';
    return widget.mode == FollowListMode.followers
        ? '$name\'s Followers'
        : '$name Following';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _users.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 56, color: AppColors.error),
            const SizedBox(height: 12),
            Text(_error!),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _loadPage(reset: true),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_users.isEmpty) {
      return _EmptyState(mode: widget.mode);
    }

    return RefreshIndicator(
      onRefresh: () => _loadPage(reset: true),
      color: AppColors.primaryGreen,
      child: ListView.builder(
        controller: _scrollController,
        itemCount: _users.length + (_isFetchingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _users.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _UserTile(
            user: _users[index],
            onTap: () => Navigator.pushNamed(
              context,
              AppRoutes.profile,
              arguments: _users[index].id,
            ),
          );
        },
      ),
    );
  }
}

// ─── User Tile ────────────────────────────────────────────────────────────────

class _UserTile extends StatelessWidget {
  final User user;
  final VoidCallback onTap;

  const _UserTile({required this.user, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: _Avatar(url: user.profilePictureUrl),
      title: Text(
        user.displayName,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: user.bio != null && user.bio!.isNotEmpty
          ? Text(
              user.bio!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textSecondary),
            )
          : null,
      trailing: user.isHost
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withAlpha(30),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primaryGreen),
              ),
              child: const Text(
                'HOST',
                style: TextStyle(
                  color: AppColors.primaryGreen,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            )
          : const Icon(Icons.chevron_right, color: AppColors.mediumGrey),
    );
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  final String? url;

  const _Avatar({this.url});

  @override
  Widget build(BuildContext context) {
    if (url != null && url!.isNotEmpty) {
      return CircleAvatar(
        radius: 24,
        backgroundColor: AppColors.lightGrey,
        child: ClipOval(
          child: CachedNetworkImage(
            imageUrl: url!,
            width: 48,
            height: 48,
            fit: BoxFit.cover,
            placeholder: (_, __) => const CircularProgressIndicator(),
            errorWidget: (_, __, ___) =>
                const Icon(Icons.person, color: AppColors.grey),
          ),
        ),
      );
    }
    return const CircleAvatar(
      radius: 24,
      backgroundColor: AppColors.lightGrey,
      child: Icon(Icons.person, color: AppColors.grey),
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final FollowListMode mode;

  const _EmptyState({required this.mode});

  @override
  Widget build(BuildContext context) {
    final isFollowers = mode == FollowListMode.followers;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isFollowers ? Icons.people_outline : Icons.person_add_outlined,
              size: 64,
              color: AppColors.mediumGrey,
            ),
            const SizedBox(height: 16),
            Text(
              isFollowers ? 'No followers yet' : 'Not following anyone yet',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
