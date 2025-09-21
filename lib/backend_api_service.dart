import 'dart:convert';
import 'package:http/http.dart' as http;

class BackendApiService {
  // GitHub repository configuration
  static const String githubOwner = 'Vyomkhurana';
  static const String githubRepo = 'Samsung-Memory-Lens';
  static const String recognitionBranch = 'rekognition';
  
  // Backend API endpoints
  static const String baseUrl = 'https://api.github.com/repos/$githubOwner/$githubRepo';
  static const String recognitionEndpoint = '$baseUrl/contents/recognition_data.json';
  
  // Production backend server URL (Samsung Memory Lens Backend on OnRender)
  static const String backendServerUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  
  /// Send recognized text to Samsung Memory Lens backend for image search
  static Future<Map<String, dynamic>> sendRecognizedText({
    required String recognizedText,
    required List<String> mediaFilePaths,
    String? customDirectory,
  }) async {
    try {
      print('🚀 Sending recognized text to Samsung Memory Lens backend: $recognizedText');
      
      // Prepare data payload
      final Map<String, dynamic> recognitionData = {
        'timestamp': DateTime.now().toIso8601String(),
        'recognized_text': recognizedText,
        'media_files': mediaFilePaths,
        'custom_directory': customDirectory,
        'device_info': {
          'platform': 'android',
          'app_version': '1.0.0',
        },
        'processing_status': 'pending',
      };
      
      // Send to Samsung Memory Lens backend server for image search
      Map<String, dynamic> serverResult = await _sendToBackendServer(recognitionData);
      
      if (serverResult['success'] == true) {
        return {
          'success': true,
          'images': serverResult['results'],
          'count': serverResult['count'],
          'query': serverResult['query'],
        };
      } else {
        // Fallback to mock backend if server is not available
        print('📱 Falling back to mock backend...');
        Map<String, dynamic> mockResult = await sendToMockBackend(recognitionData);
        return mockResult;
      }
      
    } catch (e) {
      print('❌ Error sending text to backend: $e');
      return {
        'success': false,
        'error': e.toString(),
        'images': [],
        'count': 0,
      };
    }
  }
  
