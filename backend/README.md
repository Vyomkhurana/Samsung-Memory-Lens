# Samsung Memory Lens - Backend

Voice-to-image search backend server for the Samsung Memory Lens mobile app.

## Features

- **Voice Text Processing**: Receives voice-to-text input from Flutter app
- **Image Recognition**: Uses AWS Rekognition for labels, celebrities, and text detection  
- **Vector Search**: Semantic search using Qdrant vector database
- **Real-time Results**: Returns matching images based on voice queries

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Install Python Dependencies

```bash
pip install sentence-transformers torch
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
- AWS credentials for image recognition
- Qdrant database endpoint
- Python path

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### POST /search-images
Main endpoint for Flutter app voice queries.

**Request:**
```json
{
  "text": "show me photos of cats",
  "timestamp": "2025-09-16T...",
  "source": "voice_input"
}
```

**Response:**
```json
{
  "success": true,
  "query": "show me photos of cats",
  "results": [
    {
      "url": "https://...",
      "fileName": "cat1.jpg",
      "labels": ["cat", "animal", "pet"],
      "celebrities": [],
      "texts": []
    }
  ],
  "count": 1,
  "timestamp": "2025-09-16T..."
}
```

### POST /analyze-image
Upload and analyze images to build the searchable database.

### GET /health
Health check endpoint.

### GET /test
Test backend connectivity and configuration.

## Architecture

```
Flutter App → Voice-to-Text → /search-images → Vector Search → Image Results
```

## Configuration Notes

- **AWS**: Required for image recognition features
- **Qdrant**: Vector database for semantic search
- **Python**: Required for text embeddings (sentence-transformers)

## Development

The backend runs on `http://localhost:3000` by default and is configured for CORS to accept requests from the Flutter app.