// Configuration file for backend URLs
class AppConfig {
  // Development configuration - TEMPORARILY ENABLED FOR TESTING
  static const bool isDevelopment = false;
  static const bool showDeveloperOptions = false;
  
  // Backend URL configuration
  static const String _productionBackendUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  static const String _developmentBackendUrl = 'http://172.17.90.59:3000'; // Physical device - computer's IP
  
  // Get the backend URL
  static String get backendServerUrl {
    return isDevelopment ? _developmentBackendUrl : _productionBackendUrl;
  }
  
  // Health check endpoint
  static String get healthCheckUrl => '$backendServerUrl/health';
  
  // Search endpoint
  static String get searchImagesUrl => '$backendServerUrl/search-images';
  
  // Upload endpoint  
  static String get addGalleryImagesUrl => '$backendServerUrl/add-gallery-images';
}