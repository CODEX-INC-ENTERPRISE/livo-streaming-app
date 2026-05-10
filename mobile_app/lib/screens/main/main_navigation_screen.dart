import 'dart:ui';

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
    final isLoggedIn = context.read<AuthProvider>().isAuthenticated;
    if (isLoggedIn) {
      Navigator.pushNamed(context, AppRoutes.preLiveSetup);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to start streaming')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = context.watch<AuthProvider>().currentUser?.id ?? '';

    final screens = [
      const HomeScreen(),
      const DiscoverScreen(),
      const WalletScreen(),
      ProfileScreen(userId: userId),
    ];

    return Scaffold(
      backgroundColor: Colors.black,
      extendBody: true,
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: _LiquidGlassNavBar(
        currentIndex: _currentIndex,
        onTabTapped: _onTabTapped,
        onFabTapped: _onFabTapped,
      ),
    );
  }
}

// ─── Liquid Glass Bottom Navigation Bar ──────────────────────────────────────

class _LiquidGlassNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTabTapped;
  final VoidCallback onFabTapped;

  const _LiquidGlassNavBar({
    required this.currentIndex,
    required this.onTabTapped,
    required this.onFabTapped,
  });

  // Layout constants
  static const double _barHeight = 64.0;
  static const double _fabSize = 60.0;
  static const double _fabElevation = 28.0; // how far FAB rises above bar top
  static const double _notchRadius = 36.0;  // half-width of the notch cutout
  static const double _pillHPadding = 16.0;
  static const double _bottomPadding = 12.0;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final totalHeight = _barHeight + bottomInset + _bottomPadding;

    return SizedBox(
      height: totalHeight + _fabElevation,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          // ── Glass pill bar ──────────────────────────────────────────────────
          Positioned(
            bottom: 0,
            left: _pillHPadding,
            right: _pillHPadding,
            child: SizedBox(
              height: _barHeight + bottomInset + _bottomPadding,
              child: ClipPath(
                clipper: _NotchedPillClipper(
                  notchRadius: _notchRadius,
                  barHeight: _barHeight + bottomInset + _bottomPadding,
                ),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                  child: Container(
                    decoration: BoxDecoration(
                      
                      color: Colors.black.withOpacity(0.57),
                      borderRadius: BorderRadius.circular(40),
                      border: Border.all(
                        color: Colors.transparent.withOpacity(0.30),
                        width: 0.0,
                      ),
                    ),
                    child: Padding(
                      padding: EdgeInsets.only(
                        // bottom: bottomInset + _bottomPadding,
                      ),
                      child: SizedBox(
                        // height: _barHeight,
                        child: Row(
                          children: [
                            _GlassNavItem(
                              icon: Icons.home_rounded,
                              label: 'Home',
                              isActive: currentIndex == 0,
                              onTap: () => onTabTapped(0),
                            ),
                            _GlassNavItem(
                              icon: Icons.explore_rounded,
                              label: 'Explore',
                              isActive: currentIndex == 1,
                              onTap: () => onTabTapped(1),
                            ),
                            // FAB gap — matches notch width
                            const SizedBox(width: _notchRadius * 2 + 8),
                            _GlassNavItem(
                              icon: Icons.account_balance_wallet_rounded,
                              label: 'Wallet',
                              isActive: currentIndex == 2,
                              onTap: () => onTabTapped(2),
                            ),
                            _GlassNavItem(
                              icon: Icons.person_rounded,
                              label: 'Profile',
                              isActive: currentIndex == 3,
                              onTap: () => onTabTapped(3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // ── Green FAB ───────────────────────────────────────────────────────
          Positioned(
            bottom: bottomInset + _bottomPadding + _barHeight / 2 - _fabSize / 2 + _fabElevation / 1.3,
            child: GestureDetector(
              onTap: onFabTapped,
              child: Container(
                width: _fabSize,
                height: _fabSize,
                decoration: BoxDecoration(
                  color: AppColors.primaryGreen,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.transparent, //.withOpacity(0.25),
                    width: 3.5,
                  ),
                  boxShadow: [
                    // BoxShadow(
                    //   color: AppColors.primaryGreen.withOpacity(0.45),
                    //   // blurRadius: 20,
                    //   spreadRadius: 2,
                    //   offset: const Offset(0, 6),
                    // ),
                    // BoxShadow(
                    //   color: Colors.transparent.withOpacity(0.25),
                    //   // blurRadius: 8,
                    //   offset: const Offset(0, 2),
                    // ),
                  ],
                ),
                child: const Icon(
                  Icons.add_rounded,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Individual nav item ──────────────────────────────────────────────────────

class _GlassNavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _GlassNavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Active item gets a frosted glass circle highlight
            if (isActive)
              _ActiveIconBubble(icon: icon)
            else
              Icon(icon, color: Colors.white, size: 24),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primaryGreen : Colors.white,
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                fontFamily: 'PlusJakartaSans',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Active icon inside a glass circle ───────────────────────────────────────

class _ActiveIconBubble extends StatelessWidget {
  final IconData icon;

  const _ActiveIconBubble({required this.icon});

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.20),
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.primaryGreen.withOpacity(0.60),
              width: 1.5,
            ),
          ),
          child: Icon(
            icon,
            color: AppColors.primaryGreen,
            size: 22,
          ),
        ),
      ),
    );
  }
}

// ─── Custom clipper: pill with a circular notch cut from the top center ───────

class _NotchedPillClipper extends CustomClipper<Path> {
  final double notchRadius;
  final double barHeight;

  const _NotchedPillClipper({
    required this.notchRadius,
    required this.barHeight,
  });

  @override
  Path getClip(Size size) {
    const double cornerRadius = 40.0;
    final double cx = size.width / 2;
    // How deep the notch dips into the bar from the top
    const double notchDepth = 10.0;
    final double nr = notchRadius + 4; // slight padding around FAB

    final path = Path();

    // Start at top-left corner
    path.moveTo(cornerRadius, 0);

    // Top edge → left side of notch
    path.lineTo(cx - nr - 8, 0);

    // Smooth curve down into notch (left shoulder)
    path.quadraticBezierTo(cx - nr, 0, cx - nr, notchDepth);

    // Arc across the bottom of the notch
    path.arcToPoint(
      Offset(cx + nr, notchDepth),
      radius: Radius.circular(nr),
      clockwise: false,
    );

    // Smooth curve back up (right shoulder)
    path.quadraticBezierTo(cx + nr, 0, cx + nr + 8, 0);

    // Top edge → top-right corner
    path.lineTo(size.width - cornerRadius, 0);

    // Top-right rounded corner
    path.quadraticBezierTo(size.width, 0, size.width, cornerRadius);

    // Right edge
    path.lineTo(size.width, barHeight - cornerRadius);

    // Bottom-right rounded corner
    path.quadraticBezierTo(
        size.width, barHeight, size.width - cornerRadius, barHeight);

    // Bottom edge
    path.lineTo(cornerRadius, barHeight);

    // Bottom-left rounded corner
    path.quadraticBezierTo(0, barHeight, 0, barHeight - cornerRadius);

    // Left edge
    path.lineTo(0, cornerRadius);

    // Top-left rounded corner
    path.quadraticBezierTo(0, 0, cornerRadius, 0);

    path.close();
    return path;
  }

  @override
  bool shouldReclip(_NotchedPillClipper old) =>
      old.notchRadius != notchRadius || old.barHeight != barHeight;
}
