import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';

/// Wraps [child] and catches any errors thrown during its build phase.
///
/// When an error is caught the widget renders a user-friendly error card
/// instead of propagating the crash up the tree. An optional [onRetry]
/// callback enables the user to trigger a fresh build attempt.
///
/// Usage:
/// ```dart
/// ErrorBoundary(
///   onRetry: _reload,
///   child: MyWidget(),
/// )
/// ```
class ErrorBoundary extends StatefulWidget {
  final Widget child;
  final VoidCallback? onRetry;
  final String? errorMessage;

  const ErrorBoundary({
    super.key,
    required this.child,
    this.onRetry,
    this.errorMessage,
  });

  @override
  State<ErrorBoundary> createState() => _ErrorBoundaryState();
}

class _ErrorBoundaryState extends State<ErrorBoundary> {
  Object? _error;

  void _handleError(Object error, StackTrace stackTrace) {
    Logger.error('ErrorBoundary caught error', error, stackTrace);
    setState(() {
      _error = error;
    });
  }

  void _retry() {
    setState(() {
      _error = null;
    });
    widget.onRetry?.call();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return _ErrorCard(
        message: widget.errorMessage ?? 'Something went wrong. Please try again.',
        onRetry: widget.onRetry != null ? _retry : null,
      );
    }

    return _ErrorCatcher(
      onError: _handleError,
      child: widget.child,
    );
  }
}

/// Internal widget that uses [ErrorWidget.builder] scoped to its subtree.
class _ErrorCatcher extends StatelessWidget {
  final Widget child;
  final void Function(Object error, StackTrace stackTrace) onError;

  const _ErrorCatcher({required this.child, required this.onError});

  @override
  Widget build(BuildContext context) {
    ErrorWidget.builder = (FlutterErrorDetails details) {
      onError(details.exception, details.stack ?? StackTrace.empty);
      return const SizedBox.shrink();
    };
    return child;
  }
}

/// Reusable error card shown when an error boundary catches an error.
class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const _ErrorCard({required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Try Again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
