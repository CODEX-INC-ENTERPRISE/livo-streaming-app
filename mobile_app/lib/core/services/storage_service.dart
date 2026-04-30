import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';
import '../utils/logger.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal() {
    _init();
  }

  late FlutterSecureStorage _secureStorage;
  late SharedPreferences _preferences;

  Future<void> _init() async {
    _secureStorage = const FlutterSecureStorage();
    _preferences = await SharedPreferences.getInstance();
  }

  // Secure storage methods
  Future<void> setAuthToken(String token) async {
    try {
      await _secureStorage.write(key: AppConstants.authTokenKey, value: token);
      Logger.debug('Auth token stored securely');
    } catch (e) {
      Logger.error('Failed to store auth token', e);
      rethrow;
    }
  }

  Future<String?> getAuthToken() async {
    try {
      return await _secureStorage.read(key: AppConstants.authTokenKey);
    } catch (e) {
      Logger.error('Failed to retrieve auth token', e);
      return null;
    }
  }

  Future<void> setRefreshToken(String token) async {
    try {
      await _secureStorage.write(key: AppConstants.refreshTokenKey, value: token);
      Logger.debug('Refresh token stored securely');
    } catch (e) {
      Logger.error('Failed to store refresh token', e);
      rethrow;
    }
  }

  Future<String?> getRefreshToken() async {
    try {
      return await _secureStorage.read(key: AppConstants.refreshTokenKey);
    } catch (e) {
      Logger.error('Failed to retrieve refresh token', e);
      return null;
    }
  }

  Future<void> setFcmToken(String token) async {
    try {
      await _secureStorage.write(key: AppConstants.fcmTokenKey, value: token);
      Logger.debug('FCM token stored securely');
    } catch (e) {
      Logger.error('Failed to store FCM token', e);
      rethrow;
    }
  }

  Future<String?> getFcmToken() async {
    try {
      return await _secureStorage.read(key: AppConstants.fcmTokenKey);
    } catch (e) {
      Logger.error('Failed to retrieve FCM token', e);
      return null;
    }
  }

  Future<void> clearSecureStorage() async {
    try {
      await _secureStorage.deleteAll();
      Logger.debug('Secure storage cleared');
    } catch (e) {
      Logger.error('Failed to clear secure storage', e);
      rethrow;
    }
  }

  // Shared preferences methods
  Future<void> setCurrentUser(Map<String, dynamic> user) async {
    try {
      final userJson = jsonEncode(user);
      await _preferences.setString(AppConstants.currentUserKey, userJson);
      Logger.debug('Current user stored');
    } catch (e) {
      Logger.error('Failed to store current user', e);
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    try {
      final userJson = _preferences.getString(AppConstants.currentUserKey);
      if (userJson == null) return null;
      return jsonDecode(userJson) as Map<String, dynamic>;
    } catch (e) {
      Logger.error('Failed to retrieve current user', e);
      return null;
    }
  }

  Future<void> removeCurrentUser() async {
    try {
      await _preferences.remove(AppConstants.currentUserKey);
      Logger.debug('Current user removed');
    } catch (e) {
      Logger.error('Failed to remove current user', e);
      rethrow;
    }
  }

  // Generic preferences methods
  Future<void> setString(String key, String value) async {
    try {
      await _preferences.setString(key, value);
    } catch (e) {
      Logger.error('Failed to set string preference: $key', e);
      rethrow;
    }
  }

  Future<String?> getString(String key) async {
    try {
      return _preferences.getString(key);
    } catch (e) {
      Logger.error('Failed to get string preference: $key', e);
      return null;
    }
  }

  Future<void> setBool(String key, bool value) async {
    try {
      await _preferences.setBool(key, value);
    } catch (e) {
      Logger.error('Failed to set bool preference: $key', e);
      rethrow;
    }
  }

  Future<bool?> getBool(String key) async {
    try {
      return _preferences.getBool(key);
    } catch (e) {
      Logger.error('Failed to get bool preference: $key', e);
      return null;
    }
  }

  Future<void> setInt(String key, int value) async {
    try {
      await _preferences.setInt(key, value);
    } catch (e) {
      Logger.error('Failed to set int preference: $key', e);
      rethrow;
    }
  }

  Future<int?> getInt(String key) async {
    try {
      return _preferences.getInt(key);
    } catch (e) {
      Logger.error('Failed to get int preference: $key', e);
      return null;
    }
  }

  Future<void> setDouble(String key, double value) async {
    try {
      await _preferences.setDouble(key, value);
    } catch (e) {
      Logger.error('Failed to set double preference: $key', e);
      rethrow;
    }
  }

  Future<double?> getDouble(String key) async {
    try {
      return _preferences.getDouble(key);
    } catch (e) {
      Logger.error('Failed to get double preference: $key', e);
      return null;
    }
  }

  Future<void> setStringList(String key, List<String> value) async {
    try {
      await _preferences.setStringList(key, value);
    } catch (e) {
      Logger.error('Failed to set string list preference: $key', e);
      rethrow;
    }
  }

  Future<List<String>?> getStringList(String key) async {
    try {
      return _preferences.getStringList(key);
    } catch (e) {
      Logger.error('Failed to get string list preference: $key', e);
      return null;
    }
  }

  Future<bool> containsKey(String key) async {
    try {
      return _preferences.containsKey(key);
    } catch (e) {
      Logger.error('Failed to check if preference contains key: $key', e);
      return false;
    }
  }

  Future<void> remove(String key) async {
    try {
      await _preferences.remove(key);
    } catch (e) {
      Logger.error('Failed to remove preference: $key', e);
      rethrow;
    }
  }

  Future<void> clearAll() async {
    try {
      await _preferences.clear();
      await clearSecureStorage();
      Logger.debug('All storage cleared');
    } catch (e) {
      Logger.error('Failed to clear all storage', e);
      rethrow;
    }
  }

  // App-specific methods
  Future<bool> isFirstLaunch() async {
    const key = 'is_first_launch';
    final isFirst = await getBool(key) ?? true;
    if (isFirst) {
      await setBool(key, false);
    }
    return isFirst;
  }

  Future<void> setNotificationEnabled(bool enabled) async {
    await setBool('notifications_enabled', enabled);
  }

  Future<bool> getNotificationEnabled() async {
    return await getBool('notifications_enabled') ?? true;
  }

  Future<void> setDarkMode(bool enabled) async {
    await setBool('dark_mode_enabled', enabled);
  }

  Future<bool> getDarkMode() async {
    return await getBool('dark_mode_enabled') ?? false;
  }

  Future<void> setLanguage(String languageCode) async {
    await setString('language_code', languageCode);
  }

  Future<String?> getLanguage() async {
    return await getString('language_code');
  }
}