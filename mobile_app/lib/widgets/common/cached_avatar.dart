import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// A circular avatar that loads from a URL with a placeholder and error fallback.
///
/// Uses [CachedNetworkImage] for disk + memory caching so repeated loads of
/// the same URL are served instantly without a network round-trip.
class CachedAvatar extends StatelessWidget {
  final String? url;
  final double radius;
  final Color backgroundColor;

  const CachedAvatar({
    super.key,
    this.url,
    required this.radius,
    this.backgroundColor = AppColors.darkSurface,
  });

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;

    if (url == null || url!.isEmpty) {
      return _placeholder(size);
    }

    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, __) => _placeholderBox(size),
        errorWidget: (_, __, ___) => _placeholder(size),
        fadeInDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  Widget _placeholder(double size) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      child: Icon(Icons.person, size: radius, color: AppColors.grey),
    );
  }

  Widget _placeholderBox(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        shape: BoxShape.circle,
      ),
      child: const Center(
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 1.5),
        ),
      ),
    );
  }
}
