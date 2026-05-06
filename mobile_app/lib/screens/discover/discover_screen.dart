import 'package:flutter/material.dart';
import 'package:provider/provider.dart' hide StreamProvider;
import '../../core/constants/app_routes.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/app_colors.dart';
import '../../models/user.dart';
import '../../models/voice_room.dart';
import '../../providers/user_provider.dart';

/// Discover screen – shows voice rooms, featured hosts, and a search bar.
///
/// Requirements: 11.4 (voice rooms list), general discover/search.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();

  bool _isSearching = false;
  String _searchQuery = '';

  // Voice rooms state
  List<VoiceRoom> _voiceRooms = [];
  bool _loadingRooms = false;
  String? _roomsError;

  // Featured hosts state
  List<User> _featuredHosts = [];
  bool _loadingHosts = false;

  // Search results state
  List<User> _searchResults = [];
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _loadData();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    await Future.wait([_loadVoiceRooms(), _loadFeaturedHosts()]);
  }

  Future<void> _loadVoiceRooms() async {
    setState(() {
      _loadingRooms = true;
      _roomsError = null;
    });
    try {
      final api = ApiService();
      final response = await api.get('/voice-rooms/active');
      if (response.statusCode == 200) {
        final body = response.data;
        List<dynamic> data;
        if (body is List) {
          data = body;
        } else if (body is Map && body.containsKey('voiceRooms')) {
          data = body['voiceRooms'] as List<dynamic>;
        } else {
          data = [];
        }
        setState(() {
          _voiceRooms = data
              .map((e) => VoiceRoom.fromJson(e as Map<String, dynamic>))
              .toList();
        });
      }
    } catch (_) {
      setState(() => _roomsError = 'Failed to load voice rooms');
    } finally {
      setState(() => _loadingRooms = false);
    }
  }

  Future<void> _loadFeaturedHosts() async {
    setState(() => _loadingHosts = true);
    try {
      final api = ApiService();
      final response = await api.get('/users/featured-hosts');
      if (response.statusCode == 200) {
        final body = response.data;
        List<dynamic> data;
        if (body is List) {
          data = body;
        } else if (body is Map && body.containsKey('hosts')) {
          data = body['hosts'] as List<dynamic>;
        } else {
          data = [];
        }
        setState(() {
          _featuredHosts = data
              .map((e) => User.fromJson(e as Map<String, dynamic>))
              .toList();
        });
      }
    } catch (_) {
      // Featured hosts are non-critical; fail silently
    } finally {
      setState(() => _loadingHosts = false);
    }
  }

  void _onSearchChanged() {
    final query = _searchController.text.trim();
    if (query == _searchQuery) return;
    _searchQuery = query;

    if (query.isEmpty) {
      setState(() {
        _isSearching = false;
        _searchResults = [];
      });
      return;
    }

    setState(() => _isSearching = true);
    _debounceSearch(query);
  }

  // Simple debounce via delayed future
  Future<void> _debounceSearch(String query) async {
    await Future.delayed(const Duration(milliseconds: 400));
    if (_searchQuery != query || !mounted) return;
    _runSearch(query);
  }

  Future<void> _runSearch(String query) async {
    setState(() => _searching = true);
    try {
      final results = await context.read<UserProvider>().searchUsers(query);
      if (mounted && _searchQuery == query) {
        setState(() => _searchResults = results);
      }
    } catch (_) {
      // Ignore search errors
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _clearSearch() {
    _searchController.clear();
    _searchFocus.unfocus();
    setState(() {
      _isSearching = false;
      _searchQuery = '';
      _searchResults = [];
    });
  }

  void _navigateToVoiceRoom(VoiceRoom room) {
    Navigator.pushNamed(context, AppRoutes.voiceRoom, arguments: room);
  }

  void _navigateToProfile(User user) {
    Navigator.pushNamed(context, AppRoutes.profile, arguments: user.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: _SearchBar(
            controller: _searchController,
            focusNode: _searchFocus,
            onClear: _clearSearch,
          ),
        ),
      ),
      body: _isSearching
          ? _SearchResults(
              results: _searchResults,
              isLoading: _searching,
              query: _searchQuery,
              onUserTap: _navigateToProfile,
            )
          : RefreshIndicator(
              onRefresh: _loadData,
              color: AppColors.primaryGreen,
              child: _DiscoverContent(
                voiceRooms: _voiceRooms,
                loadingRooms: _loadingRooms,
                roomsError: _roomsError,
                featuredHosts: _featuredHosts,
                loadingHosts: _loadingHosts,
                onVoiceRoomTap: _navigateToVoiceRoom,
                onHostTap: _navigateToProfile,
                onRetryRooms: _loadVoiceRooms,
              ),
            ),
    );
  }
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onClear;

  const _SearchBar({
    required this.controller,
    required this.focusNode,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        decoration: InputDecoration(
          hintText: 'Search hosts or voice rooms…',
          prefixIcon: const Icon(Icons.search, size: 20),
          suffixIcon: ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (_, value, __) => value.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: onClear,
                  )
                : const SizedBox.shrink(),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          isDense: true,
        ),
        textInputAction: TextInputAction.search,
      ),
    );
  }
}

// ─── Discover Content (non-search) ───────────────────────────────────────────

