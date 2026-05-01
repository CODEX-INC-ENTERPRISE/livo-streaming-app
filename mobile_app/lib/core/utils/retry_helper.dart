import 'dart:async';

import 'logger.dart';

/// Executes [fn] up to [maxAttempts] times with exponential backoff.
///
/// Delays between attempts: 1s, 2s, 4s, …
/// Throws the last error if all attempts fail.
///
/// Example:
/// ```dart
/// final result = await retryWithBackoff(() => apiService.get('/streams'));
/// ```
Future<T> retryWithBackoff<T>(
  Future<T> Function() fn, {
  int maxAttempts = 3,
  Duration initialDelay = const Duration(seconds: 1),
}) async {
  Object? lastError;

  for (int attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      Logger.warning(
        'Attempt ${attempt + 1}/$maxAttempts failed',
        e,
      );

      if (attempt < maxAttempts - 1) {
        final delay = initialDelay * (1 << attempt);
        await Future<void>.delayed(delay);
      }
    }
  }

  throw lastError!;
}
