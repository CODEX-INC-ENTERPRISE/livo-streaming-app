import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../models/stream.dart';
import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/stream_provider.dart';
import '../../providers/user_provider.dart';

/// Displays a user's public profile.
///
/// Pass [userId] as a route argument. When [userId] matches the currently
/// authenticated user the screen shows an "Edit" button; otherwise it shows
/// a Follow / Unfollow button.
///
/// Route: [AppRoutes.profile]
/// Arguments: `String userId`
class ProfileScreen extends StatefulWidget {
  final String userId;

  const ProfileScreen({super.key, required this.userId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  User? _user;
  List<LiveStream> _pastStreams = [];
  bool _isLoading = true;
  bool _isFollowLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final userProvider = context.read<UserProvider>();
      final streamProvider = context.read<LiveStreamProvider>();

      final user = await userProvider.loadUserProfile(widget.userId);
      final streams = await streamProvider.loadUserStreams(widget.userId);

      if (mounted) {
        setState(() {
          _user = user;
          _pastStreams = streams;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load profile';
          _isLoading = false;
        });
      }
    }
  }

  bool get _isOwnProfile {
    final currentUser = context.read<AuthProvider>().currentUser;
    return currentUser?.id == widget.userId;
  }

  bool _isFollowing(AuthProvider auth) =>
      auth.currentUser?.followingIds.contains(widget.userId) ?? false;

  Future<void> _toggleFollow() async {
    final auth = context.read<AuthProvider>();
    final userProvider = context.read<UserProvider>();
    final following = _isFollowing(auth);

    setState(() => _isFollowLoading = true);
    try {
      if (following) {
        await userProvider.unfollowUser(widget.userId);
        // Optimistically update local user state
        if (auth.currentUser != null) {
          final updated = auth.currentUser!.copyWith(
            followingIds: List<String>.from(auth.currentUser!.followingIds)
              ..remove(widget.userId),
          );
          auth.updateLocalUser(updated);
        }
      } else {
        await userProvider.followUser(widget.userId);
        if (auth.currentUser != null) {
          final updated = auth.currentUser!.copyWith(
            followingIds: List<String>.from(auth.currentUser!.followingIds)
              ..add(widget.userId),
          );
          auth.updateLocalUser(updated);
        }
      }
      // Refresh profile to get updated follower count
      await _loadData();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Action failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isFollowLoading = false);
    }
  }

  void _navigateToFollowers() {
    Navigator.pushNamed(
      context,
      AppRoutes.followers,
      arguments: {'userId': widget.userId, 'displayName': _user?.displayName},
    );
  }

  void _navigateToFollowing() {
    Navigator.pushNamed(
      context,
      AppRoutes.following,
      arguments: {'userId': widget.userId, 'displayName': _user?.displayName},
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_error != null || _user == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text(_error ?? 'User not found'),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final auth = context.watch<AuthProvider>();
    final isOwn = _isOwnProfile;
    final following = _isFollowing(auth);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primaryGreen,
        child: CustomScrollView(
          slivers: [
            _ProfileAppBar(
              user: _user!,
              isOwnProfile: isOwn,
              isFollowing: following,
              isFollowLoading: _isFollowLoading,
              onFollow: _toggleFollow,
              onEdit: () => Navigator.pushNamed(context, AppRoutes.editProfile)
                  .then((_) => _loadData()),
            ),
            SliverToBoxAdapter(
              child: _ProfileStats(
                user: _user!,
                onFollowersTap: _navigateToFollowers,
                onFollowingTap: _navigateToFollowing,
              ),
            ),
            if (_user!.bio != null && _user!.bio!.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    _user!.bio!,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ),
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Past Streams',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
              ),
            ),
            _pastStreams.isEmpty
                ? const SliverToBoxAdapter(child: _EmptyStreams())
                : SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverGrid(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) => _PastStreamCard(
                          stream: _pastStreams[index],
                        ),
                        childCount: _pastStreams.length,
                      ),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 16 / 10,
                      ),
                    ),
                  ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

