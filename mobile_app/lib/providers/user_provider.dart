import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../core/services/api_service.dart';
import '../core/utils/logger.dart';

class UserProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  
  Map<String, User> _users = {};
  bool _isLoading = false;
  String? _error;
  
  // Getters
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  // Get user by ID
  User? getUser(String userId) {
    return _users[userId];
  }
  
  // Load user profile
  Future<User> loadUserProfile(String userId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // Check if user is already cached
      if (_users.containsKey(userId)) {
        return _users[userId]!;
      }
      
      // Load user from API
      final response = await _apiService.get('/users/$userId');
      
      if (response.statusCode == 200) {
        final userData = response.data as Map<String, dynamic>;
        final user = User.fromJson(userData);
        
        // Cache the user
        _users[userId] = user;
        
        return user;
      } else {
        throw Exception('Failed to load user profile');
      }
    } catch (e) {
      Logger.error('Failed to load user profile: $userId', e);
      _error = 'Failed to load user profile';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Follow a user
  Future<void> followUser(String targetUserId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/users/follow',
        data: {'targetUserId': targetUserId},
      );
      
      if (response.statusCode == 200) {
        // Update cached user if exists
        if (_users.containsKey(targetUserId)) {
          final user = _users[targetUserId]!;
          // In a real app, we would update the follower count
          // For now, just notify listeners
        }
        
        Logger.info('Successfully followed user: $targetUserId');
      } else {
        throw Exception('Failed to follow user');
      }
    } catch (e) {
      Logger.error('Failed to follow user: $targetUserId', e);
      _error = 'Failed to follow user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Unfollow a user
  Future<void> unfollowUser(String targetUserId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.delete(
        '/users/follow/$targetUserId',
      );
      
      if (response.statusCode == 200) {
        // Update cached user if exists
        if (_users.containsKey(targetUserId)) {
          final user = _users[targetUserId]!;
          // In a real app, we would update the follower count
          // For now, just notify listeners
        }
        
        Logger.info('Successfully unfollowed user: $targetUserId');
      } else {
        throw Exception('Failed to unfollow user');
      }
    } catch (e) {
      Logger.error('Failed to unfollow user: $targetUserId', e);
      _error = 'Failed to unfollow user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Block a user
  Future<void> blockUser(String targetUserId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/users/block',
        data: {'targetUserId': targetUserId},
      );
      
      if (response.statusCode == 200) {
        // Update cached user if exists
        if (_users.containsKey(targetUserId)) {
          final user = _users[targetUserId]!;
          // In a real app, we would mark the user as blocked
          // For now, just notify listeners
        }
        
        Logger.info('Successfully blocked user: $targetUserId');
      } else {
        throw Exception('Failed to block user');
      }
    } catch (e) {
      Logger.error('Failed to block user: $targetUserId', e);
      _error = 'Failed to block user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Report a user
  Future<void> reportUser({
    required String reportedUserId,
    required String reason,
    required String description,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/users/report',
        data: {
          'reportedUserId': reportedUserId,
          'reason': reason,
          'description': description,
        },
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        Logger.info('Successfully reported user: $reportedUserId');
      } else {
        throw Exception('Failed to report user');
      }
    } catch (e) {
      Logger.error('Failed to report user: $reportedUserId', e);
      _error = 'Failed to report user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Search users
  Future<List<User>> searchUsers(String query) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.get(
        '/users/search',
        queryParameters: {'q': query},
      );
      
      if (response.statusCode == 200) {
        final usersData = response.data as List<dynamic>;
        final users = usersData
            .map((data) => User.fromJson(data as Map<String, dynamic>))
            .toList();
        
        // Cache the users
        for (final user in users) {
          _users[user.id] = user;
        }
        
        return users;
      } else {
        throw Exception('Failed to search users');
      }
    } catch (e) {
      Logger.error('Failed to search users: $query', e);
      _error = 'Failed to search users';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Get user's followers
  Future<List<User>> getUserFollowers(String userId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.get(
        '/users/$userId/followers',
      );
      
      if (response.statusCode == 200) {
        final followersData = response.data as List<dynamic>;
        final followers = followersData
            .map((data) => User.fromJson(data as Map<String, dynamic>))
            .toList();
        
        // Cache the users
        for (final user in followers) {
          _users[user.id] = user;
        }
        
        return followers;
      } else {
        throw Exception('Failed to load followers');
      }
    } catch (e) {
      Logger.error('Failed to load followers for user: $userId', e);
      _error = 'Failed to load followers';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Get user's following
  Future<List<User>> getUserFollowing(String userId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.get(
        '/users/$userId/following',
      );
      
      if (response.statusCode == 200) {
        final followingData = response.data as List<dynamic>;
        final following = followingData
            .map((data) => User.fromJson(data as Map<String, dynamic>))
            .toList();
        
        // Cache the users
        for (final user in following) {
          _users[user.id] = user;
        }
        
        return following;
      } else {
        throw Exception('Failed to load following');
      }
    } catch (e) {
      Logger.error('Failed to load following for user: $userId', e);
      _error = 'Failed to load following';
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
  
  // Clear cache
  void clearCache() {
    _users.clear();
    notifyListeners();
  }
  
  // Preload multiple users
  Future<void> preloadUsers(List<String> userIds) async {
    try {
      _isLoading = true;
      notifyListeners();
      
      // Filter out already cached users
      final uncachedIds = userIds.where((id) => !_users.containsKey(id)).toList();
      
      if (uncachedIds.isEmpty) {
        return;
      }
      
      // In a real app, we might batch load users
      // For now, load them one by one
      for (final userId in uncachedIds) {
        try {
          await loadUserProfile(userId);
        } catch (e) {
          Logger.error('Failed to preload user: $userId', e);
          // Continue with other users
        }
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}