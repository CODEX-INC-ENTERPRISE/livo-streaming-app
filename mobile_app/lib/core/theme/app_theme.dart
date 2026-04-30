import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  // Expose brand colors for convenience (delegates to AppColors)
  static const Color primaryGreen = AppColors.primaryGreen;
  static const Color white = AppColors.white;
  static const Color black = AppColors.black;

  // ─── Light Theme ────────────────────────────────────────────────────────────

  static final ThemeData lightTheme = ThemeData(
    useMaterial3: false,
    primarySwatch: Colors.green,
    primaryColor: AppColors.primaryGreen,
    scaffoldBackgroundColor: AppColors.white,
    fontFamily: 'PlusJakartaSans',

    // ── Color Scheme ──────────────────────────────────────────────────────────
    colorScheme: const ColorScheme.light(
      primary: AppColors.primaryGreen,
      secondary: AppColors.signUpGreen,
      surface: AppColors.white,
      error: AppColors.error,
      onPrimary: AppColors.white,
      onSecondary: AppColors.white,
      onSurface: AppColors.textPrimary,
      onError: AppColors.white,
    ),

    // ── AppBar ────────────────────────────────────────────────────────────────
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.white,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        color: AppColors.textPrimary,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: IconThemeData(color: AppColors.textPrimary),
    ),

    // ── Typography ────────────────────────────────────────────────────────────
    textTheme: const TextTheme(
      // Headings
      displayLarge: TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        height: 1.2,
      ),
      displayMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        height: 1.2,
      ),
      displaySmall: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.3,
      ),
      headlineLarge: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.3,
      ),
      headlineMedium: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.3,
      ),
      headlineSmall: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.4,
      ),
      // Body
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: AppColors.textPrimary,
        height: 1.5,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AppColors.textPrimary,
        height: 1.5,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
        height: 1.5,
      ),
      // Labels / Captions
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      labelMedium: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
      labelSmall: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w400,
        color: AppColors.textTertiary,
        letterSpacing: 0.5,
      ),
    ),

    // ── Input Decoration ──────────────────────────────────────────────────────
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.lightGrey),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.lightGrey),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
      hintStyle: const TextStyle(
        color: AppColors.textTertiary,
        fontSize: 14,
        fontWeight: FontWeight.w400,
      ),
      labelStyle: const TextStyle(
        color: AppColors.textSecondary,
        fontSize: 14,
      ),
      errorStyle: const TextStyle(
        color: AppColors.error,
        fontSize: 12,
      ),
    ),

    // ── ElevatedButton ────────────────────────────────────────────────────────
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primaryGreen,
        foregroundColor: AppColors.white,
        disabledBackgroundColor: AppColors.lightGrey,
        disabledForegroundColor: AppColors.textTertiary,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ── TextButton ────────────────────────────────────────────────────────────
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primaryGreen,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ── OutlinedButton ────────────────────────────────────────────────────────
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryGreen,
        side: const BorderSide(color: AppColors.primaryGreen, width: 1.5),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    // ── BottomNavigationBar ───────────────────────────────────────────────────
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.white,
      selectedItemColor: AppColors.primaryGreen,
      unselectedItemColor: AppColors.grey,
      showSelectedLabels: true,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),

    // ── Card ──────────────────────────────────────────────────────────────────
    cardTheme: CardThemeData(
      color: AppColors.white,
      elevation: 2,
      shadowColor: AppColors.black.withAlpha(20),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
    ),

    // ── Divider ───────────────────────────────────────────────────────────────
    dividerTheme: const DividerThemeData(
      color: AppColors.lightGrey,
      thickness: 1,
      space: 1,
    ),

    // ── Chip ──────────────────────────────────────────────────────────────────
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.lightGrey,
      selectedColor: AppColors.primaryGreen,
      labelStyle: const TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.textPrimary,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
    ),

    // ── SnackBar ──────────────────────────────────────────────────────────────
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.textPrimary,
      contentTextStyle: const TextStyle(
        fontFamily: 'PlusJakartaSans',
        color: AppColors.white,
        fontSize: 14,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
      ),
      behavior: SnackBarBehavior.floating,
    ),
  );

  // ─── Dark Theme ─────────────────────────────────────────────────────────────

  static final ThemeData darkTheme = ThemeData(
    useMaterial3: false,
    primarySwatch: Colors.green,
    primaryColor: AppColors.primaryGreen,
    scaffoldBackgroundColor: AppColors.darkBackground,
    fontFamily: 'PlusJakartaSans',

    colorScheme: const ColorScheme.dark(
      primary: AppColors.primaryGreen,
      secondary: AppColors.signUpGreen,
      surface: AppColors.darkSurface,
      error: AppColors.error,
      onPrimary: AppColors.white,
      onSecondary: AppColors.white,
      onSurface: AppColors.white,
      onError: AppColors.white,
    ),

    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.darkSurface,
      foregroundColor: AppColors.white,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        fontFamily: 'PlusJakartaSans',
        color: AppColors.white,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: IconThemeData(color: AppColors.white),
    ),

    textTheme: const TextTheme(
      displayLarge: TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        color: AppColors.white,
        height: 1.2,
      ),
      displayMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: AppColors.white,
        height: 1.2,
      ),
      displaySmall: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: AppColors.white,
        height: 1.3,
      ),
      headlineLarge: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        color: AppColors.white,
        height: 1.3,
      ),
      headlineMedium: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: AppColors.white,
        height: 1.3,
      ),
      headlineSmall: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.white,
        height: 1.4,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: AppColors.white,
        height: 1.5,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AppColors.white,
        height: 1.5,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: AppColors.darkTextSecondary,
        height: 1.5,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.white,
      ),
      labelMedium: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.darkTextSecondary,
      ),
      labelSmall: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w400,
        color: AppColors.darkTextSecondary,
        letterSpacing: 0.5,
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.darkSurface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.darkBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.darkBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.primaryGreen, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
      hintStyle: const TextStyle(
        color: AppColors.darkTextSecondary,
        fontSize: 14,
      ),
      labelStyle: const TextStyle(
        color: AppColors.darkTextSecondary,
        fontSize: 14,
      ),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primaryGreen,
        foregroundColor: AppColors.white,
        disabledBackgroundColor: AppColors.darkBorder,
        disabledForegroundColor: AppColors.darkTextSecondary,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primaryGreen,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primaryGreen,
        side: const BorderSide(color: AppColors.primaryGreen, width: 1.5),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontFamily: 'PlusJakartaSans',
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.darkSurface,
      selectedItemColor: AppColors.primaryGreen,
      unselectedItemColor: AppColors.darkTextSecondary,
      showSelectedLabels: true,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),

    cardTheme: CardThemeData(
      color: AppColors.darkSurface,
      elevation: 2,
      shadowColor: AppColors.black.withAlpha(40),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
    ),

    dividerTheme: const DividerThemeData(
      color: AppColors.darkBorder,
      thickness: 1,
      space: 1,
    ),

    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.darkSurface,
      contentTextStyle: const TextStyle(
        fontFamily: 'PlusJakartaSans',
        color: AppColors.white,
        fontSize: 14,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
      ),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
