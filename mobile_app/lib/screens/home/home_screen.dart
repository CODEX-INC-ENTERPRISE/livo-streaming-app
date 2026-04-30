import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/stream_provider.dart';
import '../../providers/auth_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _refreshIndicatorKey = GlobalKey<RefreshIndicatorState>();
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }
  
  Future<void> _loadData() async {
    final streamProvider = context.read<StreamProvider>();
    await streamProvider.loadActiveStreams();
  }
  
  Future<void> _refreshData() async {
    await _loadData();
  }
  
  @override
  Widget build(BuildContext context) {
    final streamProvider = context.watch<StreamProvider>();
    final authProvider = context.watch<AuthProvider>();
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Streams'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // Navigate to search
            },
          ),
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () {
              // Navigate to notifications
            },
          ),
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () {
              // Navigate to profile
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        key: _refreshIndicatorKey,
        onRefresh: _refreshData,
        child: _buildContent(streamProvider),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Start a new stream
          _showStartStreamDialog();
        },
        child: const Icon(Icons.videocam),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: 0,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.explore),
            label: 'Discover',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.wallet),
            label: 'Wallet',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        onTap: (index) {
          // Handle navigation
        },
      ),
    );
  }
  
  Widget _buildContent(StreamProvider streamProvider) {
    if (streamProvider.isLoading && streamProvider.activeStreams.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    
    if (streamProvider.error != null && streamProvider.activeStreams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              streamProvider.error!,
              style: const TextStyle(color: Colors.red),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadData,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    
    if (streamProvider.activeStreams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.videocam_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              'No live streams',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            const Text(
              'Be the first to start a stream!',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => _showStartStreamDialog(),
              child: const Text('Start Streaming'),
            ),
          ],
        ),
      );
    }
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: streamProvider.activeStreams.length,
      itemBuilder: (context, index) {
        final stream = streamProvider.activeStreams[index];
        return _buildStreamCard(stream);
      },
    );
  }
  
  Widget _buildStreamCard(Stream stream) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: () {
          // Join the stream
          _joinStream(stream);
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stream thumbnail placeholder
              Container(
                height: 200,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.videocam, size: 48, color: Colors.grey),
                      const SizedBox(height: 8),
                      Text(
                        'Live Stream',
                        style: TextStyle(color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 12),
              
              // Stream title
              Text(
                stream.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              
              const SizedBox(height: 8),
              
              // Stream info
              Row(
                children: [
                  // Host info
                  CircleAvatar(
                    backgroundColor: Colors.grey.shade300,
                    child: const Icon(Icons.person, color: Colors.grey),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Host ID: ${stream.hostId.substring(0, 8)}...',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                        Text(
                          '${stream.currentViewerCount} viewers',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  
                  // Live badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.circle, size: 8, color: Colors.white),
                        SizedBox(width: 4),
                        Text(
                          'LIVE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 8),
              
              // Stream stats
              Row(
                children: [
                  Icon(Icons.visibility, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Text(
                    '${stream.peakViewerCount} peak',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  const SizedBox(width: 16),
                  Icon(Icons.card_giftcard, size: 16, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Text(
                    '${stream.totalGiftsReceived} gifts',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  const Spacer(),
                  Text(
                    '${stream.duration.inMinutes}m',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  void _showStartStreamDialog() {
    showDialog(
      context: context,
      builder: (context) {
        final titleController = TextEditingController();
        
        return AlertDialog(
          title: const Text('Start Streaming'),
          content: TextField(
            controller: titleController,
            decoration: const InputDecoration(
              labelText: 'Stream Title',
              hintText: 'Enter a title for your stream',
              border: OutlineInputBorder(),
            ),
            maxLength: 100,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (titleController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please enter a title')),
                  );
                  return;
                }
                
                Navigator.pop(context);
                
                try {
                  final streamProvider = context.read<StreamProvider>();
                  await streamProvider.startStream(titleController.text.trim());
                  
                  // Navigation to stream screen would happen here
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to start stream: $e')),
                  );
                }
              },
              child: const Text('Start'),
            ),
          ],
        );
      },
    );
  }
  
  void _joinStream(Stream stream) async {
    try {
      final streamProvider = context.read<StreamProvider>();
      await streamProvider.joinStream(stream.id);
      
      // Navigation to stream view screen would happen here
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Joined stream: ${stream.title}')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to join stream: $e')),
      );
    }
  }
}