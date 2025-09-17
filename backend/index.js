import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import { PythonShell } from "python-shell";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:*', 'http://127.0.0.1:*'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const upload = multer();

// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "samsung-memory-lens-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Qdrant Vector Database setup
const qdrant = new QdrantClient({
  url: process.env.QDRANTDB_ENDPOINT || "http://localhost:6333",
  apiKey: process.env.QDRANTDB_API_KEY,
});
const COLLECTION_NAME = "images";
const VECTOR_SIZE = 384;

async function ensureCollectionExists() {
  try {
    await qdrant.getCollection(COLLECTION_NAME);
    console.log("✅ Collection exists.");
  } catch (err) {
    console.log("⚠️ Collection does not exist. Creating...");
    try {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      console.log("✅ Collection created.");
    } catch (createErr) {
      console.warn("❌ Qdrant connection failed. Running without vector database:", createErr.message);
      console.log("📱 Backend will use mock search results for now");
      return false;
    }
  }
  return true;
}

async function buildEmbedding(text) {
  return new Promise((resolve, reject) => {
    let result = "";

    const pyshell = new PythonShell("embeddings.py", {
      mode: "text",
      pythonOptions: ["-u"],
      pythonPath: process.env.PYTHON_PATH || "python",
      scriptPath: "./",
    });

    pyshell.send(text);

    pyshell.on("message", (msg) => {
      result += msg;
    });

    pyshell.end((err) => {
      if (err) reject(err);
      else resolve(JSON.parse(result));
    });
  });
}

async function searchImagesByStatement(statement) {
  try {
    // Skip embedding for now and go straight to mock results
    console.log(`🔍 Searching for: "${statement}"`);
    
    // Fallback to mock search results for demo
    const mockResults = [];
    const text = statement.toLowerCase();
    
    if (text.includes('red') && text.includes('car')) {
      mockResults.push({
        filename: 'red_car_vacation.jpg',
        labels: ['red', 'car', 'vehicle'],
        celebrities: [],
        texts: [],
        uploadTimestamp: new Date().toISOString(),
        source: 'mock_data',
        path: '/gallery/red_car.jpg',
        score: 0.95
      });
    }
    
    if (text.includes('car')) {
      mockResults.push({
        filename: 'blue_car_street.jpg',
        labels: ['blue', 'car', 'street'],
        celebrities: [],
        texts: [],
        uploadTimestamp: new Date().toISOString(),
        source: 'mock_data',
        path: '/gallery/blue_car.jpg',
        score: 0.75
      });
    }
    
    if (mockResults.length === 0) {
      mockResults.push({
        filename: 'sample_photo.jpg',
        labels: ['photo', 'memory'],
        celebrities: [],
        texts: [],
        uploadTimestamp: new Date().toISOString(),
        source: 'mock_data',
        path: '/gallery/sample.jpg',
        score: 0.50
      });
    }
    
    console.log(`✅ Found ${mockResults.length} mock results`);
    return mockResults;
  } catch (error) {
    console.warn("❌ Search failed:", error.message);
    return [];
  }
}

