import 'package:flutter/material.dart';
import '../../screens/splash/splash_screen.dart';
import '../../screens/onboarding/onboarding_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/otp_verification_screen.dart';
import '../../screens/auth/signup_screen.dart';
import '../../screens/main/main_navigation_screen.dart';
import '../../screens/profile/profile_screen.dart';
import '../../screens/profile/edit_profile_screen.dart';
import '../../screens/profile/followers_screen.dart';

/// Named route constants for the Livo app.
///
/// Use these constants instead of raw strings when navigating so that
/// route names are refactor-safe and discoverable.
///
/// ### Example
/// ```dart
/// Navigator.pushNamed(context, AppRoutes.login);
/// Navigator.pushReplacementNamed(context, AppRoutes.home);
/// ```
class AppRoutes {
  AppRoutes._(); // prevent instantiation

  // ─── Core ─────────────────────────────────────────────────────────────────────
  static const String splash = '/';
  static const String onboarding = '/onboarding';

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  static const String login = '/login';
  static const String signup = '/signup';
  static const String otpVerification = '/otp-verification';

  // ─── Main App ─────────────────────────────────────────────────────────────────
  static const String home = '/home';
  static const String discover = '/discover';

  // ─── Stream ───────────────────────────────────────────────────────────────────
  static const String streamView = '/stream/view';
  static const String streamStart = '/stream/start';

  // ─── Voice Room ───────────────────────────────────────────────────────────────
  static const String voiceRoom = '/voice-room';
  static const String voiceRoomCreate = '/voice-room/create';

  // ─── Profile ──────────────────────────────────────────────────────────────────
  static const String profile = '/profile';
  static const String editProfile = '/profile/edit';
  static const String followers = '/profile/followers';
  static const String following = '/profile/following';

  // ─── Wallet ───────────────────────────────────────────────────────────────────
  static const String wallet = '/wallet';
  static const String purchaseCoins = '/wallet/purchase-coins';
  static const String transactionHistory = '/wallet/transactions';
  static const String withdrawal = '/wallet/withdrawal';

  // ─── Notifications ────────────────────────────────────────────────────────────
  static const String notifications = '/notifications';

  // ─── Settings ─────────────────────────────────────────────────────────────────
  static const String settings = '/settings';

  // ─── Route Map ────────────────────────────────────────────────────────────────

  /// The complete route table passed to [MaterialApp.routes].
  ///
  /// Screens that require arguments (e.g. [streamView], [voiceRoom],
  /// [profile]) should use [MaterialApp.onGenerateRoute] for full argument
  /// passing support. The entries below cover all argument-free screens.
  static Map<String, WidgetBuilder> get routes => {
        splash: (_) => const SplashScreen(),
        onboarding: (_) => const OnboardingScreen(),
        login: (_) => const LoginScreen(),
        signup: (_) => const SignUpScreen(),
        // Main app shell – hosts the bottom nav and all tabs
        home: (_) => const MainNavigationScreen(),
        // The routes below are placeholders for screens not yet implemented.
        // They will be replaced with real screen widgets as development
        // progresses (tasks 22+).
        streamView: (_) => const _PlaceholderScreen(title: 'Stream View'),
        streamStart: (_) => const _PlaceholderScreen(title: 'Start Stream'),
        voiceRoom: (_) => const _PlaceholderScreen(title: 'Voice Room'),
        voiceRoomCreate: (_) => const _PlaceholderScreen(title: 'Create Voice Room'),
        profile: (context) {
          final userId = ModalRoute.of(context)?.settings.arguments as String?;
          return ProfileScreen(userId: userId ?? '');
        },
        editProfile: (_) => const EditProfileScreen(),
        followers: (context) {
          final args = ModalRoute.of(context)?.settings.arguments
              as Map<String, dynamic>?;
          return FollowersScreen(
            userId: args?['userId'] as String? ?? '',
            displayName: args?['displayName'] as String?,
            mode: FollowListMode.followers,
          );
        },
        following: (context) {
          final args = ModalRoute.of(context)?.settings.arguments
              as Map<String, dynamic>?;
          return FollowersScreen(
            userId: args?['userId'] as String? ?? '',
            displayName: args?['displayName'] as String?,
            mode: FollowListMode.following,
          );
        },
        wallet: (_) => const _PlaceholderScreen(title: 'Wallet'),
        purchaseCoins: (_) => const _PlaceholderScreen(title: 'Purchase Coins'),
        transactionHistory: (_) => const _PlaceholderScreen(title: 'Transactions'),
        withdrawal: (_) => const _PlaceholderScreen(title: 'Withdrawal'),
        notifications: (_) => const _PlaceholderScreen(title: 'Notifications'),
        settings: (_) => const _PlaceholderScreen(title: 'Settings'),
        otpVerification: (_) => const OtpVerificationScreen(),
      };
}

/// Temporary placeholder screen used for routes whose real screens have not
/// been implemented yet. Replaced screen-by-screen as tasks are completed.
class _PlaceholderScreen extends StatelessWidget {
  final String title;

  const _PlaceholderScreen({required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          '$title\n(Coming soon)',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      ),
    );
  }
}