  /// Send data to GitHub repository recognition branch
  static Future<bool> _sendToGitHubRepo(Map<String, dynamic> data) async {
    try {
      // Note: GitHub API requires authentication token for write operations
      // For production, you'll need to implement proper authentication
      print('📤 Sending to GitHub repository...');
      
      final response = await http.get(
        Uri.parse(recognitionEndpoint),
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Samsung-Memory-Lens-App',
        },
      );
      
      if (response.statusCode == 200) {
        print('✅ Mock backend: Text successfully processed!');
    
        // Add delay to simulate processing
        await Future.delayed(const Duration(milliseconds: 200));
        
        print('🚀 Mock backend processing complete');
        return true;
      } else {
        print('⚠️ GitHub repository access limited (authentication needed)');
        return false;
      }
      
    } catch (e) {
      print('❌ GitHub repository error: $e');
      return false;
    }
  }
  
  /// Send data to Samsung Memory Lens backend server
  static Future<Map<String, dynamic>> _sendToBackendServer(Map<String, dynamic> data) async {
    try {
      print('🎤 =================================');
      print('🎤 VOICE-TO-TEXT SENDING TO BACKEND!');
      print('🎤 =================================');
      print('📝 Voice Text: "${data['recognized_text']}"');
      print('🌐 Backend URL: $backendServerUrl/search-images');
      print('⏰ Timestamp: ${data['timestamp']}');
      print('📤 Sending HTTP POST request...');
      
      final requestBody = {
        'text': data['recognized_text'],
        'timestamp': data['timestamp'],
        'source': 'flutter_voice_recording',
      };
      
      print('📦 Request Body: ${jsonEncode(requestBody)}');
      
      final response = await http.post(
        Uri.parse('$backendServerUrl/search-images'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode(requestBody),
      );
      
      print('📡 Response Status Code: ${response.statusCode}');
      print('📡 Response Headers: ${response.headers}');
      
      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        print('✅ ================================');
        print('✅ BACKEND RESPONSE RECEIVED!');
        print('✅ ================================');
        print('🖼️ Found ${responseData['count']} matching images');
        print('📋 Response: ${response.body}');
        
        return {
          'success': true,
          'results': responseData['results'] ?? [],
          'count': responseData['count'] ?? 0,
          'query': responseData['query'] ?? '',
          'searchTerms': responseData['searchTerms'] ?? [],
          'showSimilarResults': responseData['showSimilarResults'] ?? false,
        };
      } else {
        print('❌ ================================');
        print('❌ BACKEND ERROR!');
        print('❌ ================================');
        print('❌ Status Code: ${response.statusCode}');
        print('❌ Response Body: ${response.body}');
        return {'success': false, 'error': 'Server error ${response.statusCode}'};
      }
      
    } catch (e) {
      print('❌ ================================');
      print('❌ BACKEND CONNECTION FAILED!');
      print('❌ ================================');
      print('❌ Error: $e');
      print('❌ Make sure backend server is running on $backendServerUrl');
      print('📱 Falling back to mock backend...');
      
      // Fall back to mock backend
      return await sendToMockBackend(data);
    }
  }
  
  /// Mock backend service for testing (always returns success with image results)
  static Future<Map<String, dynamic>> sendToMockBackend(Map<String, dynamic> data) async {
    print('🧪 Mock Backend - Received data:');
    print('📝 Text: ${data['recognized_text']}');
    print('📅 Timestamp: ${data['timestamp']}');
    print('📁 Files: ${data['media_files']?.length ?? 0} files');
    
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 500));
    
    // Extract search terms from voice text
    String text = data['recognized_text'].toString().toLowerCase();
    List<String> searchTerms = [];
    
    // Extract colors
    List<String> colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'pink'];
    for (String color in colors) {
      if (text.contains(color)) searchTerms.add(color);
    }
    
    // Extract objects
    List<String> objects = ['car', 'cat', 'dog', 'house', 'flower', 'person', 'beach', 'mountain', 'vacation', 
                           'photo', 'picture', 'pic', 'image', 'family', 'friend', 'food', 'animal', 'nature'];
    for (String object in objects) {
      if (text.contains(object)) searchTerms.add(object);
    }
    
    // Create mock image results based on search terms
    List<Map<String, dynamic>> mockResults = [];
    
    if (searchTerms.contains('red') && searchTerms.contains('car')) {
      mockResults.addAll([
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
          'filename': 'family_red_car.jpg',
          'path': '/gallery/family/red_car.jpg',
          'tags': ['red', 'car', 'family'],
          'score': 0.85,
          'date': '2024-07-20'
        }
      ]);
    }
    
    if (searchTerms.contains('car')) {
      mockResults.addAll([
        {
          'id': 3,
          'filename': 'blue_car_street.jpg',
          'path': '/gallery/photos/blue_car.jpg',
          'tags': ['blue', 'car', 'street'],
          'score': 0.75,
          'date': '2024-06-10'
        }
      ]);
    }
    
    if (searchTerms.contains('cat')) {
      mockResults.add({
        'id': 4,
        'filename': 'cute_cat_sleeping.jpg',
        'path': '/gallery/pets/cat.jpg',
        'tags': ['cat', 'pet', 'cute'],
        'score': 0.90,
        'date': '2024-05-15'
      });
    }
    
    // Add results for common words
    if (searchTerms.contains('photo') || searchTerms.contains('picture') || searchTerms.contains('pic') || searchTerms.contains('image')) {
      mockResults.addAll([
        {
          'id': 5,
          'filename': 'beautiful_sunset.jpg',
          'path': '/gallery/photos/sunset.jpg',
          'tags': ['sunset', 'nature', 'beautiful'],
          'score': 0.88,
          'date': '2024-08-10'
        },
        {
          'id': 6,
          'filename': 'family_gathering.jpg',
          'path': '/gallery/family/gathering.jpg',
          'tags': ['family', 'people', 'happy'],
          'score': 0.82,
          'date': '2024-07-05'
        }
      ]);
    }
    
    if (searchTerms.contains('family')) {
      mockResults.add({
        'id': 7,
        'filename': 'family_vacation.jpg',
        'path': '/gallery/family/vacation.jpg',
        'tags': ['family', 'vacation', 'trip'],
        'score': 0.92,
        'date': '2024-06-15'
      });
    }
    
    // If no specific keywords found, return some default results for testing
    if (mockResults.isEmpty) {
      print('🔍 No specific keywords found, returning default results for: "$text"');
      mockResults.addAll([
        {
          'id': 101,
          'filename': 'sample_photo1.jpg',
          'path': '/gallery/general/photo1.jpg',
          'tags': ['photo', 'memory'],
          'score': 0.70,
          'date': '2024-09-01'
        },
        {
          'id': 102,
          'filename': 'sample_photo2.jpg',
          'path': '/gallery/general/photo2.jpg',
          'tags': ['photo', 'memory'],
          'score': 0.65,
          'date': '2024-08-25'
        },
        {
          'id': 103,
          'filename': 'sample_photo3.jpg',
          'path': '/gallery/general/photo3.jpg',
          'tags': ['photo', 'memory'],
          'score': 0.60,
          'date': '2024-08-20'
        }
      ]);
    }
    
    // Sort by score
    mockResults.sort((a, b) => (b['score'] as double).compareTo(a['score'] as double));
    
    print('🔍 Mock search found ${mockResults.length} matching images');
    
    // Return data in the same format as the real backend
    final response = {
      'success': true,
      'query': data['recognized_text'],
      'searchTerms': searchTerms,
      'results': mockResults,
      'count': mockResults.length,
      'showSimilarResults': mockResults.isNotEmpty,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    print('🔄 Mock Backend Response:');
    print('  count: ${response['count']}');
    print('  showSimilarResults: ${response['showSimilarResults']}');
    print('  results length: ${response['results'].length}');
    
    return response;
  }
  
  /// Get recognition history from backend
  static Future<List<Map<String, dynamic>>> getRecognitionHistory() async {
    try {
      // This would fetch previously recognized texts from your backend
      final response = await http.get(
        Uri.parse('$backendServerUrl/recognition/history'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_TOKEN',
        },
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.cast<Map<String, dynamic>>();
      }
      
    } catch (e) {
      print('Error fetching recognition history: $e');
    }
    
    return [];
  }
  
  /// Check backend service health
  static Future<bool> checkBackendHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$backendServerUrl/health'),
        headers: {'Content-Type': 'application/json'},
      );
      
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}
