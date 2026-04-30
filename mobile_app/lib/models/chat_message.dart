import 'package:flutter/foundation.dart';

/// Represents a chat message in a stream or voice room.
@immutable
class ChatMessage {
  final String id;
  final String? streamId;
  final String? voiceRoomId;
  final String senderId;
  final String? senderName;
  final String message;
  final DateTime timestamp;
  final bool isPinned;

  const ChatMessage({
    required this.id,
    this.streamId,
    this.voiceRoomId,
    required this.senderId,
    this.senderName,
    required this.message,
    required this.timestamp,
    this.isPinned = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['_id'] ?? json['id'] ?? '',
      streamId: json['streamId'] as String?,
      voiceRoomId: json['voiceRoomId'] as String?,
      senderId: json['senderId'] ?? '',
      senderName: json['senderName'] as String?,
      message: json['message'] ?? '',
      timestamp: DateTime.parse(json['timestamp']),
      isPinned: json['isPinned'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      if (streamId != null) 'streamId': streamId,
      if (voiceRoomId != null) 'voiceRoomId': voiceRoomId,
      'senderId': senderId,
      if (senderName != null) 'senderName': senderName,
      'message': message,
      'timestamp': timestamp.toIso8601String(),
      'isPinned': isPinned,
    };
  }

  ChatMessage copyWith({
    String? id,
    String? streamId,
    String? voiceRoomId,
    String? senderId,
    String? senderName,
    String? message,
    DateTime? timestamp,
    bool? isPinned,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      streamId: streamId ?? this.streamId,
      voiceRoomId: voiceRoomId ?? this.voiceRoomId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
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
  String toString() =>
      'ChatMessage(id: $id, senderId: $senderId, message: $message, timestamp: $timestamp)';
}
