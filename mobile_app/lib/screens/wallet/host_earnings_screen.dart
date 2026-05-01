import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/services/wallet_service.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';

/// Host earnings dashboard – shows total diamonds, pending/completed
/// withdrawals, per-stream breakdown, and top gifters.
///
/// Route: [AppRoutes.hostEarnings]
class HostEarningsScreen extends StatefulWidget {
  const HostEarningsScreen({super.key});

  @override
  State<HostEarningsScreen> createState() => _HostEarningsScreenState();
}

class _HostEarningsScreenState extends State<HostEarningsScreen> {
  final WalletService _walletService = WalletService();

  Map<String, dynamic>? _earnings;
  Map<String, dynamic>? _statistics;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        _walletService.getHostEarnings(userId),
        _walletService.getHostStatistics(userId),
      ]);
      if (mounted) {
        setState(() {
          _earnings = results[0];
          _statistics = results[1];
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Earnings Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primaryGreen,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Summary cards ──────────────────────────────────
                        _SummaryGrid(earnings: _earnings ?? {}),
                        const SizedBox(height: 24),

                        // ── Conversion info ────────────────────────────────
                        _ConversionInfo(
                          totalDiamonds:
                              _earnings?['totalDiamonds'] as int? ?? 0,
                        ),
                        const SizedBox(height: 24),

                        // ── Stream breakdown ───────────────────────────────
                        if (_statistics != null &&
                            (_statistics!['streamBreakdown'] as List?)
                                    ?.isNotEmpty ==
                                true) ...[
                          const Text(
                            'Earnings by Stream',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _StreamBreakdownList(
                            streams: List<Map<String, dynamic>>.from(
                              _statistics!['streamBreakdown'] as List? ?? [],
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],

                        // ── Top gifters ────────────────────────────────────
                        if (_statistics != null &&
                            (_statistics!['topGifters'] as List?)
                                    ?.isNotEmpty ==
                                true) ...[
                          const Text(
                            'Top Gifters',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _TopGiftersList(
                            gifters: List<Map<String, dynamic>>.from(
                              _statistics!['topGifters'] as List? ?? [],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
    );
  }
}

// ─── Summary Grid ─────────────────────────────────────────────────────────────

class _SummaryGrid extends StatelessWidget {
  final Map<String, dynamic> earnings;

  const _SummaryGrid({required this.earnings});

  @override
  Widget build(BuildContext context) {
    final total = earnings['totalDiamonds'] as int? ?? 0;
    final pending = earnings['pendingWithdrawals'] as num? ?? 0;
    final completed = earnings['completedWithdrawals'] as num? ?? 0;
    final creditValue = total * AppConstants.diamondToCreditRate;

    return Column(
      children: [
        _SummaryCard(
          icon: Icons.diamond,
          iconColor: AppColors.diamondBlue,
          label: 'Total Diamonds Earned',
          value: _format(total),
          subtitle: '≈ \$${creditValue.toStringAsFixed(2)} credit',
          fullWidth: true,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                icon: Icons.hourglass_empty,
                iconColor: AppColors.warning,
                label: 'Pending',
                value: '\$${pending.toStringAsFixed(2)}',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SummaryCard(
                icon: Icons.check_circle_outline,
                iconColor: AppColors.success,
                label: 'Completed',
                value: '\$${completed.toStringAsFixed(2)}',
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _format(int v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return v.toString();
  }
}

class _SummaryCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String? subtitle;
  final bool fullWidth;

  const _SummaryCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    this.subtitle,
    this.fullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.lightGrey,
        borderRadius: BorderRadius.circular(12),
      ),
      child: fullWidth
          ? Row(
              children: [
                CircleAvatar(
                  backgroundColor: iconColor.withAlpha(30),
                  radius: 24,
                  child: Icon(icon, color: iconColor, size: 24),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.primaryGreen,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: iconColor, size: 22),
                const SizedBox(height: 8),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
    );
  }
}

// ─── Conversion Info ──────────────────────────────────────────────────────────

class _ConversionInfo extends StatelessWidget {
  final int totalDiamonds;

  const _ConversionInfo({required this.totalDiamonds});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.info.withAlpha(15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.info.withAlpha(60)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.info, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '1 Diamond = \$${AppConstants.diamondToCreditRate.toStringAsFixed(2)} credit. '
              'Minimum withdrawal: ${AppConstants.minWithdrawalDiamonds} diamonds.',
              style: const TextStyle(
                color: AppColors.info,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Stream Breakdown ─────────────────────────────────────────────────────────

class _StreamBreakdownList extends StatelessWidget {
  final List<Map<String, dynamic>> streams;

  const _StreamBreakdownList({required this.streams});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: streams.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final s = streams[index];
        final title = s['title'] as String? ?? 'Stream';
        final diamonds = s['diamondsEarned'] as int? ?? 0;
        final date = s['date'] != null
            ? DateTime.tryParse(s['date'] as String)
            : null;

        return ListTile(
          leading: const CircleAvatar(
            backgroundColor: AppColors.lightGrey,
            child: Icon(Icons.live_tv, color: AppColors.primaryGreen, size: 18),
          ),
          title: Text(
            title,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          subtitle: date != null
              ? Text(
                  '${date.day}/${date.month}/${date.year}',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary),
                )
              : null,
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.diamond, color: AppColors.diamondBlue, size: 16),
              const SizedBox(width: 4),
              Text(
                '$diamonds',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.diamondBlue,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Top Gifters ──────────────────────────────────────────────────────────────

class _TopGiftersList extends StatelessWidget {
  final List<Map<String, dynamic>> gifters;

  const _TopGiftersList({required this.gifters});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: gifters.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final g = gifters[index];
        final name = g['displayName'] as String? ?? 'User';
        final coins = g['totalCoins'] as int? ?? 0;
        final rank = index + 1;

        return ListTile(
          leading: CircleAvatar(
            backgroundColor: _rankColor(rank).withAlpha(30),
            child: Text(
              '#$rank',
              style: TextStyle(
                color: _rankColor(rank),
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          title: Text(
            name,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.monetization_on,
                  color: AppColors.coinYellow, size: 16),
              const SizedBox(width: 4),
              Text(
                '$coins',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.coinYellow,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Color _rankColor(int rank) {
    switch (rank) {
      case 1:
        return const Color(0xFFFFD700); // gold
      case 2:
        return const Color(0xFFC0C0C0); // silver
      case 3:
        return const Color(0xFFCD7F32); // bronze
      default:
        return AppColors.textSecondary;
    }
  }
}

// ─── Error View ───────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: AppColors.error),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
