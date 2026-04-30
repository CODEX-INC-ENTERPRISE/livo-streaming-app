import 'package:flutter/foundation.dart';
import '../constants/environment.dart';

class Logger {
  static void debug(String message, [Object? data]) {
    if (Environment.debug) {
      if (kDebugMode) {
        print('[DEBUG] $message${data != null ? ': $data' : ''}');
      }
    }
  }

  static void info(String message, [Object? data]) {
    if (kDebugMode) {
      print('[INFO] $message${data != null ? ': $data' : ''}');
    }
  }

  static void warning(String message, [Object? data]) {
    if (kDebugMode) {
      print('[WARNING] $message${data != null ? ': $data' : ''}');
    }
  }

  static void error(String message, [Object? error, StackTrace? stackTrace]) {
    if (kDebugMode) {
      print('[ERROR] $message');
      if (error != null) {
        print('Error: $error');
      }
      if (stackTrace != null) {
        print('Stack Trace: $stackTrace');
      }
    }
  }

  static void apiRequest(String method, String url, [Object? data]) {
    if (Environment.debug) {
      if (kDebugMode) {
        print('[API REQUEST] $method $url${data != null ? ': $data' : ''}');
      }
    }
  }

  static void apiResponse(String method, String url, int statusCode, [Object? data]) {
    if (Environment.debug) {
      if (kDebugMode) {
        print('[API RESPONSE] $method $url - Status: $statusCode${data != null ? ': $data' : ''}');
      }
    }
  }

  static void socketEvent(String event, [Object? data]) {
    if (Environment.debug) {
      if (kDebugMode) {
        print('[SOCKET EVENT] $event${data != null ? ': $data' : ''}');
      }
    }
  }

  static void performance(String operation, Duration duration) {
    if (Environment.debug) {
      if (kDebugMode) {
        print('[PERFORMANCE] $operation took ${duration.inMilliseconds}ms');
      }
    }
  }
}