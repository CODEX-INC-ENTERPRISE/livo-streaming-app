import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../constants/app_constants.dart';
import '../utils/logger.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  // Phone authentication
  Future<String> verifyPhoneNumber(String phoneNumber) async {
    try {
      Logger.debug('Verifying phone number: $phoneNumber');
      
      // In a real app, this would use Firebase phone auth
      // For now, we'll simulate by calling our backend
      final response = await _apiService.post(
        AppConstants.sendOtpEndpoint,
        data: {'phoneNumber': phoneNumber},
      );
      
      if (response.statusCode == 200) {
        return 'OTP sent successfully';
      } else {
        throw Exception('Failed to send OTP');
      }
    } catch (e) {
      Logger.error('Phone verification failed', e);
      rethrow;
    }
  }

  Future<Map<String, dynamic>> verifyPhoneOtp(String phoneNumber, String otp) async {
    try {
      Logger.debug('Verifying phone OTP for: $phoneNumber');
      
      final response = await _apiService.post(
        AppConstants.registerEndpoint,
        data: {
          'phoneNumber': phoneNumber,
          'otp': otp,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        await _handleAuthSuccess(data);
        return data;
      } else {
        throw Exception('Invalid OTP');
      }
    } catch (e) {
      Logger.error('Phone OTP verification failed', e);
      rethrow;
    }
  }

  // Email authentication
  Future<String> sendEmailOtp(String email) async {
    try {
      Logger.debug('Sending email OTP to: $email');
      
      final response = await _apiService.post(
        AppConstants.sendOtpEndpoint,
        data: {'email': email},
      );
      
      if (response.statusCode == 200) {
        return 'OTP sent successfully';
      } else {
        throw Exception('Failed to send OTP');
      }
    } catch (e) {
      Logger.error('Email OTP sending failed', e);
      rethrow;
    }
  }

  Future<Map<String, dynamic>> verifyEmailOtp(String email, String otp) async {
    try {
      Logger.debug('Verifying email OTP for: $email');
      
      final response = await _apiService.post(
        AppConstants.registerEndpoint,
        data: {
          'email': email,
          'otp': otp,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        await _handleAuthSuccess(data);
        return data;
      } else {
        throw Exception('Invalid OTP');
      }
    } catch (e) {
      Logger.error('Email OTP verification failed', e);
      rethrow;
    }
  }

  // Social authentication
  Future<Map<String, dynamic>> signInWithGoogle() async {
    try {
      Logger.debug('Signing in with Google');
      
      // Trigger Google Sign In flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw Exception('Google sign in cancelled');
      }
      
      // Obtain auth details from Google
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      
      // Create Firebase credential
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      
      // Sign in to Firebase
      final UserCredential userCredential = await _firebaseAuth.signInWithCredential(credential);
      final User? user = userCredential.user;
      
      if (user == null) {
        throw Exception('Failed to get user from Google sign in');
      }
      
      // Register/Login with our backend
      final response = await _apiService.post(
        AppConstants.registerEndpoint,
        data: {
          'socialProvider': 'google',
          'socialToken': await user.getIdToken(),
          'email': user.email,
          'displayName': user.displayName,
          'photoUrl': user.photoURL,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        await _handleAuthSuccess(data);
        return data;
      } else {
        throw Exception('Failed to register with backend');
      }
    } catch (e) {
      Logger.error('Google sign in failed', e);
      rethrow;
    }
  }

  Future<Map<String, dynamic>> signInWithApple() async {
    try {
      Logger.debug('Signing in with Apple');
      
      // Trigger Apple Sign In flow
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      
      // Create Firebase credential
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: credential.identityToken,
        accessToken: credential.authorizationCode,
      );
      
      // Sign in to Firebase
      final UserCredential userCredential = await _firebaseAuth.signInWithCredential(oauthCredential);
      final User? user = userCredential.user;
      
      if (user == null) {
        throw Exception('Failed to get user from Apple sign in');
      }
      
      // Register/Login with our backend
      final response = await _apiService.post(
        AppConstants.registerEndpoint,
        data: {
          'socialProvider': 'apple',
          'socialToken': await user.getIdToken(),
          'email': user.email,
          'displayName': user.displayName ?? 'Apple User',
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        await _handleAuthSuccess(data);
        return data;
      } else {
        throw Exception('Failed to register with backend');
      }
    } catch (e) {
      Logger.error('Apple sign in failed', e);
      rethrow;
    }
  }

  // Email/password authentication
  Future<Map<String, dynamic>> loginWithEmail(String email, String password) async {
    try {
      Logger.debug('Logging in with email: $email');
      
      final response = await _apiService.post(
        AppConstants.loginEndpoint,
        data: {'email': email, 'password': password},
      );
      
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        await _handleAuthSuccess(data);
        return data;
      } else {
        throw Exception('Invalid credentials');
      }
    } catch (e) {
      Logger.error('Email login failed', e);
      rethrow;
    }
  }

  // Logout
  Future<void> logout() async {
    try {
      Logger.debug('Logging out');
      
      // Call backend logout endpoint
      await _apiService.post(AppConstants.logoutEndpoint);
      
      // Clear local storage
      await _storageService.clearAll();
      
      // Clear API service auth token
      _apiService.clearAuthToken();
      
      // Sign out from Firebase
      await _firebaseAuth.signOut();
      
      // Sign out from Google
      await _googleSignIn.signOut();
      
      Logger.info('Logout successful');
    } catch (e) {
      Logger.error('Logout failed', e);
      // Still clear local storage even if backend call fails
      await _storageService.clearAll();
      _apiService.clearAuthToken();
      rethrow;
    }
  }

  // Check authentication status
  Future<bool> isAuthenticated() async {
    try {
      final token = await _storageService.getAuthToken();
      return token != null;
    } catch (e) {
      Logger.error('Failed to check authentication status', e);
      return false;
    }
  }

  // Get current user token
  Future<String?> getCurrentToken() async {
    try {
      return await _storageService.getAuthToken();
    } catch (e) {
      Logger.error('Failed to get current token', e);
      return null;
    }
  }

  // Refresh token
  Future<String?> refreshToken() async {
    try {
      final refreshToken = await _storageService.getRefreshToken();
      if (refreshToken == null) {
        return null;
      }
      
      // In a real app, call refresh token endpoint
      // For now, return current token
      return await getCurrentToken();
    } catch (e) {
      Logger.error('Failed to refresh token', e);
      return null;
    }
  }

  // Helper method to handle auth success
  Future<void> _handleAuthSuccess(Map<String, dynamic> data) async {
    final token = data['token'] as String?;
    final refreshToken = data['refreshToken'] as String?;
    final user = data['user'] as Map<String, dynamic>?;
    
    if (token != null) {
      await _storageService.setAuthToken(token);
      _apiService.setAuthToken(token);
    }
    
    if (refreshToken != null) {
      await _storageService.setRefreshToken(refreshToken);
    }
    
    if (user != null) {
      await _storageService.setCurrentUser(user);
    }
    
    Logger.info('Authentication successful');
  }

  // Get current user from storage
  Future<Map<String, dynamic>?> getCurrentUser() async {
    try {
      return await _storageService.getCurrentUser();
    } catch (e) {
      Logger.error('Failed to get current user', e);
      return null;
    }
  }
}