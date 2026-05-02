import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../core/services/api_service.dart';
import '../core/utils/logger.dart';

class UserProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  Map<String, User> _users = {};
  bool _isLoading = false;
  String? _error;

  bool get isLoading => _isLoading;
  String? get error => _error;

  User? getUser(String userId) => _users[userId];

  Future<User> loadUserProfile(String userId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      if (_users.containsKey(userId)) return _users[userId]!;

      final response = await _apiService.get('/users/$userId');
      if (response.statusCode == 200) {
        final body = response.data as Map<String, dynamic>;
        // Backend wraps profile in { user: {...} }
        final userData = body.containsKey('user')
            ? body['user'] as Map<String, dynamic>
            : body;
        final user = User.fromJson(userData);
        _users[userId] = user;
        return user;
      }
      throw Exception('Failed to load user profile');
    } catch (e) {
      Logger.error('Failed to load user profile: $userId', e);
      _error = 'Failed to load user profile';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> followUser(String targetUserId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      await _apiService.post('/users/follow', data: {'targetUserId': targetUserId});
      Logger.info('Followed user: $targetUserId');
    } catch (e) {
      Logger.error('Failed to follow user: $targetUserId', e);
      _error = 'Failed to follow user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> unfollowUser(String targetUserId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      await _apiService.delete('/users/follow/$targetUserId');
      Logger.info('Unfollowed user: $targetUserId');
    } catch (e) {
      Logger.error('Failed to unfollow user: $targetUserId', e);
      _error = 'Failed to unfollow user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> blockUser(String targetUserId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      await _apiService.post('/users/block', data: {'targetUserId': targetUserId});
      Logger.info('Blocked user: $targetUserId');
    } catch (e) {
      Logger.error('Failed to block user: $targetUserId', e);
      _error = 'Failed to block user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> reportUser({
    required String reportedUserId,
    required String reason,
    required String description,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      await _apiService.post('/users/report', data: {
        'reportedUserId': reportedUserId,
        'reason': reason,
        'description': description,
      });
      Logger.info('Reported user: $reportedUserId');
    } catch (e) {
      Logger.error('Failed to report user: $reportedUserId', e);
      _error = 'Failed to report user';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<User>> searchUsers(String query) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final response = await _apiService.get('/users/search', queryParameters: {'q': query});
      if (response.statusCode == 200) {
        final body = response.data;
        final List<dynamic> data = body is List ? body : (body['users'] ?? []);
        final users = data.map((d) => User.fromJson(d as Map<String, dynamic>)).toList();
        for (final u in users) {
          _users[u.id] = u;
        }
        return users;
      }
      throw Exception('Failed to search users');
    } catch (e) {
      Logger.error('Failed to search users: $query', e);
      _error = 'Failed to search users';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<User>> getUserFollowers(String userId, {int page = 1, int limit = 20}) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final response = await _apiService.get(
        '/users/$userId/followers',
        queryParameters: {'page': page, 'limit': limit},
      );
      if (response.statusCode == 200) {
        final body = response.data;
        // Backend returns { followers: [...], pagination: {...} }
        final List<dynamic> data = body is List ? body : (body['followers'] ?? []);
        final users = data.map((d) => User.fromJson(d as Map<String, dynamic>)).toList();
        for (final u in users) {
          _users[u.id] = u;
        }
        return users;
      }
      throw Exception('Failed to load followers');
    } catch (e) {
      Logger.error('Failed to load followers for user: $userId', e);
      _error = 'Failed to load followers';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<User>> getUserFollowing(String userId, {int page = 1, int limit = 20}) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      final response = await _apiService.get(
        '/users/$userId/following',
        queryParameters: {'page': page, 'limit': limit},
      );
      if (response.statusCode == 200) {
        final body = response.data;
        // Backend returns { following: [...], pagination: {...} }
        final List<dynamic> data = body is List ? body : (body['following'] ?? []);
        final users = data.map((d) => User.fromJson(d as Map<String, dynamic>)).toList();
        for (final u in users) {
          _users[u.id] = u;
        }
        return users;
      }
      throw Exception('Failed to load following');
    } catch (e) {
      Logger.error('Failed to load following for user: $userId', e);
      _error = 'Failed to load following';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void invalidateUser(String userId) {
    _users.remove(userId);
    notifyListeners();
  }

  void clearCache() {
    _users = {};
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
