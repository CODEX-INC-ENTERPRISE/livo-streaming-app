import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../core/services/auth_service.dart';
import '../core/services/storage_service.dart';
import '../core/utils/logger.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final StorageService _storageService = StorageService();
  
  User? _currentUser;
  bool _isLoading = false;
  String? _error;
  
  // Getters
  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null;
  String? get error => _error;
  
  // Initialize provider
  Future<void> initialize() async {
    try {
      _isLoading = true;
      notifyListeners();
      
      // Check if user is authenticated
      final isAuthenticated = await _authService.isAuthenticated();
      
      if (isAuthenticated) {
        // Load current user from storage
        final userData = await _authService.getCurrentUser();
        if (userData != null) {
          // In a real app, we would create a User object from the data
          // For now, create a placeholder user
          _currentUser = User(
            id: userData['id'] ?? '',
            displayName: userData['displayName'] ?? 'User',
            registeredAt: DateTime.now(),
            isBlocked: false,
            isHost: false,
            followerIds: [],
            followingIds: [],
            blockedUserIds: [],
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
  
  // Phone authentication
  Future<void> verifyPhoneNumber(String phoneNumber) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      await _authService.verifyPhoneNumber(phoneNumber);
    } catch (e) {
      Logger.error('Phone verification failed', e);
      _error = 'Failed to verify phone number';
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
    } catch (e) {
      Logger.error('Phone OTP verification failed', e);
      _error = 'Invalid OTP or verification failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Email authentication
  Future<void> sendEmailOtp(String email) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      await _authService.sendEmailOtp(email);
    } catch (e) {
      Logger.error('Email OTP sending failed', e);
      _error = 'Failed to send OTP to email';
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
    } catch (e) {
      Logger.error('Email OTP verification failed', e);
      _error = 'Invalid OTP or verification failed';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Social authentication
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
  
  // Email/password login
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
  
  // Logout
  Future<void> logout() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      await _authService.logout();
      _currentUser = null;
      Logger.info('User logged out successfully');
    } catch (e) {
      Logger.error('Logout failed', e);
      _error = 'Logout failed';
      // Still clear local state even if backend logout fails
      _currentUser = null;
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Update profile
  Future<void> updateProfile({
    String? displayName,
    String? bio,
    String? profilePictureUrl,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      if (_currentUser == null) {
        throw Exception('No user logged in');
      }
      
      // In a real app, call API to update profile
      // For now, update local user object
      _currentUser = _currentUser!.copyWith(
        displayName: displayName ?? _currentUser!.displayName,
        bio: bio ?? _currentUser!.bio,
        profilePictureUrl: profilePictureUrl ?? _currentUser!.profilePictureUrl,
      );
      
      // Save updated user to storage
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
  
  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
  
  // Helper method to handle auth success
  Future<void> _handleAuthSuccess(Map<String, dynamic> result) async {
    final userData = result['user'] as Map<String, dynamic>?;
    
    if (userData != null) {
      _currentUser = User.fromJson(userData);
      
      // Save user to storage
      await _storageService.setCurrentUser(userData);
      
      Logger.info('Authentication successful for user: ${_currentUser!.displayName}');
    } else {
      throw Exception('No user data in auth response');
    }
  }
  
  // Check if user is following another user
  bool isFollowing(String userId) {
    return _currentUser?.followingIds.contains(userId) ?? false;
  }
  
  // Check if user has blocked another user
  bool hasBlocked(String userId) {
    return _currentUser?.blockedUserIds.contains(userId) ?? false;
  }
  
  // Get user's follower count
  int get followerCount {
    return _currentUser?.followerIds.length ?? 0;
  }
  
  // Get user's following count
  int get followingCount {
    return _currentUser?.followingIds.length ?? 0;
  }
}