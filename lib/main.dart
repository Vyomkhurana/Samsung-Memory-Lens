import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';
import 'gallery_service.dart';
import 'voice_recording_service.dart';
import 'directory_picker_service.dart';

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gallery App',
      theme: ThemeData(primarySwatch: Colors.blue, useMaterial3: true),
      home: const GalleryScreen(),
    );
  }
}

class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  List<AssetEntity> _mediaList = [];
  List<MediaItem> _customMediaList = [];
  bool _isLoading = true;
  bool _hasPermission = false;
  String _errorMessage = '';
  String? _customDirectoryPath;
  String _selectedSource = 'Camera'; // Default to Camera folder
  bool _isRecording = false;
  String _recognizedText = '';
  bool _isSendingToBackend = false;
  bool _isUsingCustomDirectory = false;

  @override
  void initState() {
    super.initState();
    _requestPermissionAndLoadMedia();
  }

  @override
  void dispose() {
    VoiceRecordingService.dispose();
    super.dispose();
  }

  Future<void> _requestPermissionAndLoadMedia() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // Request permissions
      bool hasPermission = await GalleryService.requestPermissions();

      if (hasPermission) {
        // Load media from default album (Camera by default)
        if (!_isUsingCustomDirectory) {
          List<AssetEntity> media =
              await GalleryService.getMediaFromSpecificDirectory(
                albumName: _selectedSource,
              );

          setState(() {
            _hasPermission = true;
            _mediaList = media;
            _customMediaList = [];
            _isLoading = false;
          });
        } else if (_customDirectoryPath != null) {
          // Load from custom directory
          await _loadCustomDirectoryMedia(_customDirectoryPath!);
        }
      } else {
        setState(() {
          _hasPermission = false;
          _isLoading = false;
          _errorMessage =
              'Permission denied. Please grant gallery access in settings.';
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error loading media: $e';
      });
    }
  }

  Future<void> _loadMediaFromAlbum(String albumName) async {
    setState(() {
      _isLoading = true;
      _selectedSource = albumName;
      _isUsingCustomDirectory = false;
    });

    try {
      List<AssetEntity> media =
          await GalleryService.getMediaFromSpecificDirectory(
            albumName: albumName,
          );

      setState(() {
        _mediaList = media;
        _customMediaList = [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error loading media from $albumName: $e';
      });
    }
  }

  Future<void> _pickCustomDirectory() async {
    try {
      String? directoryPath = await DirectoryPickerService.pickDirectory();

      if (directoryPath != null) {
        await _loadCustomDirectoryMedia(directoryPath);
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error picking directory: $e';
      });
    }
  }

  Future<void> _loadCustomDirectoryMedia(String directoryPath) async {
    setState(() {
      _isLoading = true;
      _customDirectoryPath = directoryPath;
      _isUsingCustomDirectory = true;
      _selectedSource = DirectoryPickerService.getDirectoryName(directoryPath);
    });

    try {
      List<MediaItem> customMedia =
          await GalleryService.getMediaFromCustomDirectory(directoryPath);

      setState(() {
        _customMediaList = customMedia;
        _mediaList = []; // Clear PhotoManager media
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error loading custom directory: $e';
      });
    }
  }

  Future<void> _startVoiceRecording() async {
    try {
      setState(() {
        _isRecording = true;
        _recognizedText = '';
        _errorMessage = '';
      });

      bool success = await VoiceRecordingService.startListening(
        onResult: (text) async {
          print('Voice recording completed with text: $text');

          setState(() {
            _recognizedText = text;
            _isRecording = false;
          });

          // Send to backend when recording is complete
          if (text.isNotEmpty) {
            await _sendTextToBackend(text);
          }

          // Clear the text after a delay to prepare for next recording
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) {
              setState(() {
                _recognizedText = '';
              });
            }
          });
        },
        onPartialResult: (text) {
          setState(() {
            _recognizedText = text;
          });
        },
      );

      if (!success) {
        print('Failed to start voice recording');
        setState(() {
          _isRecording = false;
          _errorMessage = 'Failed to start voice recording. Please try again.';
        });

        // Try to reset the service if it fails
        await VoiceRecordingService.reset();
      }
    } catch (e) {
      print('Voice recording error: $e');
      setState(() {
        _isRecording = false;
        _errorMessage = 'Voice recording error: $e';
      });

      // Reset service on error
      await VoiceRecordingService.reset();
    }
  }

  Future<void> _resetVoiceService() async {
    print('Resetting voice service');
    try {
      setState(() {
        _isRecording = false;
        _recognizedText = '';
        _errorMessage = '';
      });

      await VoiceRecordingService.reset();

      // Show success message
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🔄 Voice service reset successfully'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      print('Error resetting voice service: $e');
      setState(() {
        _errorMessage = 'Reset failed: $e';
      });
    }
  }

  Future<void> _stopVoiceRecording() async {
    print('Stopping voice recording');
    try {
      await VoiceRecordingService.stopListening();
      setState(() {
        _isRecording = false;
      });
    } catch (e) {
      print('Error stopping voice recording: $e');
      setState(() {
        _isRecording = false;
        _errorMessage = 'Error stopping recording: $e';
      });
    }
  }

  Future<void> _sendTextToBackend(String text) async {
    setState(() {
      _isSendingToBackend = true;
    });

    try {
      // Using mock backend for demonstration
      bool success = await VoiceRecordingService.sendTextToMockBackend(text);

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Voice text sent: "$text"'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to send voice text to backend'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Backend error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isSendingToBackend = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Gallery App - $_selectedSource'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          // Directory picker button
          PopupMenuButton<String>(
            icon: const Icon(Icons.folder_open),
            onSelected: (value) {
              if (value == 'custom') {
                _pickCustomDirectory();
              } else {
                _loadMediaFromAlbum(value);
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'Camera', child: Text('📷 Camera')),
              const PopupMenuItem(
                value: 'Download',
                child: Text('📥 Downloads'),
              ),
              const PopupMenuItem(
                value: 'Screenshot',
                child: Text('📱 Screenshots'),
              ),
              const PopupMenuItem(value: '', child: Text('🖼️ All Photos')),
              const PopupMenuItem(
                value: 'custom',
                child: Text('📁 Choose Directory...'),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _requestPermissionAndLoadMedia,
          ),
        ],
      ),
      body: Column(
        children: [
          // Voice recording section
          if (_hasPermission) _buildVoiceRecordingSection(),
          // Gallery content
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildVoiceRecordingSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Voice recording button
              GestureDetector(
                onTap: _isRecording
                    ? _stopVoiceRecording
                    : _startVoiceRecording,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _isRecording ? Colors.red : Colors.blue,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isRecording ? Icons.stop : Icons.mic,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Status text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _isRecording
                          ? '🎤 Recording...'
                          : '🎙️ Tap to record voice',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    if (_recognizedText.isNotEmpty)
                      Text(
                        '💬 $_recognizedText',
                        style: TextStyle(color: Colors.grey[600]),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    if (_errorMessage.isNotEmpty)
                      Text(
                        '❌ $_errorMessage',
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              // Reset button for troubleshooting
              if (!_isRecording && !_isSendingToBackend)
                GestureDetector(
                  onTap: _resetVoiceService,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.orange.shade300),
                    ),
                    child: Icon(
                      Icons.refresh,
                      color: Colors.orange.shade700,
                      size: 16,
                    ),
                  ),
                ),
              // Sending indicator
              if (_isSendingToBackend)
                const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Loading gallery...'),
          ],
        ),
      );
    }

    if (!_hasPermission || _errorMessage.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.photo_library_outlined,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              _errorMessage.isNotEmpty
                  ? _errorMessage
                  : 'No permission granted',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _requestPermissionAndLoadMedia,
              child: const Text('Grant Permission'),
            ),
          ],
        ),
      );
    }

    // Check if we have any media to display
    bool hasMedia = _isUsingCustomDirectory
        ? _customMediaList.isNotEmpty
        : _mediaList.isNotEmpty;

    if (!hasMedia) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.photo, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text('No photos or videos found', style: TextStyle(fontSize: 16)),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
      ),
      itemCount: _isUsingCustomDirectory
          ? _customMediaList.length
          : _mediaList.length,
      itemBuilder: (context, index) {
        if (_isUsingCustomDirectory) {
          return CustomMediaThumbnail(mediaItem: _customMediaList[index]);
        } else {
          return MediaThumbnail(asset: _mediaList[index]);
        }
      },
    );
  }
}

