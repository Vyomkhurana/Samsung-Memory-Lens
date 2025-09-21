// Configuration file for backend URLs
class AppConfig {
  // Development configuration
  static const bool isDevelopment = true;
  static const bool showDeveloperOptions = true; // Show URL input in app
  
  // Backend URL configuration
  static const String _localBackendUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  static const String _productionBackendUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  
  // Current OnRender URL - PRODUCTION READY
  static const String _ngrokBackendUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  
  // Runtime ngrok URL (can be updated from app)
  static String? _runtimeNgrokUrl;
  
  // Get the appropriate backend URL based on configuration
  static String get backendServerUrl {
    if (isDevelopment) {
      // Use runtime URL if available, otherwise use configured ngrok URL
      return _runtimeNgrokUrl ?? _ngrokBackendUrl;
    } else {
      // Use production server for released app
      return _productionBackendUrl;
    }
  }
  
  // Method to update ngrok URL at runtime
  static void updateNgrokUrl(String newUrl) {
    _runtimeNgrokUrl = newUrl;
    print('🔄 Updated ngrok URL to: $newUrl');
  }
  
  // Reset to default ngrok URL
  static void resetNgrokUrl() {
    _runtimeNgrokUrl = null;
    print('🔄 Reset to default ngrok URL: $_ngrokBackendUrl');
  }
  
  // Health check endpoint
  static String get healthCheckUrl => '$backendServerUrl/health';
  
  // Search endpoint
  static String get searchImagesUrl => '$backendServerUrl/search-images';
  
  // Upload endpoint  
  static String get addGalleryImagesUrl => '$backendServerUrl/add-gallery-images';
}