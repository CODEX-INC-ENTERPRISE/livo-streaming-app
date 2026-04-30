import 'package:flutter/material.dart';

/// Central color palette for the Livo app.
///
/// All colors used across the app should be referenced from here so that
/// theme changes can be made in a single place.
class AppColors {
  AppColors._(); // prevent instantiation

  // ─── Brand Colors ────────────────────────────────────────────────────────────
  static const Color primaryGreen = Color(0xFF22C55E);
  static const Color signUpGreen = Color(0xFF1B9E4B);
  static const Color loginGreen = Color(0xFFE0F1E6);

  // ─── Base Colors ─────────────────────────────────────────────────────────────
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);

  // ─── Neutral / Grey Scale ────────────────────────────────────────────────────
  static const Color grey = Color(0xFF6B7280);
  static const Color lightGrey = Color(0xFFF3F4F6);
  static const Color mediumGrey = Color(0xFFD1D5DB);

  // ─── Text Colors (Light Theme) ───────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF1F2937);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textTertiary = Color(0xFF9CA3AF);

  // ─── Semantic Colors ─────────────────────────────────────────────────────────
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color success = Color(0xFF22C55E);
  static const Color info = Color(0xFF3B82F6);

  // ─── Surface / Background (Light Theme) ──────────────────────────────────────
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF9FAFB);

  // ─── Dark Theme Colors ───────────────────────────────────────────────────────
  static const Color darkBackground = Color(0xFF111827);
  static const Color darkSurface = Color(0xFF1F2937);
  static const Color darkBorder = Color(0xFF374151);
  static const Color darkTextSecondary = Color(0xFF9CA3AF);

  // ─── Live / Stream Specific ───────────────────────────────────────────────────
  static const Color liveRed = Color(0xFFEF4444);
  static const Color giftGold = Color(0xFFF59E0B);
  static const Color diamondBlue = Color(0xFF3B82F6);
  static const Color coinYellow = Color(0xFFFBBF24);
}
