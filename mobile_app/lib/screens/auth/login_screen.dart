import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();

  bool _otpSent = false;
  String _pendingContact = '';
  bool _isPhone = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
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
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final auth = context.read<AuthProvider>();
    final contact =
        _isPhone ? _phoneController.text.trim() : _emailController.text.trim();

    if (contact.isEmpty) {
      _showSnack(_isPhone ? 'Enter your phone number' : 'Enter your email');
      return;
    }

    try {
      if (_isPhone) {
        await auth.verifyPhoneNumber(contact);
      } else {
        await auth.sendEmailOtp(contact);
      }
      setState(() {
        _otpSent = true;
        _pendingContact = contact;
      });
      _showSnack('OTP sent to $contact');
    } catch (e) {
      _showSnack(auth.error ?? 'Failed to send OTP');
    }
  }

  Future<void> _verifyOtp() async {
    final auth = context.read<AuthProvider>();
    final otp = _otpController.text.trim();

    if (otp.length < 4) {
      _showSnack('Enter the OTP');
      return;
    }

    try {
      if (_isPhone) {
        await auth.verifyPhoneOtp(_pendingContact, otp);
      } else {
        await auth.verifyEmailOtp(_pendingContact, otp);
      }
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(auth.error ?? 'Invalid OTP');
    }
  }

  Future<void> _signInWithGoogle() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.signInWithGoogle();
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(auth.error ?? 'Google sign-in failed');
    }
  }

  Future<void> _signInWithApple() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.signInWithApple();
      if (mounted) Navigator.pushReplacementNamed(context, '/home');
    } catch (e) {
      _showSnack(auth.error ?? 'Apple sign-in failed');
    }
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

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
                  'Welcome back',
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Sign in to continue',
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 16,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 32),

              // Tab bar
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

              // Tab content
              SizedBox(
                height: 80,
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildPhoneField(),
                    _buildEmailField(),
                  ],
                ),
              ),

              // OTP field (shown after sending)
              if (_otpSent) ...[
                const SizedBox(height: 16),
                _buildOtpField(),
              ],

              const SizedBox(height: 24),

              // Primary action button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : (_otpSent ? _verifyOtp : _sendOtp),
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
                          _otpSent ? 'Verify OTP' : 'Send OTP',
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
                      'Change number / Resend',
                      style: TextStyle(
                        color: AppColors.primaryGreen,
                        fontFamily: 'PlusJakartaSans',
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 32),

              // Divider
              Row(
                children: [
                  const Expanded(child: Divider()),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'or continue with',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontFamily: 'PlusJakartaSans',
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const Expanded(child: Divider()),
                ],
              ),

              const SizedBox(height: 24),

              // Social buttons
              Row(
                children: [
                  Expanded(
                    child: _SocialButton(
                      label: 'Google',
                      icon: Icons.g_mobiledata,
                      onTap: auth.isLoading ? null : _signInWithGoogle,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _SocialButton(
                      label: 'Apple',
                      icon: Icons.apple,
                      onTap: auth.isLoading ? null : _signInWithApple,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 32),

              // Sign up link
              Center(
                child: GestureDetector(
                  onTap: () =>
                      Navigator.pushReplacementNamed(context, '/signup'),
                  child: RichText(
                    text: const TextSpan(
                      text: "Don't have an account? ",
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontFamily: 'PlusJakartaSans',
                        fontSize: 14,
                      ),
                      children: [
                        TextSpan(
                          text: 'Sign Up',
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

  Widget _buildPhoneField() {
    return TextField(
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      enabled: !_otpSent,
      decoration: InputDecoration(
        hintText: '+1 234 567 8900',
        prefixIcon: const Icon(Icons.phone_outlined, color: AppColors.grey),
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
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }

  Widget _buildEmailField() {
    return TextField(
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      enabled: !_otpSent,
      decoration: InputDecoration(
        hintText: 'you@example.com',
        prefixIcon: const Icon(Icons.email_outlined, color: AppColors.grey),
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
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }

  Widget _buildOtpField() {
    return TextField(
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
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }
}

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
