import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../constants/app_constants.dart';
import '../constants/app_routes.dart';
import '../utils/logger.dart';

/// Background message handler — must be a top-level function (not a class method).
/// Called when the app is in the background or terminated and a FCM message arrives.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialised by the time this is called because
  // main() calls Firebase.initializeApp() before runApp().
  Logger.info(
    'FCM background message received',
    'id=${message.messageId}, title=${message.notification?.title}',
  );
  // Additional background processing can be added here (e.g. local notifications).
}

/// Service that wraps Firebase Cloud Messaging setup and token management.
///
/// Responsibilities:
/// - Request notification permissions from the OS.
/// - Retrieve and persist the FCM registration token.
/// - Register the token with the backend after login.
/// - Handle foreground messages (show an in-app banner via the overlay).
/// - Handle background/terminated notification taps and navigate to the
///   relevant screen based on the notification data payload.
class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final StorageService _storageService = StorageService();
  final ApiService _apiService = ApiService();

  // Injected from main.dart so background taps can navigate without a context.
  GlobalKey<NavigatorState>? _navigatorKey;

  // ──────────────────────────────────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────────────────────────────────

  /// Call once from main() after Firebase.initializeApp().
  ///
  /// [navigatorKey] must be the same key passed to [MaterialApp.navigatorKey]
  /// so that background notification taps can navigate without a BuildContext.
  Future<void> initialize({GlobalKey<NavigatorState>? navigatorKey}) async {
    _navigatorKey = navigatorKey;
    try {
      // 1. Request permission (iOS / macOS / web; no-op on Android < 13).
      await _requestPermissions();

      // 2. Retrieve and persist the FCM registration token.
      await _retrieveAndStoreToken();

      // 3. Listen for token refreshes.
      _messaging.onTokenRefresh.listen(_onTokenRefresh);

      // 4. Register the background message handler.
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // 5. Handle messages that arrive while the app is in the foreground.
      FirebaseMessaging.onMessage.listen(_onForegroundMessage);

      // 6. Handle notification taps when the app is in the background (but open).
      FirebaseMessaging.onMessageOpenedApp.listen(_onMessageOpenedApp);

      // 7. Check whether the app was launched from a terminated state via a
      //    notification tap.
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        // Delay navigation until the widget tree is ready.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleMessage(initialMessage, source: 'initial');
        });
      }

      Logger.info('FCMService initialised successfully');
    } catch (e) {
      Logger.error('FCMService initialisation failed', e);
      // Non-fatal — the app can run without push notifications.
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Permission
  // ──────────────────────────────────────────────────────────────────────────

  /// Requests notification permissions from the OS.
  ///
  /// On Android 13+ this triggers the system permission dialog.
  /// On iOS / macOS it triggers the native permission dialog.
  /// On older Android versions it is a no-op (permissions are granted by default).
  Future<NotificationSettings> _requestPermissions() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    Logger.info(
      'Notification permission status',
      settings.authorizationStatus.name,
    );

    return settings;
  }

  /// Public wrapper so callers can re-request permissions if needed.
  Future<AuthorizationStatus> requestPermissions() async {
    final settings = await _requestPermissions();
    return settings.authorizationStatus;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Token management
  // ──────────────────────────────────────────────────────────────────────────

  /// Retrieves the current FCM token and stores it in [StorageService].
  Future<String?> _retrieveAndStoreToken() async {
    try {
      // On iOS, APNs token must be available before FCM token can be fetched.
      if (Platform.isIOS) {
        final apnsToken = await _messaging.getAPNSToken();
        if (apnsToken == null) {
          Logger.warning('APNs token not yet available; FCM token retrieval skipped');
          return null;
        }
      }

      final token = await _messaging.getToken();
      if (token != null) {
        await _storageService.setFcmToken(token);
        Logger.info('FCM token retrieved and stored');
        if (kDebugMode) {
          // Only log the token in debug builds to avoid leaking it.
          Logger.debug('FCM token', token);
        }
      }
      return token;
    } catch (e) {
      Logger.error('Failed to retrieve FCM token', e);
      return null;
    }
  }

  /// Returns the stored FCM token, or fetches a fresh one if none is stored.
  Future<String?> getToken() async {
    try {
      final stored = await _storageService.getFcmToken();
      if (stored != null && stored.isNotEmpty) return stored;
      return await _retrieveAndStoreToken();
    } catch (e) {
      Logger.error('Failed to get FCM token', e);
      return null;
    }
  }

  /// Called automatically when the FCM token is refreshed by the platform.
  Future<void> _onTokenRefresh(String newToken) async {
    try {
      await _storageService.setFcmToken(newToken);
      Logger.info('FCM token refreshed and stored');

      // Re-register the refreshed token with the backend if a user is logged in.
      final userData = await _storageService.getCurrentUser();
      final userId = userData?['id'] as String? ?? userData?['_id'] as String?;
      if (userId != null && userId.isNotEmpty) {
        await _registerTokenWithBackend(userId, newToken);
      }
    } catch (e) {
      Logger.error('Failed to handle FCM token refresh', e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Backend registration
  // ──────────────────────────────────────────────────────────────────────────

  /// Registers the current FCM token with the backend for [userId].
  ///
  /// Call this after a successful login so the backend can target this device
  /// with push notifications.
  Future<void> registerTokenWithBackend(String userId) async {
    try {
      final token = await getToken();
      if (token == null || token.isEmpty) {
        Logger.warning('No FCM token available to register with backend');
        return;
      }
      await _registerTokenWithBackend(userId, token);
    } catch (e) {
      Logger.error('Failed to register FCM token with backend', e);
      // Non-fatal — the app can still function without push notifications.
    }
  }

  /// Internal helper that performs the actual API call.
  Future<void> _registerTokenWithBackend(String userId, String token) async {
    try {
      await _apiService.post<Map<String, dynamic>>(
        '${AppConstants.usersEndpoint}/$userId/fcm-token',
        data: {'fcmToken': token},
      );
      Logger.info('FCM token registered with backend', 'userId=$userId');
    } catch (e) {
      Logger.error('Backend FCM token registration failed', e);
      rethrow;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Message handlers
  // ──────────────────────────────────────────────────────────────────────────

  /// Handles messages received while the app is in the foreground.
  ///
  /// Shows an in-app banner using the overlay so the user is aware of the
  /// notification without leaving the current screen.
  void _onForegroundMessage(RemoteMessage message) {
    Logger.info(
      'FCM foreground message received',
      'id=${message.messageId}, title=${message.notification?.title}',
    );

    final notification = message.notification;
    if (notification != null) {
      _showInAppBanner(
        title: notification.title ?? '',
        body: notification.body ?? '',
        message: message,
      );
    }
  }

  /// Handles notification taps when the app was in the background (but open).
  void _onMessageOpenedApp(RemoteMessage message) {
    Logger.info(
      'App opened from background FCM notification',
      'id=${message.messageId}, title=${message.notification?.title}',
    );
    _handleMessage(message, source: 'background_tap');
  }

  /// Central dispatcher for all incoming FCM messages.
  ///
  /// Navigates to the relevant screen based on [message.data]['type'].
  void _handleMessage(RemoteMessage message, {required String source}) {
    final data = message.data;
    final notificationType = data['type'] as String?;

    Logger.info(
      'Handling FCM message',
      'source=$source, type=$notificationType',
    );

    _navigateForNotification(notificationType, data);
  }

  /// Navigates to the screen that corresponds to [notificationType].
  ///
  /// Notification types and their target screens:
  /// - `stream_start`   → stream viewer screen (requires `streamId`)
  /// - `gift_received`  → host earnings / wallet screen
  /// - `new_follower`   → profile screen of the follower (requires `userId`)
  /// - `new_message`    → notifications screen (no dedicated message screen yet)
  void _navigateForNotification(
    String? notificationType,
    Map<String, dynamic> data,
  ) {
    final navigator = _navigatorKey?.currentState;
    if (navigator == null) {
      Logger.warning('Navigator not available for notification navigation');
      return;
    }

    switch (notificationType) {
      case 'stream_start':
        final streamId = data['streamId'] as String?;
        if (streamId != null && streamId.isNotEmpty) {
          navigator.pushNamed(AppRoutes.streamView, arguments: streamId);
        } else {
          navigator.pushNamed(AppRoutes.home);
        }
        break;

      case 'gift_received':
        navigator.pushNamed(AppRoutes.hostEarnings);
        break;

      case 'new_follower':
        final userId = data['userId'] as String?;
        if (userId != null && userId.isNotEmpty) {
          navigator.pushNamed(AppRoutes.profile, arguments: userId);
        } else {
          navigator.pushNamed(AppRoutes.notifications);
        }
        break;

      case 'new_message':
        navigator.pushNamed(AppRoutes.notifications);
        break;

      default:
        // Unknown type — navigate to the notifications screen as a fallback.
        if (notificationType != null) {
          Logger.warning('Unknown notification type', notificationType);
        }
        navigator.pushNamed(AppRoutes.notifications);
        break;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // In-app banner for foreground notifications
  // ──────────────────────────────────────────────────────────────────────────

  /// Displays a dismissible banner at the top of the screen when a push
  /// notification arrives while the app is in the foreground.
  ///
  /// Tapping the banner navigates to the relevant screen.
  void _showInAppBanner({
    required String title,
    required String body,
    required RemoteMessage message,
  }) {
    final context = _navigatorKey?.currentContext;
    if (context == null) return;

    final overlay = Overlay.of(context);
    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (_) => _NotificationBanner(
        title: title,
        body: body,
        onTap: () {
          entry.remove();
          _handleMessage(message, source: 'foreground_tap');
        },
        onDismiss: () => entry.remove(),
      ),
    );

    overlay.insert(entry);

    // Auto-dismiss after 4 seconds.
    Future.delayed(const Duration(seconds: 4), () {
      if (entry.mounted) {
        entry.remove();
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utility
  // ──────────────────────────────────────────────────────────────────────────

  /// Deletes the current FCM token (e.g. on logout so the device stops
  /// receiving notifications for this user).
  Future<void> deleteToken() async {
    try {
      await _messaging.deleteToken();
      await _storageService.setFcmToken('');
      Logger.info('FCM token deleted');
    } catch (e) {
      Logger.error('Failed to delete FCM token', e);
    }
  }

  /// Subscribes to a named FCM topic (e.g. 'all_users', 'promotions').
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      Logger.info('Subscribed to FCM topic: $topic');
    } catch (e) {
      Logger.error('Failed to subscribe to FCM topic: $topic', e);
    }
  }

  /// Unsubscribes from a named FCM topic.
  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      Logger.info('Unsubscribed from FCM topic: $topic');
    } catch (e) {
      Logger.error('Failed to unsubscribe from FCM topic: $topic', e);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// In-app notification banner widget
// ────────────────────────────────────────────────────────────────────────────

/// A Material-style banner that slides in from the top of the screen when a
/// push notification arrives while the app is in the foreground.
class _NotificationBanner extends StatefulWidget {
  final String title;
  final String body;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  const _NotificationBanner({
    required this.title,
    required this.body,
    required this.onTap,
    required this.onDismiss,
  });

  @override
  State<_NotificationBanner> createState() => _NotificationBannerState();
}

class _NotificationBannerState extends State<_NotificationBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);

    return Positioned(
      top: mediaQuery.padding.top + 8,
      left: 16,
      right: 16,
      child: SlideTransition(
        position: _slideAnimation,
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(12),
          color: Colors.white,
          child: InkWell(
            onTap: widget.onTap,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.notifications, color: Color(0xFF6C63FF)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (widget.title.isNotEmpty)
                          Text(
                            widget.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        if (widget.body.isNotEmpty)
                          Text(
                            widget.body,
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.black54,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18, color: Colors.black45),
                    onPressed: widget.onDismiss,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
