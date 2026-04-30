import 'package:flutter/foundation.dart';
import '../models/wallet.dart';
import '../models/virtual_gift.dart';
import '../core/services/api_service.dart';
import '../core/utils/logger.dart';

class WalletProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();
  
  UserWallet? _wallet;
  List<VirtualGift> _availableGifts = [];
  bool _isLoading = false;
  String? _error;
  
  // Getters
  UserWallet? get wallet => _wallet;
  List<VirtualGift> get availableGifts => _availableGifts;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  int get coinBalance => _wallet?.coinBalance ?? 0;
  int get diamondBalance => _wallet?.diamondBalance ?? 0;
  
  // Load wallet data
  Future<void> loadWallet(String userId) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // Load wallet
      final walletResponse = await _apiService.get('/wallet/$userId');
      
      if (walletResponse.statusCode == 200) {
        final walletData = walletResponse.data as Map<String, dynamic>;
        _wallet = UserWallet.fromJson(walletData);
        
        Logger.info('Wallet loaded: ${_wallet!.coinBalance} coins, ${_wallet!.diamondBalance} diamonds');
      } else {
        throw Exception('Failed to load wallet');
      }
      
      // Load available gifts
      await _loadAvailableGifts();
    } catch (e) {
      Logger.error('Failed to load wallet', e);
      _error = 'Failed to load wallet';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Load available gifts
  Future<void> _loadAvailableGifts() async {
    try {
      final response = await _apiService.get('/gifts');
      
      if (response.statusCode == 200) {
        final giftsData = response.data as List<dynamic>;
        _availableGifts = giftsData
            .map((data) => VirtualGift.fromJson(data as Map<String, dynamic>))
            .where((gift) => gift.isActive)
            .toList();
        
        Logger.info('Loaded ${_availableGifts.length} available gifts');
      } else {
        throw Exception('Failed to load gifts');
      }
    } catch (e) {
      Logger.error('Failed to load available gifts', e);
      // Don't throw here, just log the error
    }
  }
  
  // Load transaction history
  Future<List<Transaction>> loadTransactionHistory({
    int page = 1,
    int limit = 20,
    TransactionType? type,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      
      if (type != null) {
        queryParams['type'] = type.name;
      }
      
      final response = await _apiService.get(
        '/wallet/transactions',
        queryParameters: queryParams,
      );
      
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final transactionsData = data['transactions'] as List<dynamic>;
        
        final transactions = transactionsData
            .map((data) => Transaction.fromJson(data as Map<String, dynamic>))
            .toList();
        
        Logger.info('Loaded ${transactions.length} transactions');
        return transactions;
      } else {
        throw Exception('Failed to load transaction history');
      }
    } catch (e) {
      Logger.error('Failed to load transaction history', e);
      _error = 'Failed to load transaction history';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Purchase coins
  Future<void> purchaseCoins({
    required String packageId,
    required String paymentMethod,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      final response = await _apiService.post(
        '/wallet/purchase-coins',
        data: {
          'packageId': packageId,
          'paymentMethod': paymentMethod,
        },
      );
      
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final paymentUrl = data['paymentUrl'] as String?;
        final sessionId = data['sessionId'] as String?;
        
        Logger.info('Coin purchase initiated: $sessionId');
        
        // In a real app, we would redirect to payment URL
        // For now, just return success
      } else {
        throw Exception('Failed to initiate coin purchase');
      }
    } catch (e) {
      Logger.error('Failed to purchase coins', e);
      _error = 'Failed to purchase coins';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Send gift
  Future<void> sendGift({
    required String streamId,
    required String giftId,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // Find the gift to get its price
      final gift = _availableGifts.firstWhere(
        (g) => g.id == giftId,
        orElse: () => throw Exception('Gift not found'),
      );
      
      // Check if user has sufficient coins
      if (_wallet == null || _wallet!.coinBalance < gift.coinPrice) {
        throw Exception('Insufficient coins');
      }
      
      final response = await _apiService.post(
        '/streams/$streamId/gift',
        data: {'giftId': giftId},
      );
      
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final newBalance = data['newBalance'] as int?;
        
        // Update local wallet balance
        if (_wallet != null && newBalance != null) {
          _wallet = _wallet!.copyWith(coinBalance: newBalance);
          
          // Add transaction to history
          final transaction = Transaction(
            id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
            userId: _wallet!.userId,
            type: TransactionType.giftSent,
            amount: -gift.coinPrice,
            currency: 'Coins',
            timestamp: DateTime.now(),
            description: 'Sent gift: ${gift.name}',
            metadata: {
              'giftId': giftId,
              'streamId': streamId,
              'giftName': gift.name,
            },
          );
          
          final updatedTransactions = List<Transaction>.from(_wallet!.transactionHistory)
            ..insert(0, transaction);
          
          _wallet = _wallet!.copyWith(transactionHistory: updatedTransactions);
        }
        
        Logger.info('Gift sent successfully: ${gift.name}');
      } else {
        throw Exception('Failed to send gift');
      }
    } catch (e) {
      Logger.error('Failed to send gift', e);
      _error = 'Failed to send gift';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Request diamond withdrawal
  Future<void> requestWithdrawal(int diamondAmount) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();
      
      // Check minimum withdrawal amount
      if (diamondAmount < 1000) {
        throw Exception('Minimum withdrawal amount is 1000 diamonds');
      }
      
      // Check if user has sufficient diamonds
      if (_wallet == null || _wallet!.diamondBalance < diamondAmount) {
        throw Exception('Insufficient diamonds');
      }
      
      final response = await _apiService.post(
        '/wallet/withdraw',
        data: {'diamondAmount': diamondAmount},
      );
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        final withdrawalRequestId = data['withdrawalRequestId'] as String?;
        
        // Update local diamond balance
        if (_wallet != null) {
          final newDiamondBalance = _wallet!.diamondBalance - diamondAmount;
          _wallet = _wallet!.copyWith(diamondBalance: newDiamondBalance);
          
          // Add transaction to history
          final transaction = Transaction(
            id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
            userId: _wallet!.userId,
            type: TransactionType.withdrawal,
            amount: -diamondAmount,
            currency: 'Diamonds',
            timestamp: DateTime.now(),
            description: 'Withdrawal request',
            metadata: {
              'withdrawalRequestId': withdrawalRequestId,
              'diamondAmount': diamondAmount,
            },
          );
          
          final updatedTransactions = List<Transaction>.from(_wallet!.transactionHistory)
            ..insert(0, transaction);
          
          _wallet = _wallet!.copyWith(transactionHistory: updatedTransactions);
        }
        
        Logger.info('Withdrawal requested: $diamondAmount diamonds');
      } else {
        throw Exception('Failed to request withdrawal');
      }
    } catch (e) {
      Logger.error('Failed to request withdrawal', e);
      _error = 'Failed to request withdrawal';
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  // Get gift by ID
  VirtualGift? getGiftById(String giftId) {
    try {
      return _availableGifts.firstWhere((g) => g.id == giftId);
    } catch (e) {
      return null;
    }
  }
  
  // Get gifts by category
  List<VirtualGift> getGiftsByCategory(GiftCategory category) {
    return _availableGifts.where((g) => g.category == category).toList();
  }
  
  // Get affordable gifts (user has enough coins)
  List<VirtualGift> getAffordableGifts() {
    if (_wallet == null) return [];
    return _availableGifts.where((g) => g.coinPrice <= _wallet!.coinBalance).toList();
  }
  
  // Get premium gifts
  List<VirtualGift> getPremiumGifts() {
    return _availableGifts.where((g) => g.isPremium).toList();
  }
  
  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
  
  // Refresh wallet data
  Future<void> refreshWallet(String userId) async {
    await loadWallet(userId);
  }
  
  // Update wallet balance locally (for real-time updates)
  void updateCoinBalance(int newBalance) {
    if (_wallet != null) {
      _wallet = _wallet!.copyWith(coinBalance: newBalance);
      notifyListeners();
    }
  }
  
  void updateDiamondBalance(int newBalance) {
    if (_wallet != null) {
      _wallet = _wallet!.copyWith(diamondBalance: newBalance);
      notifyListeners();
    }
  }
  
  // Add transaction locally
  void addTransaction(Transaction transaction) {
    if (_wallet != null) {
      final updatedTransactions = List<Transaction>.from(_wallet!.transactionHistory)
        ..insert(0, transaction);
      
      _wallet = _wallet!.copyWith(transactionHistory: updatedTransactions);
      notifyListeners();
    }
  }
}