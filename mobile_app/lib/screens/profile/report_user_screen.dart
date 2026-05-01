import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';
import '../../providers/user_provider.dart';

/// Report reasons shown to the user.
const _kReportReasons = [
  'Spam or misleading content',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Nudity or sexual content',
  'Violence or dangerous content',
  'Impersonation',
  'Other',
];

/// Screen that lets the current user submit a report against [reportedUserId].
///
/// Route: push with arguments `{'userId': String, 'displayName': String}`
class ReportUserScreen extends StatefulWidget {
  final String reportedUserId;
  final String displayName;

  const ReportUserScreen({
    super.key,
    required this.reportedUserId,
    required this.displayName,
  });

  @override
  State<ReportUserScreen> createState() => _ReportUserScreenState();
}

class _ReportUserScreenState extends State<ReportUserScreen> {
  String? _selectedReason;
  final _descriptionController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedReason == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a reason.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await context.read<UserProvider>().reportUser(
            reportedUserId: widget.reportedUserId,
            reason: _selectedReason!,
            description: _descriptionController.text.trim(),
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report submitted. Thank you for keeping the community safe.'),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      Logger.error('Failed to submit report', e);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit report. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Report ${widget.displayName}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Why are you reporting this user?',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          ..._kReportReasons.map(
            (reason) => RadioListTile<String>(
              value: reason,
              groupValue: _selectedReason,
              title: Text(reason),
              activeColor: AppColors.primaryGreen,
              contentPadding: EdgeInsets.zero,
              onChanged: (value) => setState(() => _selectedReason = value),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            maxLength: 500,
            decoration: const InputDecoration(
              labelText: 'Additional details (optional)',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: AppColors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.white,
                      ),
                    )
                  : const Text('Submit Report'),
            ),
          ),
        ],
      ),
    );
  }
}
