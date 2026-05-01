import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../models/chat_message.dart';
import '../../providers/stream_provider.dart';

/// Overlay chat widget used in both broadcast and viewer stream screens.
///
/// Displays a scrollable list of messages and an optional input field.
/// Set [showInput] to false for read-only display (e.g. host view where
/// the input is placed elsewhere).
/// [onUserTap] is called with (userId, displayName) when a sender name is tapped.
class StreamChatWidget extends StatefulWidget {
  final List<ChatMessage> messages;
  final bool showInput;
  final String? currentUserId;
  final bool isMuted;

  /// Optional callback for when a sender name is tapped (used for moderation).
  final void Function(String userId, String displayName)? onUserTap;

  const StreamChatWidget({
    super.key,
    required this.messages,
    this.showInput = true,
    this.currentUserId,
    this.isMuted = false,
    this.onUserTap,
  });

  @override
  State<StreamChatWidget> createState() => _StreamChatWidgetState();
}

class _StreamChatWidgetState extends State<StreamChatWidget> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _inputController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  bool _isSending = false;

  @override
  void didUpdateWidget(StreamChatWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Auto-scroll when new messages arrive
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
    if (text.isEmpty || _isSending || widget.isMuted) return;

    if (text.length > AppConstants.maxChatMessageLength) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Message too long (max 500 characters)')),
      );
      return;
    }

    setState(() => _isSending = true);
    try {
      await context.read<LiveStreamProvider>().sendChatMessage(text);
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
        // Message list
        Expanded(
          child: widget.messages.isEmpty
              ? const SizedBox.shrink()
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: widget.messages.length,
                  itemBuilder: (context, index) {
                    final msg = widget.messages[index];
                    return _ChatMessageTile(
                      message: msg,
                      isOwnMessage: msg.senderId == widget.currentUserId,
                      onUserTap: widget.onUserTap,
                    );
                  },
                ),
        ),

        // Input field
        if (widget.showInput) _buildInputField(),
      ],
    );
  }

  Widget _buildInputField() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _inputController,
                focusNode: _focusNode,
                enabled: !widget.isMuted,
                maxLength: AppConstants.maxChatMessageLength,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: widget.isMuted ? 'You are muted' : 'Say something...',
                  hintStyle: TextStyle(
                    color: Colors.white.withOpacity(0.5),
                    fontSize: 14,
                  ),
                  border: InputBorder.none,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  counterText: '',
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _isSending ? null : _sendMessage,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: widget.isMuted
                    ? Colors.grey
                    : AppColors.primaryGreen,
                shape: BoxShape.circle,
              ),
              child: _isSending
                  ? const Padding(
                      padding: EdgeInsets.all(10),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessageTile extends StatelessWidget {
  final ChatMessage message;
  final bool isOwnMessage;
  final void Function(String userId, String displayName)? onUserTap;

  const _ChatMessageTile({
    required this.message,
    required this.isOwnMessage,
    this.onUserTap,
  });

  @override
  Widget build(BuildContext context) {
    if (message.isPinned) {
      return _PinnedMessageBanner(message: message);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sender name + message bubble
          Flexible(
            child: GestureDetector(
              onTap: onUserTap != null
                  ? () => onUserTap!(
                      message.senderId, message.senderName ?? 'User')
                  : null,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: isOwnMessage
                      ? AppColors.primaryGreen.withOpacity(0.3)
                      : Colors.black.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: '${message.senderName ?? 'User'} ',
                        style: TextStyle(
                          color: isOwnMessage
                              ? AppColors.primaryGreen
                              : AppColors.coinYellow,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      TextSpan(
                        text: message.message,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Prominent banner shown for pinned messages.
class _PinnedMessageBanner extends StatelessWidget {
  final ChatMessage message;

  const _PinnedMessageBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.giftGold.withOpacity(0.2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.giftGold.withOpacity(0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.push_pin, color: AppColors.giftGold, size: 14),
          const SizedBox(width: 6),
          Expanded(
            child: RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: '${message.senderName ?? 'User'}: ',
                    style: const TextStyle(
                      color: AppColors.giftGold,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  TextSpan(
                    text: message.message,
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
