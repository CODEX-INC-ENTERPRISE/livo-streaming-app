import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../models/transaction.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wallet_provider.dart';

/// Wallet screen – shows coin/diamond balances, transaction history with
/// filtering, and navigation to purchase / withdrawal flows.
///
/// Route: [AppRoutes.wallet]
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  TransactionType? _selectedFilter;
  List<Transaction> _transactions = [];
  bool _txLoading = false;
  int _currentPage = 1;
  bool _hasMore = true;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) return;
    await context.read<WalletProvider>().loadWallet(userId);
    await _loadTransactions(reset: true);
  }

  Future<void> _loadTransactions({bool reset = false}) async {
    if (_txLoading) return;
    if (reset) {
      setState(() {
        _currentPage = 1;
        _hasMore = true;
        _transactions = [];
      });
    }
    if (!_hasMore) return;

    setState(() => _txLoading = true);
    try {
      final result = await context.read<WalletProvider>().loadTransactionHistory(
            page: _currentPage,
            limit: AppConstants.defaultPageSize,
            type: _selectedFilter,
          );
      setState(() {
        _transactions.addAll(result);
        _hasMore = result.length == AppConstants.defaultPageSize;
        _currentPage++;
      });
    } catch (_) {
      // error shown via provider
    } finally {
      if (mounted) setState(() => _txLoading = false);
    }
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadTransactions();
    }
  }

  void _applyFilter(TransactionType? type) {
    setState(() => _selectedFilter = type);
    _loadTransactions(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletProvider>().wallet;
    final isHost = context.watch<AuthProvider>().currentUser?.isHost ?? false;
    final isLoading = context.watch<WalletProvider>().isLoading;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wallet'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _init,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: isLoading && wallet == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _init,
              color: AppColors.primaryGreen,
              child: CustomScrollView(
                controller: _scrollController,
                slivers: [
                  // ── Balance cards ──────────────────────────────────────────
                  SliverToBoxAdapter(
                    child: _BalanceSection(
                      coinBalance: wallet?.coinBalance ?? 0,
                      diamondBalance: wallet?.diamondBalance ?? 0,
                      isHost: isHost,
                      onPurchase: () =>
                          Navigator.pushNamed(context, AppRoutes.purchaseCoins)
                              .then((_) => _init()),
                      onWithdraw: () =>
                          Navigator.pushNamed(context, AppRoutes.withdrawal)
                              .then((_) => _init()),
                      onEarnings: () => Navigator.pushNamed(
                          context, AppRoutes.hostEarnings),
                    ),
                  ),

                  // ── Filter chips ───────────────────────────────────────────
                  SliverToBoxAdapter(
                    child: _FilterBar(
                      selected: _selectedFilter,
                      onSelected: _applyFilter,
                    ),
                  ),

                  // ── Transaction list header ────────────────────────────────
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Text(
                        'Transaction History',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),

                  // ── Transactions ───────────────────────────────────────────
                  _transactions.isEmpty && !_txLoading
                      ? const SliverFillRemaining(
                          hasScrollBody: false,
                          child: _EmptyTransactions(),
                        )
                      : SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              if (index == _transactions.length) {
                                return _hasMore
                                    ? const Padding(
                                        padding: EdgeInsets.all(16),
                                        child: Center(
                                            child:
                                                CircularProgressIndicator()),
                                      )
                                    : const SizedBox(height: 32);
                              }
                              return _TransactionTile(
                                  transaction: _transactions[index]);
                            },
                            childCount: _transactions.length + 1,
                          ),
                        ),
                ],
              ),
            ),
    );
  }
}

// ─── Balance Section ──────────────────────────────────────────────────────────

class _BalanceSection extends StatelessWidget {
  final int coinBalance;
  final int diamondBalance;
  final bool isHost;
  final VoidCallback onPurchase;
  final VoidCallback onWithdraw;
  final VoidCallback onEarnings;

