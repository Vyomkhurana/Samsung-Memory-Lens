import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const upload = multer();
app.use(express.json());

// 🔧 AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const rekognition = new AWS.Rekognition();

// 🔧 OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔧 Qdrant Configuration
const qdrant = new QdrantClient({ 
  url: process.env.QDRANTDB_ENDPOINT, 
  apiKey: process.env.QDRANTDB_API_KEY 
});
const COLLECTION_NAME = "samsung_memory_lens";
const VECTOR_SIZE = 1536; // OpenAI text-embedding-3-small

// 🏗️ Initialize Vector Database
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
      console.error("❌ Failed to create collection:", createErr);
      throw createErr;
    }
  }
}

// 🧠 Generate OpenAI Embedding
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ OpenAI embedding failed:", error);
    return null;
  }
}

// 📸 Process Single Image with AWS Rekognition
async function processImageBuffer(imageBytes, filename) {
  console.log(`🔄 Processing: ${filename}`);

  // 1. AWS Rekognition - Extract Labels
  let labels = [];
  try {
    const labelData = await rekognition
      .detectLabels({ 
        Image: { Bytes: imageBytes }, 
        MaxLabels: 10, 
        MinConfidence: 70 
      })
      .promise();
    labels = labelData.Labels.map((l) => l.Name.toLowerCase());
  } catch (error) {
    console.warn(`⚠️ Label detection failed for ${filename}:`, error.message);
  }

  // 2. AWS Rekognition - Extract Celebrities
  let celebrities = [];
  try {
    const celebData = await rekognition
      .recognizeCelebrities({ Image: { Bytes: imageBytes } })
      .promise();
    celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
  } catch (error) {
    console.warn(`⚠️ Celebrity detection failed for ${filename}:`, error.message);
  }

  // 3. AWS Rekognition - Extract Text
  let texts = [];
  try {
    const textData = await rekognition.detectText({ Image: { Bytes: imageBytes } }).promise();
    texts = textData.TextDetections.map((t) => t.DetectedText.toLowerCase());
  } catch (error) {
    console.warn(`⚠️ Text detection failed for ${filename}:`, error.message);
  }

  // 4. Create Semantic Description
  const allFeatures = [...labels, ...celebrities, ...texts];
  const semanticText = allFeatures.join(" ");
  
  console.log(`🏷️ Features for ${filename}: ${allFeatures.length} total`);
  console.log(`📝 Semantic text: ${semanticText}`);

  // 5. Generate OpenAI Embedding
  const embedding = await getEmbedding(semanticText);
  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // 6. Store in Qdrant Vector Database
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
        },
      },
    ],
  });

  console.log(`✅ ${filename} → Vector DB stored with ID: ${pointId}`);

  return {
    id: pointId,
    filename,
    labels,
    celebrities,
    texts,
  };
}

// 🔍 Semantic Search Function
async function searchImagesByStatement(statement, topK = 10) {
  console.log(`🔍 Searching for: "${statement}"`);

  // Generate embedding for search query
  const statementEmbedding = await getEmbedding(statement);
  if (!statementEmbedding) {
    console.log("❌ Failed to generate search embedding");
    return [];
  }

  // Search in vector database
  const result = await qdrant.search(COLLECTION_NAME, {
    vector: statementEmbedding,
    limit: topK,
    with_payload: true,
  });

  if (result.length > 0) {
    console.log(`🎯 Found ${result.length} matches`);
    
    return result.map((item, index) => ({
      id: item.id,
      filename: item.payload?.filename || `image_${item.id}`,
      labels: item.payload?.labels || [],
      celebrities: item.payload?.celebrities || [],
      texts: item.payload?.texts || [],
      uploadTimestamp: item.payload?.uploadTimestamp || new Date().toISOString(),
      score: item.score,
      rank: index + 1,
      imageUrl: `https://samsung-memory-lens-38jd.onrender.com/api/image/${item.id}`,
    }));
  }

  console.log("❌ No matches found");
  return [];
}

// 📤 Upload Images Endpoint
app.post("/add-gallery-images", upload.array("images", 50), async (req, res) => {
  try {
    await ensureCollectionExists();
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    console.log(`📸 Processing ${req.files.length} images from Flutter gallery...`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const file of req.files) {
      try {
        const result = await processImageBuffer(file.buffer, file.originalname);
        results.push(result);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to process ${file.originalname}:`, error);
        failCount++;
      }
    }

    console.log(`🎉 Gallery upload complete: ${successCount}/${req.files.length} images added to vector database`);

    res.json({
      success: true,
      message: `Processed ${successCount} images successfully, ${failCount} failed`,
      totalProcessed: successCount,
      totalFailed: failCount,
      results: results.slice(0, 5), // Return first 5 results
    });

  } catch (error) {
    console.error("❌ Gallery upload failed:", error);
    res.status(500).json({
      success: false,
      error: "Gallery upload failed",
      details: error.message,
    });
  }
});

// 🔍 Search Images Endpoint
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
        timestamp: new Date().toISOString()
      });
      
      console.log(`❌ No matches found for: "${text}"`);
    }

  } catch (error) {
    console.error("❌ Search failed:", error);
    res.status(500).json({
      success: false,
      error: "Search failed",
      details: error.message,
    });
  }
});

// 🖼️ Serve Images by ID
app.get("/api/image/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get image from Qdrant
    const result = await qdrant.retrieve(COLLECTION_NAME, { ids: [id], with_payload: true });
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    // For now, return a placeholder response
    // In a real app, you'd store and serve the actual image files
    res.json({
      id,
      filename: result[0].payload?.filename,
      message: "Image endpoint - implement actual image serving based on your storage solution"
    });

  } catch (error) {
    console.error("❌ Image retrieval failed:", error);
    res.status(500).json({ error: "Image retrieval failed" });
  }
});

// ❤️ Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "Samsung Memory Lens - Clean Semantic Search"
  });
});

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Samsung Memory Lens Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Accessible from all network interfaces on port ${PORT}`);
  
  try {
    await ensureCollectionExists();
    console.log("🎯 Backend initialization complete");
  } catch (error) {
    console.error("❌ Backend initialization failed:", error);
  }
});