import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wallet_provider.dart';
import '../../core/services/wallet_service.dart';

/// Coin purchase screen – displays packages and payment methods.
///
/// Route: [AppRoutes.purchaseCoins]
class PurchaseCoinsScreen extends StatefulWidget {
  const PurchaseCoinsScreen({super.key});

  @override
  State<PurchaseCoinsScreen> createState() => _PurchaseCoinsScreenState();
}

class _PurchaseCoinsScreenState extends State<PurchaseCoinsScreen> {
  final WalletService _walletService = WalletService();

  static const _packages = <_CoinPackage>[
    _CoinPackage(id: 'coins_100', coins: 100, price: 0.99, currency: 'USD'),
    _CoinPackage(id: 'coins_500', coins: 500, price: 4.49, currency: 'USD', badge: 'Popular'),
    _CoinPackage(id: 'coins_1000', coins: 1000, price: 7.99, currency: 'USD', badge: 'Best Value'),
    _CoinPackage(id: 'coins_5000', coins: 5000, price: 34.99, currency: 'USD'),
    _CoinPackage(id: 'coins_10000', coins: 10000, price: 59.99, currency: 'USD'),
  ];

  static const _paymentMethods = <_PaymentMethod>[
    _PaymentMethod(id: 'stripe', label: 'Credit / Debit Card', icon: Icons.credit_card),
    _PaymentMethod(id: 'paypal', label: 'PayPal', icon: Icons.account_balance_wallet),
    _PaymentMethod(id: 'mada', label: 'Mada', icon: Icons.payment),
    _PaymentMethod(id: 'stcpay', label: 'stc pay', icon: Icons.phone_android),
  ];

  _CoinPackage? _selectedPackage;
  _PaymentMethod? _selectedMethod;
  bool _isLoading = false;
  String? _error;

  Future<void> _purchase() async {
    if (_selectedPackage == null || _selectedMethod == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await _walletService.purchaseCoins(
        packageId: _selectedPackage!.id,
        paymentMethod: _selectedMethod!.id,
      );

      final paymentUrl = result['paymentUrl'] as String?;

      if (paymentUrl != null && paymentUrl.isNotEmpty) {
        final uri = Uri.parse(paymentUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          setState(() => _error = 'Could not open payment page.');
        }
      } else {
        // Payment processed inline (e.g. sandbox success)
        if (mounted) {
          final userId = context.read<AuthProvider>().currentUser?.id ?? '';
          await context.read<WalletProvider>().loadWallet(userId);
          _showSuccess();
        }
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSuccess() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Purchase initiated! Coins will be credited after payment.'),
        backgroundColor: AppColors.success,
      ),
    );
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Buy Coins')),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Current balance ──────────────────────────────────────
                  _CurrentBalance(
                    coins: context.watch<WalletProvider>().coinBalance,
                  ),
                  const SizedBox(height: 24),

                  // ── Packages ─────────────────────────────────────────────
                  const Text(
                    'Select a Package',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.3,
                    ),
                    itemCount: _packages.length,
                    itemBuilder: (context, index) {
                      final pkg = _packages[index];
                      return _PackageCard(
                        package: pkg,
                        isSelected: _selectedPackage?.id == pkg.id,
                        onTap: () => setState(() => _selectedPackage = pkg),
                      );
                    },
                  ),
                  const SizedBox(height: 24),

                  // ── Payment methods ───────────────────────────────────────
                  const Text(
                    'Payment Method',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ..._paymentMethods.map((method) => _PaymentMethodTile(
                        method: method,
                        isSelected: _selectedMethod?.id == method.id,
                        onTap: () =>
                            setState(() => _selectedMethod = method),
                      )),

                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withAlpha(20),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.error, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                  color: AppColors.error, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),

          // ── Purchase button ───────────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: (_selectedPackage != null &&
                          _selectedMethod != null &&
                          !_isLoading)
                      ? _purchase
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen,
                    foregroundColor: AppColors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.white,
                          ),
                        )
                      : Text(
                          _selectedPackage != null
                              ? 'Pay \$${_selectedPackage!.price.toStringAsFixed(2)}'
                              : 'Select a Package',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Current Balance ──────────────────────────────────────────────────────────

class _CurrentBalance extends StatelessWidget {
  final int coins;

  const _CurrentBalance({required this.coins});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.coinYellow.withAlpha(25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.coinYellow.withAlpha(80)),
      ),
      child: Row(
        children: [
          const Icon(Icons.monetization_on,
              color: AppColors.coinYellow, size: 28),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Current Balance',
                style: TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
              ),
              Text(
                '$coins Coins',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Package Card ─────────────────────────────────────────────────────────────

class _PackageCard extends StatelessWidget {
  final _CoinPackage package;
  final bool isSelected;
  final VoidCallback onTap;

  const _PackageCard({
    required this.package,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primaryGreen.withAlpha(20)
              : AppColors.lightGrey,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primaryGreen : Colors.transparent,
            width: 2,
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.monetization_on,
                      color: AppColors.coinYellow, size: 32),
                  const SizedBox(height: 6),
                  Text(
                    _formatCoins(package.coins),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Text(
                    'Coins',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '\$${package.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primaryGreen,
                    ),
                  ),
                ],
              ),
            ),
            if (package.badge != null)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.warning,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    package.badge!,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatCoins(int coins) {
    if (coins >= 1000) return '${(coins / 1000).toStringAsFixed(0)}K';
    return coins.toString();
  }
}

// ─── Payment Method Tile ──────────────────────────────────────────────────────

class _PaymentMethodTile extends StatelessWidget {
  final _PaymentMethod method;
  final bool isSelected;
  final VoidCallback onTap;

  const _PaymentMethodTile({
    required this.method,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primaryGreen.withAlpha(15)
              : AppColors.lightGrey,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primaryGreen : Colors.transparent,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Icon(method.icon,
                color: isSelected
                    ? AppColors.primaryGreen
                    : AppColors.textSecondary,
                size: 22),
            const SizedBox(width: 12),
            Text(
              method.label,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? AppColors.primaryGreen
                    : AppColors.textPrimary,
              ),
            ),
            const Spacer(),
            if (isSelected)
              const Icon(Icons.check_circle,
                  color: AppColors.primaryGreen, size: 20),
          ],
        ),
      ),
    );
  }
}

// ─── Data classes ─────────────────────────────────────────────────────────────

class _CoinPackage {
  final String id;
  final int coins;
  final double price;
  final String currency;
  final String? badge;

  const _CoinPackage({
    required this.id,
    required this.coins,
    required this.price,
    required this.currency,
    this.badge,
  });
}

class _PaymentMethod {
  final String id;
  final String label;
  final IconData icon;

  const _PaymentMethod({
    required this.id,
    required this.label,
    required this.icon,
  });
}
