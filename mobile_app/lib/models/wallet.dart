import 'package:flutter/foundation.dart';
import 'transaction.dart';

export 'transaction.dart';

/// Represents a user's wallet with coin and diamond balances.
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
              .toList() ??
          [],
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
  String toString() =>
      'UserWallet(userId: $userId, coins: $coinBalance, diamonds: $diamondBalance)';

  // Helper methods
  bool get hasSufficientCoins => coinBalance > 0;
  bool get hasSufficientDiamonds => diamondBalance > 0;

  List<Transaction> getRecentTransactions({int limit = 10}) {
    final sorted = List<Transaction>.from(transactionHistory)
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sorted.take(limit).toList();
  }

  List<Transaction> getTransactionsByType(TransactionType type) =>
      transactionHistory.where((t) => t.type == type).toList();

  int get totalGiftsSpent => transactionHistory
      .where((t) => t.type == TransactionType.giftSent)
      .fold(0, (sum, t) => sum + t.amount);

  int get totalDiamondsEarned => transactionHistory
      .where((t) =>
          t.type == TransactionType.giftReceived ||
          t.type == TransactionType.diamondEarned)
      .fold(0, (sum, t) => sum + t.amount);
}
