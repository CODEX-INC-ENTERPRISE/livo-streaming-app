import 'dart:collection';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';

/// LRU in-memory cache for decoded image bytes.
///
/// Wraps a [LinkedHashMap] to maintain insertion/access order and evicts the
/// least-recently-used entry when [maxSize] is exceeded.
class ImageCache {
  ImageCache._({int maxSize = 100}) : _maxSize = maxSize;

  static final ImageCache instance = ImageCache._();

  final int _maxSize;
  final LinkedHashMap<String, Uint8List> _cache =
      LinkedHashMap<String, Uint8List>();

  int get length => _cache.length;

  bool containsKey(String key) => _cache.containsKey(key);

  Uint8List? get(String key) {
    if (!_cache.containsKey(key)) return null;
    final value = _cache.remove(key)!;
    _cache[key] = value;
    return value;
  }

  void put(String key, Uint8List value) {
    if (_cache.containsKey(key)) {
      _cache.remove(key);
    } else if (_cache.length >= _maxSize) {
      _cache.remove(_cache.keys.first);
    }
    _cache[key] = value;
  }

  void remove(String key) => _cache.remove(key);

  void clear() => _cache.clear();
}
