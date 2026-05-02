import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../home/home_screen.dart';
import '../discover/discover_screen.dart';
import '../profile/profile_screen.dart';
import '../wallet/wallet_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  void _onTabTapped(int index) => setState(() => _currentIndex = index);

  void _onFabTapped() {
    final isHost =
        context.read<AuthProvider>().currentUser?.isHost ?? false;
    if (isHost) {
      _showStartStreamDialog();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Become a host to start streaming')),
      );
    }
  }

  void _showStartStreamDialog() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Start Streaming'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'Stream Title',
            hintText: 'Enter a title for your stream',
          ),
          maxLength: 100,
          autofocus: true,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final title = ctrl.text.trim();
              if (title.isEmpty) return;
              Navigator.pop(ctx);
              Navigator.pushNamed(context, AppRoutes.streamStart,
                  arguments: title);
            },
            child: const Text('Start'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final userId =
        context.watch<AuthProvider>().currentUser?.id ?? '';

    final screens = [
      const HomeScreen(),
      const DiscoverScreen(),
      const WalletScreen(),
      ProfileScreen(userId: userId),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: _BottomNavWithFab(
        currentIndex: _currentIndex,
        onTabTapped: _onTabTapped,
        onFabTapped: _onFabTapped,
      ),
    );
  }
}

// ─── Bottom nav with floating + button ───────────────────────────────────────

class _BottomNavWithFab extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTabTapped;
  final VoidCallback onFabTapped;

  const _BottomNavWithFab({
    required this.currentIndex,
    required this.onTabTapped,
    required this.onFabTapped,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 72,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(20),
                    blurRadius: 12,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  _NavItem(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home,
                    label: 'Home',
                    isActive: currentIndex == 0,
                    onTap: () => onTabTapped(0),
                  ),
                  _NavItem(
                    icon: Icons.explore_outlined,
                    activeIcon: Icons.explore,
                    label: 'Explore',
                    isActive: currentIndex == 1,
                    onTap: () => onTabTapped(1),
                  ),
                  const Expanded(child: SizedBox()), // FAB gap
                  _NavItem(
                    icon: Icons.account_balance_wallet_outlined,
                    activeIcon: Icons.account_balance_wallet,
                    label: 'Wallet',
                    isActive: currentIndex == 2,
                    onTap: () => onTabTapped(2),
                  ),
                  _NavItem(
                    icon: Icons.person_outline,
                    activeIcon: Icons.person,
                    label: 'Profile',
                    isActive: currentIndex == 3,
                    onTap: () => onTabTapped(3),
                  ),
                ],
              ),
            ),
          ),
          // Centered FAB
          Positioned(
            top: -20,
            left: 0,
            right: 0,
            child: Center(
              child: GestureDetector(
                onTap: onFabTapped,
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryGreen,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x4022C55E),
                        blurRadius: 12,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.add, color: Colors.white, size: 28),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color =
        isActive ? AppColors.primaryGreen : AppColors.textSecondary;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isActive ? activeIcon : icon, color: color, size: 24),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight:
                    isActive ? FontWeight.w600 : FontWeight.w400,
                fontFamily: 'PlusJakartaSans',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
