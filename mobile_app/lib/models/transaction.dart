import 'package:flutter/foundation.dart';

/// Represents a wallet transaction (coin purchase, gift sent/received, withdrawal, commission).
@immutable
class Transaction {
  final String id;
  final String userId;
  final TransactionType type;
  final int amount;
  final String currency;
  final DateTime timestamp;
  final String description;
  final Map<String, dynamic> metadata;

  const Transaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.currency,
    required this.timestamp,
    required this.description,
    required this.metadata,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['_id'] ?? json['id'] ?? '',
      userId: json['userId'] ?? '',
      type: TransactionType.values.firstWhere(
        (e) => e.name == (json['type'] ?? 'coinPurchase'),
        orElse: () => TransactionType.coinPurchase,
      ),
      amount: json['amount'] ?? 0,
      currency: json['currency'] ?? 'USD',
      timestamp: DateTime.parse(json['timestamp']),
      description: json['description'] ?? '',
      metadata: Map<String, dynamic>.from(json['metadata'] ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type.name,
      'amount': amount,
      'currency': currency,
      'timestamp': timestamp.toIso8601String(),
      'description': description,
      'metadata': metadata,
    };
  }

  Transaction copyWith({
    String? id,
    String? userId,
    TransactionType? type,
    int? amount,
    String? currency,
    DateTime? timestamp,
    String? description,
    Map<String, dynamic>? metadata,
  }) {
    return Transaction(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      amount: amount ?? this.amount,
      currency: currency ?? this.currency,
      timestamp: timestamp ?? this.timestamp,
      description: description ?? this.description,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Transaction && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'Transaction(id: $id, type: $type, amount: $amount $currency, timestamp: $timestamp)';

  // Convenience accessors for common metadata fields
  String? get giftId => metadata['giftId'] as String?;
  String? get streamId => metadata['streamId'] as String?;
  String? get paymentGateway => metadata['paymentGateway'] as String?;
  String? get paymentId => metadata['paymentId'] as String?;
  String? get senderId => metadata['senderId'] as String?;
  String? get receiverId => metadata['receiverId'] as String?;
}

enum TransactionType {
  coinPurchase,
  giftSent,
  giftReceived,
  diamondEarned,
  withdrawal,
  commission,
}
