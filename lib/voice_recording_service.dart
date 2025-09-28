import 'package:speech_to_text/speech_to_text.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class VoiceRecordingService {
  static final SpeechToText _speech = SpeechToText();
  static bool _isListening = false;
  static String _recognizedText = '';
  static bool _isInitialized = false;
  static bool _hasPermission = false;

  // Initialize speech recognition once
  static Future<bool> initialize() async {
    if (_isInitialized && _hasPermission) return true;

    try {
      bool available = await _speech.initialize(
        onStatus: (status) {
          print('Speech status: $status');
          // Handle status changes
          if (status == 'done' || status == 'notListening') {
            _isListening = false;
          }
        },
        onError: (error) {
          print('Speech error: $error');
          print('Error type: ${error.errorMsg}');
          print('Error permanent: ${error.permanent}');
          
          // Special handling for no_match errors
          if (error.errorMsg == 'error_no_match') {
            print('WARNING: No match error - this might be due to short words or background noise');
            print('TIP: Try speaking more clearly or using longer phrases');
          }
          
          _isListening = false;
        },
      );

      _isInitialized = available;
      _hasPermission = available;

      print('Speech recognition initialized: $available');
      return available;
    } catch (e) {
      print('Error initializing speech: $e');
      _isInitialized = false;
      _hasPermission = false;
      return false;
    }
  }

  // Check if service is ready (initialized and has permission)
  static Future<bool> isReady() async {
    if (!_isInitialized || !_hasPermission) {
      return await initialize();
    }
    return true;
  }

  // Get available locales for debugging
  static Future<List<dynamic>> getAvailableLocales() async {
    try {
      var locales = await _speech.locales();
      print('Available locales: ${locales.map((l) => '${l.localeId} - ${l.name}').join(', ')}');
      return locales;
    } catch (e) {
      print('Error getting locales: $e');
      return [];
    }
  }

  // Start listening for voice with optimized settings for short words
  static Future<bool> startListening({
    required Function(String) onResult,
    Function(String)? onPartialResult,
  }) async {
    print('startListening called, _isListening: $_isListening');

    // Don't start if already listening
    if (_isListening) {
      print('Already listening, stopping first');
      await stopListening();
      // Wait a bit before starting again
      await Future.delayed(const Duration(milliseconds: 300));
    }

    try {
      // Ensure service is ready
      bool ready = await isReady();
      if (!ready) {
        print('Service not ready');
        throw Exception('Speech recognition not available on this device');
      }

      print('Starting speech recognition');
      await _speech.listen(
        onResult: (result) {
          print(
            'Speech result: "${result.recognizedWords}", confidence: ${result.confidence}, final: ${result.finalResult}',
          );
          _recognizedText = result.recognizedWords;

          if (result.finalResult) {
            onResult(_recognizedText);
            _isListening = false;
          } else if (onPartialResult != null) {
            onPartialResult(_recognizedText);
          }
        },
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 2),
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: false,
          listenMode: ListenMode.dictation,
          enableHapticFeedback: true,
        ),
        localeId: 'en_US',
      );

      _isListening = true;
      print('Speech recognition started successfully');
      return true;
    } catch (e) {
      print('Error starting speech recognition: $e');
      _isListening = false;
      return false;
    }
  }

  // Stop listening
  static Future<void> stopListening() async {
    print('stopListening called, _isListening: $_isListening');
    if (_isListening) {
      try {
        await _speech.stop();
        print('Speech recognition stopped');
      } catch (e) {
        print('Error stopping speech recognition: $e');
      }
      _isListening = false;
    }
  }

  // Reset the service (useful for troubleshooting)
  static Future<void> reset() async {
    print('Resetting voice recording service');
    await stopListening();
    _isInitialized = false;
    _hasPermission = false;
    _recognizedText = '';
  }

  // Get current listening status
  static bool get isListening => _isListening;

  // Get last recognized text
  static String get recognizedText => _recognizedText;

  // Check if initialized
  static bool get isInitialized => _isInitialized;

  // Send text to backend
  static Future<bool> sendTextToBackend(
    String text, {
    String? backendUrl,
  }) async {
    try {
      // Default backend URL - replace with your actual backend endpoint
      final url = backendUrl ?? 'https://your-backend-api.com/voice-text';

      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'text': text,
          'timestamp': DateTime.now().toIso8601String(),
          'source': 'voice_input',
        }),
      );

      if (response.statusCode == 200) {
        print('Text sent to backend successfully');
        return true;
      } else {
        print('Failed to send text to backend: ${response.statusCode}');
        return false;
      }
    } catch (e) {
      print('Error sending text to backend: $e');
      return false;
    }
  }

  // Send text to mock backend (for testing)
  static Future<bool> sendTextToMockBackend(String text) async {
    try {
      // Simulate network delay
      await Future.delayed(const Duration(seconds: 1));

      // Mock successful response
      print('Mock Backend: Received text: "$text"');
      print('Mock Backend: Processing completed successfully');

      return true;
    } catch (e) {
      print('Mock backend error: $e');
      return false;
    }
  }

  // Dispose resources
  static Future<void> dispose() async {
    await stopListening();
  }
}
