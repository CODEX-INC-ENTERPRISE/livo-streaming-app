import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/virtual_gift.dart';
import '../../providers/wallet_provider.dart';

/// Bottom sheet for selecting and sending a virtual gift.
///
/// Shows available gifts grouped by category, the user's coin balance,
/// and handles the send flow including insufficient-funds feedback.
class GiftSheet extends StatefulWidget {
  final String streamId;
  final VoidCallback? onGiftSent;

  const GiftSheet({
    super.key,
    required this.streamId,
    this.onGiftSent,
  });

  /// Convenience method to show the sheet.
  static Future<void> show(
    BuildContext context, {
    required String streamId,
    VoidCallback? onGiftSent,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GiftSheet(streamId: streamId, onGiftSent: onGiftSent),
    );
  }

  @override
  State<GiftSheet> createState() => _GiftSheetState();
}

class _GiftSheetState extends State<GiftSheet> {
  VirtualGift? _selectedGift;
  bool _isSending = false;

  Future<void> _sendGift(WalletProvider walletProvider) async {
    if (_selectedGift == null || _isSending) return;

    // Check balance
    if (walletProvider.coinBalance < _selectedGift!.coinPrice) {
      _showInsufficientFunds();
      return;
    }

    // Confirm dialog
    final confirmed = await _showConfirmDialog();
    if (!confirmed) return;

    setState(() => _isSending = true);
    try {
      await walletProvider.sendGift(
        streamId: widget.streamId,
        giftId: _selectedGift!.id,
      );
      if (mounted) {
        Navigator.pop(context);
        widget.onGiftSent?.call();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_selectedGift!.name} sent!'),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to send gift. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _showInsufficientFunds() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.darkSurface,
        title: const Text(
          'Insufficient Coins',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          'You need ${_selectedGift!.coinPrice} coins to send ${_selectedGift!.name}. '
          'Purchase more coins to continue.',
          style: const TextStyle(color: AppColors.darkTextSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryGreen),
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(context); // close gift sheet
              // Navigate to purchase coins
              Navigator.pushNamed(context, '/wallet/purchase-coins');
            },
            child: const Text('Buy Coins'),
          ),
        ],
      ),
    );
  }

  Future<bool> _showConfirmDialog() async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.darkSurface,
            title: const Text(
              'Send Gift?',
              style: TextStyle(color: Colors.white),
            ),
            content: Text(
              'Send ${_selectedGift!.name} for ${_selectedGift!.coinPrice} coins?',
              style: const TextStyle(color: AppColors.darkTextSecondary),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryGreen),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Send'),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<WalletProvider>(
      builder: (context, walletProvider, _) {
        final gifts = walletProvider.availableGifts;

        return Container(
          height: MediaQuery.of(context).size.height * 0.55,
          decoration: const BoxDecoration(
            color: AppColors.darkSurface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle bar
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.darkBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header: title + coin balance
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Send a Gift',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    _CoinBalanceBadge(balance: walletProvider.coinBalance),
                  ],
                ),
              ),

              const Divider(color: AppColors.darkBorder, height: 1),

              // Gift grid
              Expanded(
                child: gifts.isEmpty
                    ? const Center(
                        child: Text(
                          'No gifts available',
                          style: TextStyle(color: AppColors.darkTextSecondary),
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 4,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 0.75,
                        ),
                        itemCount: gifts.length,
                        itemBuilder: (context, index) {
                          final gift = gifts[index];
                          final isSelected = _selectedGift?.id == gift.id;
                          final canAfford =
                              walletProvider.coinBalance >= gift.coinPrice;

                          return _GiftTile(
                            gift: gift,
                            isSelected: isSelected,
                            canAfford: canAfford,
                            onTap: () =>
                                setState(() => _selectedGift = gift),
                          );
                        },
                      ),
              ),

              // Send button
              Padding(
                padding: EdgeInsets.fromLTRB(
                    16, 8, 16, MediaQuery.of(context).padding.bottom + 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _selectedGift != null
                          ? AppColors.primaryGreen
                          : AppColors.darkBorder,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: _selectedGift != null && !_isSending
                        ? () => _sendGift(walletProvider)
                        : null,
                    child: _isSending
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            _selectedGift != null
                                ? 'Send ${_selectedGift!.name} · ${_selectedGift!.coinPrice} coins'
                                : 'Select a gift',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _GiftTile extends StatelessWidget {
  final VirtualGift gift;
  final bool isSelected;
  final bool canAfford;
  final VoidCallback onTap;

  const _GiftTile({
    required this.gift,
    required this.isSelected,
    required this.canAfford,
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
              ? AppColors.primaryGreen.withOpacity(0.2)
              : AppColors.darkBackground,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primaryGreen : AppColors.darkBorder,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Gift thumbnail
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: gift.thumbnailUrl.isNotEmpty
                    ? Image.network(
                        gift.thumbnailUrl,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.card_giftcard,
                          color: AppColors.giftGold,
                          size: 32,
                        ),
                      )
                    : const Icon(
                        Icons.card_giftcard,
                        color: AppColors.giftGold,
                        size: 32,
                      ),
              ),
            ),
            // Gift name
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                gift.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
            // Price
            Padding(
              padding: const EdgeInsets.only(bottom: 6, top: 2),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.monetization_on,
                    size: 10,
                    color: canAfford
                        ? AppColors.coinYellow
                        : AppColors.darkTextSecondary,
                  ),
                  const SizedBox(width: 2),
                  Text(
                    '${gift.coinPrice}',
                    style: TextStyle(
                      color: canAfford
                          ? AppColors.coinYellow
                          : AppColors.darkTextSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CoinBalanceBadge extends StatelessWidget {
  final int balance;

  const _CoinBalanceBadge({required this.balance});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.coinYellow.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.coinYellow.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.monetization_on,
              color: AppColors.coinYellow, size: 14),
          const SizedBox(width: 4),
          Text(
            '$balance',
            style: const TextStyle(
              color: AppColors.coinYellow,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

/// Overlay widget that plays a gift animation on screen.
class GiftAnimationOverlay extends StatefulWidget {
  final VirtualGift gift;
  final VoidCallback onComplete;

  const GiftAnimationOverlay({
    super.key,
    required this.gift,
    required this.onComplete,
  });

  @override
  State<GiftAnimationOverlay> createState() => _GiftAnimationOverlayState();
}

class _GiftAnimationOverlayState extends State<GiftAnimationOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnim;
  late Animation<double> _opacityAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    );

    _scaleAnim = TweenSequence([
      TweenSequenceItem(
          tween: Tween(begin: 0.0, end: 1.2)
              .chain(CurveTween(curve: Curves.elasticOut)),
          weight: 40),
      TweenSequenceItem(
          tween: Tween(begin: 1.2, end: 1.0), weight: 20),
      TweenSequenceItem(
          tween: Tween(begin: 1.0, end: 1.0), weight: 20),
      TweenSequenceItem(
          tween: Tween(begin: 1.0, end: 0.0)
              .chain(CurveTween(curve: Curves.easeIn)),
          weight: 20),
    ]).animate(_controller);

    _opacityAnim = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 60),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 20),
    ]).animate(_controller);

    _controller.forward().then((_) => widget.onComplete());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: _opacityAnim.value,
          child: Transform.scale(
            scale: _scaleAnim.value,
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.7),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.giftGold.withOpacity(0.6)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.gift.thumbnailUrl.isNotEmpty)
              Image.network(
                widget.gift.thumbnailUrl,
                width: 48,
                height: 48,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.card_giftcard,
                  color: AppColors.giftGold,
                  size: 48,
                ),
              )
            else
              const Icon(Icons.card_giftcard,
                  color: AppColors.giftGold, size: 48),
            const SizedBox(width: 12),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Gift received!',
                  style: TextStyle(
                    color: AppColors.giftGold,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  widget.gift.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
