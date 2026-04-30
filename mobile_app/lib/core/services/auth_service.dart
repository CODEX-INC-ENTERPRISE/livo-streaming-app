import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../constants/app_constants.dart';
import '../utils/logger.dart';

/// Handles all authentication flows:
/// - Phone number OTP (via backend)
/// - Email OTP (via backend)
/// - Google OAuth (Firebase + backend)
/// - Apple Sign-In (Firebase + backend)
/// - Email/password login
/// - Token refresh and secure storage
class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final fb.FirebaseAuth _firebaseAuth = fb.FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  // ─── Phone authentication ─────────────────────────────────────────────────────

  /// Sends an OTP to [phoneNumber] via the backend.
  Future<void> verifyPhoneNumber(String phoneNumber) async {
    try {
      Logger.debug('Sending phone OTP to: $phoneNumber');
      await _apiService.post(
        AppConstants.sendOtpEndpoint,
        data: {'phoneNumber': phoneNumber},
      );
    } catch (e) {
      Logger.error('Failed to send phone OTP', e);
      rethrow;
    }
  }

  /// Verifies [otp] for [phoneNumber] and returns auth data on success.
  Future<Map<String, dynamic>> verifyPhoneOtp(
      String phoneNumber, String otp) async {
    try {
      Logger.debug('Verifying phone OTP for: $phoneNumber');
      final response = await _apiService.post<Map<String, dynamic>>(
        AppConstants.registerEndpoint,
        data: {'phoneNumber': phoneNumber, 'otp': otp},
      );
      final data = response.data!;
      await _handleAuthSuccess(data);
      return data;
    } catch (e) {
      Logger.error('Phone OTP verification failed', e);
      rethrow;
    }
  }

  // ─── Email authentication ─────────────────────────────────────────────────────

  /// Sends an OTP to [email] via the backend.
  Future<void> sendEmailOtp(String email) async {
    try {
      Logger.debug('Sending email OTP to: $email');
      await _apiService.post(
        AppConstants.sendOtpEndpoint,
        data: {'email': email},
      );
    } catch (e) {
      Logger.error('Failed to send email OTP', e);
      rethrow;
    }
  }

  /// Verifies [otp] for [email] and returns auth data on success.
  Future<Map<String, dynamic>> verifyEmailOtp(
      String email, String otp) async {
    try {
      Logger.debug('Verifying email OTP for: $email');
      final response = await _apiService.post<Map<String, dynamic>>(
        AppConstants.registerEndpoint,
        data: {'email': email, 'otp': otp},
      );
      final data = response.data!;
      await _handleAuthSuccess(data);
      return data;
    } catch (e) {
      Logger.error('Email OTP verification failed', e);
      rethrow;
    }
  }

  // ─── Social authentication ────────────────────────────────────────────────────

  /// Signs in with Google via Firebase, then registers/logs in with the backend.
  Future<Map<String, dynamic>> signInWithGoogle() async {
    try {
      Logger.debug('Initiating Google sign-in');

      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw const ApiException('Google sign-in was cancelled.');
      }

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final credential = fb.GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final fb.UserCredential userCredential =
          await _firebaseAuth.signInWithCredential(credential);
      final fb.User? fbUser = userCredential.user;
      if (fbUser == null) throw const ApiException('Google sign-in failed.');

      final idToken = await fbUser.getIdToken();

      final response = await _apiService.post<Map<String, dynamic>>(
        AppConstants.registerEndpoint,
        data: {
          'socialProvider': 'google',
          'socialToken': idToken,
          'email': fbUser.email,
          'displayName': fbUser.displayName,
          'photoUrl': fbUser.photoURL,
        },
      );
      final data = response.data!;
      await _handleAuthSuccess(data);
      return data;
    } catch (e) {
      Logger.error('Google sign-in failed', e);
      rethrow;
    }
  }

  /// Signs in with Apple via Firebase, then registers/logs in with the backend.
  Future<Map<String, dynamic>> signInWithApple() async {
    try {
      Logger.debug('Initiating Apple sign-in');

      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final oauthCredential = fb.OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );

      final fb.UserCredential userCredential =
          await _firebaseAuth.signInWithCredential(oauthCredential);
      final fb.User? fbUser = userCredential.user;
      if (fbUser == null) throw const ApiException('Apple sign-in failed.');

      final idToken = await fbUser.getIdToken();

      final response = await _apiService.post<Map<String, dynamic>>(
        AppConstants.registerEndpoint,
        data: {
          'socialProvider': 'apple',
          'socialToken': idToken,
          'email': fbUser.email,
          'displayName': fbUser.displayName ?? 'Apple User',
        },
      );
      final data = response.data!;
      await _handleAuthSuccess(data);
      return data;
    } catch (e) {
      Logger.error('Apple sign-in failed', e);
      rethrow;
    }
  }

  // ─── Email / password login ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> loginWithEmail(
      String email, String password) async {
    try {
      Logger.debug('Logging in with email: $email');
      final response = await _apiService.post<Map<String, dynamic>>(
        AppConstants.loginEndpoint,
        data: {'email': email, 'password': password},
      );
      final data = response.data!;
      await _handleAuthSuccess(data);
      return data;
    } catch (e) {
      Logger.error('Email login failed', e);
      rethrow;
    }
  }

  // ─── Token refresh ────────────────────────────────────────────────────────────

  /// Exchanges the stored refresh token for a new access token.
  /// Returns the new token, or null if refresh is not possible.
  Future<String?> refreshToken() async {
    try {
      final storedRefreshToken = await _storageService.getRefreshToken();
      if (storedRefreshToken == null) {
        Logger.debug('No refresh token available');
        return null;
      }

      Logger.debug('Refreshing access token');
      final response = await _apiService.post<Map<String, dynamic>>(
        AppConstants.refreshTokenEndpoint,
        data: {'refreshToken': storedRefreshToken},
      );

      final data = response.data!;
      final newToken = data['token'] as String?;
      final newRefreshToken = data['refreshToken'] as String?;

      if (newToken != null) {
        await _storageService.setAuthToken(newToken);
        _apiService.setAuthToken(newToken);
      }
      if (newRefreshToken != null) {
        await _storageService.setRefreshToken(newRefreshToken);
      }

      Logger.info('Token refreshed successfully');
      return newToken;
    } catch (e) {
      Logger.error('Token refresh failed', e);
      return null;
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    try {
      Logger.debug('Logging out');
      // Best-effort backend call – don't block logout if it fails.
      await _apiService.post(AppConstants.logoutEndpoint).catchError((e) {
        Logger.error('Backend logout failed', e);
        return Response(requestOptions: RequestOptions(path: AppConstants.logoutEndpoint));
      });

      await _storageService.clearAll();
      _apiService.clearAuthToken();
      await _firebaseAuth.signOut();
      await _googleSignIn.signOut();

      Logger.info('Logout successful');
    } catch (e) {
      Logger.error('Logout error', e);
      // Always clear local state.
      await _storageService.clearAll();
      _apiService.clearAuthToken();
      rethrow;
    }
  }

  // ─── State helpers ────────────────────────────────────────────────────────────

  Future<bool> isAuthenticated() async {
    final token = await _storageService.getAuthToken();
    return token != null;
  }

  Future<String?> getCurrentToken() async {
    return _storageService.getAuthToken();
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    return _storageService.getCurrentUser();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

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

    Logger.info('Auth success – token stored');
  }
}
