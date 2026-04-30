import 'package:flutter/foundation.dart';

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
      hostId: json['hostId'] ?? '',
      name: json['name'] ?? '',
      participantLimit: json['participantLimit'] ?? 10,
      createdAt: DateTime.parse(json['createdAt']),
      participants: (json['participants'] as List<dynamic>?)
          ?.map((e) => VoiceParticipant.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      chatHistory: (json['chatHistory'] as List<dynamic>?)
          ?.map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
      status: VoiceRoomStatus.values.firstWhere(
        (e) => e.name == (json['status'] ?? 'active'),
        orElse: () => VoiceRoomStatus.active,
      ),
      agoraChannelId: json['agoraChannelId'],
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
  String toString() {
    return 'VoiceRoom(id: $id, name: $name, hostId: $hostId, participants: ${participants.length}, status: $status)';
  }

  // Helper methods
  int get participantCount => participants.length;
  bool get isActive => status == VoiceRoomStatus.active;
  bool get isEnded => status == VoiceRoomStatus.ended;
  bool get isFull => participantCount >= participantLimit;
  Duration get duration => DateTime.now().difference(createdAt);
  
  // Get host participant
  VoiceParticipant? get hostParticipant {
    return participants.firstWhere(
      (p) => p.userId == hostId,
      orElse: () => VoiceParticipant(userId: '', role: ParticipantRole.listener),
    );
  }
  
  // Get speakers
  List<VoiceParticipant> get speakers {
    return participants.where((p) => p.role == ParticipantRole.speaker).toList();
  }
  
  // Get listeners
  List<VoiceParticipant> get listeners {
    return participants.where((p) => p.role == ParticipantRole.listener).toList();
  }
  
  // Get participants with raised hands
  List<VoiceParticipant> get raisedHands {
    return participants.where((p) => p.isHandRaised).toList();
  }
  
  // Check if user is in room
  bool containsUser(String userId) {
    return participants.any((p) => p.userId == userId);
  }
  
  // Get participant by user ID
  VoiceParticipant? getParticipant(String userId) {
    try {
      return participants.firstWhere((p) => p.userId == userId);
    } catch (e) {
      return null;
    }
  }
  
  // Check if user can speak
  bool canUserSpeak(String userId) {
    final participant = getParticipant(userId);
    return participant != null && participant.role == ParticipantRole.speaker && !participant.isMuted;
  }
}

enum VoiceRoomStatus {
  active,
  ended,
}

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
      joinedAt: json['joinedAt'] != null ? DateTime.parse(json['joinedAt']) : null,
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
  String toString() {
    return 'VoiceParticipant(userId: $userId, role: $role, handRaised: $isHandRaised, muted: $isMuted)';
  }
}

enum ParticipantRole {
  host,
  speaker,
  listener,
}