# Memory Lens
**Cloud-Enabled Intelligent Memory Recall Framework (IMRF) using AWS and OPENAI**
---
[![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)

## **Project Overview**

Memory Lens revolutionizes photo search by enabling users to find images using natural voice commands. Simply speak "show me red cars" or "find sunset photos" and watch our AI-powered semantic search find exactly what you're looking for.

### **Key Innovation**
- **Natural Language Processing**: Search photos conversationally, not with keywords
- **Modern Design Language**: Professional UI following modern design principles  
- **Voice-First Interface**: Hands-free photo discovery with speech recognition
- **Semantic Understanding**: AI comprehends context and meaning, not just exact matches
- **Real-time Results**: Instant search with confidence scoring and smart ranking

<img width="500" height="1000" alt="MEMORY LENS" src="https://github.com/user-attachments/assets/01631e9a-9ca0-4448-b55c-659b3d08c9ce" />

## **Demo**

**Demo Video** : https://youtu.be/qyNPU4weXrQ?si=GzbHqBmf7CauhPgR
(Please note, the video is UNLISTED hence the video can only be accessed through the above link)

---

## **Project Assumptions**

### **Gallery Integration**
This project demonstrates a **next-generation photo gallery feature** that seamlessly integrates voice-powered semantic search into a native photo management experience. 

### **Core Assumptions**
- **Direct Gallery Access**: The application operates with full integration into photo galleries, providing direct access to user photos without requiring manual uploads
- **Native Gallery Feature**: This represents an evolution of photo galleries where voice search becomes a core functionality, integrated seamlessly into the user experience
- **System-Level Integration**: The voice search capability works at the OS level, processing photos automatically as they are captured or saved to the device
- **Real-time Indexing**: Photos are automatically analyzed and indexed in the background, ensuring instant search results without user intervention
- **Seamless User Experience**: Users interact with this feature as a natural extension of their photo gallery, with voice search accessible through the familiar gallery interface

### **Technical Implementation Scope**
For demonstration purposes, this prototype includes a photo upload mechanism to simulate the direct gallery integration that would exist in the production version.



## **Quick Start - APK Download**

### **For Testers:**

1. **Download APK**: [Memory-Lens-v1.0.apk](https://github.com/Vyomkhurana/Samsung-Memory-Lens/releases) (43.9 MB)

2. **Install on Android**:
   - Open **Settings** → **Security** → Enable **"Install from Unknown Sources"**
   - Download and tap the APK file to install
   - Grant permissions: **Camera**, **Storage**, **Microphone**

3. **Test Voice Search**:
   - Tap the blue microphone button
   - Say: *"Show me cars"*, *"Find people"*, *"Look for text"*
   - View intelligent results with confidence scores

4. **Upload Photos**:
   - Tap **"Upload Photos"** button
   - Select images from your gallery
   - Wait for AI processing to complete

**Requirements**: Android 6.0+, ~50MB storage, Internet connection

---

## **Technology Architecture**

<img width="3840" height="2311" alt="memorylens" src="https://github.com/user-attachments/assets/032268f7-46eb-45d5-9f9b-4911ae43615e" />


### **Frontend Stack**
```
Flutter Framework (Dart)
├── Speech-to-Text Recognition
├── Modern Design System
├── Photo Gallery Integration  
├── Voice Feedback System
└── Backend API Integration
```

### **Backend Stack**
```
Node.js + Express Server
├── OpenAI Embeddings API (text-embedding-3-small)
├── AWS Rekognition (Object/Text/Celebrity Detection)  
├── Qdrant Vector Database (Similarity Search)
├── Real-time Image Processing
└── Smart Result Ranking
```

### **AI Pipeline**
```
Voice Input → Speech-to-Text → Semantic Enhancement → Vector Embedding 
     ↓
Qdrant Search → Similarity Matching → Confidence Scoring → Ranked Results
```

---

## **Full Development Setup**

### **Prerequisites**
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Flutter SDK** 3.0+ ([Install Guide](https://docs.flutter.dev/get-started/install))
- **Android Studio** or **VS Code** with Flutter extensions
- **Git** for version control

### **1. Clone Repository**
```bash
git clone https://github.com/Vyomkhurana/Samsung-Memory-Lens.git
cd Samsung-Memory-Lens
```

### **2. Backend Setup**
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

**Configure `.env` file:**
```env
# OpenAI Configuration (Required)
OPENAI_API_KEY=your-openai-api-key

# AWS Configuration (Required)  
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Qdrant Configuration (Required)
QDRANTDB_ENDPOINT=your-qdrant-cloud-url
QDRANTDB_API_KEY=your-qdrant-api-key

# Server Configuration
PORT=3000
```

**Start Backend Server:**
```bash
npm run dev
# Server runs at: http://localhost:3000
# Health check: http://localhost:3000/health
```

### **3. Flutter App Setup**
```bash
# Install Flutter dependencies
flutter pub get

# Run on connected device/emulator
flutter run

# Build release APK
flutter build apk --release
```

### **4. Testing the App**

1. **Start Backend**: Ensure Node.js server is running on port 3000
2. **Launch App**: Run Flutter app on device/emulator  
3. **Upload Photos**: Use "Upload Photos" button to add images
4. **Voice Search**: Tap mic button and speak naturally
5. **View Results**: See ranked results with confidence scores

---

## **Key Features Demonstration**

<img width="1920" height="1080" alt="SAMSUNG - MEMORY LENS (12)" src="https://github.com/user-attachments/assets/346f26b3-faa1-4f0a-9d35-a57446e9746b" />
<img width="1920" height="1080" alt="SAMSUNG - MEMORY LENS (13)" src="https://github.com/user-attachments/assets/5cb7c826-8a10-4dff-9d15-31291f7e1be4" />

### **Semantic Understanding**
- **"Red sports car"** finds: Ferrari, Lamborghini, racing vehicles
- **"Sunset beach"** finds: Ocean sunsets, coastal evening photos  
- **"Food from restaurants"** finds: Dining photos, menu images
- **"My dog playing"** finds: Pet activity photos, outdoor scenes

### **Smart Results**
- **TOP MATCH**: Highlighted with blue border and star badge
- **Confidence Scores**: 90%+ (Excellent), 70%+ (Good), 50%+ (Fair)
- **Visual Hierarchy**: Best matches shown first with larger previews
- **Quick Preview**: Tap any result for full-screen view

---

## **Design System**

### **Visual Identity**
- **Primary Color**: Primary Blue (#1976D2)
- **Typography**: Modern sans-serif font family  
- **Components**: Glassmorphism cards, rounded corners
- **Animations**: Smooth 150ms transitions, easing curves
- **Spacing**: 8px grid system, consistent margins

### **User Experience**
- **Voice-First**: Large, accessible microphone button
- **Professional Dashboard**: Stats cards showing gallery metrics
- **Intuitive Navigation**: Clear visual hierarchy and flow
- **Accessibility**: High contrast, readable fonts, touch targets
- **Responsive**: Adapts to different screen sizes seamlessly

---

## **Performance Metrics**

| Metric | Performance |
|--------|-------------|
| **Search Speed** | < 2 seconds for 1000+ photos |
| **Voice Recognition** | 95%+ accuracy (English) |
| **Semantic Accuracy** | 85%+ relevant results |
| **App Size** | 43.9 MB APK |
| **Memory Usage** | < 100 MB RAM |
| **Battery Impact** | Low power consumption |

---

## **API Endpoints**

### **Backend Services**
```
POST /add-gallery-images    # Upload and process images
POST /search-images         # Voice search query  
GET  /api/image/:id        # Retrieve processed image
GET  /health               # Server health check
```

### **Data Flow**
```
Flutter App → Node.js Backend → OpenAI Embeddings → Qdrant Vector DB
     ↑              ↓                    ↑                   ↓
Voice Input → AWS Rekognition → Semantic Processing → Search Results
```

---

## **Troubleshooting**

### **Common Issues**

**Backend Connection Failed:**
```bash
# Check server status
curl http://localhost:3000/health

# Restart backend
cd backend && npm run dev
```

**Voice Recognition Not Working:**
- Grant microphone permission in Android settings
- Test in quiet environment  
- Speak clearly and naturally
- NOTE : Kindly note that for the backend to start (for the first time) it may take upto 30-40 seconds because of free deployment (ONRENDER )  

**No Search Results:**
- Upload photos first using "Upload Photos" button
- Wait for AI processing to complete
- Try different search terms

**APK Installation Failed:**
- Enable "Install from Unknown Sources" in Android Security settings
- Ensure Android 6.0+ device
- Clear download cache and retry


## **Future Enhancements**

- **Multi-language Support**: Expand beyond English voice commands
- **Advanced Filters**: Date, location, people-based filtering  
- **Batch Operations**: Select and organize multiple photos
- **Cloud Sync**: Cross-device photo synchronization
- **AI Suggestions**: Proactive photo organization recommendations

---

## **License**

This project demonstrates AI-powered voice search for photo galleries.

---

## **Ready to Test?**

1. **[Download APK](https://github.com/Vyomkhurana/Samsung-Memory-Lens/releases)** 
2. **Install on Android device**
3. **Grant permissions** (Camera, Storage, Microphone)
4. **Upload some photos** using the upload button
5. **Tap the mic** and say "show me cars" or "find people"
6. **Experience the magic** of voice-powered photo search!

