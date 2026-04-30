import 'package:flutter/foundation.dart';

@immutable
class Notification {
  final String id;
  final String userId;
  final NotificationType type;
  final String title;
  final String message;
  final Map<String, dynamic> data;
  final DateTime createdAt;
  final bool isRead;

  const Notification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    required this.data,
    required this.createdAt,
    required this.isRead,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      id: json['_id'] ?? json['id'] ?? '',
      userId: json['userId'] ?? '',
      type: NotificationType.values.firstWhere(
        (e) => e.name == (json['type'] ?? 'general'),
        orElse: () => NotificationType.general,
      ),
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      data: Map<String, dynamic>.from(json['data'] ?? {}),
      createdAt: DateTime.parse(json['createdAt']),
      isRead: json['isRead'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type.name,
      'title': title,
      'message': message,
      'data': data,
      'createdAt': createdAt.toIso8601String(),
      'isRead': isRead,
    };
  }

  Notification copyWith({
    String? id,
    String? userId,
    NotificationType? type,
    String? title,
    String? message,
    Map<String, dynamic>? data,
    DateTime? createdAt,
    bool? isRead,
  }) {
    return Notification(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      data: data ?? this.data,
      createdAt: createdAt ?? this.createdAt,
      isRead: isRead ?? this.isRead,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Notification && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Notification(id: $id, type: $type, title: $title, read: $isRead)';
  }

  // Helper methods
  bool get isUnread => !isRead;
  Duration get age => DateTime.now().difference(createdAt);
  String get timeAgo {
    final days = age.inDays;
    final hours = age.inHours;
    final minutes = age.inMinutes;
    
    if (days > 0) return '${days}d ago';
    if (hours > 0) return '${hours}h ago';
    if (minutes > 0) return '${minutes}m ago';
    return 'Just now';
  }
  
  // Get data values
  String? get streamId => data['streamId'] as String?;
  String? get giftId => data['giftId'] as String?;
  String? get senderId => data['senderId'] as String?;
  String? get followerId => data['followerId'] as String?;
  String? get roomId => data['roomId'] as String?;
  String? get action => data['action'] as String?;
  int? get amount => data['amount'] as int?;
}

enum NotificationType {
  streamStarted,
  giftReceived,
  newFollower,
  newMessage,
  withdrawalApproved,
  withdrawalRejected,
  hostApproved,
  hostRejected,
  voiceRoomInvite,
  streamEnded,
  system,
  general,
}