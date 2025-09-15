import 'package:photo_manager/photo_manager.dart';

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

  static Future<List<AssetEntity>> getAllMedia() async {
    try {
      // Get all photo albums
      List<AssetPathEntity> albums = await PhotoManager.getAssetPathList(
        type: RequestType.common, // Gets both images and videos
        hasAll: true,
      );

      if (albums.isEmpty) {
        return [];
      }

      // Get all media from the first album (usually "All Photos")
      List<AssetEntity> media = await albums[0].getAssetListPaged(
        page: 0,
        size: 1000, // Get up to 1000 items
      );

      return media;
    } catch (e) {
      print('Error fetching media: $e');
      return [];
    }
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
