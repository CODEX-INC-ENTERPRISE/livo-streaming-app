import 'package:flutter/foundation.dart';
import 'chat_message.dart';

/// Represents a multi-user audio voice room session.
@immutable
class VoiceRoom {
  final String id;
  final String hostId;
  final String name;
  final int participantLimit;
  final DateTime createdAt;
  final List<VoiceParticipant> participants;
  final List<ChatMessage> chatHistory;
  final VoiceRoomStatus status;
  final String? agoraChannelId;

  const VoiceRoom({
    required this.id,
    required this.hostId,
    required this.name,
    required this.participantLimit,
    required this.createdAt,
    required this.participants,
    required this.chatHistory,
    required this.status,
    this.agoraChannelId,
  });

  factory VoiceRoom.fromJson(Map<String, dynamic> json) {
    return VoiceRoom(
      id: json['_id'] ?? json['id'] ?? '',
      hostId: (json['hostId'] is Map ? json['hostId']['_id'] : json['hostId']) ?? '',
      name: json['name'] ?? '',
      participantLimit: json['participantLimit'] ?? 10,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      participants: (json['participants'] as List<dynamic>?)
              ?.map((e) => VoiceParticipant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      chatHistory: (json['chatHistory'] as List<dynamic>?)
              ?.map((e) {
                final msg = e as Map<String, dynamic>;
                // Ensure timestamp exists — fall back to now if missing
                if (!msg.containsKey('timestamp')) {
                  msg['timestamp'] = DateTime.now().toIso8601String();
                }
                return ChatMessage.fromJson(msg);
              })
              .toList() ??
          [],
      status: VoiceRoomStatus.values.firstWhere(
        (e) => e.name == (json['status'] ?? 'active'),
        orElse: () => VoiceRoomStatus.active,
      ),
      agoraChannelId: json['agoraChannelId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'hostId': hostId,
      'name': name,
      'participantLimit': participantLimit,
      'createdAt': createdAt.toIso8601String(),
      'participants': participants.map((e) => e.toJson()).toList(),
      'chatHistory': chatHistory.map((e) => e.toJson()).toList(),
      'status': status.name,
      'agoraChannelId': agoraChannelId,
    };
  }

  VoiceRoom copyWith({
    String? id,
    String? hostId,
    String? name,
    int? participantLimit,
    DateTime? createdAt,
    List<VoiceParticipant>? participants,
    List<ChatMessage>? chatHistory,
    VoiceRoomStatus? status,
    String? agoraChannelId,
  }) {
    return VoiceRoom(
      id: id ?? this.id,
      hostId: hostId ?? this.hostId,
      name: name ?? this.name,
      participantLimit: participantLimit ?? this.participantLimit,
      createdAt: createdAt ?? this.createdAt,
      participants: participants ?? this.participants,
      chatHistory: chatHistory ?? this.chatHistory,
      status: status ?? this.status,
      agoraChannelId: agoraChannelId ?? this.agoraChannelId,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is VoiceRoom && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'VoiceRoom(id: $id, name: $name, hostId: $hostId, participants: ${participants.length}, status: $status)';

  // Helper methods
  int get participantCount => participants.length;
  bool get isActive => status == VoiceRoomStatus.active;
  bool get isEnded => status == VoiceRoomStatus.ended;
  bool get isFull => participantCount >= participantLimit;
  Duration get duration => DateTime.now().difference(createdAt);

  VoiceParticipant? get hostParticipant =>
      participants.where((p) => p.userId == hostId).firstOrNull;

  List<VoiceParticipant> get speakers =>
      participants.where((p) => p.role == ParticipantRole.speaker).toList();

  List<VoiceParticipant> get listeners =>
      participants.where((p) => p.role == ParticipantRole.listener).toList();

  List<VoiceParticipant> get raisedHands =>
      participants.where((p) => p.isHandRaised).toList();

  bool containsUser(String userId) =>
      participants.any((p) => p.userId == userId);

  VoiceParticipant? getParticipant(String userId) =>
      participants.where((p) => p.userId == userId).firstOrNull;

  bool canUserSpeak(String userId) {
    final participant = getParticipant(userId);
    return participant != null &&
        participant.role == ParticipantRole.speaker &&
        !participant.isMuted;
  }
}

enum VoiceRoomStatus { active, ended }

/// A participant in a voice room.
@immutable
class VoiceParticipant {
  final String userId;
  final ParticipantRole role;
  final bool isHandRaised;
  final bool isMuted;
  final DateTime? joinedAt;

  const VoiceParticipant({
    required this.userId,
    required this.role,
    this.isHandRaised = false,
    this.isMuted = false,
    this.joinedAt,
  });

  factory VoiceParticipant.fromJson(Map<String, dynamic> json) {
    return VoiceParticipant(
      userId: json['userId'] ?? '',
      role: ParticipantRole.values.firstWhere(
        (e) => e.name == (json['role'] ?? 'listener'),
        orElse: () => ParticipantRole.listener,
      ),
      isHandRaised: json['isHandRaised'] ?? false,
      isMuted: json['isMuted'] ?? false,
      joinedAt:
          json['joinedAt'] != null ? DateTime.parse(json['joinedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'role': role.name,
      'isHandRaised': isHandRaised,
      'isMuted': isMuted,
      'joinedAt': joinedAt?.toIso8601String(),
    };
  }

  VoiceParticipant copyWith({
    String? userId,
    ParticipantRole? role,
    bool? isHandRaised,
    bool? isMuted,
    DateTime? joinedAt,
  }) {
    return VoiceParticipant(
      userId: userId ?? this.userId,
      role: role ?? this.role,
      isHandRaised: isHandRaised ?? this.isHandRaised,
      isMuted: isMuted ?? this.isMuted,
      joinedAt: joinedAt ?? this.joinedAt,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is VoiceParticipant && other.userId == userId;
  }

  @override
  int get hashCode => userId.hashCode;

  @override
  String toString() =>
      'VoiceParticipant(userId: $userId, role: $role, handRaised: $isHandRaised, muted: $isMuted)';
}

enum ParticipantRole { host, speaker, listener }
