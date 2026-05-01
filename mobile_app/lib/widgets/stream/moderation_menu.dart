import 'package:flutter/material.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';

/// Moderation action types available to a host or moderator.
enum ModerationAction { mute, kick, block, assignModerator }

extension ModerationActionExt on ModerationAction {
  String get label {
    switch (this) {
      case ModerationAction.mute:
        return 'Mute';
      case ModerationAction.kick:
        return 'Kick';
      case ModerationAction.block:
        return 'Block';
      case ModerationAction.assignModerator:
        return 'Make Moderator';
    }
  }

  IconData get icon {
    switch (this) {
      case ModerationAction.mute:
        return Icons.mic_off;
      case ModerationAction.kick:
        return Icons.exit_to_app;
      case ModerationAction.block:
        return Icons.block;
      case ModerationAction.assignModerator:
        return Icons.shield;
    }
  }

  Color get color {
    switch (this) {
      case ModerationAction.mute:
        return AppColors.warning;
      case ModerationAction.kick:
        return AppColors.error;
      case ModerationAction.block:
        return AppColors.error;
      case ModerationAction.assignModerator:
        return AppColors.info;
    }
  }

  String get confirmMessage {
    switch (this) {
      case ModerationAction.mute:
        return 'Mute this user? They will not be able to send chat messages.';
      case ModerationAction.kick:
        return 'Kick this user? They will be removed from the stream.';
      case ModerationAction.block:
        return 'Block this user? They will be permanently prevented from joining your streams.';
      case ModerationAction.assignModerator:
        return 'Make this user a moderator? They will be able to mute and kick other viewers.';
    }
  }
}

/// Bottom sheet moderation menu shown when a host long-presses a viewer.
class ModerationMenu extends StatefulWidget {
  final String streamId;
  final String targetUserId;
  final String targetDisplayName;

  /// Whether the caller is the stream host (vs a moderator).
  final bool isHost;

  const ModerationMenu({
    super.key,
    required this.streamId,
    required this.targetUserId,
    required this.targetDisplayName,
    this.isHost = true,
  });

  /// Convenience method to show the menu.
  static Future<void> show(
    BuildContext context, {
    required String streamId,
    required String targetUserId,
    required String targetDisplayName,
    bool isHost = true,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => ModerationMenu(
        streamId: streamId,
        targetUserId: targetUserId,
        targetDisplayName: targetDisplayName,
        isHost: isHost,
      ),
    );
  }

  @override
  State<ModerationMenu> createState() => _ModerationMenuState();
}

class _ModerationMenuState extends State<ModerationMenu> {
  bool _isLoading = false;

  List<ModerationAction> get _availableActions {
    if (widget.isHost) {
      return ModerationAction.values;
    }
    // Moderators can only mute and kick
    return [ModerationAction.mute, ModerationAction.kick];
  }

  Future<void> _performAction(ModerationAction action) async {
    final confirmed = await _showConfirmDialog(action);
    if (!confirmed) return;

    setState(() => _isLoading = true);
    try {
      final apiService = ApiService();
      final response = await apiService.post(
        '/streams/${widget.streamId}/moderate',
        data: {
          'action': action.name == 'assignModerator' ? 'moderator' : action.name,
          'targetUserId': widget.targetUserId,
        },
      );

      if (response.statusCode == 200 && mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                '${action.label} applied to ${widget.targetDisplayName}'),
            backgroundColor: AppColors.success,
          ),
        );
      } else {
        throw Exception('Moderation action failed');
      }
    } catch (e) {
      Logger.error('Moderation action failed', e);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to ${action.label.toLowerCase()} user'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<bool> _showConfirmDialog(ModerationAction action) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.darkSurface,
            title: Text(
              '${action.label} ${widget.targetDisplayName}?',
              style: const TextStyle(color: Colors.white),
            ),
            content: Text(
              action.confirmMessage,
              style: const TextStyle(color: AppColors.darkTextSecondary),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                    backgroundColor: action.color),
                onPressed: () => Navigator.pop(ctx, true),
                child: Text(action.label),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.darkBorder,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.darkBackground,
                  child: Icon(Icons.person, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.targetDisplayName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      const Text(
                        'Viewer',
                        style: TextStyle(
                          color: AppColors.darkTextSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(color: AppColors.darkBorder, height: 1),

          // Action list
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: AppColors.primaryGreen),
            )
          else
            ..._availableActions.map(
              (action) => ListTile(
                leading: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: action.color.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(action.icon, color: action.color, size: 18),
                ),
                title: Text(
                  action.label,
                  style: TextStyle(
                    color: action.color,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                onTap: () => _performAction(action),
              ),
            ),

          SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
        ],
      ),
    );
  }
}
