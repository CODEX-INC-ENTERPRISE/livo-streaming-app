import 'package:flutter/foundation.dart';

@immutable
class Stream {
  final String id;
  final String hostId;
  final String title;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int peakViewerCount;
  final int totalGiftsReceived;
  final List<String> currentViewerIds;
  final List<ChatMessage> chatHistory;
  final StreamStatus status;
  final List<String> mutedUserIds;
  final List<String> kickedUserIds;
  final List<String> moderatorIds;
  final String? agoraChannelId;

  const Stream({
    required this.id,
    required this.hostId,
    required this.title,
    required this.startedAt,
    this.endedAt,
    required this.peakViewerCount,
    required this.totalGiftsReceived,
    required this.currentViewerIds,
    required this.chatHistory,
    required this.status,
    required this.mutedUserIds,
    required this.kickedUserIds,
    required this.moderatorIds,
    this.agoraChannelId,
  });

  factory Stream.fromJson(Map<String, dynamic> json) {
    return Stream(
      id: json['_id'] ?? json['id'] ?? '',
      hostId: json['hostId'] ?? '',
      title: json['title'] ?? '',
      startedAt: DateTime.parse(json['startedAt']),
      endedAt: json['endedAt'] != null ? DateTime.parse(json['endedAt']) : null,
      peakViewerCount: json['peakViewerCount'] ?? 0,
      totalGiftsReceived: json['totalGiftsReceived'] ?? 0,
      currentViewerIds: List<String>.from(json['currentViewerIds'] ?? []),
      chatHistory: (json['chatHistory'] as List<dynamic>?)
          ?.map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      status: StreamStatus.values.firstWhere(
        (e) => e.name == (json['status'] ?? 'active'),
        orElse: () => StreamStatus.active,
      ),
      mutedUserIds: List<String>.from(json['mutedUserIds'] ?? []),
      kickedUserIds: List<String>.from(json['kickedUserIds'] ?? []),
      moderatorIds: List<String>.from(json['moderatorIds'] ?? []),
      agoraChannelId: json['agoraChannelId'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'hostId': hostId,
      'title': title,
      'startedAt': startedAt.toIso8601String(),
      'endedAt': endedAt?.toIso8601String(),
      'peakViewerCount': peakViewerCount,
      'totalGiftsReceived': totalGiftsReceived,
      'currentViewerIds': currentViewerIds,
      'chatHistory': chatHistory.map((e) => e.toJson()).toList(),
      'status': status.name,
      'mutedUserIds': mutedUserIds,
      'kickedUserIds': kickedUserIds,
      'moderatorIds': moderatorIds,
      'agoraChannelId': agoraChannelId,
    };
  }

  Stream copyWith({
    String? id,
    String? hostId,
    String? title,
    DateTime? startedAt,
    DateTime? endedAt,
    int? peakViewerCount,
    int? totalGiftsReceived,
    List<String>? currentViewerIds,
    List<ChatMessage>? chatHistory,
    StreamStatus? status,
    List<String>? mutedUserIds,
    List<String>? kickedUserIds,
    List<String>? moderatorIds,
    String? agoraChannelId,
  }) {
    return Stream(
      id: id ?? this.id,
      hostId: hostId ?? this.hostId,
      title: title ?? this.title,
      startedAt: startedAt ?? this.startedAt,
      endedAt: endedAt ?? this.endedAt,
      peakViewerCount: peakViewerCount ?? this.peakViewerCount,
      totalGiftsReceived: totalGiftsReceived ?? this.totalGiftsReceived,
      currentViewerIds: currentViewerIds ?? this.currentViewerIds,
      chatHistory: chatHistory ?? this.chatHistory,
      status: status ?? this.status,
      mutedUserIds: mutedUserIds ?? this.mutedUserIds,
      kickedUserIds: kickedUserIds ?? this.kickedUserIds,
      moderatorIds: moderatorIds ?? this.moderatorIds,
      agoraChannelId: agoraChannelId ?? this.agoraChannelId,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Stream && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Stream(id: $id, title: $title, hostId: $hostId, status: $status, viewers: ${currentViewerIds.length})';
  }

  // Helper methods
  int get currentViewerCount => currentViewerIds.length;
  bool get isActive => status == StreamStatus.active;
  bool get isEnded => status == StreamStatus.ended;
  Duration get duration => endedAt != null 
      ? endedAt!.difference(startedAt)
      : DateTime.now().difference(startedAt);
  
  // Check if a user is muted
  bool isUserMuted(String userId) {
    return mutedUserIds.contains(userId);
  }
  
  // Check if a user is kicked
  bool isUserKicked(String userId) {
    return kickedUserIds.contains(userId);
  }
  
  // Check if a user is a moderator
  bool isUserModerator(String userId) {
    return moderatorIds.contains(userId);
  }
  
  // Check if a user can chat (not muted or kicked)
  bool canUserChat(String userId) {
    return !mutedUserIds.contains(userId) && !kickedUserIds.contains(userId);
  }
}

enum StreamStatus {
  active,
  ended,
  terminated,
}

@immutable
class ChatMessage {
  final String id;
  final String streamId;
  final String senderId;
  final String message;
  final DateTime timestamp;
  final bool isPinned;

  const ChatMessage({
    required this.id,
    required this.streamId,
    required this.senderId,
    required this.message,
    required this.timestamp,
    required this.isPinned,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['_id'] ?? json['id'] ?? '',
      streamId: json['streamId'] ?? '',
      senderId: json['senderId'] ?? '',
      message: json['message'] ?? '',
      timestamp: DateTime.parse(json['timestamp']),
      isPinned: json['isPinned'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'streamId': streamId,
      'senderId': senderId,
      'message': message,
      'timestamp': timestamp.toIso8601String(),
      'isPinned': isPinned,
    };
  }

  ChatMessage copyWith({
    String? id,
    String? streamId,
    String? senderId,
    String? message,
    DateTime? timestamp,
    bool? isPinned,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      streamId: streamId ?? this.streamId,
      senderId: senderId ?? this.senderId,
      message: message ?? this.message,
      timestamp: timestamp ?? this.timestamp,
      isPinned: isPinned ?? this.isPinned,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ChatMessage && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'ChatMessage(id: $id, senderId: $senderId, message: $message, timestamp: $timestamp)';
  }
}