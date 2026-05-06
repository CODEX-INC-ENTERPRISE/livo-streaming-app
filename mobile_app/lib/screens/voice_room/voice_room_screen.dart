import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/logger.dart';
import '../../models/voice_room.dart';
import '../../providers/auth_provider.dart';
import '../../providers/voice_room_provider.dart';
import '../../widgets/voice_room/voice_room_chat_widget.dart';

/// Voice room screen – audio-only multi-user room.
///
/// Displays host and speakers prominently in a grid, listeners in a list,
/// speaking indicators, raise-hand button, chat panel, and leave button.
///
/// Requirements: 11.1, 11.4, 11.5, 12.1, 12.3, 12.4, 12.5, 12.6, 13.1–13.3
class VoiceRoomScreen extends StatefulWidget {
  /// The voice room to join. Passed from the discover screen.
  final VoiceRoom room;

  const VoiceRoomScreen({super.key, required this.room});

  @override
  State<VoiceRoomScreen> createState() => _VoiceRoomScreenState();
}

class _VoiceRoomScreenState extends State<VoiceRoomScreen> {
  bool _isJoining = true;
  bool _isLeaving = false;
  String? _error;
  bool _showChat = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _joinRoom());
  }

  Future<void> _joinRoom() async {
    final authProvider = context.read<AuthProvider>();
    final voiceProvider = context.read<VoiceRoomProvider>();
    final userId = authProvider.currentUser?.id ?? '';

    try {
      await voiceProvider.joinRoom(widget.room.id, userId);
      if (mounted) setState(() => _isJoining = false);
    } catch (e) {
      Logger.error('VoiceRoomScreen: Failed to join room', e);
      if (mounted) {
        setState(() {
          _isJoining = false;
          _error = 'Failed to join voice room. Please try again.';
        });
      }
    }
  }

  Future<void> _leaveRoom() async {
    setState(() => _isLeaving = true);
    try {
      await context.read<VoiceRoomProvider>().leaveRoom();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      Logger.error('VoiceRoomScreen: Failed to leave room', e);
      if (mounted) {
        setState(() => _isLeaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to leave room')),
        );
      }
    }
  }

  @override
  void dispose() {
    // Ensure we leave the room if screen is popped without tapping leave
    final voiceProvider = context.read<VoiceRoomProvider>();
    if (voiceProvider.isInRoom) {
      voiceProvider.leaveRoom();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBackground,
      body: _isJoining
          ? _buildLoadingView()
          : _error != null
              ? _buildErrorView()
              : _buildRoomView(),
    );
  }

  Widget _buildLoadingView() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: AppColors.primaryGreen),
          SizedBox(height: 16),
          Text(
            'Joining voice room...',
            style: TextStyle(color: Colors.white, fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: const TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoomView() {
    return Consumer<VoiceRoomProvider>(
      builder: (context, provider, _) {
        final room = provider.currentRoom ?? widget.room;
        final currentUserId =
            context.read<AuthProvider>().currentUser?.id ?? '';

        return SafeArea(
          child: Column(
            children: [
              // Top bar
              _RoomTopBar(
                roomName: room.name,
                participantCount: room.participantCount,
                isLeaving: _isLeaving,
                onLeave: _leaveRoom,
                showChat: _showChat,
                onToggleChat: () =>
                    setState(() => _showChat = !_showChat),
              ),

              // Main content
              Expanded(
                child: _showChat
                    ? VoiceRoomChatWidget(
                        messages: provider.chatMessages,
                        currentUserId: currentUserId,
                      )
                    : _RoomContent(
                        room: room,
                        currentUserId: currentUserId,
                        myRole: provider.myRole,
                        isHandRaised: provider.isHandRaised,
                        isMuted: provider.isMuted,
                        isSpeaker: provider.isSpeaker,
                        isHost: provider.isHost,
                        onRaiseHand: provider.raiseHand,
                        onLowerHand: provider.lowerHand,
                        onToggleMute: provider.toggleMute,
                        onPromote: provider.promoteToSpeaker,
                        onDemote: provider.demoteToListener,
                      ),
              ),

              // Bottom controls
              _RoomBottomBar(
                isSpeaker: provider.isSpeaker,
                isMuted: provider.isMuted,
                isHandRaised: provider.isHandRaised,
                showChat: _showChat,
                onToggleMute: provider.toggleMute,
                onRaiseHand: provider.raiseHand,
                onLowerHand: provider.lowerHand,
                onToggleChat: () =>
                    setState(() => _showChat = !_showChat),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

class _RoomTopBar extends StatelessWidget {
  final String roomName;
  final int participantCount;
  final bool isLeaving;
  final VoidCallback onLeave;
  final bool showChat;
  final VoidCallback onToggleChat;

  const _RoomTopBar({
    required this.roomName,
    required this.participantCount,
    required this.isLeaving,
    required this.onLeave,
    required this.showChat,
    required this.onToggleChat,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.darkBorder)),
      ),
      child: Row(
        children: [
          // Room info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  roomName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '$participantCount participants',
                  style: const TextStyle(
                      color: AppColors.darkTextSecondary, fontSize: 12),
                ),
              ],
            ),
          ),

          // Chat toggle
          _IconButton(
            icon: showChat
                ? Icons.chat_bubble
                : Icons.chat_bubble_outline,
            onTap: onToggleChat,
          ),
          const SizedBox(width: 8),

          // Leave button
          GestureDetector(
            onTap: isLeaving ? null : onLeave,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(20),
              ),
              child: isLeaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Leave',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Room Content ─────────────────────────────────────────────────────────────

class _RoomContent extends StatelessWidget {
  final VoiceRoom room;
  final String currentUserId;
  final ParticipantRole myRole;
  final bool isHandRaised;
  final bool isMuted;
  final bool isSpeaker;
  final bool isHost;
  final VoidCallback onRaiseHand;
  final VoidCallback onLowerHand;
  final VoidCallback onToggleMute;
  final ValueChanged<String> onPromote;
  final ValueChanged<String> onDemote;

  const _RoomContent({
    required this.room,
    required this.currentUserId,
    required this.myRole,
    required this.isHandRaised,
    required this.isMuted,
    required this.isSpeaker,
    required this.isHost,
    required this.onRaiseHand,
    required this.onLowerHand,
    required this.onToggleMute,
    required this.onPromote,
    required this.onDemote,
  });

  @override
  Widget build(BuildContext context) {
    // Speakers = host + speakers
    final speakers = [
      if (room.hostParticipant != null) room.hostParticipant!,
      ...room.speakers.where((p) => p.userId != room.hostId),
    ];
    final listeners = room.listeners;
    final raisedHands = room.raisedHands;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Speakers grid
          const Text(
            'On Stage',
            style: TextStyle(
              color: AppColors.darkTextSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          speakers.isEmpty
              ? const _EmptySection(message: 'No speakers yet')
              : _SpeakersGrid(
                  speakers: speakers,
                  hostId: room.hostId,
                  currentUserId: currentUserId,
                  isHost: isHost,
                  onDemote: onDemote,
                ),

          const SizedBox(height: 24),

          // Raised hands (host only)
          if (isHost && raisedHands.isNotEmpty) ...[
            const Text(
              'Raised Hands',
              style: TextStyle(
                color: AppColors.warning,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),
            _ParticipantList(
              participants: raisedHands,
              currentUserId: currentUserId,
              isHost: isHost,
              showHandRaised: true,
              onPromote: onPromote,
              onDemote: onDemote,
            ),
            const SizedBox(height: 24),
          ],

          // Listeners list
          Row(
            children: [
              const Text(
                'Listeners',
                style: TextStyle(
                  color: AppColors.darkTextSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.darkSurface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${listeners.length}',
                  style: const TextStyle(
                      color: AppColors.darkTextSecondary, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          listeners.isEmpty
              ? const _EmptySection(message: 'No listeners')
              : _ParticipantList(
                  participants: listeners,
                  currentUserId: currentUserId,
                  isHost: isHost,
                  showHandRaised: false,
                  onPromote: onPromote,
                  onDemote: onDemote,
                ),
        ],
      ),
    );
  }
}

// ─── Speakers Grid ────────────────────────────────────────────────────────────

class _SpeakersGrid extends StatelessWidget {
  final List<VoiceParticipant> speakers;
  final String hostId;
  final String currentUserId;
  final bool isHost;
  final ValueChanged<String> onDemote;

  const _SpeakersGrid({
    required this.speakers,
    required this.hostId,
    required this.currentUserId,
    required this.isHost,
    required this.onDemote,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: speakers.map((p) {
        final isRoomHost = p.userId == hostId;
        final isMe = p.userId == currentUserId;
        return _SpeakerAvatar(
          participant: p,
          isHost: isRoomHost,
          isMe: isMe,
          canDemote: isHost && !isRoomHost,
          onDemote: () => onDemote(p.userId),
        );
      }).toList(),
    );
  }
}

class _SpeakerAvatar extends StatelessWidget {
  final VoiceParticipant participant;
  final bool isHost;
  final bool isMe;
  final bool canDemote;
  final VoidCallback onDemote;

  const _SpeakerAvatar({
    required this.participant,
    required this.isHost,
    required this.isMe,
    required this.canDemote,
    required this.onDemote,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: canDemote ? onDemote : null,
      child: SizedBox(
        width: 72,
        child: Column(
          children: [
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                // Avatar circle
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isHost
                        ? AppColors.primaryGreen.withAlpha(40)
                        : AppColors.darkSurface,
                    border: Border.all(
                      color: participant.isMuted
                          ? AppColors.darkBorder
                          : AppColors.primaryGreen,
                      width: 2,
                    ),
                  ),
                  child: const Icon(Icons.person,
                      color: AppColors.darkTextSecondary, size: 28),
                ),

                // Speaking indicator (green pulse when not muted)
                if (!participant.isMuted)
                  Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      color: AppColors.primaryGreen,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: AppColors.darkBackground, width: 2),
                    ),
                    child: const Icon(Icons.mic,
                        color: Colors.white, size: 10),
                  )
                else
                  Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      color: AppColors.darkBorder,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: AppColors.darkBackground, width: 2),
                    ),
                    child: const Icon(Icons.mic_off,
                        color: Colors.white, size: 10),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            // Name + host badge
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isHost)
                  const Padding(
                    padding: EdgeInsets.only(right: 2),
                    child: Icon(Icons.star,
                        color: AppColors.giftGold, size: 10),
                  ),
                Flexible(
                  child: Text(
                    isMe ? 'You' : 'User',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Participant List ─────────────────────────────────────────────────────────

class _ParticipantList extends StatelessWidget {
  final List<VoiceParticipant> participants;
  final String currentUserId;
  final bool isHost;
  final bool showHandRaised;
  final ValueChanged<String> onPromote;
  final ValueChanged<String> onDemote;

  const _ParticipantList({
    required this.participants,
    required this.currentUserId,
    required this.isHost,
    required this.showHandRaised,
    required this.onPromote,
    required this.onDemote,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: participants.map((p) {
        final isMe = p.userId == currentUserId;
        return _ParticipantTile(
          participant: p,
          isMe: isMe,
          isHost: isHost,
          showHandRaised: showHandRaised,
          onPromote: () => onPromote(p.userId),
          onDemote: () => onDemote(p.userId),
        );
      }).toList(),
    );
  }
}

class _ParticipantTile extends StatelessWidget {
  final VoiceParticipant participant;
  final bool isMe;
  final bool isHost;
  final bool showHandRaised;
  final VoidCallback onPromote;
  final VoidCallback onDemote;

  const _ParticipantTile({
    required this.participant,
    required this.isMe,
    required this.isHost,
    required this.showHandRaised,
    required this.onPromote,
    required this.onDemote,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 0, vertical: 2),
      leading: const CircleAvatar(
        radius: 20,
        backgroundColor: AppColors.darkSurface,
        child: Icon(Icons.person,
            color: AppColors.darkTextSecondary, size: 20),
      ),
      title: Text(
        isMe ? 'You' : 'Listener',
        style: const TextStyle(color: Colors.white, fontSize: 14),
      ),
      subtitle: showHandRaised && participant.isHandRaised
          ? const Text(
              'Hand raised ✋',
              style: TextStyle(color: AppColors.warning, fontSize: 12),
            )
          : null,
      trailing: isHost
          ? _HostActions(
              participant: participant,
              onPromote: onPromote,
              onDemote: onDemote,
            )
          : null,
    );
  }
}

class _HostActions extends StatelessWidget {
  final VoiceParticipant participant;
  final VoidCallback onPromote;
  final VoidCallback onDemote;

  const _HostActions({
    required this.participant,
    required this.onPromote,
    required this.onDemote,
  });

  @override
  Widget build(BuildContext context) {
    if (participant.role == ParticipantRole.listener) {
      return TextButton(
        onPressed: onPromote,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryGreen,
          padding: const EdgeInsets.symmetric(horizontal: 10),
        ),
        child: const Text('Invite', style: TextStyle(fontSize: 12)),
      );
    } else {
      return TextButton(
        onPressed: onDemote,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.error,
          padding: const EdgeInsets.symmetric(horizontal: 10),
        ),
        child: const Text('Remove', style: TextStyle(fontSize: 12)),
      );
    }
  }
}

// ─── Bottom Bar ───────────────────────────────────────────────────────────────

class _RoomBottomBar extends StatelessWidget {
  final bool isSpeaker;
  final bool isMuted;
  final bool isHandRaised;
  final bool showChat;
  final VoidCallback onToggleMute;
  final VoidCallback onRaiseHand;
  final VoidCallback onLowerHand;
  final VoidCallback onToggleChat;

  const _RoomBottomBar({
    required this.isSpeaker,
    required this.isMuted,
    required this.isHandRaised,
    required this.showChat,
    required this.onToggleMute,
    required this.onRaiseHand,
    required this.onLowerHand,
    required this.onToggleChat,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 12,
        bottom: MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: const BoxDecoration(
        color: AppColors.darkSurface,
        border: Border(top: BorderSide(color: AppColors.darkBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          // Mute / unmute (speakers only)
          if (isSpeaker)
            _BottomBarButton(
              icon: isMuted ? Icons.mic_off : Icons.mic,
              label: isMuted ? 'Unmute' : 'Mute',
              color: isMuted ? AppColors.error : AppColors.primaryGreen,
              onTap: onToggleMute,
            ),

          // Raise / lower hand (listeners only)
          if (!isSpeaker)
            _BottomBarButton(
              icon: isHandRaised ? Icons.back_hand : Icons.back_hand_outlined,
              label: isHandRaised ? 'Lower Hand' : 'Raise Hand',
              color: isHandRaised ? AppColors.warning : AppColors.darkTextSecondary,
              onTap: isHandRaised ? onLowerHand : onRaiseHand,
            ),

          // Chat toggle
          _BottomBarButton(
            icon: showChat ? Icons.chat_bubble : Icons.chat_bubble_outline,
            label: 'Chat',
            color: showChat
                ? AppColors.primaryGreen
                : AppColors.darkTextSecondary,
            onTap: onToggleChat,
          ),
        ],
      ),
    );
  }
}

class _BottomBarButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _BottomBarButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: color.withAlpha(30),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(color: color, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _EmptySection extends StatelessWidget {
  final String message;

  const _EmptySection({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(
        message,
        style: const TextStyle(
            color: AppColors.darkTextSecondary, fontSize: 13),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _IconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(
          color: AppColors.darkSurface,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }
}
