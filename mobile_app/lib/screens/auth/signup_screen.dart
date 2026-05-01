import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';

/// Registration screen supporting:
///   - Phone number + OTP
///   - Email + OTP
///   - Google OAuth
///   - Apple Sign-In
///
/// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _displayNameController = TextEditingController();
  final _otpController = TextEditingController();

  final _step1FormKey = GlobalKey<FormState>();
  final _step2FormKey = GlobalKey<FormState>();

  bool _otpSent = false;
  bool _isPhone = true;
  String _pendingContact = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) return;
      setState(() {
        _otpSent = false;
        _otpController.clear();
        _isPhone = _tabController.index == 0;
      });
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _displayNameController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  Future<void> _sendOtp() async {
    if (!(_step1FormKey.currentState?.validate() ?? false)) return;

    final auth = context.read<AuthProvider>();
    final contact =
        _isPhone ? _phoneController.text.trim() : _emailController.text.trim();

    try {
      await auth.sendOtp(contact, isPhone: _isPhone);
      setState(() {
        _otpSent = true;
        _pendingContact = contact;
      });
      _showSnack('OTP sent to $contact');
    } catch (e) {
      _showSnack(auth.error ?? 'Failed to send OTP');
    }
  }

  Future<void> _register() async {
    if (!(_step2FormKey.currentState?.validate() ?? false)) return;

    final auth = context.read<AuthProvider>();
    final otp = _otpController.text.trim();
    final displayName = _displayNameController.text.trim();

    try {
      if (_isPhone) {
        await auth.registerWithPhone(_pendingContact, otp, displayName);
      } else {
        await auth.registerWithEmail(_pendingContact, otp, displayName);
      }
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(auth.error ?? 'Registration failed');
    }
  }

  Future<void> _signUpWithGoogle() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.signInWithGoogle();
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(auth.error ?? 'Google sign-up failed');
    }
  }

  Future<void> _signUpWithApple() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.signInWithApple();
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(auth.error ?? 'Apple sign-up failed');
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  // ─── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                const SizedBox(height: 32),
                const Text(
                  'Create account',
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Join the community',
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 16,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 32),

              // ── Tab bar ──────────────────────────────────────────────────────
              Container(
                decoration: BoxDecoration(
                  color: AppColors.lightGrey,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  labelColor: AppColors.textPrimary,
                  unselectedLabelColor: AppColors.textSecondary,
                  labelStyle: const TextStyle(
                    fontFamily: 'PlusJakartaSans',
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  tabs: const [
                    Tab(text: 'Phone'),
                    Tab(text: 'Email'),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── Step 1: contact field ─────────────────────────────────────────
              Form(
                key: _step1FormKey,
                child: SizedBox(
                  height: 80,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildPhoneField(),
                      _buildEmailField(),
                    ],
                  ),
                ),
              ),

              // ── Step 2: display name + OTP ────────────────────────────────────
              if (_otpSent) ...[
                const SizedBox(height: 16),
                Form(
                  key: _step2FormKey,
                  child: Column(
                    children: [
                      _buildDisplayNameField(),
                      const SizedBox(height: 16),
                      _buildOtpField(),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // ── Primary action button ─────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : (_otpSent ? _register : _sendOtp),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.signUpGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: auth.isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          _otpSent ? 'Create Account' : 'Send OTP',
                          style: const TextStyle(
                            fontFamily: 'PlusJakartaSans',
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),

              if (_otpSent) ...[
                const SizedBox(height: 12),
                Center(
                  child: TextButton(
                    onPressed: auth.isLoading
                        ? null
                        : () => setState(() {
                              _otpSent = false;
                              _otpController.clear();
                            }),
                    child: const Text(
                      'Change contact / Resend OTP',
                      style: TextStyle(
                        color: AppColors.primaryGreen,
                        fontFamily: 'PlusJakartaSans',
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 32),

              // ── Divider ───────────────────────────────────────────────────────
              const Row(
                children: [
                  Expanded(child: Divider()),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'or sign up with',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontFamily: 'PlusJakartaSans',
                        fontSize: 13,
                      ),
                    ),
                  ),
                  Expanded(child: Divider()),
                ],
              ),

              const SizedBox(height: 24),

              // ── Social buttons ────────────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: _SocialButton(
                      label: 'Google',
                      icon: Icons.g_mobiledata,
                      onTap: auth.isLoading ? null : _signUpWithGoogle,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _SocialButton(
                      label: 'Apple',
                      icon: Icons.apple,
                      onTap: auth.isLoading ? null : _signUpWithApple,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 32),

              // ── Sign in link ──────────────────────────────────────────────────
              Center(
                child: GestureDetector(
                  onTap: () =>
                      Navigator.pushReplacementNamed(context, '/login'),
                  child: RichText(
                    text: const TextSpan(
                      text: 'Already have an account? ',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontFamily: 'PlusJakartaSans',
                        fontSize: 14,
                      ),
                      children: [
                        TextSpan(
                          text: 'Sign In',
                          style: TextStyle(
                            color: AppColors.primaryGreen,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    ), // Scaffold
    ); // PopScope
  }

  // ─── Field builders ───────────────────────────────────────────────────────────

  Widget _buildPhoneField() {
    return TextFormField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+]'))],
      enabled: !_otpSent,
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'Enter your phone number';
        if (!RegExp(r'^\+?[1-9]\d{6,14}$').hasMatch(v.trim())) {
          return 'Enter a valid phone number';
        }
        return null;
      },
      decoration: _inputDecoration(
        hint: '+1 234 567 8900',
        icon: Icons.phone_outlined,
      ),
    );
  }

  Widget _buildEmailField() {
    return TextFormField(
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      enabled: !_otpSent,
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'Enter your email';
        if (!RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v.trim())) {
          return 'Enter a valid email address';
        }
        return null;
      },
      decoration: _inputDecoration(
        hint: 'you@example.com',
        icon: Icons.email_outlined,
      ),
    );
  }

  Widget _buildDisplayNameField() {
    return TextFormField(
      controller: _displayNameController,
      textCapitalization: TextCapitalization.words,
      inputFormatters: [LengthLimitingTextInputFormatter(30)],
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'Enter a display name';
        if (v.trim().length < 3) {
          return 'Display name must be at least 3 characters';
        }
        return null;
      },
      decoration: _inputDecoration(
        hint: 'Your display name',
        icon: Icons.person_outline,
      ),
    );
  }

  Widget _buildOtpField() {
    return TextFormField(
      controller: _otpController,
      keyboardType: TextInputType.number,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        letterSpacing: 8,
      ),
      validator: (v) {
        if (v == null || v.trim().length < 4) return 'Enter the OTP';
        return null;
      },
      decoration: InputDecoration(
        hintText: '------',
        hintStyle: const TextStyle(letterSpacing: 8, color: AppColors.grey),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lightGrey),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lightGrey),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primaryGreen),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String hint,
    required IconData icon,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, color: AppColors.grey),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.lightGrey),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.lightGrey),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryGreen),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      filled: true,
      fillColor: Colors.white,
    );
  }
}

// ─── Social button widget ──────────────────────────────────────────────────────

class _SocialButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  const _SocialButton({
    required this.label,
    required this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.lightGrey),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: AppColors.textPrimary),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontFamily: 'PlusJakartaSans',
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