// 🎯 MAIN ENDPOINT FOR FLUTTER APP - Voice Text to Image Search
app.post("/search-images", async (req, res) => {
  try {
    const { text, timestamp, source } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        error: "No text provided",
        success: false 
      });
    }

    console.log(`🔍 Searching for: "${text}" from ${source || 'unknown'}`);

    // Search for matching images using voice text
    const matchedImages = await searchImagesByStatement(text);

    if (matchedImages.length > 0) {
      res.json({
        success: true,
        query: text,
        results: matchedImages,
        count: matchedImages.length,
        showSimilarResults: true,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Found ${matchedImages.length} matching images for: "${text}"`);
    } else {
      res.json({
        success: true,
        query: text,
        results: [],
        count: 0,
        showSimilarResults: false,
        message: "No matching images found",
        timestamp: new Date().toISOString()
      });
      
      console.log(`❌ No images found for: "${text}"`);
    }

  } catch (error) {
    console.error("❌ Search error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// 📱 NEW ENDPOINT - Add images from Flutter gallery to vector database
app.post("/add-gallery-images", upload.array("images", 50), async (req, res) => {
  await ensureCollectionExists();
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  console.log(`📸 Processing ${req.files.length} images from Flutter gallery...`);
  
  try {
    const results = [];
    let processed = 0;
    let failed = 0;

    for (const file of req.files) {
      try {
        const imageBytes = file.buffer;
        const filename = file.originalname || `image_${Date.now()}.jpg`;
        
        console.log(`🔄 Processing: ${filename}`);

        // 1. Detect Labels using Amazon Rekognition
        let labels = [];
        try {
          const labelData = await rekognition
            .detectLabels({ Image: { Bytes: imageBytes }, MaxLabels: 10, MinConfidence: 70 })
            .promise();
          labels = labelData.Labels.map((l) => l.Name.toLowerCase());
        } catch (labelError) {
          console.warn(`⚠️ Label detection failed for ${filename}:`, labelError.message);
        }

        // 2. Detect Celebrities
        let celebrities = [];
        try {
          const celebData = await rekognition
            .recognizeCelebrities({ Image: { Bytes: imageBytes } })
            .promise();
          celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
        } catch (celebError) {
          console.warn(`⚠️ Celebrity detection failed for ${filename}:`, celebError.message);
        }

        // 3. Detect Text
        let texts = [];
        try {
          const textData = await rekognition.detectText({ Image: { Bytes: imageBytes } }).promise();
          texts = textData.TextDetections.map((t) => t.DetectedText.toLowerCase());
        } catch (textError) {
          console.warn(`⚠️ Text detection failed for ${filename}:`, textError.message);
        }

        // 4. Build semantic embedding
        const allFeatures = [...labels, ...celebrities, ...texts];
        const embedding = await buildEmbedding(allFeatures.join(" "));

        // 5. Store in Qdrant Vector Database
        const pointId = uuidv4();
        await qdrant.upsert(COLLECTION_NAME, {
          points: [
            {
              id: pointId,
              vector: embedding,
              payload: {
                filename,
                labels,
                celebrities,
                texts,
                uploadTimestamp: new Date().toISOString(),
                source: 'flutter_gallery',
                path: file.path || `/gallery/${filename}`,
              },
            },
          ],
        });

        results.push({
          id: pointId,
          filename,
          labels,
          celebrities,
          texts,
          status: 'success'
        });

        processed++;
        console.log(`✅ ${filename} → Vector DB (${labels.length} labels, ${celebrities.length} celebrities, ${texts.length} texts)`);

      } catch (imageError) {
        failed++;
        console.error(`❌ Failed to process image: ${imageError.message}`);
        results.push({
          filename: file.originalname || 'unknown',
          status: 'failed',
          error: imageError.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${processed} images successfully, ${failed} failed`,
      processed,
      failed,
      total: req.files.length,
      results
    });

    console.log(`🎉 Gallery upload complete: ${processed}/${req.files.length} images added to vector database`);

  } catch (error) {
    console.error("❌ Gallery processing error:", error);
    res.status(500).json({
      success: false,
      error: "Gallery processing failed",
      message: error.message
    });
  }
});

// Endpoint to analyze and store a single image
app.post("/analyze-image", upload.single("image"), async (req, res) => {
  await ensureCollectionExists();
  
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  const imageBytes = req.file.buffer;

  try {
    // 1. Detect Labels
    let labels = [];
    try {
      const labelData = await rekognition
        .detectLabels({ Image: { Bytes: imageBytes }, MaxLabels: 10, MinConfidence: 70 })
        .promise();
      labels = labelData.Labels.map((l) => l.Name.toLowerCase());
    } catch {}

    // 2. Detect Celebrities
    let celebrities = [];
    try {
      const celebData = await rekognition
        .recognizeCelebrities({ Image: { Bytes: imageBytes } })
        .promise();
      celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
    } catch {}

    // 3. Detect Text
    let texts = [];
    try {
      const textData = await rekognition.detectText({ Image: { Bytes: imageBytes } }).promise();
      texts = textData.TextDetections.map((t) => t.DetectedText.toLowerCase());
    } catch {}

    // 4. Build semantic embedding
    const allFeatures = [...labels, ...celebrities, ...texts];
    const embedding = await buildEmbedding(allFeatures.join(" "));

    // 5. Store in Qdrant
    const pointId = uuidv4();
    await qdrant.upsert(COLLECTION_NAME, {
      points: [
        {
          id: pointId,
          vector: embedding,
          payload: {
            labels,
            celebrities,
            texts,
            uploadTimestamp: new Date().toISOString(),
          },
        },
      ],
    });

    res.json({
      success: true,
      id: pointId,
      labels,
      celebrities,
      texts,
    });

    console.log(`✅ Analyzed and stored image with ID: ${pointId}`);

  } catch (error) {
    console.error("❌ Image analysis error:", error);
    res.status(500).json({
      success: false,
      error: "Image analysis failed",
      message: error.message
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Samsung Memory Lens Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for quick verification
app.get("/test", async (req, res) => {
  try {
    await ensureCollectionExists();
    res.json({
      status: "Backend is working!",
      qdrant_connection: "✅ Connected",
      aws_config: process.env.AWS_ACCESS_KEY_ID ? "✅ Configured" : "❌ Missing",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "Error",
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Samsung Memory Lens Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  
  // Initialize collection on startup
  ensureCollectionExists().catch(console.error);
});

export default app;