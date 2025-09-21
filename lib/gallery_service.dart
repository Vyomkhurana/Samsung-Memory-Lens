import 'package:photo_manager/photo_manager.dart';
import 'dart:io';

enum MediaType { image, video }

class MediaItem {
  final File file;
  final MediaType type;
  final String name;
  final DateTime lastModified;

  MediaItem({
    required this.file,
    required this.type,
    required this.name,
    required this.lastModified,
  });
}

class GalleryService {
  static Future<bool> requestPermissions() async {
    try {
      // Request photo access permission
      PermissionState result = await PhotoManager.requestPermissionExtend();

      if (result == PermissionState.authorized) {
        return true;
      } else if (result == PermissionState.limited) {
        // Limited access is still usable
        return true;
      } else {
        return false;
      }
    } catch (e) {
      print('Error requesting permissions: $e');
      return false;
    }
  }

  // Custom media item class for file-based media
  static Future<List<MediaItem>> getMediaFromCustomDirectory(
    String directoryPath,
  ) async {
    try {
      Directory directory = Directory(directoryPath);

      if (!await directory.exists()) {
        print('Directory does not exist: $directoryPath');
        return [];
      }

      List<FileSystemEntity> entities = await directory.list().toList();
      List<MediaItem> mediaItems = [];

      for (FileSystemEntity entity in entities) {
        if (entity is File) {
          String path = entity.path.toLowerCase();

          // Check if file is an image or video
          if (_isMediaFile(path)) {
            MediaItem item = MediaItem(
              file: entity,
              type: _getMediaType(path),
              name: _getFileName(entity.path),
              lastModified: await entity.lastModified(),
            );
            mediaItems.add(item);
          }
        }
      }

      // Sort by modification date (newest first)
      mediaItems.sort((a, b) => b.lastModified.compareTo(a.lastModified));

      return mediaItems;
    } catch (e) {
      print('Error reading custom directory: $e');
      return [];
    }
  }

  // Check if a file is a media file
  static bool _isMediaFile(String filePath) {
    List<String> imageExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.webp',
      '.svg',
      '.tiff',
      '.ico',
    ];

    List<String> videoExtensions = [
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.webm',
      '.mkv',
      '.m4v',
      '.3gp',
    ];

    String extension = '';
    int lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex != -1) {
      extension = filePath.substring(lastDotIndex);
    }

    return imageExtensions.contains(extension) ||
        videoExtensions.contains(extension);
  }

  // Get media type from file path
  static MediaType _getMediaType(String filePath) {
    List<String> videoExtensions = [
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.webm',
      '.mkv',
      '.m4v',
      '.3gp',
    ];

    String extension = '';
    int lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex != -1) {
      extension = filePath.substring(lastDotIndex);
    }

    return videoExtensions.contains(extension)
        ? MediaType.video
        : MediaType.image;
  }

  // Get file name from path
  static String _getFileName(String filePath) {
    return filePath.split(Platform.pathSeparator).last;
  }

  // Get all available albums/directories
  static Future<List<AssetPathEntity>> getAllAlbums() async {
    try {
      List<AssetPathEntity> albums = await PhotoManager.getAssetPathList(
        type: RequestType.common,
        hasAll: true,
      );
      return albums;
    } catch (e) {
      print('Error fetching albums: $e');
      return [];
    }
  }

  // Get media from a specific directory/album
  static Future<List<AssetEntity>> getMediaFromSpecificDirectory({
    String? albumName,
    int maxItems = 1000,
  }) async {
    try {
      List<AssetPathEntity> albums = await PhotoManager.getAssetPathList(
        type: RequestType.common,
        hasAll: true,
      );

      if (albums.isEmpty) {
        return [];
      }

      AssetPathEntity? targetAlbum;

      if (albumName != null && albumName.isNotEmpty) {
        // Find specific album by name
        targetAlbum = albums.firstWhere(
          (album) => album.name.toLowerCase().contains(albumName.toLowerCase()),
          orElse: () => albums.first, // Fallback to first album if not found
        );
      } else {
        // Use first album (usually "Camera" or "All Photos")
        targetAlbum = albums.first;
      }

      List<AssetEntity> media = await targetAlbum.getAssetListPaged(
        page: 0,
        size: maxItems,
      );

      return media;
    } catch (e) {
      print('Error fetching media from specific directory: $e');
      return [];
    }
  }

  // Get media from Camera album specifically
  static Future<List<AssetEntity>> getCameraMedia() async {
    return getMediaFromSpecificDirectory(albumName: 'Camera');
  }

  // Get media from Downloads album specifically
  static Future<List<AssetEntity>> getDownloadsMedia() async {
    return getMediaFromSpecificDirectory(albumName: 'Download');
  }

  // Get media from Screenshots album specifically
  static Future<List<AssetEntity>> getScreenshotsMedia() async {
    return getMediaFromSpecificDirectory(albumName: 'Screenshot');
  }

  // Legacy method for backward compatibility
  static Future<List<AssetEntity>> getAllMedia() async {
    return getMediaFromSpecificDirectory();
  }

  static Future<List<AssetEntity>> getMediaPaged(int page, int pageSize) async {
    try {
      List<AssetPathEntity> albums = await PhotoManager.getAssetPathList(
        type: RequestType.common,
        hasAll: true,
      );

      if (albums.isEmpty) {
        return [];
      }

      List<AssetEntity> media = await albums[0].getAssetListPaged(
        page: page,
        size: pageSize,
      );

      return media;
    } catch (e) {
      print('Error fetching paged media: $e');
      return [];
    }
  }
}
