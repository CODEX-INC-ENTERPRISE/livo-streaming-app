import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../models/chat_message.dart';
import '../../providers/voice_room_provider.dart';

/// Chat panel for voice rooms.
///
/// Displays text messages with sender names and timestamps, and provides
/// an input field for sending new messages (max 500 chars).
///
/// Requirements: 13.1, 13.2, 13.3
class VoiceRoomChatWidget extends StatefulWidget {
  final List<ChatMessage> messages;
  final String? currentUserId;

  const VoiceRoomChatWidget({
    super.key,
    required this.messages,
    this.currentUserId,
  });

  @override
  State<VoiceRoomChatWidget> createState() => _VoiceRoomChatWidgetState();
}

class _VoiceRoomChatWidgetState extends State<VoiceRoomChatWidget> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _inputController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  bool _isSending = false;

  @override
  void didUpdateWidget(VoiceRoomChatWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.messages.length != oldWidget.messages.length) {
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _isSending) return;

    if (text.length > AppConstants.maxChatMessageLength) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Message too long (max 500 characters)')),
      );
      return;
    }

    setState(() => _isSending = true);
    try {
      await context.read<VoiceRoomProvider>().sendChatMessage(text);
      _inputController.clear();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send message')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _inputController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: AppColors.darkBorder),
            ),
          ),
          child: Row(
            children: [
              const Icon(Icons.chat_bubble_outline,
                  size: 16, color: AppColors.darkTextSecondary),
              const SizedBox(width: 6),
              Text(
                'Chat',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.darkTextSecondary,
                    ),
              ),
            ],
          ),
        ),

        // Message list
        Expanded(
          child: widget.messages.isEmpty
              ? const Center(
                  child: Text(
                    'No messages yet',
                    style: TextStyle(
                        color: AppColors.darkTextSecondary, fontSize: 13),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: widget.messages.length,
                  itemBuilder: (context, index) {
                    final msg = widget.messages[index];
                    return _VoiceChatMessageTile(
                      message: msg,
                      isOwnMessage: msg.senderId == widget.currentUserId,
                    );
                  },
                ),
        ),

        // Input field
        _buildInputField(),
      ],
    );
  }

  Widget _buildInputField() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.darkBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _inputController,
              focusNode: _focusNode,
              maxLength: AppConstants.maxChatMessageLength,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Say something...',
                hintStyle: const TextStyle(
                    color: AppColors.darkTextSecondary, fontSize: 14),
                filled: true,
                fillColor: AppColors.darkSurface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none,
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                counterText: '',
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _isSending ? null : _sendMessage,
            child: Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: AppColors.primaryGreen,
                shape: BoxShape.circle,
              ),
              child: _isSending
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}

class _VoiceChatMessageTile extends StatelessWidget {
  final ChatMessage message;
  final bool isOwnMessage;

  const _VoiceChatMessageTile({
    required this.message,
    required this.isOwnMessage,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isOwnMessage
                    ? AppColors.primaryGreen.withAlpha(50)
                    : AppColors.darkSurface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.senderName ?? 'User',
                    style: TextStyle(
                      color: isOwnMessage
                          ? AppColors.primaryGreen
                          : AppColors.coinYellow,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message.message,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
