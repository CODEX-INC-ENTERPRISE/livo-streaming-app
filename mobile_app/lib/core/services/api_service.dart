import 'dart:async';
import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../constants/environment.dart';
import '../utils/logger.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal() {
    _init();
  }

  late Dio _dio;
  final Map<String, String> _headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  void _init() {
    _dio = Dio(
      BaseOptions(
        baseUrl: Environment.apiBaseUrl,
        connectTimeout: Duration(seconds: AppConstants.apiTimeoutSeconds),
        receiveTimeout: Duration(seconds: AppConstants.apiTimeoutSeconds),
        sendTimeout: Duration(seconds: AppConstants.apiTimeoutSeconds),
        headers: _headers,
      ),
    );

    // Add interceptors
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          Logger.apiRequest(options.method, options.path, options.data);
          // Add authentication token if available
          final token = _getAuthToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
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

  String? _getAuthToken() {
    // This should be implemented with secure storage
    // For now, return null - will be implemented in StorageService
    return null;
  }

  void setAuthToken(String token) {
    _headers['Authorization'] = 'Bearer $token';
    _dio.options.headers = _headers;
  }

  void clearAuthToken() {
    _headers.remove('Authorization');
    _dio.options.headers = _headers;
  }

  // Generic HTTP methods
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  // Multipart file upload
  Future<Response> uploadFile(
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

      return await _dio.post(
        path,
        data: formData,
        options: options ?? Options(contentType: 'multipart/form-data'),
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  // Error handling
  Exception _handleDioException(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return TimeoutException('Request timeout');
    } else if (e.type == DioExceptionType.connectionError) {
      return Exception('Network connection error');
    } else if (e.response != null) {
      // Server responded with error
      final statusCode = e.response!.statusCode;
      final data = e.response!.data;

      switch (statusCode) {
        case 400:
          return Exception(data['error'] ?? 'Bad request');
        case 401:
          return Exception('Authentication required');
        case 403:
          return Exception('Access forbidden');
        case 404:
          return Exception('Resource not found');
        case 409:
          return Exception('Conflict: ${data['error']}');
        case 422:
          return Exception('Validation error: ${data['errors']}');
        case 429:
          return Exception('Too many requests');
        case 500:
          return Exception('Internal server error');
        case 502:
          return Exception('Bad gateway');
        case 503:
          return Exception('Service unavailable');
        default:
          return Exception('Server error: $statusCode');
      }
    } else {
      return Exception('Unknown error: ${e.message}');
    }
  }
}

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException: $message${statusCode != null ? ' ($statusCode)' : ''}';
}