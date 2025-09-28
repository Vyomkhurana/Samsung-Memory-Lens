import 'dart:convert';
import 'package:http/http.dart' as http;

class BackendApiService {
  static const String backendServerUrl = 'https://samsung-memory-lens-38jd.onrender.com';

  /// Send recognized text to backend
  static Future<Map<String, dynamic>> sendRecognizedText({
    required String recognizedText,
    required List<String> mediaFilePaths,
    String? customDirectory,
  }) async {
    print('Sending recognized text to Samsung Memory Lens backend: $recognizedText');
    
    Map<String, dynamic> recognitionData = {
      'recognized_text': recognizedText,
      'timestamp': DateTime.now().toIso8601String(),
      'source': 'flutter_voice_recording',
      'media_files': mediaFilePaths,
      'custom_directory': customDirectory,
    };

    try {
      // Always use mock backend for testing
      print('Using mock backend for testing...');
      return await sendToMockBackend(recognitionData);
      
    } catch (e) {
      print('Error: $e');
      return {'success': false, 'error': 'Connection failed'};
    }
  }

  /// SIMPLIFIED Mock backend - ALWAYS returns results
  static Future<Map<String, dynamic>> sendToMockBackend(Map<String, dynamic> data) async {
    print('Mock Backend - Received data:');
    print('Text: ${data['recognized_text']}');
    
    // ALWAYS return 3 results
    List<Map<String, dynamic>> mockResults = [
      {
        'id': 1,
        'filename': 'red_car_vacation.jpg',
        'path': '/gallery/vacation/red_car.jpg',
        'tags': ['red', 'car', 'vacation'],
        'score': 0.95,
        'date': '2024-08-15'
      },
      {
        'id': 2,
        'filename': 'family_photo.jpg',
        'path': '/gallery/family/photo.jpg',
        'tags': ['family', 'photo'],
        'score': 0.85,
        'date': '2024-07-20'
      },
      {
        'id': 3,
        'filename': 'nature_image.jpg',
        'path': '/gallery/nature/image.jpg',
        'tags': ['nature', 'beautiful'],
        'score': 0.75,
        'date': '2024-06-10'
      }
    ];
    
    final response = {
      'success': true,
      'query': data['recognized_text'],
      'searchTerms': ['test', 'mock'],
      'results': mockResults,
      'count': 3,
      'showSimilarResults': true,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    print('SIMPLIFIED Mock Backend Response:');
    print('  success: ${response['success']}');
    print('  count: ${response['count']}');  
    print('  showSimilarResults: ${response['showSimilarResults']}');
    print('  results length: ${response['results'].length}');
    
    return response;
  }
}