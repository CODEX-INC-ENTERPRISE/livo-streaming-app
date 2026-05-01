import '../utils/logger.dart';
import 'api_service.dart';
import '../../models/wallet.dart';

/// Service for wallet, transaction, and withdrawal API calls.
class WalletService {
  final ApiService _apiService = ApiService();

  /// Fetch wallet for [userId].
  Future<UserWallet> getWallet(String userId) async {
    final response = await _apiService.get('/wallet/$userId');
    final data = response.data as Map<String, dynamic>;
    return UserWallet.fromJson(data);
  }

  /// Fetch paginated transactions for [userId].
  Future<Map<String, dynamic>> getTransactions({
    required String userId,
    int page = 1,
    int limit = 20,
    TransactionType? type,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (type != null) params['type'] = type.name;

    final response = await _apiService.get(
      '/wallet/transactions/$userId',
      queryParameters: params,
    );
    return response.data as Map<String, dynamic>;
  }

  /// Initiate a coin purchase. Returns `{ paymentUrl, sessionId }`.
  Future<Map<String, dynamic>> purchaseCoins({
    required String packageId,
    required String paymentMethod,
  }) async {
    final response = await _apiService.post(
      '/wallet/purchase-coins',
      data: {'packageId': packageId, 'paymentMethod': paymentMethod},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Request a diamond withdrawal. Returns `{ withdrawalRequestId }`.
  Future<Map<String, dynamic>> requestWithdrawal(int diamondAmount) async {
    final response = await _apiService.post(
      '/wallet/withdraw',
      data: {'diamondAmount': diamondAmount},
    );
    return response.data as Map<String, dynamic>;
  }

  /// Fetch withdrawal history for [userId].
  Future<List<dynamic>> getWithdrawals(String userId) async {
    final response = await _apiService.get('/wallet/withdrawals/$userId');
    final data = response.data as Map<String, dynamic>;
    return data['withdrawals'] as List<dynamic>? ?? [];
  }

  /// Fetch host earnings summary for [userId].
  Future<Map<String, dynamic>> getHostEarnings(String userId) async {
    final response = await _apiService.get('/hosts/$userId/earnings');
    return response.data as Map<String, dynamic>;
  }

  /// Fetch host statistics for [userId].
  Future<Map<String, dynamic>> getHostStatistics(String userId) async {
    try {
      final response = await _apiService.get('/hosts/$userId/statistics');
      return response.data as Map<String, dynamic>;
    } catch (e) {
      Logger.error('Failed to load host statistics', e);
      return {};
    }
  }
}
