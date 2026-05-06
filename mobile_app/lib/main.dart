import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/config/env_config.dart';
import 'core/constants/app_routes.dart';
import 'core/services/fcm_service.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/logger.dart';
import 'providers/auth_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/stream_provider.dart';
import 'providers/user_provider.dart';
import 'providers/voice_room_provider.dart';
import 'providers/wallet_provider.dart';

/// Global navigator key used by [FCMService] to navigate from background
/// notification taps without requiring a [BuildContext].
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  // Must be called before any async work in main().
  WidgetsFlutterBinding.ensureInitialized();


  // Select environment. Override with --dart-define=APP_ENV=production for
  // production builds, or call EnvConfig.setEnvironment() in a flavor entry
  // point. Defaults to development when APP_ENV is not set.
  Logger.info('Environment: ${EnvConfig.label}');
  Logger.info('API base URL: ${EnvConfig.apiBaseUrl}');

  // Set system UI overlay style.
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  // Initialise Firebase.
  // NOTE: Requires a valid google-services.json (Android) and
  // GoogleService-Info.plist (iOS) to be present. Replace the placeholder
  // files in android/app/ and ios/Runner/ with real ones from the Firebase
  // Console before running on a device.
  await Firebase.initializeApp();
  Logger.info('Firebase initialised');

  runApp(const MyApp());

  // Initialise Firebase Cloud Messaging after the app is running so the
  // notification permission dialog appears on top of the rendered UI rather
  // than blocking runApp() and causing a blank screen.
  FCMService().initialize(navigatorKey: navigatorKey);
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) {
          final auth = AuthProvider();
          // Validate stored token against backend on startup.
          // This prevents stale sessions from a previous user being loaded.
          auth.initialize();
          return auth;
        }),
        ChangeNotifierProvider(create: (_) => UserProvider()),
        ChangeNotifierProvider(create: (_) => LiveStreamProvider()),
        ChangeNotifierProvider(create: (_) => WalletProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => VoiceRoomProvider()),
      ],
      child: MaterialApp(
        title: 'Livo',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.light,
        navigatorKey: navigatorKey,
        initialRoute: AppRoutes.splash,
        routes: AppRoutes.routes,
      ),
    );
  }
}
