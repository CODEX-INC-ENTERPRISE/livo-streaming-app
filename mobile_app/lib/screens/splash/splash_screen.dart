import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import '../../core/constants/app_constants.dart';
import '../../core/services/storage_service.dart';
import '../../providers/auth_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final StorageService _storageService = StorageService();

  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    // Wait for minimum splash duration and auth initialization in parallel
    await Future.wait([
      Future.delayed(const Duration(seconds: AppConstants.splashDuration)),
      _waitForAuthInit(),
    ]);

    if (!mounted) return;

    final auth = context.read<AuthProvider>();
    final hasSeenOnboarding =
        await _storageService.getBool(AppConstants.hasSeenOnboarding) ?? false;

    if (!mounted) return;

    if (auth.isAuthenticated) {
      Navigator.pushReplacementNamed(context, '/home');
    } else if (hasSeenOnboarding) {
      Navigator.pushReplacementNamed(context, '/login');
    } else {
      Navigator.pushReplacementNamed(context, '/onboarding');
    }
  }

  /// Waits until AuthProvider finishes its initialize() call.
  Future<void> _waitForAuthInit() async {
    final auth = context.read<AuthProvider>();
    // If already done (not loading), return immediately
    if (!auth.isLoading) return;
    // Otherwise wait for the next non-loading state
    final completer = Completer<void>();
    void listener() {
      if (!auth.isLoading) {
        auth.removeListener(listener);
        if (!completer.isCompleted) completer.complete();
      }
    }
    auth.addListener(listener);
    // Safety timeout — don't block splash forever
    await completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () {},
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Image.asset(
          'assets/images/logo.png',
          width: 200,
          height: 200,
        ),
      ),
    );
  }
}
