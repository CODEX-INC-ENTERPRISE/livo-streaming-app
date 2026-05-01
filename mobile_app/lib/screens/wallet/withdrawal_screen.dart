import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/services/wallet_service.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wallet_provider.dart';

/// Withdrawal screen – hosts only.
/// Allows requesting a diamond-to-credit conversion and shows history.
///
/// Route: [AppRoutes.withdrawal]
class WithdrawalScreen extends StatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  State<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends State<WithdrawalScreen> {
  final WalletService _walletService = WalletService();
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();

  List<dynamic> _withdrawals = [];
  bool _historyLoading = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadHistory());
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) return;
    setState(() => _historyLoading = true);
    try {
      final list = await _walletService.getWithdrawals(userId);
      if (mounted) setState(() => _withdrawals = list);
    } catch (_) {
      // non-critical
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final amount = int.tryParse(_amountController.text.trim()) ?? 0;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await context.read<WalletProvider>().requestWithdrawal(amount);
      if (mounted) {
        _amountController.clear();
        await _loadHistory();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Withdrawal request submitted successfully.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      setState(() =>
          _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletProvider>().wallet;
    final diamondBalance = wallet?.diamondBalance ?? 0;
    final creditValue = diamondBalance * AppConstants.diamondToCreditRate;

    return Scaffold(
      appBar: AppBar(title: const Text('Withdraw Diamonds')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Balance summary ──────────────────────────────────────────
            _DiamondBalanceCard(
              diamonds: diamondBalance,
              creditValue: creditValue,
            ),
            const SizedBox(height: 24),

            // ── Withdrawal form ──────────────────────────────────────────
            const Text(
              'Request Withdrawal',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: 12),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _amountController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      labelText: 'Diamond Amount',
                      hintText:
                          'Min ${AppConstants.minWithdrawalDiamonds} diamonds',
                      prefixIcon: const Icon(Icons.diamond,
                          color: AppColors.diamondBlue),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      suffixText: 'diamonds',
                    ),
                    validator: (value) {
                      final v = int.tryParse(value ?? '');
                      if (v == null || v <= 0) return 'Enter a valid amount';
                      if (v < AppConstants.minWithdrawalDiamonds) {
                        return 'Minimum is ${AppConstants.minWithdrawalDiamonds} diamonds';
                      }
                      if (v > diamondBalance) {
                        return 'Insufficient diamond balance';
                      }
                      return null;
                    },
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 8),
                  // Live credit preview
                  if (_amountController.text.isNotEmpty)
                    _CreditPreview(
                      diamonds: int.tryParse(_amountController.text) ?? 0,
                    ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    _ErrorBanner(message: _error!),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryGreen,
                        foregroundColor: AppColors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.white,
                              ),
                            )
                          : const Text(
                              'Request Withdrawal',
                              style: TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // ── Withdrawal history ───────────────────────────────────────
            const Text(
              'Withdrawal History',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: 12),
            _historyLoading
                ? const Center(child: CircularProgressIndicator())
                : _withdrawals.isEmpty
                    ? const _EmptyHistory()
                    : ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _withdrawals.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final w = _withdrawals[index] as Map<String, dynamic>;
                          return _WithdrawalTile(data: w);
                        },
                      ),
          ],
        ),
      ),
    );
  }
}

// ─── Diamond Balance Card ─────────────────────────────────────────────────────

class _DiamondBalanceCard extends StatelessWidget {
  final int diamonds;
  final double creditValue;

  const _DiamondBalanceCard({
    required this.diamonds,
    required this.creditValue,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.diamondBlue, Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.diamond, color: AppColors.white, size: 40),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$diamonds Diamonds',
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                '≈ \$${creditValue.toStringAsFixed(2)} credit',
                style: TextStyle(
                  color: AppColors.white.withAlpha(200),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Min withdrawal: ${AppConstants.minWithdrawalDiamonds} diamonds',
                style: TextStyle(
                  color: AppColors.white.withAlpha(160),
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

// ─── Credit Preview ───────────────────────────────────────────────────────────

class _CreditPreview extends StatelessWidget {
  final int diamonds;

  const _CreditPreview({required this.diamonds});

  @override
  Widget build(BuildContext context) {
    final credit = diamonds * AppConstants.diamondToCreditRate;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.info.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.info, size: 16),
          const SizedBox(width: 8),
          Text(
            'You will receive ≈ \$${credit.toStringAsFixed(2)}',
            style: const TextStyle(color: AppColors.info, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  final String message;

  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.error.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Withdrawal Tile ──────────────────────────────────────────────────────────

class _WithdrawalTile extends StatelessWidget {
  final Map<String, dynamic> data;

  const _WithdrawalTile({required this.data});

  @override
  Widget build(BuildContext context) {
    final diamonds = data['diamondAmount'] as int? ?? 0;
    final credit = data['creditAmount'] as num? ?? 0;
    final status = data['status'] as String? ?? 'pending';
    final requestedAt = data['requestedAt'] != null
        ? DateTime.tryParse(data['requestedAt'] as String)
        : null;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: _statusColor(status).withAlpha(30),
        child: Icon(
          _statusIcon(status),
          color: _statusColor(status),
          size: 20,
        ),
      ),
      title: Text(
        '$diamonds diamonds → \$${credit.toStringAsFixed(2)}',
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
      ),
      subtitle: requestedAt != null
          ? Text(
              _formatDate(requestedAt),
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary),
            )
          : null,
      trailing: _StatusChip(status: status),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
      case 'completed':
        return AppColors.success;
      case 'rejected':
        return AppColors.error;
      default:
        return AppColors.warning;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'approved':
      case 'completed':
        return Icons.check_circle;
      case 'rejected':
        return Icons.cancel;
      default:
        return Icons.hourglass_empty;
    }
  }

  String _formatDate(DateTime dt) =>
      '${dt.day}/${dt.month}/${dt.year}';
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status) {
      case 'approved':
      case 'completed':
        color = AppColors.success;
        break;
      case 'rejected':
        color = AppColors.error;
        break;
      default:
        color = AppColors.warning;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(80)),
      ),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ─── Empty History ────────────────────────────────────────────────────────────

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.history, size: 48, color: AppColors.mediumGrey),
            SizedBox(height: 8),
            Text(
              'No withdrawal requests yet',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
