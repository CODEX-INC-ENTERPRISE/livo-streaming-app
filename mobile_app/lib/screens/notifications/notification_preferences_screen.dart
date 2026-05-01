import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/services/api_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';
import '../../providers/auth_provider.dart';

/// Notification preferences screen – lets users toggle each notification type
/// on/off and persists the settings to the backend.
///
/// Route: [AppRoutes.notificationPreferences]
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  final ApiService _apiService = ApiService();

  // Preference state – mirrors the backend notificationPrefs object.
  bool _streamStart = true;
  bool _gifts = true;
  bool _followers = true;
  bool _messages = true;

  bool _isLoading = true;
  bool _isSaving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadPreferences());
  }

  Future<void> _loadPreferences() async {
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      final response =
          await _apiService.get<Map<String, dynamic>>('/users/$userId');
      if (response.statusCode == 200 && response.data != null) {
        final prefs = (response.data!['notificationPrefs'] ??
            response.data!['notificationPreferences']) as Map<String, dynamic>?;
        if (prefs != null) {
          setState(() {
            _streamStart = prefs['streamStart'] as bool? ?? true;
            _gifts = prefs['gifts'] as bool? ?? true;
            _followers = prefs['followers'] as bool? ?? true;
            _messages = prefs['messages'] as bool? ?? true;
          });
        }
      }
    } catch (e) {
      Logger.error('Failed to load notification preferences', e);
      // Non-fatal – show defaults.
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _savePreferences() async {
    final userId = context.read<AuthProvider>().currentUser?.id ?? '';
    if (userId.isEmpty) return;

    setState(() {
      _isSaving = true;
      _error = null;
    });

    try {
      await _apiService.put<Map<String, dynamic>>(
        '/users/$userId/notification-preferences',
        data: {
          'streamStart': _streamStart,
          'gifts': _gifts,
          'followers': _followers,
          'messages': _messages,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Preferences saved'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      Logger.error('Failed to save notification preferences', e);
      setState(() => _error = 'Failed to save preferences. Please try again.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _onToggle(String key, bool value) {
    setState(() {
      switch (key) {
        case 'streamStart':
          _streamStart = value;
          break;
        case 'gifts':
          _gifts = value;
          break;
        case 'followers':
          _followers = value;
          break;
        case 'messages':
          _messages = value;
          break;
      }
    });
    // Auto-save on each toggle.
    _savePreferences();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Preferences'),
        actions: [
          if (_isSaving)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                const _SectionHeader(title: 'Streams'),
                _PreferenceTile(
                  icon: Icons.live_tv,
                  iconColor: AppColors.liveRed,
                  title: 'Stream start',
                  subtitle:
                      'Notify me when someone I follow goes live',
                  value: _streamStart,
                  onChanged: (v) => _onToggle('streamStart', v),
                ),
                const Divider(height: 1, indent: 72),
                const _SectionHeader(title: 'Activity'),
                _PreferenceTile(
                  icon: Icons.card_giftcard,
                  iconColor: AppColors.giftGold,
                  title: 'Gifts received',
                  subtitle: 'Notify me when I receive a virtual gift',
                  value: _gifts,
                  onChanged: (v) => _onToggle('gifts', v),
                ),
                const Divider(height: 1, indent: 72),
                _PreferenceTile(
                  icon: Icons.person_add_outlined,
                  iconColor: AppColors.primaryGreen,
                  title: 'New followers',
                  subtitle: 'Notify me when someone follows me',
                  value: _followers,
                  onChanged: (v) => _onToggle('followers', v),
                ),
                const Divider(height: 1, indent: 72),
                _PreferenceTile(
                  icon: Icons.chat_bubble_outline,
                  iconColor: AppColors.info,
                  title: 'Messages',
                  subtitle: 'Notify me about new messages',
                  value: _messages,
                  onChanged: (v) => _onToggle('messages', v),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      _error!,
                      style: const TextStyle(
                          color: AppColors.error, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                  ),
              ],
            ),
    );
  }
}

// ─── Section Header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textSecondary,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

// ─── Preference Tile ──────────────────────────────────────────────────────────

class _PreferenceTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _PreferenceTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        radius: 20,
        backgroundColor: iconColor.withAlpha(30),
        child: Icon(icon, color: iconColor, size: 18),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(
          fontSize: 12,
          color: AppColors.textSecondary,
        ),
      ),
      trailing: Switch.adaptive(
        value: value,
        onChanged: onChanged,
        activeColor: AppColors.primaryGreen,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    );
  }
}
