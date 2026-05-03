import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../core/services/api_service.dart';
import '../core/services/auth_service.dart';
import '../core/services/fcm_service.dart';
import '../core/services/storage_service.dart';
import '../core/utils/logger.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final StorageService _storageService = StorageService();

  User? _currentUser;
  bool _isLoading = false;
  String? _error;

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null;
  String? get error => _error;

  Future<void> initialize() async {
    try {
      _isLoading = true;
      notifyListeners();
      final authenticated = await _authService.isAuthenticated();
      if (authenticated) {
        final userData = await _authService.getCurrentUser();
        if (userData != null) {
          _currentUser = User(
            id: userData['id'] ?? userData['_id'] ?? '',
            displayName: userData['displayName'] ?? 'User',
            registeredAt: userData['registeredAt'] != null
                ? DateTime.tryParse(userData['registeredAt'].toString()) ?? DateTime.now()
                : DateTime.now(),
            isBlocked: userData['isBlocked'] ?? false,
            isHost: userData['isHost'] ?? false,
            followerIds: List<String>.from(userData['followerIds'] ?? []),
            followingIds: List<String>.from(userData['followingIds'] ?? []),
            blockedUserIds: List<String>.from(userData['blockedUserIds'] ?? []),
          );
        }
      }
      _error = null;
    } catch (e) {
      Logger.error('Failed to initialize auth provider', e);
      _error = 'Failed to initialize authentication';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyPhoneNumber(String phoneNumber, {String purpose = 'login'}) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      await _authService.verifyPhoneNumber(phoneNumber, purpose: purpose);
    } catch (e) {
      Logger.error('Phone verification failed', e);
      _error = e is ApiException ? e.message : 'Failed to verify phone number';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyPhoneOtp(String phoneNumber, String otp) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.verifyPhoneOtp(phoneNumber, otp);
      await _handleAuthSuccess(result);
    } on ApiException catch (e) {
      Logger.error('Phone OTP verification failed', e);
      _error = e.message;
      rethrow;
    } catch (e) {
      Logger.error('Phone OTP verification failed', e);
      _error = 'Invalid OTP or verification failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> sendEmailOtp(String email, {String purpose = 'login'}) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      await _authService.sendEmailOtp(email, purpose: purpose);
    } catch (e) {
      Logger.error('Email OTP sending failed', e);
      _error = e is ApiException ? e.message : 'Failed to send OTP to email';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> verifyEmailOtp(String email, String otp) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.verifyEmailOtp(email, otp);
      await _handleAuthSuccess(result);
    } on ApiException catch (e) {
      Logger.error('Email OTP verification failed', e);
      _error = e.message;
      rethrow;
    } catch (e) {
      Logger.error('Email OTP verification failed', e);
      _error = 'Invalid OTP or verification failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Unified OTP verification — delegates to phone or email based on [isPhone].
  Future<void> verifyOtp(String contact, String otp, {required bool isPhone}) async {
    if (isPhone) {
      await verifyPhoneOtp(contact, otp);
    } else {
      await verifyEmailOtp(contact, otp);
    }
  }

  /// Send OTP to phone or email (used by signup screen — purpose is 'register').
  Future<void> sendOtp(String contact, {required bool isPhone}) async {
    if (isPhone) {
      await verifyPhoneNumber(contact, purpose: 'register');
    } else {
      await sendEmailOtp(contact, purpose: 'register');
    }
  }

  /// Register with phone number + OTP + display name.
  Future<void> registerWithPhone(String phoneNumber, String otp, String displayName) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.registerWithPhone(phoneNumber, otp, displayName);
      await _handleAuthSuccess(result);
    } on ApiException catch (e) {
      Logger.error('Phone registration failed', e);
      _error = e.message;
      rethrow;
    } catch (e) {
      Logger.error('Phone registration failed', e);
      _error = 'Registration failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Register with email + OTP + display name.
  Future<void> registerWithEmail(String email, String otp, String displayName) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.registerWithEmail(email, otp, displayName);
      await _handleAuthSuccess(result);
    } on ApiException catch (e) {
      Logger.error('Email registration failed', e);
      _error = e.message;
      rethrow;
    } catch (e) {
      Logger.error('Email registration failed', e);
      _error = 'Registration failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.signInWithGoogle();
      await _handleAuthSuccess(result);
    } catch (e) {
      Logger.error('Google sign in failed', e);
      _error = 'Google sign in failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> signInWithApple() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.signInWithApple();
      await _handleAuthSuccess(result);
    } catch (e) {
      Logger.error('Apple sign in failed', e);
      _error = 'Apple sign in failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loginWithEmail(String email, String password) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final result = await _authService.loginWithEmail(email, password);
      await _handleAuthSuccess(result);
    } catch (e) {
      Logger.error('Email login failed', e);
      _error = 'Invalid email or password';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      FCMService().deleteToken().catchError((Object e) {
        Logger.error('FCM token deletion failed on logout', e);
      });
      await _authService.logout();
      _currentUser = null;
      Logger.info('User logged out successfully');
    } catch (e) {
      Logger.error('Logout failed', e);
      _error = 'Logout failed';
      _currentUser = null;
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateProfile({
    String? displayName,
    String? bio,
    String? profilePictureUrl,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      if (_currentUser == null) throw Exception('No user logged in');

      // Call backend API to persist changes
      final apiService = ApiService();
      await apiService.put(
        '/users/${_currentUser!.id}',
        data: {
          if (displayName != null) 'displayName': displayName,
          if (bio != null) 'bio': bio,
          if (profilePictureUrl != null) 'profilePictureUrl': profilePictureUrl,
        },
      );

      // Update local state
      _currentUser = _currentUser!.copyWith(
        displayName: displayName ?? _currentUser!.displayName,
        bio: bio ?? _currentUser!.bio,
        profilePictureUrl: profilePictureUrl ?? _currentUser!.profilePictureUrl,
      );

      // Persist updated user to storage
      await _storageService.setCurrentUser(_currentUser!.toJson());
      Logger.info('Profile updated successfully');
    } catch (e) {
      Logger.error('Profile update failed', e);
      _error = 'Failed to update profile';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Update local user state without an API call (for optimistic UI updates).
  void updateLocalUser(User user) {
    _currentUser = user;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> _handleAuthSuccess(Map<String, dynamic> result) async {
    final userData = result['user'] as Map<String, dynamic>?;
    if (userData != null) {
      _currentUser = User.fromJson(userData);
      await _storageService.setCurrentUser(userData);
      Logger.info('Authentication successful for user: ${_currentUser!.displayName}');
      final userId = _currentUser!.id;
      if (userId.isNotEmpty) {
        FCMService().registerTokenWithBackend(userId).catchError((Object e) {
          Logger.error('FCM token registration failed after login', e);
        });
      }
    } else {
      throw Exception('No user data in auth response');
    }
  }

  bool isFollowingUser(String userId) =>
      _currentUser?.followingIds.contains(userId) ?? false;

  bool hasBlocked(String userId) =>
      _currentUser?.blockedUserIds.contains(userId) ?? false;

  int get followerCount => _currentUser?.followerIds.length ?? 0;
  int get followingCount => _currentUser?.followingIds.length ?? 0;
}
