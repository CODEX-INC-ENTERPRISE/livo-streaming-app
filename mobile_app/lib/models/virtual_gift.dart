import 'package:flutter/foundation.dart';

@immutable
class VirtualGift {
  final String id;
  final String name;
  final int coinPrice;
  final int diamondValue;
  final String animationAssetUrl;
  final String thumbnailUrl;
  final GiftCategory category;
  final bool isActive;

  const VirtualGift({
    required this.id,
    required this.name,
    required this.coinPrice,
    required this.diamondValue,
    required this.animationAssetUrl,
    required this.thumbnailUrl,
    required this.category,
    required this.isActive,
  });

  factory VirtualGift.fromJson(Map<String, dynamic> json) {
    return VirtualGift(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      coinPrice: json['coinPrice'] ?? 0,
      diamondValue: json['diamondValue'] ?? 0,
      animationAssetUrl: json['animationAssetUrl'] ?? '',
      thumbnailUrl: json['thumbnailUrl'] ?? '',
      category: GiftCategory.values.firstWhere(
        (e) => e.name == (json['category'] ?? 'common'),
        orElse: () => GiftCategory.common,
      ),
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'coinPrice': coinPrice,
      'diamondValue': diamondValue,
      'animationAssetUrl': animationAssetUrl,
      'thumbnailUrl': thumbnailUrl,
      'category': category.name,
      'isActive': isActive,
    };
  }

  VirtualGift copyWith({
    String? id,
    String? name,
    int? coinPrice,
    int? diamondValue,
    String? animationAssetUrl,
    String? thumbnailUrl,
    GiftCategory? category,
    bool? isActive,
  }) {
    return VirtualGift(
      id: id ?? this.id,
      name: name ?? this.name,
      coinPrice: coinPrice ?? this.coinPrice,
      diamondValue: diamondValue ?? this.diamondValue,
      animationAssetUrl: animationAssetUrl ?? this.animationAssetUrl,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      category: category ?? this.category,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is VirtualGift && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'VirtualGift(id: $id, name: $name, price: $coinPrice coins, value: $diamondValue diamonds)';
  }

  // Helper methods
  double get valueRatio => diamondValue / coinPrice;
  bool get isAffordable => coinPrice > 0;
  bool get isPremium => category == GiftCategory.premium || category == GiftCategory.exclusive;
  
  // Get display price
  String get displayPrice => '$coinPrice Coins';
  String get displayValue => '$diamondValue Diamonds';
}

enum GiftCategory {
  common,
  rare,
  epic,
  legendary,
  premium,
  exclusive,
  seasonal,
  event,
}