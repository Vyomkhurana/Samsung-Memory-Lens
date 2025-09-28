import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import OpenAI from "openai";
import session from "express-session";

dotenv.config();

const app = express();
const upload = multer();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const rekognition = new AWS.Rekognition();

app.use(
  session({
    secret: "some secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Qdrant Configuration
const qdrant = new QdrantClient({ 
  url: process.env.QDRANTDB_ENDPOINT, 
  apiKey: process.env.QDRANTDB_API_KEY 
});
const COLLECTION_NAME = "samsung_voice_search";
const VECTOR_SIZE = 1536; // OpenAI embeddings optimized for voice search

// Initialize Vector Database
async function ensureCollectionExists() {
  try {
    await qdrant.getCollection(COLLECTION_NAME);
    console.log("Collection exists.");
  } catch (err) {
    console.log("Collection does not exist. Creating...");
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log("Collection created.");
  }
}

// Build embedding using Python SentenceTransformer
// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function buildEmbedding(text) {
  try {
    console.log(`Generating embedding for: "${text}"`);
    
    if (!text || text.trim().length === 0) {
      console.log("Empty text, using generic embedding");
      text = "generic image content";
    }
    
    // Create enhanced text for better voice search matching
    const enhancedText = enhanceTextForVoiceSearch(text);
    console.log(`Enhanced text: "${enhancedText}"`);
    
    // Use OpenAI embeddings optimized for semantic search
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: enhancedText,
    });
    
    const embedding = response.data[0].embedding;
    console.log(`Generated ${embedding.length}D embedding successfully`);
    return embedding;
    
  } catch (error) {
    console.error("OpenAI embedding failed:", error);
    
    // Final fallback: create a simple hash-based embedding
    console.log("Using simple hash-based embedding as final fallback");
    return createSimpleEmbedding(text || "generic content");
  }
}

// Enhance search query for voice commands
function enhanceSearchQuery(query) {
  let enhanced = query.toLowerCase().trim();
  
  // Handle common voice search patterns
  if (enhanced.includes('car') || enhanced.includes('cars')) {
    enhanced = 'car automobile vehicle sedan transportation wheels tires motor driving';
  } else if (enhanced.includes('house') || enhanced.includes('home')) {
    enhanced = 'house home building residence dwelling property architecture';
  } else if (enhanced.includes('metal body')) {
    enhanced = 'metal metallic chrome steel aluminum shiny surface car automobile vehicle';
  } else if (enhanced.includes('person') || enhanced.includes('people')) {
    enhanced = 'person human individual people face portrait man woman';
  }
  
  return enhanced;
}

// Enhance text for better voice search matching
function enhanceTextForVoiceSearch(text) {
  // Add synonyms and related terms for common voice search queries
  let enhanced = text.toLowerCase();
  
  // Car-related enhancements
  if (enhanced.includes('car') || enhanced.includes('sedan') || enhanced.includes('vehicle')) {
    enhanced += ' automobile motor vehicle transportation wheels tires driving road';
  }
  
  // House-related enhancements
  if (enhanced.includes('house') || enhanced.includes('building') || enhanced.includes('home')) {
    enhanced += ' residence dwelling property architecture structure';
  }
  
  // Person-related enhancements
  if (enhanced.includes('person') || enhanced.includes('man') || enhanced.includes('woman')) {
    enhanced += ' human individual people face portrait';
  }
  
  // Metal-related enhancements for "metal body" searches
  if (enhanced.includes('metal')) {
    enhanced += ' metallic steel aluminum chrome shiny surface material';
  }
  
  return enhanced;
}

// Simple hash-based embedding fallback (384 dimensions)
function createSimpleEmbedding(text) {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(384).fill(0);
  
  // Simple hash function to distribute words across dimensions
  words.forEach((word, wordIndex) => {
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const dimension = (charCode + wordIndex * 17 + i * 7) % 384;
      embedding[dimension] += Math.sin(charCode + wordIndex) * 0.1;
    }
  });
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  console.log("Created 384D simple embedding");
  return embedding;
}

// Process Single Image Buffer with AWS Rekognition
async function processImageBuffer(imageBytes, filename) {
  console.log(`Processing: ${filename}`);

  // Validate image format and size
  if (!imageBytes || imageBytes.length === 0) {
    throw new Error("Empty image data");
  }
  
  // Check if it's a valid image format (JPEG, PNG, etc.)
  const isValidImage = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8 && imageBytes[2] === 0xFF; // JPEG
  const isPNG = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47; // PNG
  
  if (!isValidImage && !isPNG) {
    console.log(`Invalid image format for ${filename}, using fallback processing`);
    // Continue with fallback processing instead of failing
  }

  console.log(`Image info: ${filename} (${imageBytes.length} bytes)`);

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
    console.warn(`Label detection failed for ${filename}:`, error.message);
  }

  // 2. AWS Rekognition - Extract Celebrities
  let celebrities = [];
  try {
    const celebData = await rekognition
      .recognizeCelebrities({ Image: { Bytes: imageBytes } })
      .promise();
    celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
  } catch (error) {
    console.warn(`Celebrity detection failed for ${filename}:`, error.message);
  }

  // 3. AWS Rekognition - Extract Text
  let texts = [];
  try {
    const textData = await rekognition.detectText({ Image: { Bytes: imageBytes } }).promise();
    texts = textData.TextDetections.map((t) => t.DetectedText.toLowerCase());
  } catch (error) {
    console.warn(`Text detection failed for ${filename}:`, error.message);
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
          imageData: imageBytes.toString('base64'), // Store image data
        },
      },
    ],
  });

  console.log(`Stored vector for ${filename} with ID: ${pointId}`);

  return {
    id: pointId,
    filename,
    labels,
    celebrities,
    texts,
  };
}

