import '../constants/app_constants.dart';

/// Supported application environments.
enum AppEnvironment {
  /// Local development environment (points to localhost backend).
  development,

  /// Production environment (points to live backend).
  production,
}

/// Environment-aware configuration for the Livo app.
///
/// Switch environments by setting [_environment] at app startup, or by using
/// Flutter build flavors / `--dart-define` compile-time flags.
///
/// ### Usage
/// ```dart
/// // In main.dart (or a flavor-specific entry point):
/// EnvConfig.setEnvironment(AppEnvironment.production);
///
/// // Anywhere in the app:
/// final url = EnvConfig.apiBaseUrl;
/// ```
///
/// ### Using --dart-define
/// Pass `--dart-define=APP_ENV=production` to `flutter run` / `flutter build`
/// and the environment will be selected automatically.
class EnvConfig {
  EnvConfig._(); // prevent instantiation

  // ─── Internal State ──────────────────────────────────────────────────────────

  /// Resolved from the `APP_ENV` compile-time constant when available,
  /// otherwise defaults to [AppEnvironment.development].
  static AppEnvironment _environment = _resolveEnvironment();

  static AppEnvironment _resolveEnvironment() {
    const envName = String.fromEnvironment('APP_ENV', defaultValue: 'development');
    switch (envName.toLowerCase()) {
      case 'production':
      case 'prod':
        return AppEnvironment.production;
      case 'development':
      case 'dev':
      default:
        return AppEnvironment.development;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /// The currently active environment.
  static AppEnvironment get environment => _environment;

  /// Whether the app is running in development mode.
  static bool get isDevelopment => _environment == AppEnvironment.development;

  /// Whether the app is running in production mode.
  static bool get isProduction => _environment == AppEnvironment.production;

  /// Programmatically override the environment (useful for testing or
  /// flavor-based entry points).
  static void setEnvironment(AppEnvironment env) {
    _environment = env;
  }

  // ─── Environment-Specific Values ─────────────────────────────────────────────

  /// The API base URL for the current environment.
  static String get apiBaseUrl {
    switch (_environment) {
      case AppEnvironment.production:
        return AppConstants.prodBaseUrl;
      case AppEnvironment.development:
        return AppConstants.devBaseUrl;
    }
  }

  /// The Agora App ID for the current environment.
  ///
  /// Replace the placeholder values with real App IDs from the Agora Console.
  static String get agoraAppId {
    const devId = String.fromEnvironment(
      'AGORA_APP_ID_DEV',
      defaultValue: AppConstants.agoraAppId,
    );
    const prodId = String.fromEnvironment(
      'AGORA_APP_ID_PROD',
      defaultValue: AppConstants.agoraAppId,
    );
    return _environment == AppEnvironment.production ? prodId : devId;
  }

  /// The WebSocket server URL for the current environment.
  static String get socketUrl {
    switch (_environment) {
      case AppEnvironment.production:
        return 'wss://api.livo.app';
      case AppEnvironment.development:
        return 'ws://localhost:3000';
    }
  }

  /// Whether verbose logging is enabled (true in development only).
  static bool get enableLogging => isDevelopment;

  /// Whether the debug banner should be shown.
  static bool get showDebugBanner => isDevelopment;

  /// HTTP request timeout for the current environment.
  static Duration get apiTimeout {
    return Duration(seconds: AppConstants.apiTimeoutSeconds);
  }

  /// Human-readable label for the current environment.
  static String get label {
    switch (_environment) {
      case AppEnvironment.production:
        return 'Production';
      case AppEnvironment.development:
        return 'Development';
    }
  }
}
