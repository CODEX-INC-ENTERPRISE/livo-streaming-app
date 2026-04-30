import 'package:flutter/foundation.dart';

@immutable
class User {
  final String id;
  final String? phoneNumber;
  final String? email;
  final String displayName;
  final String? bio;
  final String? profilePictureUrl;
  final DateTime registeredAt;
  final DateTime? lastLoginAt;
  final bool isBlocked;
  final bool isHost;
  final List<String> followerIds;
  final List<String> followingIds;
  final List<String> blockedUserIds;
  final Map<String, dynamic>? wallet;
  final Map<String, bool>? notificationPrefs;

  const User({
    required this.id,
    this.phoneNumber,
    this.email,
    required this.displayName,
    this.bio,
    this.profilePictureUrl,
    required this.registeredAt,
    this.lastLoginAt,
    required this.isBlocked,
    required this.isHost,
    required this.followerIds,
    required this.followingIds,
    required this.blockedUserIds,
    this.wallet,
    this.notificationPrefs,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? json['id'] ?? '',
      phoneNumber: json['phoneNumber'],
      email: json['email'],
      displayName: json['displayName'] ?? '',
      bio: json['bio'],
      profilePictureUrl: json['profilePictureUrl'],
      registeredAt: DateTime.parse(json['registeredAt']),
      lastLoginAt: json['lastLoginAt'] != null ? DateTime.parse(json['lastLoginAt']) : null,
      isBlocked: json['isBlocked'] ?? false,
      isHost: json['isHost'] ?? false,
      followerIds: List<String>.from(json['followerIds'] ?? []),
      followingIds: List<String>.from(json['followingIds'] ?? []),
      blockedUserIds: List<String>.from(json['blockedUserIds'] ?? []),
      wallet: json['wallet'] != null ? Map<String, dynamic>.from(json['wallet']) : null,
      notificationPrefs: json['notificationPrefs'] != null ? Map<String, bool>.from(json['notificationPrefs']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phoneNumber': phoneNumber,
      'email': email,
      'displayName': displayName,
      'bio': bio,
      'profilePictureUrl': profilePictureUrl,
      'registeredAt': registeredAt.toIso8601String(),
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'isBlocked': isBlocked,
      'isHost': isHost,
      'followerIds': followerIds,
      'followingIds': followingIds,
      'blockedUserIds': blockedUserIds,
      'wallet': wallet,
      'notificationPrefs': notificationPrefs,
    };
  }

  User copyWith({
    String? id,
    String? phoneNumber,
    String? email,
    String? displayName,
    String? bio,
    String? profilePictureUrl,
    DateTime? registeredAt,
    DateTime? lastLoginAt,
    bool? isBlocked,
    bool? isHost,
    List<String>? followerIds,
    List<String>? followingIds,
    List<String>? blockedUserIds,
    Map<String, dynamic>? wallet,
    Map<String, bool>? notificationPrefs,
  }) {
    return User(
      id: id ?? this.id,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      bio: bio ?? this.bio,
      profilePictureUrl: profilePictureUrl ?? this.profilePictureUrl,
      registeredAt: registeredAt ?? this.registeredAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      isBlocked: isBlocked ?? this.isBlocked,
      isHost: isHost ?? this.isHost,
      followerIds: followerIds ?? this.followerIds,
      followingIds: followingIds ?? this.followingIds,
      blockedUserIds: blockedUserIds ?? this.blockedUserIds,
      wallet: wallet ?? this.wallet,
      notificationPrefs: notificationPrefs ?? this.notificationPrefs,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is User && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'User(id: $id, displayName: $displayName, email: $email, isHost: $isHost)';
  }

  // Helper methods
  int get followerCount => followerIds.length;
  int get followingCount => followingIds.length;
  bool get isAuthenticated => id.isNotEmpty;
  bool get hasProfilePicture => profilePictureUrl != null && profilePictureUrl!.isNotEmpty;
  
  // Check if this user follows another user
  bool follows(String userId) {
    return followingIds.contains(userId);
  }
  
  // Check if this user is followed by another user
  bool isFollowedBy(String userId) {
    return followerIds.contains(userId);
  }
  
  // Check if this user has blocked another user
  bool hasBlocked(String userId) {
    return blockedUserIds.contains(userId);
  }
}