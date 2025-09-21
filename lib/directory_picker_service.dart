import 'package:file_picker/file_picker.dart';
import 'dart:io';

class DirectoryPickerService {
  // Pick a directory from file manager
  static Future<String?> pickDirectory() async {
    try {
      String? selectedDirectory = await FilePicker.platform.getDirectoryPath();

      if (selectedDirectory != null) {
        // Verify the directory exists and is accessible
        Directory dir = Directory(selectedDirectory);
        if (await dir.exists()) {
          return selectedDirectory;
        } else {
          print('Selected directory does not exist: $selectedDirectory');
          return null;
        }
      }

      return null;
    } catch (e) {
      print('Error picking directory: $e');
      return null;
    }
  }

  // Get all media files from a directory path
  static Future<List<File>> getMediaFilesFromDirectory(
    String directoryPath,
  ) async {
    try {
      Directory directory = Directory(directoryPath);

      if (!await directory.exists()) {
        print('Directory does not exist: $directoryPath');
        return [];
      }

      // List all files in the directory
      List<FileSystemEntity> entities = await directory.list().toList();

      // Filter for image and video files
      List<File> mediaFiles = [];

      for (FileSystemEntity entity in entities) {
        if (entity is File) {
          String path = entity.path.toLowerCase();

          // Check if file is an image or video
          if (_isMediaFile(path)) {
            mediaFiles.add(entity);
          }
        }
      }

      // Sort files by modification date (newest first)
      mediaFiles.sort((a, b) {
        return b.lastModifiedSync().compareTo(a.lastModifiedSync());
      });

      return mediaFiles;
    } catch (e) {
      print('Error reading directory: $e');
      return [];
    }
  }

  // Get media files recursively from directory and subdirectories
  static Future<List<File>> getMediaFilesRecursively(
    String directoryPath,
  ) async {
    try {
      Directory directory = Directory(directoryPath);

      if (!await directory.exists()) {
        return [];
      }

      List<File> allMediaFiles = [];

      // Get files from current directory
      List<File> currentDirFiles = await getMediaFilesFromDirectory(
        directoryPath,
      );
      allMediaFiles.addAll(currentDirFiles);

      // Get files from subdirectories
      await for (FileSystemEntity entity in directory.list()) {
        if (entity is Directory) {
          List<File> subDirFiles = await getMediaFilesRecursively(entity.path);
          allMediaFiles.addAll(subDirFiles);
        }
      }

      return allMediaFiles;
    } catch (e) {
      print('Error reading directory recursively: $e');
      return [];
    }
  }

  // Check if a file is a media file (image or video)
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

  // Get directory name from path
  static String getDirectoryName(String directoryPath) {
    return directoryPath.split(Platform.pathSeparator).last;
  }

  // Check if directory has any media files
  static Future<bool> hasMediaFiles(String directoryPath) async {
    List<File> mediaFiles = await getMediaFilesFromDirectory(directoryPath);
    return mediaFiles.isNotEmpty;
  }
}
