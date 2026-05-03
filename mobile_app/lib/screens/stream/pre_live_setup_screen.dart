import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/constants/app_routes.dart';
import '../../core/theme/app_colors.dart';

/// Pre-live setup screen shown when the user taps the FAB to go live.
/// Matches the design: logo header, title field, category chips, thumbnail
/// picker, and a "Start Live" button.
class PreLiveSetupScreen extends StatefulWidget {
  const PreLiveSetupScreen({super.key});

  @override
  State<PreLiveSetupScreen> createState() => _PreLiveSetupScreenState();
}

class _PreLiveSetupScreenState extends State<PreLiveSetupScreen> {
  final _titleController = TextEditingController();

  // Available categories
  static const _allCategories = [
    'Music', 'Dance', 'Comedy', 'Gaming', 'Sports',
    'Education', 'Cooking', 'Travel', 'Fashion', 'Tech',
  ];

  final Set<String> _selectedCategories = {'Music', 'Dance', 'Comedy'};
  XFile? _thumbnail;
  bool _showCategoryPicker = false;

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _pickThumbnail() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file != null && mounted) setState(() => _thumbnail = file);
  }

  void _removeCategory(String cat) =>
      setState(() => _selectedCategories.remove(cat));

  void _toggleCategory(String cat) {
    setState(() {
      if (_selectedCategories.contains(cat)) {
        _selectedCategories.remove(cat);
      } else {
        _selectedCategories.add(cat);
      }
    });
  }

  void _startLive() {
    final title = _titleController.text.trim().isEmpty
        ? 'Live Stream'
        : _titleController.text.trim();
    Navigator.pushReplacementNamed(context, AppRoutes.streamStart,
        arguments: title);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  // Logo
                  Image.asset(
                    'assets/images/home_logo.png',
                    height: 32,
                    errorBuilder: (_, __, ___) => Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.play_arrow,
                            color: AppColors.primaryGreen, size: 28),
                        const SizedBox(width: 4),
                        Text(
                          'livo',
                          style: TextStyle(
                            fontFamily: 'PlusJakartaSans',
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryGreen,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  // Search icon
                  _HeaderIcon(
                    icon: Icons.search,
                    onTap: () {},
                  ),
                  const SizedBox(width: 8),
                  // Notification icon
                  _HeaderIcon(
                    icon: Icons.notifications_outlined,
                    onTap: () => Navigator.pushNamed(
                        context, AppRoutes.notifications),
                  ),
                ],
              ),
            ),

            // ── Scrollable body ──────────────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),

                    // Page title
                    const Text(
                      'Pre-Live Setup',
                      style: TextStyle(
                        fontFamily: 'PlusJakartaSans',
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),

                    const SizedBox(height: 24),

                    // ── Title field ────────────────────────────────────────
                    const _FieldLabel('Title'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _titleController,
                      maxLength: 100,
                      style: const TextStyle(
                        fontFamily: 'PlusJakartaSans',
                        fontSize: 14,
                        color: AppColors.textPrimary,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Add a title (optional)',
                        hintStyle: const TextStyle(
                          color: AppColors.textTertiary,
                          fontFamily: 'PlusJakartaSans',
                          fontSize: 14,
                        ),
                        counterText: '',
                        filled: true,
                        fillColor: const Color(0xFFF0FAF4),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                              color: Color(0xFFD1FAE5), width: 1),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                              color: Color(0xFFD1FAE5), width: 1),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(
                              color: AppColors.primaryGreen, width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 14),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // ── Categories ─────────────────────────────────────────
                    const _FieldLabel('Categories'),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () => setState(
                          () => _showCategoryPicker = !_showCategoryPicker),
                      child: Container(
                        width: double.infinity,
                        constraints: const BoxConstraints(minHeight: 52),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FAF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: const Color(0xFFD1FAE5), width: 1),
                        ),
                        child: _selectedCategories.isEmpty
                            ? const Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  'Tap to select categories',
                                  style: TextStyle(
                                    color: AppColors.textTertiary,
                                    fontFamily: 'PlusJakartaSans',
                                    fontSize: 14,
                                  ),
                                ),
                              )
                            : Wrap(
                                spacing: 8,
                                runSpacing: 6,
                                children: _selectedCategories
                                    .map((cat) => _CategoryChip(
                                          label: cat,
                                          onRemove: () => _removeCategory(cat),
                                        ))
                                    .toList(),
                              ),
                      ),
                    ),

                    // Category picker dropdown
                    if (_showCategoryPicker) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: const Color(0xFFD1FAE5), width: 1),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _allCategories
                              .map((cat) => _SelectableCategoryChip(
                                    label: cat,
                                    selected:
                                        _selectedCategories.contains(cat),
                                    onTap: () => _toggleCategory(cat),
                                  ))
                              .toList(),
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    // ── Thumbnail ──────────────────────────────────────────
                    const _FieldLabel('Thumbnail'),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _pickThumbnail,
                      child: Container(
                        width: double.infinity,
                        height: 160,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FAF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: const Color(0xFFD1FAE5), width: 1),
                        ),
                        child: _thumbnail == null
                            ? const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.add_photo_alternate_outlined,
                                    size: 36,
                                    color: AppColors.textTertiary,
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'Tap to add a picture',
                                    style: TextStyle(
                                      color: AppColors.textTertiary,
                                      fontFamily: 'PlusJakartaSans',
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              )
                            : ClipRRect(
                                borderRadius: BorderRadius.circular(11),
                                child: Image.network(
                                  _thumbnail!.path,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  height: double.infinity,
                                ),
                              ),
                      ),
                    ),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),

            // ── Start Live button ────────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _startLive,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.signUpGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Start Live',
                    style: TextStyle(
                      fontFamily: 'PlusJakartaSans',
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Field label ──────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'PlusJakartaSans',
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: AppColors.textPrimary,
      ),
    );
  }
}

// ─── Selected category chip (with × remove) ───────────────────────────────────

class _CategoryChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;

  const _CategoryChip({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primaryGreen, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'PlusJakartaSans',
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close,
                size: 14, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

// ─── Selectable category chip (in picker) ────────────────────────────────────

class _SelectableCategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SelectableCategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.loginGreen : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? AppColors.primaryGreen
                : const Color(0xFFD1FAE5),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'PlusJakartaSans',
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: selected
                ? AppColors.signUpGreen
                : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ─── Header icon button ───────────────────────────────────────────────────────

class _HeaderIcon extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _HeaderIcon({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.mediumGrey, width: 1),
        ),
        child: Icon(icon, size: 18, color: AppColors.textPrimary),
      ),
    );
  }
}
