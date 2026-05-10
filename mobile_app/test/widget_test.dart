import 'package:flutter_test/flutter_test.dart';
import 'package:social_live_streaming_app/models/user.dart';
import 'package:social_live_streaming_app/models/stream.dart';
import 'package:social_live_streaming_app/models/wallet.dart';
import 'package:social_live_streaming_app/models/virtual_gift.dart';
import 'package:social_live_streaming_app/models/voice_room.dart';
import 'package:social_live_streaming_app/models/notification.dart';

void main() {
  // ─── User model ────────────────────────────────────────────────────────────

  group('User model', () {
    final now = DateTime(2024, 1, 1);

    Map<String, dynamic> userJson() => {
          '_id': 'user1',
          'displayName': 'Alice',
          'email': 'alice@example.com',
          'phoneNumber': '+1234567890',
          'bio': 'Hello world',
          'profilePictureUrl': 'https://example.com/pic.jpg',
          'registeredAt': now.toIso8601String(),
          'isBlocked': false,
          'isHost': true,
          'followerIds': ['u2', 'u3'],
          'followingIds': ['u4'],
          'blockedUserIds': ['u5'],
        };

    test('fromJson parses all fields correctly', () {
      final user = User.fromJson(userJson());
      expect(user.id, 'user1');
      expect(user.displayName, 'Alice');
      expect(user.email, 'alice@example.com');
      expect(user.isHost, isTrue);
      expect(user.followerIds, ['u2', 'u3']);
      expect(user.followingIds, ['u4']);
      expect(user.blockedUserIds, ['u5']);
    });

    test('toJson round-trips correctly', () {
      final user = User.fromJson(userJson());
      final json = user.toJson();
      final user2 = User.fromJson(json);
      expect(user2.id, user.id);
      expect(user2.displayName, user.displayName);
      expect(user2.followerIds, user.followerIds);
    });

    test('followerCount and followingCount are correct', () {
      final user = User.fromJson(userJson());
      expect(user.followerCount, 2);
      expect(user.followingCount, 1);
    });

    test('follows() returns true for followed user', () {
      final user = User.fromJson(userJson());
      expect(user.follows('u4'), isTrue);
      expect(user.follows('u99'), isFalse);
    });

    test('hasBlocked() returns true for blocked user', () {
      final user = User.fromJson(userJson());
      expect(user.hasBlocked('u5'), isTrue);
      expect(user.hasBlocked('u1'), isFalse);
    });

    test('copyWith updates only specified fields', () {
      final user = User.fromJson(userJson());
      final updated = user.copyWith(displayName: 'Bob', isHost: false);
      expect(updated.displayName, 'Bob');
      expect(updated.isHost, isFalse);
      expect(updated.email, user.email);
    });

    test('equality is based on id', () {
      final u1 = User.fromJson(userJson());
      final u2 = User.fromJson({...userJson(), 'displayName': 'Different'});
      expect(u1, equals(u2));
    });

    test('fromJson handles followerCount fallback when followerIds absent', () {
      final json = {
        '_id': 'u1',
        'displayName': 'Bob',
        'registeredAt': now.toIso8601String(),
        'isBlocked': false,
        'isHost': false,
        'followerCount': 5,
        'followingCount': 3,
        'blockedUserIds': [],
      };
      final user = User.fromJson(json);
      expect(user.followerCount, 5);
      expect(user.followingCount, 3);
    });
  });

  // ─── LiveStream model ──────────────────────────────────────────────────────

  group('LiveStream model', () {
    final now = DateTime(2024, 6, 1, 12, 0);

    Map<String, dynamic> streamJson() => {
          '_id': 'stream1',
          'hostId': 'host1',
          'title': 'My Stream',
          'startedAt': now.toIso8601String(),
          'peakViewerCount': 100,
          'totalGiftsReceived': 5,
          'currentViewerIds': ['v1', 'v2'],
          'chatHistory': [],
          'status': 'active',
          'mutedUserIds': ['m1'],
          'kickedUserIds': [],
          'moderatorIds': ['mod1'],
          'agoraChannelId': 'agora-ch-1',
        };

    test('fromJson parses all fields', () {
      final stream = LiveStream.fromJson(streamJson());
      expect(stream.id, 'stream1');
      expect(stream.hostId, 'host1');
      expect(stream.title, 'My Stream');
      expect(stream.status, StreamStatus.active);
      expect(stream.currentViewerIds, ['v1', 'v2']);
      expect(stream.mutedUserIds, ['m1']);
      expect(stream.moderatorIds, ['mod1']);
      expect(stream.agoraChannelId, 'agora-ch-1');
    });

    test('isActive and isEnded flags', () {
      final active = LiveStream.fromJson(streamJson());
      expect(active.isActive, isTrue);
      expect(active.isEnded, isFalse);

      final ended = LiveStream.fromJson({...streamJson(), 'status': 'ended'});
      expect(ended.isActive, isFalse);
      expect(ended.isEnded, isTrue);
    });

    test('currentViewerCount matches list length', () {
      final stream = LiveStream.fromJson(streamJson());
      expect(stream.currentViewerCount, 2);
    });

    test('isUserMuted / isUserKicked / isUserModerator helpers', () {
      final stream = LiveStream.fromJson(streamJson());
      expect(stream.isUserMuted('m1'), isTrue);
      expect(stream.isUserMuted('v1'), isFalse);
      expect(stream.isUserKicked('v1'), isFalse);
      expect(stream.isUserModerator('mod1'), isTrue);
      expect(stream.isUserModerator('v1'), isFalse);
    });

    test('canUserChat returns false for muted user', () {
      final stream = LiveStream.fromJson(streamJson());
      expect(stream.canUserChat('m1'), isFalse);
      expect(stream.canUserChat('v1'), isTrue);
    });

    test('fromJson handles populated hostId object', () {
      final json = {
        ...streamJson(),
        'hostId': {
          '_id': 'host1',
          'displayName': 'HostName',
          'profilePictureUrl': 'https://example.com/host.jpg',
        },
      };
      final stream = LiveStream.fromJson(json);
      expect(stream.hostId, 'host1');
      expect(stream.hostName, 'HostName');
    });

    test('toJson round-trips correctly', () {
      final stream = LiveStream.fromJson(streamJson());
      final json = stream.toJson();
      final stream2 = LiveStream.fromJson(json);
      expect(stream2.id, stream.id);
      expect(stream2.title, stream.title);
      expect(stream2.status, stream.status);
    });
  });

  // ─── UserWallet model ──────────────────────────────────────────────────────

  group('UserWallet model', () {
    final ts = DateTime(2024, 1, 15, 10, 0);

    Map<String, dynamic> walletJson() => {
          'userId': 'user1',
          'coinBalance': 500,
          'diamondBalance': 200,
          'transactionHistory': [
            {
              '_id': 'tx1',
              'userId': 'user1',
              'type': 'coinPurchase',
              'amount': 100,
              'currency': 'USD',
              'timestamp': ts.toIso8601String(),
              'description': 'Bought coins',
              'metadata': {},
            },
            {
              '_id': 'tx2',
              'userId': 'user1',
              'type': 'giftSent',
              'amount': 50,
              'currency': 'Coins',
              'timestamp': ts.add(const Duration(hours: 1)).toIso8601String(),
              'description': 'Sent gift',
              'metadata': {'giftId': 'g1'},
            },
          ],
        };

    test('fromJson parses balances and transactions', () {
      final wallet = UserWallet.fromJson(walletJson());
      expect(wallet.coinBalance, 500);
      expect(wallet.diamondBalance, 200);
      expect(wallet.transactionHistory.length, 2);
    });

    test('getRecentTransactions returns sorted by timestamp desc', () {
      final wallet = UserWallet.fromJson(walletJson());
      final recent = wallet.getRecentTransactions(limit: 2);
      expect(recent.first.id, 'tx2');
    });

    test('getTransactionsByType filters correctly', () {
      final wallet = UserWallet.fromJson(walletJson());
      final gifts = wallet.getTransactionsByType(TransactionType.giftSent);
      expect(gifts.length, 1);
      expect(gifts.first.id, 'tx2');
    });

    test('totalGiftsSpent sums giftSent amounts', () {
      final wallet = UserWallet.fromJson(walletJson());
      expect(wallet.totalGiftsSpent, 50);
    });

    test('copyWith updates only specified fields', () {
      final wallet = UserWallet.fromJson(walletJson());
      final updated = wallet.copyWith(coinBalance: 1000);
      expect(updated.coinBalance, 1000);
      expect(updated.diamondBalance, wallet.diamondBalance);
    });

    test('toJson round-trips correctly', () {
      final wallet = UserWallet.fromJson(walletJson());
      final json = wallet.toJson();
      final wallet2 = UserWallet.fromJson(json);
      expect(wallet2.coinBalance, wallet.coinBalance);
      expect(wallet2.transactionHistory.length, wallet.transactionHistory.length);
    });
  });

  // ─── VirtualGift model ─────────────────────────────────────────────────────

  group('VirtualGift model', () {
    Map<String, dynamic> giftJson() => {
          '_id': 'gift1',
          'name': 'Rose',
          'coinPrice': 10,
          'diamondValue': 8,
          'animationAssetUrl': 'https://cdn.example.com/rose.json',
          'thumbnailUrl': 'https://cdn.example.com/rose.png',
          'category': 'common',
          'isActive': true,
        };

    test('fromJson parses all fields', () {
      final gift = VirtualGift.fromJson(giftJson());
      expect(gift.id, 'gift1');
      expect(gift.name, 'Rose');
      expect(gift.coinPrice, 10);
      expect(gift.diamondValue, 8);
      expect(gift.category, GiftCategory.common);
      expect(gift.isActive, isTrue);
    });

    test('isPremium is true for premium/exclusive categories', () {
      final premium = VirtualGift.fromJson({...giftJson(), 'category': 'premium'});
      final exclusive = VirtualGift.fromJson({...giftJson(), 'category': 'exclusive'});
      final common = VirtualGift.fromJson(giftJson());
      expect(premium.isPremium, isTrue);
      expect(exclusive.isPremium, isTrue);
      expect(common.isPremium, isFalse);
    });

    test('displayPrice and displayValue are formatted correctly', () {
      final gift = VirtualGift.fromJson(giftJson());
      expect(gift.displayPrice, '10 Coins');
      expect(gift.displayValue, '8 Diamonds');
    });

    test('toJson round-trips correctly', () {
      final gift = VirtualGift.fromJson(giftJson());
      final json = gift.toJson();
      final gift2 = VirtualGift.fromJson(json);
      expect(gift2.id, gift.id);
      expect(gift2.coinPrice, gift.coinPrice);
      expect(gift2.category, gift.category);
    });
  });

  // ─── VoiceRoom model ───────────────────────────────────────────────────────

  group('VoiceRoom model', () {
    final now = DateTime(2024, 3, 10, 9, 0);

    Map<String, dynamic> voiceRoomJson() => {
          '_id': 'room1',
          'hostId': 'host1',
          'name': 'Chill Room',
          'participantLimit': 10,
          'createdAt': now.toIso8601String(),
          'status': 'active',
          'participants': [
            {
              'userId': 'host1',
              'role': 'host',
              'isHandRaised': false,
              'isMuted': false,
            },
            {
              'userId': 'user2',
              'role': 'speaker',
              'isHandRaised': false,
              'isMuted': false,
            },
            {
              'userId': 'user3',
              'role': 'listener',
              'isHandRaised': true,
              'isMuted': false,
            },
          ],
          'chatHistory': [],
          'agoraChannelId': 'agora-voice-1',
        };

    test('fromJson parses participants and roles', () {
      final room = VoiceRoom.fromJson(voiceRoomJson());
      expect(room.id, 'room1');
      expect(room.name, 'Chill Room');
      expect(room.participants.length, 3);
      expect(room.speakers.length, 1);
      expect(room.listeners.length, 1);
    });

    test('raisedHands returns participants with isHandRaised=true', () {
      final room = VoiceRoom.fromJson(voiceRoomJson());
      expect(room.raisedHands.length, 1);
      expect(room.raisedHands.first.userId, 'user3');
    });

    test('containsUser returns correct result', () {
      final room = VoiceRoom.fromJson(voiceRoomJson());
      expect(room.containsUser('user2'), isTrue);
      expect(room.containsUser('unknown'), isFalse);
    });

    test('canUserSpeak returns true only for unmuted speakers', () {
      final room = VoiceRoom.fromJson(voiceRoomJson());
      expect(room.canUserSpeak('user2'), isTrue);
      expect(room.canUserSpeak('user3'), isFalse);
    });

    test('isFull returns true when at participant limit', () {
      final json = {
        ...voiceRoomJson(),
        'participantLimit': 3,
      };
      final room = VoiceRoom.fromJson(json);
      expect(room.isFull, isTrue);
    });

    test('toJson round-trips correctly', () {
      final room = VoiceRoom.fromJson(voiceRoomJson());
      final json = room.toJson();
      final room2 = VoiceRoom.fromJson(json);
      expect(room2.id, room.id);
      expect(room2.participants.length, room.participants.length);
    });
  });

  // ─── ChatMessage model ─────────────────────────────────────────────────────

  group('ChatMessage model', () {
    final ts = DateTime(2024, 5, 1, 14, 30);

    Map<String, dynamic> msgJson() => {
          '_id': 'msg1',
          'streamId': 'stream1',
          'senderId': 'user1',
          'senderName': 'Alice',
          'message': 'Hello everyone!',
          'timestamp': ts.toIso8601String(),
          'isPinned': false,
          'type': 'message',
        };

    test('fromJson parses all fields', () {
      final msg = ChatMessage.fromJson(msgJson());
      expect(msg.id, 'msg1');
      expect(msg.streamId, 'stream1');
      expect(msg.senderId, 'user1');
      expect(msg.senderName, 'Alice');
      expect(msg.message, 'Hello everyone!');
      expect(msg.isPinned, isFalse);
    });

    test('copyWith updates isPinned', () {
      final msg = ChatMessage.fromJson(msgJson());
      final pinned = msg.copyWith(isPinned: true);
      expect(pinned.isPinned, isTrue);
      expect(pinned.message, msg.message);
    });

    test('toJson round-trips correctly', () {
      final msg = ChatMessage.fromJson(msgJson());
      final json = msg.toJson();
      final msg2 = ChatMessage.fromJson(json);
      expect(msg2.id, msg.id);
      expect(msg2.message, msg.message);
    });
  });

  // ─── Notification model ────────────────────────────────────────────────────

  group('Notification model', () {
    final ts = DateTime(2024, 4, 20, 8, 0);

    Map<String, dynamic> notifJson() => {
          '_id': 'notif1',
          'userId': 'user1',
          'type': 'newFollower',
          'title': 'New Follower',
          'message': 'Bob started following you',
          'data': {'followerId': 'user2'},
          'createdAt': ts.toIso8601String(),
          'isRead': false,
        };

    test('fromJson parses all fields', () {
      final notif = Notification.fromJson(notifJson());
      expect(notif.id, 'notif1');
      expect(notif.type, NotificationType.newFollower);
      expect(notif.isRead, isFalse);
      expect(notif.isUnread, isTrue);
      expect(notif.followerId, 'user2');
    });

    test('copyWith marks as read', () {
      final notif = Notification.fromJson(notifJson());
      final read = notif.copyWith(isRead: true);
      expect(read.isRead, isTrue);
      expect(read.isUnread, isFalse);
    });

    test('toJson round-trips correctly', () {
      final notif = Notification.fromJson(notifJson());
      final json = notif.toJson();
      final notif2 = Notification.fromJson(json);
      expect(notif2.id, notif.id);
      expect(notif2.type, notif.type);
    });

    test('unknown type falls back to general', () {
      final json = {...notifJson(), 'type': 'unknownType'};
      final notif = Notification.fromJson(json);
      expect(notif.type, NotificationType.general);
    });
  });

  // ─── Transaction model ─────────────────────────────────────────────────────

  group('Transaction model', () {
    final ts = DateTime(2024, 2, 14, 12, 0);

    Map<String, dynamic> txJson() => {
          '_id': 'tx1',
          'userId': 'user1',
          'type': 'giftSent',
          'amount': 50,
          'currency': 'Coins',
          'timestamp': ts.toIso8601String(),
          'description': 'Sent Rose gift',
          'metadata': {
            'giftId': 'gift1',
            'streamId': 'stream1',
          },
        };

    test('fromJson parses all fields', () {
      final tx = Transaction.fromJson(txJson());
      expect(tx.id, 'tx1');
      expect(tx.type, TransactionType.giftSent);
      expect(tx.amount, 50);
      expect(tx.giftId, 'gift1');
      expect(tx.streamId, 'stream1');
    });

    test('toJson round-trips correctly', () {
      final tx = Transaction.fromJson(txJson());
      final json = tx.toJson();
      final tx2 = Transaction.fromJson(json);
      expect(tx2.id, tx.id);
      expect(tx2.type, tx.type);
      expect(tx2.amount, tx.amount);
    });

    test('unknown type falls back to coinPurchase', () {
      final json = {...txJson(), 'type': 'unknownType'};
      final tx = Transaction.fromJson(json);
      expect(tx.type, TransactionType.coinPurchase);
    });
  });
}
