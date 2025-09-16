# Samsung Memory Lens - Mobile App

A Flutter-based mobile gallery application with voice recording and speech-to-text capabilities.

## 🛠️ Technologies Used

- **Framework**: Flutter (iOS & Android)
- **Language**: Dart
- **Packages**:
  - `photo_manager` - Gallery access
  - `speech_to_text` - Voice recognition
  - `file_picker` - Directory selection
  - `permission_handler` - Device permissions

## 📱 Features

- **Multi-Source Gallery**: Access photos from Camera, Downloads, Screenshots, and custom folders
- **Voice Recording**: Record voice commands and convert to text
- **Cross-Platform**: Works on both iOS and Android
- **Permission Management**: Handles gallery and microphone permissions
- **Custom Directory Support**: Browse media from any accessible folder

## 📁 Project Structure

```
mobile-app/
├── lib/
│   ├── main.dart                      # Main app entry point
│   ├── gallery_service.dart           # Gallery and media management
│   ├── voice_recording_service.dart   # Voice recording functionality
│   └── directory_picker_service.dart  # Custom folder selection
├── android/                          # Android platform code
├── ios/                              # iOS platform code
├── pubspec.yaml                      # Flutter dependencies
└── README.md                         # This file
```

## 🚀 Setup Instructions

1. **Install Flutter**
   - Follow the [Flutter installation guide](https://flutter.dev/docs/get-started/install)
   - Ensure you have Android Studio or Xcode installed

2. **Clone and Setup**
   ```bash
   cd mobile-app
   flutter pub get
   ```

3. **Platform-Specific Setup**

   **Android:**
   - Minimum SDK: 21
   - Permissions: Camera, Microphone, Storage access

   **iOS:**
   - iOS 11.0+
   - Permissions: Photo Library, Microphone, Speech Recognition

4. **Run the App**
   ```bash
   # For debugging
   flutter run

   # For release build
   flutter build apk          # Android
   flutter build ios          # iOS
   ```

## 📋 Core Functionality

### Gallery Service
- Load media from device gallery
- Access specific albums (Camera, Downloads, Screenshots)
- Support for custom directory browsing
- Media type detection (images/videos)

### Voice Recording Service
- Record audio from device microphone
- Convert speech to text using device's built-in recognition
- Send processed text to backend services

### Directory Picker Service
- Allow users to select custom folders
- Browse media files outside default gallery locations

## 🔐 Permissions Required

**Android:**
- `READ_EXTERNAL_STORAGE`
- `RECORD_AUDIO`
- `INTERNET`

**iOS:**
- `NSPhotoLibraryUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`

## 🧪 Testing

### iOS Testing
- Core gallery functionality should work
- Permission handling is iOS-compatible
- Album names might differ from Android

### Android Testing
- Full functionality including custom directories
- Comprehensive permission handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both platforms if possible
5. Submit a pull request

## 📝 Development Notes

- Uses `photo_manager` for cross-platform gallery access
- Implements platform-specific permission handling
- Voice recording integrates with backend API
- Custom directory access may be limited on iOS due to sandboxing

## 🚨 Known Issues

- Custom directory access limited on iOS
- Some album names differ between platforms
- Voice recording requires internet for backend processing

## 📄 License

This project is part of the Samsung Memory Lens suite and is available under the MIT License.