class MediaThumbnail extends StatelessWidget {
  final AssetEntity asset;

  const MediaThumbnail({super.key, required this.asset});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Widget?>(
      future: _buildThumbnail(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done &&
            snapshot.hasData) {
          return GestureDetector(
            onTap: () => _showFullImage(context),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Colors.grey[200],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    snapshot.data!,
                    if (asset.type == AssetType.video)
                      const Positioned(
                        top: 8,
                        right: 8,
                        child: Icon(
                          Icons.play_circle_outline,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    if (asset.type == AssetType.video)
                      Positioned(
                        bottom: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _formatDuration(asset.duration),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        } else {
          return Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.grey[300],
            ),
            child: const Center(child: CircularProgressIndicator()),
          );
        }
      },
    );
  }

  Future<Widget?> _buildThumbnail() async {
    try {
      final thumbnail = await asset.thumbnailDataWithSize(
        const ThumbnailSize(200, 200),
      );

      if (thumbnail != null) {
        return Image.memory(thumbnail, fit: BoxFit.cover);
      }
    } catch (e) {
      print('Error loading thumbnail: $e');
    }

    return Container(
      color: Colors.grey[300],
      child: const Icon(Icons.broken_image, color: Colors.grey),
    );
  }

  void _showFullImage(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => FullImageScreen(asset: asset)),
    );
  }

  String _formatDuration(int durationInSeconds) {
    final duration = Duration(seconds: durationInSeconds);
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }
}