// ─── App Bar ──────────────────────────────────────────────────────────────────

class _ProfileAppBar extends StatelessWidget {
  final User user;
  final bool isOwnProfile;
  final bool isFollowing;
  final bool isFollowLoading;
  final VoidCallback onFollow;
  final VoidCallback onEdit;

  const _ProfileAppBar({
    required this.user,
    required this.isOwnProfile,
    required this.isFollowing,
    required this.isFollowLoading,
    required this.onFollow,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        background: _AvatarHeader(user: user),
      ),
      actions: [
        if (isOwnProfile)
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Edit Profile',
            onPressed: onEdit,
          )
        else
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: _FollowButton(
                isFollowing: isFollowing,
                isLoading: isFollowLoading,
                onTap: onFollow,
              ),
            ),
          ),
      ],
    );
  }
}

class _AvatarHeader extends StatelessWidget {
  final User user;

  const _AvatarHeader({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.darkBackground,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 48), // account for status bar
          _Avatar(url: user.profilePictureUrl, radius: 48),
          const SizedBox(height: 10),
          Text(
            user.displayName,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (user.isHost)
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'HOST',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

class _ProfileStats extends StatelessWidget {
  final User user;
  final VoidCallback onFollowersTap;
  final VoidCallback onFollowingTap;

  const _ProfileStats({
    required this.user,
    required this.onFollowersTap,
    required this.onFollowingTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _StatItem(
            label: 'Followers',
            value: _formatCount(user.followerCount),
            onTap: onFollowersTap,
          ),
          _Divider(),
          _StatItem(
            label: 'Following',
            value: _formatCount(user.followingCount),
            onTap: onFollowingTap,
          ),
        ],
      ),
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return count.toString();
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;

  const _StatItem({
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 36, color: AppColors.mediumGrey);
  }
}

// ─── Follow Button ────────────────────────────────────────────────────────────

class _FollowButton extends StatelessWidget {
  final bool isFollowing;
  final bool isLoading;
  final VoidCallback onTap;

  const _FollowButton({
    required this.isFollowing,
    required this.isLoading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }

    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        backgroundColor:
            isFollowing ? Colors.transparent : AppColors.primaryGreen,
        foregroundColor: isFollowing ? AppColors.primaryGreen : AppColors.white,
        side: const BorderSide(color: AppColors.primaryGreen),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(isFollowing ? 'Following' : 'Follow'),
    );
  }
}

// ─── Past Stream Card ─────────────────────────────────────────────────────────

class _PastStreamCard extends StatelessWidget {
  final LiveStream stream;

  const _PastStreamCard({required this.stream});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Container(color: AppColors.darkSurface),
          const Center(
            child: Icon(Icons.play_circle_outline,
                size: 36, color: AppColors.white),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(6),
              color: AppColors.black.withAlpha(153),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    stream.title,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${stream.peakViewerCount} viewers',
                    style: const TextStyle(
                      color: AppColors.mediumGrey,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  final String? url;
  final double radius;

  const _Avatar({this.url, required this.radius});

  @override
  Widget build(BuildContext context) {
    if (url != null && url!.isNotEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.darkSurface,
        child: ClipOval(
          child: CachedNetworkImage(
            imageUrl: url!,
            width: radius * 2,
            height: radius * 2,
            fit: BoxFit.cover,
            placeholder: (_, __) => const CircularProgressIndicator(),
            errorWidget: (_, __, ___) =>
                const Icon(Icons.person, color: AppColors.grey),
          ),
        ),
      );
    }
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.darkSurface,
      child: Icon(Icons.person, size: radius, color: AppColors.grey),
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyStreams extends StatelessWidget {
  const _EmptyStreams();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.videocam_off_outlined,
                size: 48, color: AppColors.mediumGrey),
            SizedBox(height: 8),
            Text(
              'No past streams',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
