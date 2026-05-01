/// App-wide constants used throughout the Livo mobile application.
///
/// For environment-specific values (API base URL, Agora App ID, etc.) use
/// [EnvConfig] instead, which selects the correct value based on the current
/// build flavor / environment.
class AppConstants {
  AppConstants._(); // prevent instantiation

  // ─── App Info ────────────────────────────────────────────────────────────────
  static const String appName = 'Livo';
  static const String appVersion = '1.0.0';

  // ─── Storage Keys ────────────────────────────────────────────────────────────
  static const String hasSeenOnboarding = 'has_seen_onboarding';
  static const String authToken = 'auth_token';
  static const String authTokenKey = 'auth_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String fcmTokenKey = 'fcm_token';
  static const String currentUserKey = 'current_user';
  static const String userId = 'user_id';
  static const String themeKey = 'app_theme';

  // ─── API Base URLs ────────────────────────────────────────────────────────────
  /// Development API base URL – points to the live Render backend.
  static const String devBaseUrl = 'https://livo-streaming-app.onrender.com/api';

  /// Production API base URL – same Render backend for now.
  static const String prodBaseUrl = 'https://livo-streaming-app.onrender.com/api';

  /// Convenience accessor – resolves to [devBaseUrl] by default.
  /// Prefer using [EnvConfig.apiBaseUrl] for environment-aware access.
  static const String baseUrl = devBaseUrl;

  // ─── API Endpoints ────────────────────────────────────────────────────────────
  static const String sendOtpEndpoint = '/auth/send-otp';
  static const String registerEndpoint = '/auth/register';
  static const String loginEndpoint = '/auth/login';
  static const String logoutEndpoint = '/auth/logout';
  static const String refreshTokenEndpoint = '/auth/refresh-token';

  // User
  static const String usersEndpoint = '/users';
  static const String followEndpoint = '/follow';
  static const String blockEndpoint = '/block';
  static const String reportEndpoint = '/report';

  // Streams
  static const String streamsEndpoint = '/streams';
  static const String activeStreamsEndpoint = '/streams/active';
  static const String startStreamEndpoint = '/streams/start';

  // Voice Rooms
  static const String voiceRoomsEndpoint = '/voice-rooms';

  // Wallet
  static const String walletEndpoint = '/wallet';
  static const String purchaseCoinsEndpoint = '/wallet/purchase-coins';
  static const String withdrawEndpoint = '/wallet/withdraw';
  static const String transactionsEndpoint = '/wallet/transactions';

  // Notifications
  static const String notificationsEndpoint = '/notifications';

  // Gifts
  static const String giftsEndpoint = '/gifts';

  // ─── Agora ────────────────────────────────────────────────────────────────────
  /// Placeholder – set the real App ID via [EnvConfig.agoraAppId].
  static const String agoraAppId = 'YOUR_AGORA_APP_ID';

  // ─── Timing ───────────────────────────────────────────────────────────────────
  /// Duration (seconds) the splash screen is shown before navigating.
  static const int splashDuration = 2;

  /// Default HTTP request timeout in seconds.
  static const int apiTimeoutSeconds = 30;

  /// OTP expiry in seconds (must match backend setting).
  static const int otpExpirySeconds = 300;

  // ─── Socket / WebSocket ───────────────────────────────────────────────────────
  static const int maxSocketReconnectAttempts = 5;
  static const int socketReconnectDelayMs = 1000;
  static const int socketHeartbeatIntervalMs = 25000;

  // ─── Chat ─────────────────────────────────────────────────────────────────────
  static const int maxChatMessageLength = 500;

  // ─── Pagination ───────────────────────────────────────────────────────────────
  static const int defaultPageSize = 20;
  static const int maxPageSize = 50;

  // ─── Wallet / Payments ────────────────────────────────────────────────────────
  static const int minWithdrawalDiamonds = 1000;

  /// Conversion rate: 1 diamond = this many real-currency units (e.g. USD cents).
  static const double diamondToCreditRate = 0.01;

  // ─── Media / Upload ───────────────────────────────────────────────────────────
  /// Maximum profile picture file size in bytes (5 MB).
  static const int maxProfilePictureSizeBytes = 5 * 1024 * 1024;

  // ─── Stream ───────────────────────────────────────────────────────────────────
  static const int maxConcurrentViewers = 5000;
  static const int streamLatencyTargetMs = 2000;
}
