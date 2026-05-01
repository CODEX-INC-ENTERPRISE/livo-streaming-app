import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// A rectangular image widget backed by [CachedNetworkImage].
///
/// Shows a shimmer-style placeholder while loading and a broken-image icon
/// on error. Suitable for gift thumbnails, stream covers, and other
/// non-circular images.
class CachedImage extends StatelessWidget {
  final String? url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final Widget? placeholder;

  const CachedImage({
    super.key,
    this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholder,
  });

  @override
  Widget build(BuildContext context) {
    final fallback = placeholder ?? _defaultPlaceholder();

    if (url == null || url!.isEmpty) {
      return _wrap(fallback);
    }

    return _wrap(
      CachedNetworkImage(
        imageUrl: url!,
        width: width,
        height: height,
        fit: fit,
        placeholder: (_, __) => _loadingPlaceholder(),
        errorWidget: (_, __, ___) => fallback,
        fadeInDuration: const Duration(milliseconds: 200),
      ),
    );
  }

  Widget _wrap(Widget child) {
    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }

  Widget _loadingPlaceholder() {
    return Container(
      width: width,
      height: height,
      color: AppColors.darkSurface,
      child: const Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 1.5),
        ),
      ),
    );
  }

  Widget _defaultPlaceholder() {
    return Container(
      width: width,
      height: height,
      color: AppColors.darkSurface,
      child: const Center(
        child: Icon(Icons.broken_image_outlined, color: AppColors.grey),
      ),
    );
  }
}
