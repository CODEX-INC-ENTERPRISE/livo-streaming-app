import 'package:flutter/foundation.dart';
import 'chat_message.dart';

export 'chat_message.dart';

/// Represents a live stream session.
@immutable
class LiveStream {
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

  const LiveStream({
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

  factory LiveStream.fromJson(Map<String, dynamic> json) {
    return LiveStream(
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
              .toList() ??
          [],
      status: StreamStatus.values.firstWhere(
        (e) => e.name == (json['status'] ?? 'active'),
        orElse: () => StreamStatus.active,
      ),
      mutedUserIds: List<String>.from(json['mutedUserIds'] ?? []),
      kickedUserIds: List<String>.from(json['kickedUserIds'] ?? []),
      moderatorIds: List<String>.from(json['moderatorIds'] ?? []),
      agoraChannelId: json['agoraChannelId'] as String?,
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

  LiveStream copyWith({
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
    return LiveStream(
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
    return other is LiveStream && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'LiveStream(id: $id, title: $title, hostId: $hostId, status: $status, viewers: ${currentViewerIds.length})';

  // Helper methods
  int get currentViewerCount => currentViewerIds.length;
  bool get isActive => status == StreamStatus.active;
  bool get isEnded => status == StreamStatus.ended;
  Duration get duration => endedAt != null
      ? endedAt!.difference(startedAt)
      : DateTime.now().difference(startedAt);

  bool isUserMuted(String userId) => mutedUserIds.contains(userId);
  bool isUserKicked(String userId) => kickedUserIds.contains(userId);
  bool isUserModerator(String userId) => moderatorIds.contains(userId);
  bool canUserChat(String userId) =>
      !mutedUserIds.contains(userId) && !kickedUserIds.contains(userId);
}

enum StreamStatus {
  active,
  ended,
  terminated,
}
