// Configuration file for backend URLs
class AppConfig {
  // Production configuration
  static const bool isDevelopment = false;
  static const bool showDeveloperOptions = false;
  
  // Backend URL configuration - PRODUCTION ONLY
  static const String _productionBackendUrl = 'https://samsung-memory-lens-38jd.onrender.com';
  
  // Get the backend URL
  static String get backendServerUrl {
    return _productionBackendUrl;
  }
  
  // Health check endpoint
  static String get healthCheckUrl => '$backendServerUrl/health';
  
  // Search endpoint
  static String get searchImagesUrl => '$backendServerUrl/search-images';
  
  // Upload endpoint  
  static String get addGalleryImagesUrl => '$backendServerUrl/add-gallery-images';
}
}