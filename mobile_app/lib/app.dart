import 'package:flutter/material.dart';
import 'package:provider/provider.dart' as provider_package;
import 'package:social_live_streaming_app/core/theme/app_theme.dart';
import 'package:social_live_streaming_app/providers/auth_provider.dart';
import 'package:social_live_streaming_app/providers/user_provider.dart';
import 'package:social_live_streaming_app/providers/stream_provider.dart' as app_stream_provider;
import 'package:social_live_streaming_app/providers/wallet_provider.dart';
import 'package:social_live_streaming_app/providers/notification_provider.dart';
import 'package:social_live_streaming_app/screens/auth/login_screen.dart';
import 'package:social_live_streaming_app/screens/home/home_screen.dart';

class SocialLiveStreamingApp extends StatelessWidget {
  const SocialLiveStreamingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return provider_package.MultiProvider(
      providers: [
        provider_package.ChangeNotifierProvider(create: (_) => AuthProvider()),
        provider_package.ChangeNotifierProvider(create: (_) => UserProvider()),
        provider_package.ChangeNotifierProvider(create: (_) => app_stream_provider.StreamProvider()),
        provider_package.ChangeNotifierProvider(create: (_) => WalletProvider()),
        provider_package.ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: MaterialApp(
        title: 'Social Live Streaming',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.light,
        debugShowCheckedModeBanner: false,
        home: provider_package.Consumer<AuthProvider>(
          builder: (context, authProvider, _) {
            if (authProvider.isAuthenticated) {
              return const HomeScreen();
            } else {
              return const LoginScreen();
            }
          },
        ),
        routes: {
          '/login': (context) => const LoginScreen(),
          '/home': (context) => const HomeScreen(),
        },
      ),
    );
  }
}