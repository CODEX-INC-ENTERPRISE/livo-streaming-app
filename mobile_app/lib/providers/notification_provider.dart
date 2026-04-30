import 'package:flutter/foundation.dart';
import '../models/notification.dart';
import '../core/services/api_service.dart';
import '../core/services/socket_service.dart';
import '../core/utils/logger.dart';

class NotificationProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  final SocketService _socketService = SocketService();
  
  List<Notification> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String? _error;
  
  // Getters
  List<Notification> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasUnreadNotifications => _unreadCount > 0;
  
  // Initialize provider
  Future<void> initialize(String userId) async {
    try {
      // Setup socket event listeners
      _setupSocketListeners();
      
      // Load notifications
      await loadNotifications(userId);
    } catch (e) {
      Logger.error('Failed to initialize notification provider', e);
    }
  }
  
  // Setup socket event listeners
  void _setupSocketListeners() {
    _socketService.notificationEvents.listen((event) {
      final type = event['type'] as String;
      final data = event['data'] as Map<String, dynamic>;
      
      if (type == 'new_notification') {
        _handleNewNotification(data);
      }
    });
  }
  
  // Load notifications
  Future<void> loadNotifications(String userId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.get(
        '/notifications/$userId',
        queryParameters: {
          'page': 1,
          'limit': 50,
        },
      );
      
      if (response.statusCode == 200) {
        final notificationsData = response.data as List<dynamic>;
        _notifications = notificationsData
            .map((data) => Notification.fromJson(data as Map<String, dynamic>))
            .toList();
        
        // Calculate unread count
        _unreadCount = _notifications.where((n) => n.isUnread).length;
        
        Logger.info('Loaded ${_notifications.length} notifications ($_unreadCount unread)');
      } else {
        throw Exception('Failed to load notifications');
      }
    } catch (e) {
      Logger.error('Failed to load notifications', e);
      _error = 'Failed to load notifications';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Mark notification as read
  Future<void> markAsRead(String notificationId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.put(
        '/notifications/$notificationId/read',
      );
      
      if (response.statusCode == 200) {
        // Update local notification
        final index = _notifications.indexWhere((n) => n.id == notificationId);
        if (index != -1) {
          final notification = _notifications[index];
          _notifications[index] = notification.copyWith(isRead: true);
          
          // Update unread count
          if (notification.isUnread) {
            _unreadCount--;
          }
        }
        
        Logger.info('Notification marked as read: $notificationId');
      } else {
        throw Exception('Failed to mark notification as read');
      }
    } catch (e) {
      Logger.error('Failed to mark notification as read', e);
      _error = 'Failed to mark notification as read';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Mark all notifications as read
  Future<void> markAllAsRead() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // In a real app, we would call an API endpoint
      // For now, update locally
      for (int i = 0; i < _notifications.length; i++) {
        if (_notifications[i].isUnread) {
          _notifications[i] = _notifications[i].copyWith(isRead: true);
        }
      }
      
      _unreadCount = 0;
      
      Logger.info('All notifications marked as read');
    } catch (e) {
      Logger.error('Failed to mark all notifications as read', e);
      _error = 'Failed to mark all notifications as read';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Delete notification
  Future<void> deleteNotification(String notificationId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // In a real app, we would call DELETE /notifications/:id
      // For now, remove locally
      final notification = _notifications.firstWhere(
        (n) => n.id == notificationId,
        orElse: () => throw Exception('Notification not found'),
      );
      
      _notifications.removeWhere((n) => n.id == notificationId);
      
      // Update unread count if notification was unread
      if (notification.isUnread) {
        _unreadCount--;
      }
      
      Logger.info('Notification deleted: $notificationId');
    } catch (e) {
      Logger.error('Failed to delete notification', e);
      _error = 'Failed to delete notification';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Clear all notifications
  Future<void> clearAllNotifications() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // In a real app, we would call an API endpoint
      // For now, clear locally
      _notifications.clear();
      _unreadCount = 0;
      
      Logger.info('All notifications cleared');
    } catch (e) {
      Logger.error('Failed to clear all notifications', e);
      _error = 'Failed to clear all notifications';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Handle new notification from socket
  void _handleNewNotification(Map<String, dynamic> data) {
    try {
      final notification = Notification.fromJson(data);
      
      // Add to beginning of list
      _notifications.insert(0, notification);
      
      // Update unread count
      if (notification.isUnread) {
        _unreadCount++;
      }
      
      // Limit notifications list size
      if (_notifications.length > 100) {
        _notifications = _notifications.take(100).toList();
      }
      
      Logger.info('New notification received: ${notification.title}');
      notifyListeners();
    } catch (e) {
      Logger.error('Failed to handle new notification', e);
    }
  }
  
  // Get notifications by type
  List<Notification> getNotificationsByType(NotificationType type) {
    return _notifications.where((n) => n.type == type).toList();
  }
  
  // Get unread notifications
  List<Notification> getUnreadNotifications() {
    return _notifications.where((n) => n.isUnread).toList();
  }
  
  // Get recent notifications (last 24 hours)
  List<Notification> getRecentNotifications() {
    final now = DateTime.now();
    return _notifications
        .where((n) => now.difference(n.createdAt).inHours <= 24)
        .toList();
  }
  
  // Get notification by ID
  Notification? getNotificationById(String notificationId) {
    try {
      return _notifications.firstWhere((n) => n.id == notificationId);
    } catch (e) {
      return null;
    }
  }
  
  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
  
  // Refresh notifications
  Future<void> refreshNotifications(String userId) async {
    await loadNotifications(userId);
  }
  
  // Add notification locally (for testing or manual addition)
  void addNotification(Notification notification) {
    _notifications.insert(0, notification);
    
    if (notification.isUnread) {
      _unreadCount++;
    }
    
    notifyListeners();
  }
}