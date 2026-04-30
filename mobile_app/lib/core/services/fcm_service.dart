import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../services/storage_service.dart';
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
class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final StorageService _storageService = StorageService();

  // ──────────────────────────────────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────────────────────────────────

  /// Call once from main() after Firebase.initializeApp().
  Future<void> initialize() async {
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
        _handleMessage(initialMessage, source: 'initial');
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
      if (stored != null) return stored;
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
      // TODO: Send the new token to your backend so it can target this device.
    } catch (e) {
      Logger.error('Failed to handle FCM token refresh', e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Message handlers
  // ──────────────────────────────────────────────────────────────────────────

  /// Handles messages received while the app is in the foreground.
  void _onForegroundMessage(RemoteMessage message) {
    Logger.info(
      'FCM foreground message received',
      'id=${message.messageId}, title=${message.notification?.title}',
    );
    _handleMessage(message, source: 'foreground');
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
  /// Extend this method to navigate to specific screens or trigger in-app
  /// actions based on [message.data].
  void _handleMessage(RemoteMessage message, {required String source}) {
    final data = message.data;
    final notificationType = data['type'] as String?;

    Logger.info(
      'Handling FCM message',
      'source=$source, type=$notificationType',
    );

    // TODO: Add navigation / in-app action logic based on notificationType.
    // Example:
    // switch (notificationType) {
    //   case 'stream_started':
    //     navigatorKey.currentState?.pushNamed('/stream', arguments: data['streamId']);
    //     break;
    //   case 'new_follower':
    //     navigatorKey.currentState?.pushNamed('/profile', arguments: data['userId']);
    //     break;
    // }
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
