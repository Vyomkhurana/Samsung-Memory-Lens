import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:glassmorphism/glassmorphism.dart';
import 'gallery_service.dart';
import 'voice_recording_service.dart';
import 'directory_picker_service.dart';
import 'real_backend_service.dart';
import 'similar_results_window.dart';
import 'similar_results_window.dart';

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Samsung Memory Lens',
      theme: ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00D4FF),
          secondary: Color(0xFF4FC3F7),
          surface: Color(0xFF121212),
          background: Color(0xFF0A0A0A),
          onSurface: Color(0xFFE1E1E1),
          onBackground: Color(0xFFFFFFFF),
          tertiary: Color(0xFF9C27B0),
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          foregroundColor: Colors.white,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1E1E1E),
          elevation: 8,
          shadowColor: Colors.black54,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        useMaterial3: true,
        fontFamily: 'SF Pro Display',
      ),
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
  String _selectedSource = '';
  bool _isUsingCustomDirectory = false;
  String? _customDirectoryPath;
  bool _isRecording = false;
  bool _isListening = false;
  bool _isSpeaking = false;
  double _soundLevel = 0.0;
  bool _isSendingToBackend = false;
  String _recognizedText = '';
  DateTime _lastSpeechTime = DateTime.now();
  
  @override
  void initState() {
    super.initState();
    _requestPermissionAndLoadMedia();
  }

  @override
  void dispose() {
    // VoiceRecordingService doesn't have a dispose method
    super.dispose();
  }

  Future<void> _requestPermissionAndLoadMedia() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final hasPermission = await GalleryService.requestPermissions();
      setState(() {
        _hasPermission = hasPermission;
      });

      if (hasPermission) {
        await _loadMediaFromAlbum('');
      } else {
        setState(() {
          _errorMessage = 'Gallery permission is required to view photos';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error requesting permission: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadMediaFromAlbum(String albumName) async {
    setState(() {
      _isLoading = true;
      _isUsingCustomDirectory = false;
      _selectedSource = albumName;
    });

    try {
      List<AssetEntity> media;
      if (albumName.isEmpty) {
        media = await GalleryService.getAllMedia();
      } else {
        // Map album names to correct methods
        switch (albumName) {
          case 'Camera':
            media = await GalleryService.getCameraMedia();
            break;
          case 'Download':
            media = await GalleryService.getDownloadsMedia();
            break;
          case 'Screenshot':
            media = await GalleryService.getScreenshotsMedia();
            break;
          default:
            media = await GalleryService.getAllMedia();
        }
      }

      setState(() {
        _mediaList = media;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Error loading media: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _pickCustomDirectory() async {
    try {
      final directoryPath = await DirectoryPickerService.pickDirectory();
      if (directoryPath != null) {
        setState(() {
          _isLoading = true;
          _isUsingCustomDirectory = true;
          _selectedSource = 'Custom Directory';
        });

        final mediaItems = await GalleryService.getMediaFromCustomDirectory(directoryPath);
        setState(() {
          _customMediaList = mediaItems;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error picking directory: $e';
        _isLoading = false;
      });
    }
  }

  // Voice recording methods
  Future<void> _startVoiceRecording() async {
    try {
      setState(() {
        _isRecording = true;
        _isListening = true;
        _recognizedText = '';
        _lastSpeechTime = DateTime.now();
      });

      await VoiceRecordingService.startListening(
        onResult: (recognizedWords) {
          setState(() {
            _recognizedText = recognizedWords;
            _isListening = false;
            _isSpeaking = false;
            _isRecording = false;
          });
          
          // Send recognized text to backend
          if (recognizedWords.isNotEmpty) {
            _sendTextToBackend(recognizedWords);
          }
        },
        onPartialResult: (partialWords) {
          final now = DateTime.now();
          setState(() {
            _recognizedText = partialWords;
            _isSpeaking = partialWords.isNotEmpty;
            _lastSpeechTime = now;
            
            // Simulate sound level based on speech activity
            if (partialWords.isNotEmpty) {
              _soundLevel = 0.7 + (partialWords.length % 3) * 0.1;
            } else {
              _soundLevel = 0.0;
            }
          });
          
          // Auto-stop after 2 seconds of silence
          _checkForSpeechTimeout();
        },
      );
    } catch (e) {
      setState(() {
        _isRecording = false;
        _isListening = false;
        _isSpeaking = false;
        
        // Better error messages for common issues
        if (e.toString().contains('error_network')) {
          _errorMessage = '🌐 Network error: Please check your internet connection';
        } else if (e.toString().contains('error_no_match')) {
          _errorMessage = '🎤 No speech detected. Please try speaking again.';
        } else if (e.toString().contains('error_speech_timeout')) {
          _errorMessage = '⏰ Speech timeout. Please try again.';
        } else {
          _errorMessage = 'Voice recording error: $e';
        }
      });
      
      // Auto-clear error message after 5 seconds
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) {
          setState(() {
            _errorMessage = '';
          });
        }
      });
    }
  }

  void _checkForSpeechTimeout() {
    Future.delayed(const Duration(seconds: 2), () {
      final now = DateTime.now();
      if (now.difference(_lastSpeechTime).inSeconds >= 2 && _isListening) {
        _stopVoiceRecording();
      }
    });
  }

  Future<void> _stopVoiceRecording() async {
    try {
      await VoiceRecordingService.stopListening();
      setState(() {
        _isRecording = false;
        _isListening = false;
        _isSpeaking = false;
        _soundLevel = 0.0;
      });
    } catch (e) {
      setState(() {
        _isRecording = false;
        _isListening = false;
        _isSpeaking = false;
        _soundLevel = 0.0;
        _errorMessage = 'Error stopping recording: $e';
      });
    }
  }

  // Upload selected photo to backend
  Future<void> _uploadSelectedPhotoToBackend() async {
    setState(() {
      _errorMessage = '📤 Selecting photo to upload...';
    });

    try {
      print('📱 Starting photo selection and upload...');
      
      // Show photo picker dialog first
      AssetEntity? selectedPhoto = await _showPhotoPickerDialog();
      
      if (selectedPhoto == null) {
        setState(() {
          _errorMessage = '❌ No photo selected';
        });
        return;
      }

      setState(() {
        _errorMessage = '📤 Uploading selected photo to backend...';
      });
      
      // Now upload the selected photo (with built-in connectivity check)
      var uploadResult = await RealBackendService.uploadSelectedPhoto(selectedPhoto);
      
      if (uploadResult['success']) {
        var data = uploadResult['data'];
        
        setState(() {
          _errorMessage = '✅ Successfully uploaded selected photo!';
        });
        
        print('✅ Upload successful: Photo processed');
      } else {
        setState(() {
          _errorMessage = '❌ Upload failed: ${uploadResult['error']}';
        });
        print('❌ Upload failed: ${uploadResult['error']}');
      }

    } catch (e) {
      setState(() {
        _errorMessage = '❌ Upload error: $e';
      });
      print('❌ Upload error: $e');
    }
  }

  // Upload multiple photos to backend (bulk upload)
  Future<void> _uploadMultiplePhotosToBackend() async {
    setState(() {
      _errorMessage = '📤 Preparing bulk photo upload...';
    });

    try {
      print('📱 Starting bulk photo upload (10 photos)...');
      
      setState(() {
        _errorMessage = '📤 Uploading 10 photos to backend...';
      });
      
      // Upload 10 sample photos from gallery
      var uploadResult = await RealBackendService.uploadSamplePhotos(count: 10);
      
      if (uploadResult['success']) {
        var uploaded = uploadResult['uploaded'] ?? 0;
        var total = uploadResult['total'] ?? 10;
        
        setState(() {
          _errorMessage = '✅ Successfully uploaded $uploaded/$total photos!';
        });
        
        print('✅ Bulk upload successful: $uploaded photos processed');
      } else {
        setState(() {
          _errorMessage = '❌ Bulk upload failed: ${uploadResult['error']}';
        });
        print('❌ Bulk upload failed: ${uploadResult['error']}');
      }
      
    } catch (e) {
      setState(() {
        _errorMessage = '❌ Error during photo selection: $e';
      });
      print('❌ Error during photo selection: $e');
    }
  }

  // Show photo picker dialog
  Future<AssetEntity?> _showPhotoPickerDialog() async {
    List<AssetEntity> photos = [];
    
    try {
      print('🔍 Requesting gallery permission...');
      
      // Request permission
      var permission = await PhotoManager.requestPermissionExtend();
      print('📝 Permission result: ${permission.name}');
      
      if (!permission.isAuth) {
        print('❌ Gallery permission denied');
        setState(() {
          _errorMessage = '❌ Gallery permission required to select photos';
        });
        return null;
      }
      
      print('✅ Gallery permission granted, loading photos...');
      
      // Get recent photos
      List<AssetPathEntity> albums = await PhotoManager.getAssetPathList(
        type: RequestType.image,
        onlyAll: true,
      );
      
      if (albums.isNotEmpty) {
        photos = await albums.first.getAssetListRange(start: 0, end: 20);
        print('📸 Loaded ${photos.length} photos from gallery');
      } else {
        print('❌ No photo albums found');
      }
      
    } catch (e) {
      print('❌ Error loading photos: $e');
      setState(() {
        _errorMessage = '❌ Error loading photos: $e';
      });
      return null;
    }

    if (photos.isEmpty) {
      print('❌ No photos available');
      setState(() {
        _errorMessage = '❌ No photos found in gallery';
      });
      return null;
    }

    print('📋 Showing photo picker with ${photos.length} photos');

    return await showDialog<AssetEntity?>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text('Select Photo to Upload'),
          content: Container(
            width: double.maxFinite,
            height: 400,
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 4,
                mainAxisSpacing: 4,
              ),
              itemCount: photos.length,
              itemBuilder: (context, index) {
                return GestureDetector(
                  onTap: () {
                    print('📸 Photo selected: ${photos[index].id}');
                    Navigator.of(context).pop(photos[index]);
                  },
                  child: FutureBuilder<Widget>(
                    future: _buildPhotoThumbnail(photos[index]),
                    builder: (context, snapshot) {
                      if (snapshot.hasData) {
                        return snapshot.data!;
                      }
                      return Container(
                        color: Colors.grey[300],
                        child: Icon(Icons.image),
                      );
                    },
                  ),
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                print('❌ Photo selection cancelled');
                Navigator.of(context).pop(null);
              },
              child: Text('Cancel'),
            ),
          ],
        );
      },
    );
  }

  // Build photo thumbnail
  Future<Widget> _buildPhotoThumbnail(AssetEntity asset) async {
    try {
      var thumbnail = await asset.thumbnailDataWithSize(
        ThumbnailSize(200, 200),
      );
      if (thumbnail != null) {
        return Image.memory(
          thumbnail,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        );
      }
    } catch (e) {
      print('Error loading thumbnail: $e');
    }
    
    return Container(
      color: Colors.grey[300],
      child: Icon(Icons.broken_image),
    );
  }

  // Legacy method - keep for now but will replace with selected photo upload
  Future<void> _uploadPhotosToBackend() async {
    setState(() {
      _errorMessage = '📤 Uploading photos to backend...';
    });

    try {
      print('📱 Starting photo upload to backend...');
      
      // Check if backend is running
      bool backendRunning = await RealBackendService.isBackendRunning();
      if (!backendRunning) {
        setState(() {
          _errorMessage = '❌ Backend not running. Please start the backend server.';
        });
        return;
      }

      // Upload sample photos (first 10 photos)
      var uploadResult = await RealBackendService.uploadSamplePhotos(count: 10);
      
      if (uploadResult['success']) {
        var data = uploadResult['data'];
        int processed = data['processed'] ?? 0;
        int total = data['total'] ?? 0;
        
        setState(() {
          _errorMessage = '✅ Uploaded $processed/$total photos successfully!';
        });
        
        print('✅ Upload successful: $processed/$total photos processed');
      } else {
        setState(() {
          _errorMessage = '❌ Upload failed: ${uploadResult['error']}';
        });
        print('❌ Upload failed: ${uploadResult['error']}');
      }
      
    } catch (e) {
      setState(() {
        _errorMessage = '❌ Upload error: $e';
      });
      print('❌ Upload error: $e');
    }
    
    // Clear message after 5 seconds
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) {
        setState(() {
          _errorMessage = '';
        });
      }
    });
  }

  // REAL BACKEND: Connect to real backend service
  Future<void> _sendTextToBackend(String recognizedText) async {
    if (recognizedText.trim().isEmpty) return;
    
    setState(() {
      _isSendingToBackend = true;
    });
    
    try {
      print('🎤 Voice text captured: "$recognizedText"');
      print('� Searching in backend for: "$recognizedText"');
      
      // Check if backend is running
      bool backendRunning = await RealBackendService.isBackendRunning();
      if (!backendRunning) {
        print('❌ Backend not running, using fallback');
        setState(() {
          _errorMessage = '⚠️ Backend not running. Please start the backend server.';
        });
        return;
      }
      
      // Search for images using real backend
      var searchResult = await RealBackendService.searchImages(recognizedText);
      
      if (searchResult['success']) {
        var data = searchResult['data'];
        List<dynamic> results = data['results'] ?? [];
        
        print('✅ Found ${results.length} matching images');
        
        // Show success message
        setState(() {
          _errorMessage = '✅ Found ${results.length} matching images!';
        });
        
        // Navigate to Similar Results window with real data
        try {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => SimilarResultsWindow(
                query: recognizedText,
                searchTerms: recognizedText.toLowerCase().split(' '),
                results: results,
              ),
            ),
          );
          print('🎯 Navigation completed successfully!');
        } catch (e) {
          print('❌ Navigation error: $e');
          setState(() {
            _errorMessage = '❌ Navigation error: $e';
          });
        }
        
      } else {
        print('❌ Search failed: ${searchResult['error']}');
        setState(() {
          _errorMessage = '❌ Search failed: ${searchResult['error']}';
        });
      }
      
    } catch (e) {
      print('❌ Backend error: $e');
      setState(() {
        _errorMessage = '❌ Backend error: $e';
      });
    } finally {
      setState(() {
        _isSendingToBackend = false;
      });
      
      // Clear error message after 3 seconds
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          setState(() {
            _errorMessage = '';
          });
        }
      });
    }
  }

  IconData _getSourceIcon() {
    switch (_selectedSource) {
      case 'Camera':
        return Icons.camera_alt;
      case 'Download':
        return Icons.download;
      case 'Screenshot':
        return Icons.screenshot;
      default:
        return _isUsingCustomDirectory ? Icons.folder : Icons.photo_library;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00D4FF), Color(0xFF0099CC)],
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00D4FF).withOpacity(0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.photo_library, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 12),
            const Text(
              'Samsung Memory Lens',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 20,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        flexibleSpace: GlassmorphicContainer(
          width: double.infinity,
          height: double.infinity,
          borderRadius: 0,
          blur: 20,
          alignment: Alignment.bottomCenter,
          border: 0,
          linearGradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF00D4FF).withOpacity(0.1),
              const Color(0xFF4FC3F7).withOpacity(0.05),
            ],
          ),
          borderGradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF00D4FF).withOpacity(0.2),
              const Color(0xFF4FC3F7).withOpacity(0.1),
            ],
          ),
        ),
        actions: [
          // Professional directory picker
          Container(
            margin: const EdgeInsets.only(right: 16),
            child: PopupMenuButton<String>(
              icon: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFF00D4FF).withOpacity(0.3),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.folder_open, 
                  color: Color(0xFF00D4FF), 
                  size: 18
                ),
              ),
              color: const Color(0xFF1E1E1E),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(
                  color: const Color(0xFF00D4FF).withOpacity(0.3),
                  width: 1,
                ),
              ),
              onSelected: (value) {
                if (value == 'custom') {
                  _pickCustomDirectory();
                } else {
                  _loadMediaFromAlbum(value);
                }
              },
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 'Camera', 
                  child: Row(children: [
                    Icon(Icons.camera_alt, size: 18, color: Color(0xFF00D4FF)), 
                    SizedBox(width: 12), 
                    Text('Camera', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500))
                  ])
                ),
                const PopupMenuItem(
                  value: 'Download', 
                  child: Row(children: [
                    Icon(Icons.download, size: 18, color: Color(0xFF00D4FF)), 
                    SizedBox(width: 12), 
                    Text('Downloads', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500))
                  ])
                ),
                const PopupMenuItem(
                  value: 'Screenshot', 
                  child: Row(children: [
                    Icon(Icons.screenshot, size: 18, color: Color(0xFF00D4FF)), 
                    SizedBox(width: 12), 
                    Text('Screenshots', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500))
                  ])
                ),
                const PopupMenuItem(
                  value: '', 
                  child: Row(children: [
                    Icon(Icons.photo_library, size: 18, color: Color(0xFF00D4FF)), 
                    SizedBox(width: 12), 
                    Text('All Photos', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500))
                  ])
                ),
                const PopupMenuItem(
                  value: 'custom', 
                  child: Row(children: [
                    Icon(Icons.folder, size: 18, color: Color(0xFF00D4FF)), 
                    SizedBox(width: 12), 
                    Text('Custom Folder', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500))
                  ])
                ),
              ],
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Main content
          Column(
            children: [
              const SizedBox(height: 100), // Space for transparent app bar
              // Source indicator
              if (_hasPermission) _buildSourceIndicator(),
              // Gallery content
              Expanded(child: _buildBody()),
              // Bottom padding for floating mic button
              const SizedBox(height: 120),
            ],
          ),
          // Floating YouTube-style mic button
          if (_hasPermission) _buildFloatingMicButton(),
          // Test button for backend (temporary)
          if (_hasPermission) _buildTestButton(),
          // Voice recognition overlay
          if (_recognizedText.isNotEmpty) _buildVoiceOverlay(),
        ],
      ),
    );
  }

  Widget _buildSourceIndicator() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E1E1E), Color(0xFF2A2A2A)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF00D4FF).withOpacity(0.3),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 5),
            spreadRadius: 2,
          ),
          BoxShadow(
            color: const Color(0xFF00D4FF).withOpacity(0.1),
            blurRadius: 15,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00D4FF).withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              _getSourceIcon(),
              color: const Color(0xFF00D4FF),
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            _selectedSource.isEmpty ? 'All Photos' : _selectedSource,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w600,
              fontSize: 16,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFloatingMicButton() {
    // Calculate dynamic size based on speaking activity
    double buttonSize = _isListening ? 70 : 65;
    if (_isSpeaking) {
      buttonSize = 70 + (_soundLevel * 10); // Pulsing effect
    }
    
    return Positioned(
      bottom: 40,
      left: 0,
      right: 0,
      child: Center(
        child: GestureDetector(
          onTap: _isRecording ? _stopVoiceRecording : _startVoiceRecording,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // YouTube-style expanding circles when listening
              if (_isListening) ...[
                // Outer pulse circle
                AnimatedContainer(
                  duration: Duration(milliseconds: _isSpeaking ? 300 : 800),
                  height: _isSpeaking ? 140 + (_soundLevel * 20) : 120,
                  width: _isSpeaking ? 140 + (_soundLevel * 20) : 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFFF4444).withOpacity(_isSpeaking ? 0.6 : 0.3),
                      width: 2,
                    ),
                  ),
                ),
                // Middle pulse circle
                AnimatedContainer(
                  duration: Duration(milliseconds: _isSpeaking ? 200 : 600),
                  height: _isSpeaking ? 110 + (_soundLevel * 15) : 95,
                  width: _isSpeaking ? 110 + (_soundLevel * 15) : 95,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFFF4444).withOpacity(_isSpeaking ? 0.8 : 0.5),
                      width: 2,
                    ),
                  ),
                ),
                // Inner pulse circle
                AnimatedContainer(
                  duration: Duration(milliseconds: _isSpeaking ? 100 : 400),
                  height: _isSpeaking ? 85 + (_soundLevel * 8) : 80,
                  width: _isSpeaking ? 85 + (_soundLevel * 8) : 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFFF4444).withOpacity(_isSpeaking ? 1.0 : 0.7),
                      width: 1.5,
                    ),
                  ),
                ),
              ],
              // Main button with YouTube-style pulsing
              AnimatedContainer(
                duration: Duration(milliseconds: _isSpeaking ? 150 : 200),
                height: buttonSize,
                width: buttonSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: _isListening 
                      ? [
                          Color.lerp(const Color(0xFFFF4444), const Color(0xFFFF6666), _soundLevel)!,
                          Color.lerp(const Color(0xFFCC1111), const Color(0xFFEE3333), _soundLevel)!,
                        ]
                      : [const Color(0xFF00D4FF), const Color(0xFF0099CC)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: (_isListening 
                        ? const Color(0xFFFF4444) 
                        : const Color(0xFF00D4FF)).withOpacity(_isSpeaking ? 0.8 : 0.4),
                      blurRadius: _isSpeaking ? 30 + (_soundLevel * 10) : (_isListening ? 25 : 20),
                      offset: const Offset(0, 10),
                      spreadRadius: _isSpeaking ? 8 + (_soundLevel * 3) : (_isListening ? 5 : 2),
                    ),
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: AnimatedScale(
                  duration: Duration(milliseconds: _isSpeaking ? 100 : 200),
                  scale: _isSpeaking ? 1.0 + (_soundLevel * 0.2) : 1.0,
                  child: Icon(
                    _isListening ? Icons.mic : Icons.mic_outlined,
                    color: Colors.white,
                    size: _isSpeaking ? 32 + (_soundLevel * 4) : (_isListening ? 30 : 28),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Test buttons for backend integration
  Widget _buildTestButton() {
    return Stack(
      children: [
        // Upload Multiple Photos Button (Bulk Upload) - Glassmorphism
        Positioned(
          bottom: 160,
          right: 20,
          child: GestureDetector(
            onTap: _uploadMultiplePhotosToBackend,
            child: GlassmorphicContainer(
              width: 56,
              height: 56,
              borderRadius: 28,
              blur: 20,
              alignment: Alignment.center,
              border: 2,
              linearGradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFFFF9800).withOpacity(0.3),
                  const Color(0xFFFF6F00).withOpacity(0.2),
                ],
              ),
              borderGradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFFFF9800).withOpacity(0.6),
                  const Color(0xFFFF6F00).withOpacity(0.4),
                ],
              ),
              child: const Icon(
                Icons.photo_library,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
        // Upload Selected Photo Button - Glassmorphism
        Positioned(
          bottom: 100,
          right: 20,
          child: GestureDetector(
            onTap: _uploadSelectedPhotoToBackend,
            child: GlassmorphicContainer(
              width: 56,
              height: 56,
              borderRadius: 28,
              blur: 20,
              alignment: Alignment.center,
              border: 2,
              linearGradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF2196F3).withOpacity(0.3),
                  const Color(0xFF1976D2).withOpacity(0.2),
                ],
              ),
              borderGradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF2196F3).withOpacity(0.6),
                  const Color(0xFF1976D2).withOpacity(0.4),
                ],
              ),
              child: const Icon(
                Icons.add_photo_alternate,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
        // Test Navigation Button - Glassmorphism
        Positioned(
          bottom: 40,
          right: 20,
          child: GestureDetector(
            onTap: () {
              print('🟢 Green test button pressed!');
              
              // Direct navigation test - bypass all logic
              try {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => SimilarResultsWindow(
                      query: "Test Query",
                      searchTerms: ["test", "query"],
                      results: [
                        {
                          'id': 1,
                          'filename': 'test_photo.jpg',
                          'path': '/test/photo.jpg',
                          'tags': ['test', 'demo'],
                          'score': 0.95,
                          'date': '2024-09-17'
                        }
                      ],
                    ),
                  ),
                );
                print('🟢 Direct navigation successful!');
              } catch (e) {
                print('❌ Direct navigation failed: $e');
              }
            },
            child: GlassmorphicContainer(
              width: 56,
              height: 56,
              borderRadius: 28,
              blur: 20,
              alignment: Alignment.center,
              border: 2,
              linearGradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF4CAF50).withOpacity(0.3),
                  const Color(0xFF388E3C).withOpacity(0.2),
                ],
              ),
              borderGradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF4CAF50).withOpacity(0.6),
                  const Color(0xFF388E3C).withOpacity(0.4),
                ],
              ),
              child: const Icon(
                Icons.science,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVoiceOverlay() {
    return Positioned(
      bottom: 130,
      left: 20,
      right: 20,
      child: AnimatedOpacity(
        opacity: _recognizedText.isNotEmpty ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 300),
        child: GlassmorphicContainer(
          width: double.infinity,
          height: 120,
          borderRadius: 24,
          blur: 30,
          alignment: Alignment.bottomCenter,
          border: 2,
          linearGradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF00D4FF).withOpacity(0.15),
              const Color(0xFF4FC3F7).withOpacity(0.1),
            ],
          ),
          borderGradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF00D4FF).withOpacity(0.4),
              const Color(0xFF4FC3F7).withOpacity(0.2),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00D4FF).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.mic, 
                        color: Color(0xFF00D4FF), 
                        size: 20
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Listening...',
                        style: TextStyle(
                          color: Color(0xFF00D4FF),
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (_recognizedText.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A0A0A),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.1),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _recognizedText,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w400,
                            height: 1.4,
                          ),
                        ),
                        if (_isSendingToBackend) ...[
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Color(0xFF00D4FF),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Sending to backend...',
                                style: TextStyle(
                                  color: Color(0xFF00D4FF),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Color(0xFF00D4FF)),
            SizedBox(height: 16),
            Text(
              'Loading your memories...',
              style: TextStyle(color: Colors.white),
            ),
          ],
        ),
      );
    }

    if (!_hasPermission || _errorMessage.isNotEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.photo_library_outlined,
              size: 64,
              color: Colors.grey,
            ),
            const SizedBox(height: 16),
            Text(
              _errorMessage.isNotEmpty
                  ? _errorMessage
                  : 'Gallery permission required',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, color: Colors.white),
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
            Text(
              'No photos or videos found', 
              style: TextStyle(fontSize: 16, color: Colors.white)
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 0.75,
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
                borderRadius: BorderRadius.circular(20),
                color: const Color(0xFF1E1E1E),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                    spreadRadius: 2,
                  ),
                  BoxShadow(
                    color: const Color(0xFF00D4FF).withOpacity(0.1),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    snapshot.data!,
                    // Professional gradient overlay
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.transparent,
                            Colors.black.withOpacity(0.3),
                            Colors.black.withOpacity(0.6),
                          ],
                          stops: const [0.0, 0.5, 0.8, 1.0],
                        ),
                      ),
                    ),
                    // Video play button
                    if (asset.type == AssetType.video)
                      Positioned(
                        top: 16,
                        right: 16,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.7),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.3),
                              width: 1,
                            ),
                          ),
                          child: const Icon(
                            Icons.play_arrow,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    // Photo indicator
                    if (asset.type == AssetType.image)
                      Positioned(
                        bottom: 12,
                        right: 12,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF00D4FF).withOpacity(0.9),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.photo,
                            color: Colors.white,
                            size: 16,
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
              borderRadius: BorderRadius.circular(20),
              color: const Color(0xFF1E1E1E),
            ),
            child: const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF00D4FF),
                strokeWidth: 2,
              ),
            ),
          );
        }
      },
    );
  }

  Future<Widget?> _buildThumbnail() async {
    try {
      final thumbnail = await asset.thumbnailDataWithSize(
        const ThumbnailSize(300, 300),
      );
      if (thumbnail != null) {
        return Image.memory(thumbnail, fit: BoxFit.cover);
      }
    } catch (e) {
      return Container(
        color: Colors.grey[800],
        child: Icon(Icons.broken_image, color: Colors.grey[400]),
      );
    }
    return null;
  }

  void _showFullImage(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => FullImageScreen(asset: asset)),
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
          borderRadius: BorderRadius.circular(20),
          color: const Color(0xFF1E1E1E),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 15,
              offset: const Offset(0, 5),
              spreadRadius: 2,
            ),
            BoxShadow(
              color: const Color(0xFF00D4FF).withOpacity(0.1),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.file(
                mediaItem.file,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: const Color(0xFF1E1E1E),
                    child: const Icon(
                      Icons.broken_image, 
                      color: Colors.grey, 
                      size: 40
                    ),
                  );
                },
              ),
              // Professional gradient overlay
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.transparent,
                      Colors.black.withOpacity(0.3),
                      Colors.black.withOpacity(0.6),
                    ],
                    stops: const [0.0, 0.5, 0.8, 1.0],
                  ),
                ),
              ),
              // File type indicator
              Positioned(
                bottom: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: (mediaItem.type == MediaType.video 
                      ? const Color(0xFFFF4444) 
                      : const Color(0xFF00D4FF)).withOpacity(0.9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    mediaItem.type == MediaType.video 
                      ? Icons.videocam 
                      : Icons.photo,
                    color: Colors.white,
                    size: 16,
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

class FullImageScreen extends StatelessWidget {
  final AssetEntity asset;

  const FullImageScreen({super.key, required this.asset});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(asset.title ?? 'Photo'),
      ),
      body: Center(
        child: FutureBuilder<Widget?>(
          future: _buildFullImage(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.done &&
                snapshot.hasData) {
              return InteractiveViewer(child: snapshot.data!);
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
        return Image.file(file, fit: BoxFit.contain);
      }
    } catch (e) {
      return Icon(Icons.broken_image, color: Colors.grey[400], size: 100);
    }
    return null;
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
        backgroundColor: Colors.transparent,
        title: Text(mediaItem.name),
      ),
      body: Center(
        child: InteractiveViewer(
          child: Image.file(mediaItem.file, fit: BoxFit.contain),
        ),
      ),
    );
  }
}