class _DiscoverContent extends StatelessWidget {
  final List<VoiceRoom> voiceRooms;
  final bool loadingRooms;
  final String? roomsError;
  final List<User> featuredHosts;
  final bool loadingHosts;
  final ValueChanged<VoiceRoom> onVoiceRoomTap;
  final ValueChanged<User> onHostTap;
  final VoidCallback onRetryRooms;

  const _DiscoverContent({
    required this.voiceRooms,
    required this.loadingRooms,
    required this.roomsError,
    required this.featuredHosts,
    required this.loadingHosts,
    required this.onVoiceRoomTap,
    required this.onHostTap,
    required this.onRetryRooms,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        // Featured Hosts section
        if (loadingHosts || featuredHosts.isNotEmpty)
          const _SectionHeader(title: 'Featured Hosts'),
        if (loadingHosts)
          const SizedBox(
            height: 100,
            child: Center(child: CircularProgressIndicator()),
          )
        else if (featuredHosts.isNotEmpty)
          _FeaturedHostsRow(hosts: featuredHosts, onTap: onHostTap),

        const SizedBox(height: 8),

        // Voice Rooms section
        const _SectionHeader(title: 'Voice Rooms'),
        if (loadingRooms)
          const SizedBox(
            height: 120,
            child: Center(child: CircularProgressIndicator()),
          )
        else if (roomsError != null)
          _SectionError(message: roomsError!, onRetry: onRetryRooms)
        else if (voiceRooms.isEmpty)
          const _SectionEmpty(
            icon: Icons.mic_none,
            message: 'No active voice rooms',
          )
        else
          ...voiceRooms.map(
            (room) => _VoiceRoomTile(room: room, onTap: () => onVoiceRoomTap(room)),
          ),
      ],
    );
  }
}

// ─── Section Helpers ──────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
    );
  }
}

class _SectionEmpty extends StatelessWidget {
  final IconData icon;
  final String message;

  const _SectionEmpty({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          Icon(icon, size: 48, color: AppColors.mediumGrey),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppColors.textTertiary),
          ),
        ],
      ),
    );
  }
}

class _SectionError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _SectionError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message,
                style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

// ─── Featured Hosts Row ───────────────────────────────────────────────────────

class _FeaturedHostsRow extends StatelessWidget {
  final List<User> hosts;
  final ValueChanged<User> onTap;

  const _FeaturedHostsRow({required this.hosts, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 100,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: hosts.length,
        separatorBuilder: (_, __) => const SizedBox(width: 16),
        itemBuilder: (context, index) {
          final host = hosts[index];
          return _HostAvatar(host: host, onTap: () => onTap(host));
        },
      ),
    );
  }
}

class _HostAvatar extends StatelessWidget {
  final User host;
  final VoidCallback onTap;

  const _HostAvatar({required this.host, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: AppColors.lightGrey,
              backgroundImage: host.profilePictureUrl != null
                  ? NetworkImage(host.profilePictureUrl!)
                  : null,
              child: host.profilePictureUrl == null
                  ? const Icon(Icons.person, color: AppColors.grey, size: 28)
                  : null,
            ),
            const SizedBox(height: 6),
            Text(
              host.displayName,
              style: Theme.of(context).textTheme.labelSmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Voice Room Tile ──────────────────────────────────────────────────────────

class _VoiceRoomTile extends StatelessWidget {
  final VoiceRoom room;
  final VoidCallback onTap;

  const _VoiceRoomTile({required this.room, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: AppColors.primaryGreen.withAlpha(30),
        child: const Icon(Icons.mic, color: AppColors.primaryGreen, size: 22),
      ),
      title: Text(room.name, style: theme.textTheme.labelLarge),
      subtitle: Text(
        '${room.participantCount} / ${room.participantLimit} participants',
        style: theme.textTheme.bodySmall,
      ),
      trailing: room.isFull
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.mediumGrey,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Full',
                style: TextStyle(fontSize: 11, color: AppColors.white),
              ),
            )
          : const Icon(Icons.chevron_right, color: AppColors.grey),
    );
  }
}

// ─── Search Results ───────────────────────────────────────────────────────────

class _SearchResults extends StatelessWidget {
  final List<User> results;
  final bool isLoading;
  final String query;
  final ValueChanged<User> onUserTap;

  const _SearchResults({
    required this.results,
    required this.isLoading,
    required this.query,
    required this.onUserTap,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (results.isEmpty && query.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.search_off, size: 56, color: AppColors.mediumGrey),
            const SizedBox(height: 12),
            Text(
              'No results for "$query"',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        final user = results[index];
        return _UserSearchTile(user: user, onTap: () => onUserTap(user));
      },
    );
  }
}

class _UserSearchTile extends StatelessWidget {
  final User user;
  final VoidCallback onTap;

  const _UserSearchTile({required this.user, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: AppColors.lightGrey,
        backgroundImage: user.profilePictureUrl != null
            ? NetworkImage(user.profilePictureUrl!)
            : null,
        child: user.profilePictureUrl == null
            ? const Icon(Icons.person, color: AppColors.grey)
            : null,
      ),
      title: Text(user.displayName),
      subtitle: Text(
        user.isHost ? 'Host · ${user.followerCount} followers' : '${user.followerCount} followers',
        style: Theme.of(context).textTheme.bodySmall,
      ),
      trailing: user.isHost
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.primaryGreen.withAlpha(30),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'Host',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.primaryGreen,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : null,
    );
  }
}