  const _BalanceSection({
    required this.coinBalance,
    required this.diamondBalance,
    required this.isHost,
    required this.onPurchase,
    required this.onWithdraw,
    required this.onEarnings,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primaryGreen, AppColors.signUpGreen],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _BalanceCard(
                  icon: Icons.monetization_on,
                  iconColor: AppColors.coinYellow,
                  label: 'Coins',
                  value: _format(coinBalance),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _BalanceCard(
                  icon: Icons.diamond,
                  iconColor: AppColors.diamondBlue,
                  label: 'Diamonds',
                  value: _format(diamondBalance),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: 'Buy Coins',
                  icon: Icons.add_circle_outline,
                  onTap: onPurchase,
                ),
              ),
              if (isHost) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: _ActionButton(
                    label: 'Withdraw',
                    icon: Icons.arrow_circle_up_outlined,
                    onTap: onWithdraw,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _ActionButton(
                    label: 'Earnings',
                    icon: Icons.bar_chart,
                    onTap: onEarnings,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  String _format(int value) {
    if (value >= 1000000) return '${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}K';
    return value.toString();
  }
}

class _BalanceCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _BalanceCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.white.withAlpha(30),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: 28),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: AppColors.white.withAlpha(200),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.white.withAlpha(40),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.white, size: 20),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

class _FilterBar extends StatelessWidget {
  final TransactionType? selected;
  final ValueChanged<TransactionType?> onSelected;

  const _FilterBar({required this.selected, required this.onSelected});

  static const _filters = <String, TransactionType?>{
    'All': null,
    'Purchases': TransactionType.coinPurchase,
    'Gifts Sent': TransactionType.giftSent,
    'Gifts Received': TransactionType.giftReceived,
    'Withdrawals': TransactionType.withdrawal,
    'Commission': TransactionType.commission,
  };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: _filters.entries.map((entry) {
          final isSelected = selected == entry.value;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: FilterChip(
              label: Text(entry.key),
              selected: isSelected,
              onSelected: (_) => onSelected(entry.value),
              selectedColor: AppColors.primaryGreen,
              labelStyle: TextStyle(
                color: isSelected ? AppColors.white : AppColors.textPrimary,
                fontSize: 13,
              ),
              checkmarkColor: AppColors.white,
              backgroundColor: AppColors.lightGrey,
              side: BorderSide.none,
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── Transaction Tile ─────────────────────────────────────────────────────────

class _TransactionTile extends StatelessWidget {
  final Transaction transaction;

  const _TransactionTile({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final isCredit = _isCredit(transaction.type);
    final sign = isCredit ? '+' : '-';
    final amountColor = isCredit ? AppColors.success : AppColors.error;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: _typeColor(transaction.type).withAlpha(30),
        child: Icon(
          _typeIcon(transaction.type),
          color: _typeColor(transaction.type),
          size: 20,
        ),
      ),
      title: Text(
        transaction.description.isNotEmpty
            ? transaction.description
            : _typeLabel(transaction.type),
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        _formatDate(transaction.timestamp),
        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
      ),
      trailing: Text(
        '$sign${transaction.amount} ${transaction.currency}',
        style: TextStyle(
          color: amountColor,
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
    );
  }

  bool _isCredit(TransactionType type) {
    return type == TransactionType.coinPurchase ||
        type == TransactionType.giftReceived ||
        type == TransactionType.diamondEarned ||
        type == TransactionType.commission;
  }

  IconData _typeIcon(TransactionType type) {
    switch (type) {
      case TransactionType.coinPurchase:
        return Icons.monetization_on;
      case TransactionType.giftSent:
        return Icons.card_giftcard;
      case TransactionType.giftReceived:
        return Icons.redeem;
      case TransactionType.diamondEarned:
        return Icons.diamond;
      case TransactionType.withdrawal:
        return Icons.arrow_circle_up;
      case TransactionType.commission:
        return Icons.percent;
    }
  }

  Color _typeColor(TransactionType type) {
    switch (type) {
      case TransactionType.coinPurchase:
        return AppColors.coinYellow;
      case TransactionType.giftSent:
        return AppColors.error;
      case TransactionType.giftReceived:
        return AppColors.success;
      case TransactionType.diamondEarned:
        return AppColors.diamondBlue;
      case TransactionType.withdrawal:
        return AppColors.warning;
      case TransactionType.commission:
        return AppColors.info;
    }
  }

  String _typeLabel(TransactionType type) {
    switch (type) {
      case TransactionType.coinPurchase:
        return 'Coin Purchase';
      case TransactionType.giftSent:
        return 'Gift Sent';
      case TransactionType.giftReceived:
        return 'Gift Received';
      case TransactionType.diamondEarned:
        return 'Diamond Earned';
      case TransactionType.withdrawal:
        return 'Withdrawal';
      case TransactionType.commission:
        return 'Commission';
    }
  }

  String _formatDate(DateTime dt) {
    return '${dt.day}/${dt.month}/${dt.year}  ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyTransactions extends StatelessWidget {
  const _EmptyTransactions();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.receipt_long_outlined,
              size: 64, color: AppColors.mediumGrey),
          SizedBox(height: 12),
          Text(
            'No transactions yet',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
