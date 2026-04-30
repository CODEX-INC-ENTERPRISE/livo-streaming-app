import 'package:flutter/foundation.dart';

@immutable
class UserWallet {
  final String userId;
  final int coinBalance;
  final int diamondBalance;
  final List<Transaction> transactionHistory;

  const UserWallet({
    required this.userId,
    required this.coinBalance,
    required this.diamondBalance,
    required this.transactionHistory,
  });

  factory UserWallet.fromJson(Map<String, dynamic> json) {
    return UserWallet(
      userId: json['userId'] ?? '',
      coinBalance: json['coinBalance'] ?? 0,
      diamondBalance: json['diamondBalance'] ?? 0,
      transactionHistory: (json['transactionHistory'] as List<dynamic>?)
          ?.map((e) => Transaction.fromJson(e as Map<String, dynamic>))
          .toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'coinBalance': coinBalance,
      'diamondBalance': diamondBalance,
      'transactionHistory': transactionHistory.map((e) => e.toJson()).toList(),
    };
  }

  UserWallet copyWith({
    String? userId,
    int? coinBalance,
    int? diamondBalance,
    List<Transaction>? transactionHistory,
  }) {
    return UserWallet(
      userId: userId ?? this.userId,
      coinBalance: coinBalance ?? this.coinBalance,
      diamondBalance: diamondBalance ?? this.diamondBalance,
      transactionHistory: transactionHistory ?? this.transactionHistory,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is UserWallet && other.userId == userId;
  }

  @override
  int get hashCode => userId.hashCode;

  @override
  String toString() {
    return 'UserWallet(userId: $userId, coins: $coinBalance, diamonds: $diamondBalance, transactions: ${transactionHistory.length})';
  }

  // Helper methods
  double get coinBalanceInCurrency => coinBalance.toDouble();
  double get diamondBalanceInCurrency => diamondBalance.toDouble();
  bool get hasSufficientCoins => coinBalance > 0;
  bool get hasSufficientDiamonds => diamondBalance > 0;
  
  // Get recent transactions
  List<Transaction> getRecentTransactions({int limit = 10}) {
    final sorted = List<Transaction>.from(transactionHistory)
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sorted.take(limit).toList();
  }
  
  // Get transactions by type
  List<Transaction> getTransactionsByType(TransactionType type) {
    return transactionHistory.where((t) => t.type == type).toList();
  }
  
  // Get total spent on gifts
  int get totalGiftsSpent {
    return transactionHistory
        .where((t) => t.type == TransactionType.giftSent)
        .fold(0, (sum, t) => sum + t.amount);
  }
  
  // Get total diamonds earned
  int get totalDiamondsEarned {
    return transactionHistory
        .where((t) => t.type == TransactionType.giftReceived || t.type == TransactionType.diamondEarned)
        .fold(0, (sum, t) => sum + t.amount);
  }
}

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
  String toString() {
    return 'Transaction(id: $id, type: $type, amount: $amount $currency, timestamp: $timestamp)';
  }

  // Helper methods
  bool get isCredit => amount > 0;
  bool get isDebit => amount < 0;
  String get formattedAmount => '${isCredit ? '+' : ''}$amount $currency';
  
  // Get metadata values
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