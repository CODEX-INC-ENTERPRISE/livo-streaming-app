import 'package:flutter/material.dart';
import 'dart:async';
import '../../core/constants/app_constants.dart';
import '../../core/services/storage_service.dart';

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
    _navigateAfterDelay();
  }

  Future<void> _navigateAfterDelay() async {
    await Future.delayed(const Duration(seconds: AppConstants.splashDuration));
    
    if (!mounted) return;
    
    // Check if user has seen onboarding
    final hasSeenOnboarding = await _storageService.getBool(AppConstants.hasSeenOnboarding) ?? false;
    
    // Check if user is logged in
    final authToken = await _storageService.getString(AppConstants.authToken);
    
    if (!mounted) return;
    
    if (authToken != null && authToken.isNotEmpty) {
      // User is logged in, go to home
      Navigator.pushReplacementNamed(context, '/home');
    } else if (hasSeenOnboarding) {
      // User has seen onboarding, go to login
      Navigator.pushReplacementNamed(context, '/login');
    } else {
      // First time user, show onboarding
      Navigator.pushReplacementNamed(context, '/onboarding');
    }
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