class FullImageScreen extends StatelessWidget {
  final AssetEntity asset;

  const FullImageScreen({super.key, required this.asset});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          asset.type == AssetType.video ? 'Video' : 'Photo',
          style: const TextStyle(color: Colors.white),
        ),
      ),
      body: Center(
        child: FutureBuilder<Widget?>(
          future: _buildFullImage(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.done &&
                snapshot.hasData) {
              return snapshot.data!;
            } else {
              return const CircularProgressIndicator();
            }
          },
        ),
      ),
    );
  }

  Future<Widget?> _buildFullImage() async {
    try {
      final file = await asset.file;
      if (file != null) {
        if (asset.type == AssetType.video) {
          return Container(
            padding: const EdgeInsets.all(20),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.play_circle_outline, size: 80, color: Colors.white),
                SizedBox(height: 16),
                Text(
                  'Video playback requires a video player implementation',
                  style: TextStyle(color: Colors.white),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        } else {
          return InteractiveViewer(
            child: Image.file(file, fit: BoxFit.contain),
          );
        }
      }
    } catch (e) {
      print('Error loading full image: $e');
    }

    return const Text(
      'Could not load media',
      style: TextStyle(color: Colors.white),
    );
  }
}

class CustomMediaThumbnail extends StatelessWidget {
  final MediaItem mediaItem;

  const CustomMediaThumbnail({super.key, required this.mediaItem});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _showFullImage(context),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: Colors.grey[200],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.file(
                mediaItem.file,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: Colors.grey[300],
                    child: const Icon(Icons.broken_image, color: Colors.grey),
                  );
                },
              ),
              if (mediaItem.type == MediaType.video)
                const Positioned(
                  top: 8,
                  right: 8,
                  child: Icon(
                    Icons.play_circle_outline,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              if (mediaItem.type == MediaType.video)
                Positioned(
                  bottom: 4,
                  right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'VIDEO',
                      style: TextStyle(color: Colors.white, fontSize: 10),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFullImage(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CustomFullImageScreen(mediaItem: mediaItem),
      ),
    );
  }
}

class CustomFullImageScreen extends StatelessWidget {
  final MediaItem mediaItem;

  const CustomFullImageScreen({super.key, required this.mediaItem});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          mediaItem.type == MediaType.video ? 'Video' : 'Photo',
          style: const TextStyle(color: Colors.white),
        ),
      ),
      body: Center(child: _buildFullImage()),
    );
  }

  Widget _buildFullImage() {
    if (mediaItem.type == MediaType.video) {
      return Container(
        padding: const EdgeInsets.all(20),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.play_circle_outline, size: 80, color: Colors.white),
            SizedBox(height: 16),
            Text(
              'Video playback requires a video player implementation',
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    } else {
      return InteractiveViewer(
        child: Image.file(
          mediaItem.file,
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) {
            return const Text(
              'Could not load image',
              style: TextStyle(color: Colors.white),
            );
          },
        ),
      );
    }
  }
}
