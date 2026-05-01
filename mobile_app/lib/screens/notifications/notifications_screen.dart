import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../models/notification.dart' as app;
import '../../providers/auth_provider.dart';
import '../../providers/notification_provider.dart';

/// Notifications screen – displays paginated notification list with unread
/// highlighting, mark-as-read on tap, and navigation to relevant screens.
///
/// Route: [AppRoutes.notifications]
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final ScrollController _scrollController = ScrollController();
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    if (_initialized) return;
    _initialized = true;
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) return;
    await context.read<NotificationProvider>().loadNotifications(userId);
  }

  Future<void> _refresh() async {
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) return;
    await context.read<NotificationProvider>().refreshNotifications(userId);
  }

  void _onScroll() {
    // Pagination hook – extend when backend supports cursor-based paging.
  }

  Future<void> _onNotificationTap(app.Notification notification) async {
    // Mark as read first (non-blocking).
    if (notification.isUnread) {
      context.read<NotificationProvider>().markAsRead(notification.id);
    }
    _navigateForNotification(notification);
  }

  void _navigateForNotification(app.Notification notification) {
    switch (notification.type) {
      case app.NotificationType.streamStarted:
      case app.NotificationType.streamEnded:
        final streamId = notification.streamId;
        if (streamId != null && streamId.isNotEmpty) {
          Navigator.pushNamed(context, AppRoutes.streamView,
              arguments: streamId);
        }
        break;

      case app.NotificationType.giftReceived:
        Navigator.pushNamed(context, AppRoutes.hostEarnings);
        break;

      case app.NotificationType.newFollower:
        final followerId = notification.followerId ?? notification.senderId;
        if (followerId != null && followerId.isNotEmpty) {
          Navigator.pushNamed(context, AppRoutes.profile,
              arguments: followerId);
        }
        break;

      case app.NotificationType.newMessage:
      case app.NotificationType.voiceRoomInvite:
        // Navigate to the relevant voice room if roomId is present.
        break;

      case app.NotificationType.withdrawalApproved:
      case app.NotificationType.withdrawalRejected:
        Navigator.pushNamed(context, AppRoutes.wallet);
        break;

      case app.NotificationType.hostApproved:
      case app.NotificationType.hostRejected:
        Navigator.pushNamed(context, AppRoutes.profile,
            arguments:
                context.read<AuthProvider>().currentUser?.id ?? '');
        break;

      case app.NotificationType.system:
      case app.NotificationType.general:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final notifications = provider.notifications;
    final isLoading = provider.isLoading;
    final unreadCount = provider.unreadCount;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: provider.markAllAsRead,
              child: const Text(
                'Mark all read',
                style: TextStyle(color: AppColors.primaryGreen),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Notification preferences',
            onPressed: () => Navigator.pushNamed(
                context, AppRoutes.notificationPreferences),
          ),
        ],
      ),
      body: isLoading && notifications.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              color: AppColors.primaryGreen,
              child: notifications.isEmpty
                  ? const _EmptyNotifications()
                  : ListView.separated(
                      controller: _scrollController,
                      itemCount: notifications.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        return _NotificationTile(
                          notification: notifications[index],
                          onTap: () =>
                              _onNotificationTap(notifications[index]),
                        );
                      },
                    ),
            ),
    );
  }
}

// ─── Notification Tile ────────────────────────────────────────────────────────

class _NotificationTile extends StatelessWidget {
  final app.Notification notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isUnread = notification.isUnread;

    return InkWell(
      onTap: onTap,
      child: Container(
        color: isUnread
            ? AppColors.primaryGreen.withAlpha(15)
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon avatar
            _NotificationIcon(type: notification.type),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontWeight: isUnread
                                ? FontWeight.w700
                                : FontWeight.w500,
                            fontSize: 14,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        notification.timeAgo,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    notification.message,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Unread dot
            if (isUnread) ...[
              const SizedBox(width: 8),
              const _UnreadDot(),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Notification Icon ────────────────────────────────────────────────────────

class _NotificationIcon extends StatelessWidget {
  final app.NotificationType type;

  const _NotificationIcon({required this.type});

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _iconAndColor(type);
    return CircleAvatar(
      radius: 22,
      backgroundColor: color.withAlpha(30),
      child: Icon(icon, color: color, size: 20),
    );
  }

  (IconData, Color) _iconAndColor(app.NotificationType type) {
    switch (type) {
      case app.NotificationType.streamStarted:
        return (Icons.live_tv, AppColors.liveRed);
      case app.NotificationType.streamEnded:
        return (Icons.stop_circle_outlined, AppColors.textSecondary);
      case app.NotificationType.giftReceived:
        return (Icons.card_giftcard, AppColors.giftGold);
      case app.NotificationType.newFollower:
        return (Icons.person_add_outlined, AppColors.primaryGreen);
      case app.NotificationType.newMessage:
        return (Icons.chat_bubble_outline, AppColors.info);
      case app.NotificationType.withdrawalApproved:
        return (Icons.check_circle_outline, AppColors.success);
      case app.NotificationType.withdrawalRejected:
        return (Icons.cancel_outlined, AppColors.error);
      case app.NotificationType.hostApproved:
        return (Icons.verified_outlined, AppColors.primaryGreen);
      case app.NotificationType.hostRejected:
        return (Icons.block_outlined, AppColors.error);
      case app.NotificationType.voiceRoomInvite:
        return (Icons.mic_outlined, AppColors.diamondBlue);
      case app.NotificationType.system:
      case app.NotificationType.general:
        return (Icons.notifications_outlined, AppColors.textSecondary);
    }
  }
}

// ─── Unread Dot ───────────────────────────────────────────────────────────────

class _UnreadDot extends StatelessWidget {
  const _UnreadDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      margin: const EdgeInsets.only(top: 4),
      decoration: const BoxDecoration(
        color: AppColors.primaryGreen,
        shape: BoxShape.circle,
      ),
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyNotifications extends StatelessWidget {
  const _EmptyNotifications();

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: const [
        SizedBox(height: 120),
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.notifications_none_outlined,
                  size: 72, color: AppColors.mediumGrey),
              SizedBox(height: 16),
              Text(
                'No notifications yet',
                style: TextStyle(
                  fontSize: 16,
                  color: AppColors.textSecondary,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'You\'ll see updates about streams,\ngifts, and followers here.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
