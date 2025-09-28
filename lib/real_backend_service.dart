import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:photo_manager/photo_manager.dart';
import 'package:path/path.dart' as path;

class RealBackendService {
  static const String baseUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  
  /// Upload a single selected photo to backend
  static Future<Map<String, dynamic>> uploadSelectedPhoto(AssetEntity asset) async {
    int maxRetries = 3;
    int retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        print('📤 Starting upload of selected photo to backend... (Attempt ${retryCount + 1}/$maxRetries)');
        
        var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/add-gallery-images'));
        
        // Get the file from AssetEntity
        File? file = await asset.file;
        if (file == null || !await file.exists()) {
          return {
            'success': false,
            'error': 'Photo file not found or not accessible',
          };
        }
        
        // Read file bytes
        List<int> fileBytes = await file.readAsBytes();
        
        // Create multipart file
        var multipartFile = http.MultipartFile.fromBytes(
          'images',
          fileBytes,
          filename: 'selected_photo_${asset.id}.jpg',
        );
        
        request.files.add(multipartFile);
        print('📸 Added selected photo to upload');
        
        print('🚀 Uploading photo to backend...');
        
        // Send the request with longer timeout for AWS Rekognition processing
        var streamedResponse = await request.send().timeout(Duration(seconds: 60));
        var response = await http.Response.fromStream(streamedResponse);
        
        if (response.statusCode == 200) {
          var data = json.decode(response.body);
          print('✅ Upload successful: ${data['message']}');
          return {
            'success': true,
            'data': data,
            'uploaded': 1,
          };
        } else {
          print('❌ Upload failed: ${response.statusCode} - ${response.body}');
          if (retryCount < maxRetries - 1) {
            retryCount++;
            print('🔄 Retrying in 2 seconds...');
            await Future.delayed(Duration(seconds: 2));
            continue;
          }
          return {
            'success': false,
            'error': 'Upload failed: ${response.statusCode}',
            'uploaded': 0,
          };
        }
      } catch (e) {
        print('❌ Upload error: $e');
        if (retryCount < maxRetries - 1) {
          retryCount++;
          print('🔄 Retrying in 2 seconds...');
          await Future.delayed(Duration(seconds: 2));
          continue;
        }
        return {
          'success': false,
          'error': 'Upload error: $e',
          'uploaded': 0,
        };
      }
    }
    
    return {
      'success': false,
      'error': 'All retry attempts failed',
      'uploaded': 0,
    };
  }
  
  /// Upload photos from gallery to backend for processing (with batching)
  static Future<Map<String, dynamic>> uploadGalleryPhotos(List<AssetEntity> assets) async {
    try {
      print('📤 Starting upload of ${assets.length} photos to backend...');
      
      // Process in smaller batches to avoid timeout/connection issues
      const int batchSize = 5; // Process 5 images at a time
      int totalUploaded = 0;
      int totalFailed = 0;
      
      for (int i = 0; i < assets.length; i += batchSize) {
        int endIndex = (i + batchSize > assets.length) ? assets.length : i + batchSize;
        List<AssetEntity> batch = assets.sublist(i, endIndex);
        
        print('📦 Processing batch ${(i ~/ batchSize) + 1} (${batch.length} photos)...');
        
        var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/add-gallery-images'));
        
        int batchUploaded = 0;
        for (var asset in batch) {
          try {
            // Get the file from AssetEntity
            File? file = await asset.file;
            if (file != null && await file.exists()) {
              // Read file bytes
              List<int> fileBytes = await file.readAsBytes();
              
              // Compress if image is too large (>2MB)
              if (fileBytes.length > 2 * 1024 * 1024) {
                print('⚠️ Large image detected (${(fileBytes.length / 1024 / 1024).toStringAsFixed(1)}MB), may cause timeout');
              }
              
              // Create multipart file
              var multipartFile = http.MultipartFile.fromBytes(
                'images',
                fileBytes,
                filename: 'gallery_photo_${asset.id}.jpg',
              );
              
              request.files.add(multipartFile);
              batchUploaded++;
              print('📸 Added photo ${totalUploaded + batchUploaded}/${assets.length}');
            }
          } catch (e) {
            print('⚠️ Failed to process asset ${asset.id}: $e');
            totalFailed++;
          }
        }
        
        if (request.files.isEmpty) {
          print('⚠️ No valid files in this batch, skipping...');
          continue;
        }
        
        print('🚀 Uploading batch with ${request.files.length} photos...');
        
        try {
          // Send the request with extended timeout for multiple images
          var streamedResponse = await request.send().timeout(Duration(seconds: 90));
          var response = await http.Response.fromStream(streamedResponse);
      
          if (response.statusCode == 200) {
            var data = json.decode(response.body);
            print('✅ Batch ${(i ~/ batchSize) + 1} upload successful: ${data['message']}');
            totalUploaded += batchUploaded;
          } else {
            print('❌ Batch ${(i ~/ batchSize) + 1} upload failed: ${response.statusCode} - ${response.body}');
            totalFailed += batchUploaded;
          }
        } catch (batchError) {
          print('❌ Batch ${(i ~/ batchSize) + 1} error: $batchError');
          totalFailed += batchUploaded;
        }
        
        // Small delay between batches to avoid overwhelming server
        if (i + batchSize < assets.length) {
          await Future.delayed(Duration(milliseconds: 500));
        }
      }
      
      print('🎉 Upload complete: ${totalUploaded} successful, ${totalFailed} failed out of ${assets.length} total');
      
      return {
        'success': totalUploaded > 0,
        'message': 'Uploaded ${totalUploaded} photos successfully, ${totalFailed} failed',
        'uploaded': totalUploaded,
        'failed': totalFailed,
      };
      
    } catch (e) {
      print('❌ Upload error: $e');
      return {
        'success': false,
        'error': 'Upload error: $e',
        'uploaded': 0,
      };
    }
  }
  
  /// Search for images using voice text
  static Future<Map<String, dynamic>> searchImages(String voiceText) async {
    try {
      print('🔍 Searching for images with text: "$voiceText"');
      
      var response = await http.post(
        Uri.parse('$baseUrl/search-images'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'text': voiceText,
          'timestamp': DateTime.now().toIso8601String(),
          'source': 'flutter_voice_search',
        }),
      );
      
      if (response.statusCode == 200) {
        var data = json.decode(response.body);
        print('✅ Search successful: Found ${data['count']} results');
        return {
          'success': true,
          'data': data,
        };
      } else {
        print('❌ Search failed: ${response.statusCode} - ${response.body}');
        return {
          'success': false,
          'error': 'Search failed: ${response.statusCode}',
        };
      }
    } catch (e) {
      print('❌ Search error: $e');
      return {
        'success': false,
        'error': 'Search error: $e',
      };
    }
  }
  
  /// Check if backend is running
  static Future<bool> isBackendRunning() async {
    try {
      var response = await http.get(Uri.parse('$baseUrl/health')).timeout(
        const Duration(seconds: 30),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('❌ Backend not reachable: $e');
      return false;
    }
  }
  
  /// Upload a specific number of photos for testing
  static Future<Map<String, dynamic>> uploadSamplePhotos({int count = 10}) async {
    try {
      print('📱 Getting sample photos from gallery...');
      
      // Request permission
      bool hasPermission = await PhotoManager.requestPermissionExtend() == PermissionState.authorized;
      if (!hasPermission) {
        return {
          'success': false,
          'error': 'Gallery permission required',
        };
      }
      
      // Get albums
      List<AssetPathEntity> albums = await PhotoManager.getAssetPathList(
        type: RequestType.image,
        hasAll: true,
      );
      
      if (albums.isEmpty) {
        return {
          'success': false,
          'error': 'No photo albums found',
        };
      }
      
      // Get photos from first album (usually Camera or All Photos)
      List<AssetEntity> photos = await albums[0].getAssetListRange(
        start: 0,
        end: count,
      );
      
      if (photos.isEmpty) {
        return {
          'success': false,
          'error': 'No photos found in gallery',
        };
      }
      
      print('📸 Found ${photos.length} photos, uploading to backend...');
      
      // Upload photos
      return await uploadGalleryPhotos(photos);
      
    } catch (e) {
      print('❌ Sample upload error: $e');
      return {
        'success': false,
        'error': 'Sample upload error: $e',
      };
    }
  }
}