import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';

/// Arguments passed to [OtpVerificationScreen] via [Navigator.pushNamed].
///
/// ```dart
/// Navigator.pushNamed(
///   context,
///   AppRoutes.otpVerification,
///   arguments: OtpVerificationArgs(
///     contact: '+1234567890',
///     isPhone: true,
///   ),
/// );
/// ```
class OtpVerificationArgs {
  /// The phone number or email address the OTP was sent to.
  final String contact;

  /// `true` if [contact] is a phone number, `false` if it is an email address.
  final bool isPhone;

  const OtpVerificationArgs({
    required this.contact,
    required this.isPhone,
  });
}

/// A dedicated screen for entering and verifying a 6-digit OTP code.
///
/// Features:
/// - 6 individual digit boxes for clear visual feedback
/// - 5-minute countdown timer (matches backend OTP expiry)
/// - "Resend OTP" button enabled only after the timer expires
/// - Calls [AuthProvider.verifyOtp] on submission
/// - Navigates to `/home` on success
class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({super.key});

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  // ─── OTP input ───────────────────────────────────────────────────────────────
  static const int _otpLength = 6;

  /// One controller per digit box.
  final List<TextEditingController> _controllers =
      List.generate(_otpLength, (_) => TextEditingController());

  /// One focus node per digit box.
  final List<FocusNode> _focusNodes =
      List.generate(_otpLength, (_) => FocusNode());

  // ─── Timer ───────────────────────────────────────────────────────────────────
  late int _secondsRemaining;
  Timer? _timer;
  bool get _canResend => _secondsRemaining == 0;

  // ─── Screen args ─────────────────────────────────────────────────────────────
  late OtpVerificationArgs _args;
  bool _argsInitialised = false;

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _secondsRemaining = AppConstants.otpExpirySeconds; // 300 s = 5 min
    _startTimer();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_argsInitialised) {
      final args =
          ModalRoute.of(context)?.settings.arguments as OtpVerificationArgs?;
      if (args != null) {
        _args = args;
      } else {
        // Fallback – should not happen in normal navigation flow.
        _args = const OtpVerificationArgs(contact: '', isPhone: false);
      }
      _argsInitialised = true;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  // ─── Timer helpers ────────────────────────────────────────────────────────────

  void _startTimer() {
    _timer?.cancel();
    _secondsRemaining = AppConstants.otpExpirySeconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_secondsRemaining > 0) {
          _secondsRemaining--;
        } else {
          timer.cancel();
        }
      });
    });
  }

  String get _timerLabel {
    final minutes = _secondsRemaining ~/ 60;
    final seconds = _secondsRemaining % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  // ─── OTP helpers ─────────────────────────────────────────────────────────────

  String get _currentOtp =>
      _controllers.map((c) => c.text).join();

  bool get _isOtpComplete => _currentOtp.length == _otpLength;

  void _onDigitChanged(int index, String value) {
    if (value.length == 1 && index < _otpLength - 1) {
      // Move focus to next box.
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      // Move focus back on delete.
      _focusNodes[index - 1].requestFocus();
    }
    setState(() {}); // Rebuild to update verify button state.
  }

  void _clearOtp() {
    for (final c in _controllers) {
      c.clear();
    }
    _focusNodes.first.requestFocus();
    setState(() {});
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  Future<void> _verifyOtp() async {
    if (!_isOtpComplete) {
      _showSnack('Please enter the complete 6-digit code');
      return;
    }

    final auth = context.read<AuthProvider>();
    try {
      await auth.verifyOtp(
        _args.contact,
        _currentOtp,
        isPhone: _args.isPhone,
      );
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (_) {
      _showSnack(auth.error ?? 'Invalid OTP. Please try again.');
      _clearOtp();
    }
  }

  Future<void> _resendOtp() async {
    if (!_canResend) return;

    final auth = context.read<AuthProvider>();
    try {
      if (_args.isPhone) {
        await auth.verifyPhoneNumber(_args.contact);
      } else {
        await auth.sendEmailOtp(_args.contact);
      }
      _clearOtp();
      _startTimer();
      _showSnack('OTP resent to ${_args.contact}');
    } catch (_) {
      _showSnack(auth.error ?? 'Failed to resend OTP. Please try again.');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ─── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),

              // Back button
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Icon(Icons.arrow_back_ios, size: 20),
              ),

              const SizedBox(height: 32),

              // Title
              const Text(
                'Verify your code',
                style: TextStyle(
                  fontFamily: 'PlusJakartaSans',
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),

              const SizedBox(height: 8),

              // Subtitle with contact info
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontFamily: 'PlusJakartaSans',
                    fontSize: 15,
                    color: AppColors.textSecondary,
                  ),
                  children: [
                    TextSpan(
                      text: 'We sent a 6-digit code to ',
                    ),
                    TextSpan(
                      text: _argsInitialised ? _args.contact : '',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 40),

              // OTP digit boxes
              _OtpInputRow(
                controllers: _controllers,
                focusNodes: _focusNodes,
                onChanged: _onDigitChanged,
                enabled: !auth.isLoading,
              ),

              const SizedBox(height: 32),

              // Timer / resend row
              Center(
                child: _canResend
                    ? TextButton(
                        onPressed: auth.isLoading ? null : _resendOtp,
                        child: const Text(
                          'Resend OTP',
                          style: TextStyle(
                            fontFamily: 'PlusJakartaSans',
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryGreen,
                          ),
                        ),
                      )
                    : RichText(
                        text: TextSpan(
                          style: const TextStyle(
                            fontFamily: 'PlusJakartaSans',
                            fontSize: 14,
                            color: AppColors.textSecondary,
                          ),
                          children: [
                            const TextSpan(text: 'Resend code in '),
                            TextSpan(
                              text: _timerLabel,
                              style: const TextStyle(
                                color: AppColors.primaryGreen,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
              ),

              const SizedBox(height: 40),

              // Verify button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed:
                      (auth.isLoading || !_isOtpComplete) ? null : _verifyOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.signUpGreen,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        AppColors.signUpGreen.withValues(alpha: 0.5),
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
                      : const Text(
                          'Verify',
                          style: TextStyle(
                            fontFamily: 'PlusJakartaSans',
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),

              const SizedBox(height: 24),

              // Wrong contact? Go back hint
              Center(
                child: GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Text(
                    'Wrong number / email? Go back',
                    style: TextStyle(
                      fontFamily: 'PlusJakartaSans',
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── OTP Input Row ────────────────────────────────────────────────────────────

/// A row of 6 individual single-character text fields styled as digit boxes.
class _OtpInputRow extends StatelessWidget {
  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;
  final void Function(int index, String value) onChanged;
  final bool enabled;

  const _OtpInputRow({
    required this.controllers,
    required this.focusNodes,
    required this.onChanged,
    required this.enabled,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(
        controllers.length,
        (index) => _OtpDigitBox(
          controller: controllers[index],
          focusNode: focusNodes[index],
          enabled: enabled,
          onChanged: (value) => onChanged(index, value),
          onBackspace: () {
            if (controllers[index].text.isEmpty && index > 0) {
              controllers[index - 1].clear();
              focusNodes[index - 1].requestFocus();
            }
          },
        ),
      ),
    );
  }
}

// ─── Single Digit Box ─────────────────────────────────────────────────────────

class _OtpDigitBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final VoidCallback onBackspace;

  const _OtpDigitBox({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onChanged,
    required this.onBackspace,
  });

  @override
  Widget build(BuildContext context) {
    final bool isFilled = controller.text.isNotEmpty;

    return SizedBox(
      width: 48,
      height: 56,
      child: KeyboardListener(
        focusNode: FocusNode(),
        onKeyEvent: (event) {
          if (event is KeyDownEvent &&
              event.logicalKey == LogicalKeyboardKey.backspace) {
            onBackspace();
          }
        },
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          maxLength: 1,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
          decoration: InputDecoration(
            counterText: '',
            contentPadding: EdgeInsets.zero,
            filled: true,
            fillColor: isFilled ? AppColors.loginGreen : AppColors.lightGrey,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: isFilled
                  ? const BorderSide(color: AppColors.primaryGreen, width: 1.5)
                  : BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppColors.primaryGreen, width: 2),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
