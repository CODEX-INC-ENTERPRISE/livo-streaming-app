import 'dart:async';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../constants/environment.dart';
import '../utils/logger.dart';

/// Custom exception for API errors with status code and message.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic data;

  const ApiException(this.message, {this.statusCode, this.data});

  @override
  String toString() =>
      'ApiException: $message${statusCode != null ? ' (HTTP $statusCode)' : ''}';
}

/// Singleton HTTP client wrapping Dio.
///
/// Features:
/// - Base URL and 10-second timeouts configured from [Environment] / [AppConstants]
/// - Auth interceptor: attaches `Authorization: Bearer <token>` when set
/// - Logging interceptor: logs requests and responses in debug mode
/// - Structured [ApiException] thrown for all error cases
class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal() {
    _init();
  }

  late final Dio _dio;

  // In-memory token cache – set via [setAuthToken], cleared via [clearAuthToken].
  String? _authToken;

  void _init() {
    _dio = Dio(
      BaseOptions(
        baseUrl: Environment.apiBaseUrl,
        connectTimeout: const Duration(seconds: AppConstants.apiTimeoutSeconds),
        receiveTimeout: const Duration(seconds: AppConstants.apiTimeoutSeconds),
        sendTimeout: const Duration(seconds: AppConstants.apiTimeoutSeconds),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Auth interceptor – adds token to every request when available.
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_authToken != null) {
            options.headers['Authorization'] = 'Bearer $_authToken';
          }
          Logger.apiRequest(options.method, options.path, options.data);
          return handler.next(options);
        },
        onResponse: (response, handler) {
          Logger.apiResponse(
            response.requestOptions.method,
            response.requestOptions.path,
            response.statusCode ?? 0,
            response.data,
          );
          return handler.next(response);
        },
        onError: (error, handler) {
          Logger.error(
            'API Error: ${error.requestOptions.method} ${error.requestOptions.path}',
            error.response?.data,
          );
          return handler.next(error);
        },
      ),
    );
  }

  // ─── Token management ────────────────────────────────────────────────────────

  void setAuthToken(String token) {
    _authToken = token;
  }

  void clearAuthToken() {
    _authToken = null;
  }

  // ─── HTTP methods ─────────────────────────────────────────────────────────────

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(path,
          queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  /// Multipart file upload helper.
  Future<Response<T>> uploadFile<T>(
    String path,
    String filePath, {
    String fieldName = 'file',
    Map<String, dynamic>? additionalData,
    Options? options,
  }) async {
    try {
      final formData = FormData.fromMap({
        fieldName: await MultipartFile.fromFile(filePath),
        ...?additionalData,
      });
      return await _dio.post<T>(
        path,
        data: formData,
        options: options ?? Options(contentType: 'multipart/form-data'),
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  // ─── Error handling ───────────────────────────────────────────────────────────

  ApiException _handleDioException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return const ApiException('Request timed out. Please try again.');

      case DioExceptionType.connectionError:
        return const ApiException(
            'No internet connection. Please check your network.');

      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final body = e.response?.data;
        final serverMessage = body is Map ? body['error'] ?? body['message'] : null;

        switch (statusCode) {
          case 400:
            return ApiException(serverMessage ?? 'Bad request',
                statusCode: 400, data: body);
          case 401:
            return ApiException('Authentication required. Please log in again.',
                statusCode: 401);
          case 403:
            return ApiException('You do not have permission to perform this action.',
                statusCode: 403);
          case 404:
            return ApiException('The requested resource was not found.',
                statusCode: 404);
          case 409:
            return ApiException(serverMessage ?? 'Conflict with existing data.',
                statusCode: 409, data: body);
          case 422:
            return ApiException(
                serverMessage ?? 'Validation failed.',
                statusCode: 422,
                data: body);
          case 429:
            return const ApiException(
                'Too many requests. Please slow down and try again.',
                statusCode: 429);
          case 500:
            return const ApiException('Internal server error. Please try again later.',
                statusCode: 500);
          case 502:
          case 503:
            return ApiException('Service temporarily unavailable.',
                statusCode: statusCode);
          default:
            return ApiException(
                serverMessage ?? 'Unexpected server error.',
                statusCode: statusCode);
        }

      default:
        return ApiException(e.message ?? 'An unexpected error occurred.');
    }
  }
}
