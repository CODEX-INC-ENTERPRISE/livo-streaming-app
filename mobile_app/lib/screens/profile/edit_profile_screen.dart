import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/services/api_service.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/user_provider.dart';

/// Screen for editing the current user's profile.
///
/// Allows updating display name, bio, and profile picture.
/// Validates display name uniqueness and image size (max 5 MB).
///
/// Route: [AppRoutes.editProfile]
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _bioController;

  File? _pickedImage;
  String? _existingPictureUrl;
  bool _isSaving = false;
  String? _nameError;

  static const int _maxImageBytes = 5 * 1024 * 1024; // 5 MB
  static const int _maxBioLength = 200;
  static const int _maxNameLength = 30;
  static const int _minNameLength = 3;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().currentUser;
    _nameController = TextEditingController(text: user?.displayName ?? '');
    _bioController = TextEditingController(text: user?.bio ?? '');
    _existingPictureUrl = user?.profilePictureUrl;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  // ─── Image Picker ────────────────────────────────────────────────────────────

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (picked == null) return;

    final file = File(picked.path);
    final bytes = await file.length();

    if (bytes > _maxImageBytes) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Image must be smaller than 5 MB'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    setState(() => _pickedImage = file);
  }

  // ─── Save ─────────────────────────────────────────────────────────────────────

  Future<void> _save() async {
    // Clear previous name error before re-validating
    setState(() => _nameError = null);

    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final auth = context.read<AuthProvider>();
      final userProvider = context.read<UserProvider>();
      final userId = auth.currentUser!.id;
      final newName = _nameController.text.trim();
      final newBio = _bioController.text.trim();

      // Check display name uniqueness if it changed
      if (newName != auth.currentUser!.displayName) {
        final isUnique = await _checkNameUnique(newName);
        if (!isUnique) {
          setState(() {
            _nameError = 'Display name is already taken';
            _isSaving = false;
          });
          return;
        }
      }

      // Upload image if a new one was picked
      String? newPictureUrl = _existingPictureUrl;
      if (_pickedImage != null) {
        newPictureUrl = await _uploadImage(userId, _pickedImage!);
      }

      // Call API via UserProvider / AuthProvider
      await auth.updateProfile(
        displayName: newName,
        bio: newBio,
        profilePictureUrl: newPictureUrl,
      );

      // Invalidate cached user so profile screen reloads fresh data
      userProvider.invalidateUser(userId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<bool> _checkNameUnique(String name) async {
    try {
      final api = ApiService();
      final response = await api.get(
        '/users/check-name',
        queryParameters: {'displayName': name},
      );
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        return data['available'] == true;
      }
      return true; // assume available on unexpected response
    } catch (_) {
      return true;
    }
  }

  Future<String?> _uploadImage(String userId, File file) async {
    try {
      final api = ApiService();
      final response = await api.uploadFile(
        '/users/$userId/profile-picture',
        file.path,
        fieldName: 'profilePicture',
      );
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        return data['profilePictureUrl'] as String?;
      }
    } catch (_) {}
    return null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Profile'),
        actions: [
          _isSaving
              ? const Padding(
                  padding: EdgeInsets.all(16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : TextButton(
                  onPressed: _save,
                  child: const Text(
                    'Save',
                    style: TextStyle(
                      color: AppColors.primaryGreen,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _AvatarPicker(
                pickedImage: _pickedImage,
                existingUrl: _existingPictureUrl,
                onTap: _pickImage,
              ),
              const SizedBox(height: 32),
              _NameField(
                controller: _nameController,
                externalError: _nameError,
                minLength: _minNameLength,
                maxLength: _maxNameLength,
              ),
              const SizedBox(height: 20),
              _BioField(
                controller: _bioController,
                maxLength: _maxBioLength,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Avatar Picker ────────────────────────────────────────────────────────────

class _AvatarPicker extends StatelessWidget {
  final File? pickedImage;
  final String? existingUrl;
  final VoidCallback onTap;

  const _AvatarPicker({
    required this.pickedImage,
    required this.existingUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          CircleAvatar(
            radius: 56,
            backgroundColor: AppColors.lightGrey,
            child: ClipOval(child: _avatarContent()),
          ),
          Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              color: AppColors.primaryGreen,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.camera_alt, size: 16, color: AppColors.white),
          ),
        ],
      ),
    );
  }

  Widget _avatarContent() {
    if (pickedImage != null) {
      return Image.file(
        pickedImage!,
        width: 112,
        height: 112,
        fit: BoxFit.cover,
      );
    }
    if (existingUrl != null && existingUrl!.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: existingUrl!,
        width: 112,
        height: 112,
        fit: BoxFit.cover,
        placeholder: (_, __) => const CircularProgressIndicator(),
        errorWidget: (_, __, ___) =>
            const Icon(Icons.person, size: 56, color: AppColors.grey),
      );
    }
    return const Icon(Icons.person, size: 56, color: AppColors.grey);
  }
}

// ─── Name Field ───────────────────────────────────────────────────────────────

class _NameField extends StatelessWidget {
  final TextEditingController controller;
  final String? externalError;
  final int minLength;
  final int maxLength;

  const _NameField({
    required this.controller,
    required this.externalError,
    required this.minLength,
    required this.maxLength,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLength: maxLength,
      textInputAction: TextInputAction.next,
      decoration: InputDecoration(
        labelText: 'Display Name',
        hintText: 'Enter your display name',
        errorText: externalError,
        border: const OutlineInputBorder(),
        prefixIcon: const Icon(Icons.person_outline),
      ),
      validator: (value) {
        final v = value?.trim() ?? '';
        if (v.isEmpty) return 'Display name is required';
        if (v.length < minLength) return 'At least $minLength characters';
        return null;
      },
    );
  }
}

// ─── Bio Field ────────────────────────────────────────────────────────────────

class _BioField extends StatelessWidget {
  final TextEditingController controller;
  final int maxLength;

  const _BioField({
    required this.controller,
    required this.maxLength,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLength: maxLength,
      maxLines: 4,
      textInputAction: TextInputAction.done,
      decoration: const InputDecoration(
        labelText: 'Bio',
        hintText: 'Tell others about yourself',
        alignLabelWithHint: true,
        border: OutlineInputBorder(),
        prefixIcon: Padding(
          padding: EdgeInsets.only(bottom: 56),
          child: Icon(Icons.info_outline),
        ),
      ),
    );
  }
}