// Search by voice statement with enhanced semantic matching
async function searchImagesByStatement(statement, topK = 10) {
  console.log(`Voice search for: "${statement}"`);
  
  // Enhance the search query for better voice matching
  const enhancedQuery = enhanceSearchQuery(statement);
  console.log(`Enhanced search query: "${enhancedQuery}"`);
  
  const statementEmbedding = await buildEmbedding(enhancedQuery);

  const result = await qdrant.search(COLLECTION_NAME, {
    vector: statementEmbedding,
    limit: topK * 2, // Get more results to filter
    with_payload: true,
  });

  if (result.length > 0) {
    console.log(`Found ${result.length} potential matches`);
    
    // Log all scores for debugging
    result.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.payload?.filename || 'unknown'} (score: ${item.score.toFixed(3)})`);
    });
    
    // Filter by confidence threshold for voice searches
    const VOICE_CONFIDENCE_THRESHOLD = 0.3; // Higher threshold for voice searches
    const highConfidenceResults = result.filter(item => item.score >= VOICE_CONFIDENCE_THRESHOLD);
    
    console.log(`After voice confidence filtering (${VOICE_CONFIDENCE_THRESHOLD}): ${highConfidenceResults.length} matches`);
    
    const finalResults = highConfidenceResults.length > 0 ? highConfidenceResults.slice(0, topK) : result.slice(0, 3);

    // Return all relevant images with their scores - Flutter compatible format
    return finalResults.map((item, index) => ({
      id: item.id,
      filename: item.payload?.filename || `image_${item.id}`,
      labels: item.payload?.labels || [],
      celebrities: item.payload?.celebrities || [],
      texts: item.payload?.texts || [],
      uploadTimestamp: item.payload?.uploadTimestamp || new Date().toISOString(),
      source: 'vector_search',
      path: item.payload?.imageUrl || `/api/image/${item.id}`,
      imageUrl: `https://samsung-memory-lens-38jd.onrender.com/api/image/${item.id}`,
      score: item.score,
      rank: index + 1,
      semanticReason: `Vector similarity match: ${(item.score * 100).toFixed(1)}%`
    }));
  }
  
  console.log("No matches found");
  return [];
}

// Upload Images Endpoint
app.post("/add-gallery-images", upload.array("images", 50), async (req, res) => {
  try {
    await ensureCollectionExists();
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    console.log(`Processing ${req.files.length} images from Flutter gallery...`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const file of req.files) {
      try {
        const result = await processImageBuffer(file.buffer, file.originalname);
        results.push(result);
        successCount++;
      } catch (error) {
        console.error(`Failed to process ${file.originalname}:`, error);
        failCount++;
      }
    }

    console.log(`Gallery upload complete: ${successCount}/${req.files.length} images added to vector database`);

    res.json({
      success: true,
      message: `Processed ${successCount} images successfully, ${failCount} failed`,
      totalProcessed: successCount,
      totalFailed: failCount,
      results: results.slice(0, 5), // Return first 5 results
    });

  } catch (error) {
    console.error("Gallery upload failed:", error);
    res.status(500).json({
      success: false,
      error: "Gallery upload failed",
      details: error.message,
    });
  }
});

// Search Images Endpoint
app.post("/search-images", async (req, res) => {
  try {
    const { text, timestamp, source } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        error: "No text provided",
        success: false 
      });
    }

    console.log(`Searching for: "${text}" from ${source || 'unknown'}`);

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
      
      console.log(`Found ${matchedImages.length} matching images for: "${text}"`);
    } else {
      res.json({
        success: true,
        query: text,
        results: [],
        count: 0,
        showSimilarResults: false,
        timestamp: new Date().toISOString()
      });
      
      console.log(`No matches found for: "${text}"`);
    }

  } catch (error) {
    console.error("Search failed:", error);
    res.status(500).json({
      success: false,
      error: "Search failed",
      details: error.message,
    });
  }
});

// Serve Images by ID
app.get("/api/image/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get image from Qdrant
    const result = await qdrant.retrieve(COLLECTION_NAME, { ids: [id], with_payload: true });
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    const imageData = result[0].payload?.imageData;
    if (!imageData) {
      return res.status(404).json({ error: "Image data not found" });
    }

    // Convert base64 back to buffer and serve as image
    const imageBuffer = Buffer.from(imageData, 'base64');
    
    // Set appropriate headers
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });
    
    res.send(imageBuffer);

  } catch (error) {
    console.error("Image retrieval failed:", error);
    res.status(500).json({ error: "Image retrieval failed" });
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "Samsung Memory Lens - Clean Semantic Search"
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Samsung Memory Lens Backend running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Accessible from all network interfaces on port ${PORT}`);
  
  try {
    await ensureCollectionExists();
    console.log("Backend initialization complete");
  } catch (error) {
    console.error("Backend initialization failed:", error);
  }
});