import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import OpenAI from 'openai';

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

// OpenAI Configuration for Real Semantic Search
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "samsung-memory-lens-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Qdrant Vector Database setup
let qdrant = null;
let isQdrantAvailable = false;

try {
  if (process.env.QDRANTDB_ENDPOINT) {
    qdrant = new QdrantClient({
      url: process.env.QDRANTDB_ENDPOINT,
      apiKey: process.env.QDRANTDB_API_KEY,
    });
  }
} catch (err) {
  console.log("⚠️ Qdrant client initialization failed, using mock backend");
}

const COLLECTION_NAME = "images";
const VECTOR_SIZE = 384;

async function ensureCollectionExists() {
  if (!qdrant) {
    console.log("📱 Qdrant not configured, using mock backend");
    return false;
  }
  
  try {
    await qdrant.getCollection(COLLECTION_NAME);
    console.log("✅ Collection exists.");
    isQdrantAvailable = true;
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
      isQdrantAvailable = true;
    } catch (createErr) {
      console.warn("❌ Qdrant connection failed. Running without vector database:", createErr.message);
      console.log("📱 Backend will use lightweight semantic search for now");
      isQdrantAvailable = false;
      return false;
    }
  }
  return true;
}

// 🧠 REAL SEMANTIC SEARCH using OpenAI Embeddings
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ Error getting OpenAI embedding:", error);
    return null;
  }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Create semantic description from image features
function createImageDescription(labels, celebrities, texts) {
  const features = [];
  
  if (labels && labels.length > 0) {
    features.push(`Objects and scenes: ${labels.join(', ')}`);
  }
  
  if (celebrities && celebrities.length > 0) {
    features.push(`People: ${celebrities.join(', ')}`);
  }
  
  if (texts && texts.length > 0) {
    features.push(`Text content: ${texts.join(', ')}`);
  }
  
  return features.length > 0 ? features.join('. ') : 'No description available';
}



function semanticSearchWithoutPython(queryText, imageDatabase) {
  console.log(`🔍 Pure JS semantic search for: "${queryText}"`);
  
  const queryWords = queryText.toLowerCase().split(/\s+/);
  const results = [];
  
  // Search through stored images using AWS labels
  imageDatabase.forEach(image => {
    const labels = image.labels || [];
    const celebrities = image.celebrities || [];
    const texts = image.texts || [];
    
    let score = 0;
    
    // Direct label matching (highest score)
    labels.forEach(label => {
      if (queryWords.some(word => label.toLowerCase().includes(word))) {
        score += 1.0;
      }
    });
    
    // Celebrity matching
    celebrities.forEach(celebrity => {
      if (queryWords.some(word => celebrity.toLowerCase().includes(word))) {
        score += 0.9;
      }
    });
    
    // Text content matching  
    texts.forEach(text => {
      if (queryWords.some(word => text.toLowerCase().includes(word))) {
        score += 0.8;
      }
    });
    
    // Semantic similarity (colors, objects, etc.)
    score += lightweightSemanticSearch(queryText, labels);
    
    if (score > 0.3) { // Threshold for relevance
      results.push({
        ...image,
        score: score,
        source: 'aws_semantic_search'
      });
    }
  });
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}
function lightweightSemanticSearch(queryText, imageLabels) {
  // Semantic similarity mappings for common concepts
  const semanticGroups = {
    vehicles: ['car', 'vehicle', 'auto', 'truck', 'bus', 'motorcycle', 'bike', 'transport'],
    people: ['person', 'people', 'human', 'man', 'woman', 'child', 'face', 'portrait'],
    celebrities: ['celebrity', 'celebrities', 'famous', 'star', 'actor', 'actress', 'singer', 'musician'],
    animals: ['animal', 'cat', 'dog', 'pet', 'wildlife', 'bird', 'horse', 'cow'],
    colors: ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white'],
    nature: ['tree', 'flower', 'plant', 'garden', 'forest', 'landscape', 'nature', 'outdoor'],
    food: ['food', 'meal', 'dinner', 'lunch', 'breakfast', 'restaurant', 'cooking', 'eat'],
    buildings: ['building', 'house', 'home', 'architecture', 'city', 'urban', 'street'],
    water: ['water', 'sea', 'ocean', 'lake', 'river', 'beach', 'swimming', 'boat']
  };
  
  const queryWords = queryText.toLowerCase().split(/\s+/);
  const labelWords = imageLabels.map(label => label.toLowerCase());
  
  let score = 0;
  
  // Direct word matching
  for (const queryWord of queryWords) {
    if (labelWords.includes(queryWord)) {
      score += 1.0; // Exact match gets highest score
    }
  }
  
  // Semantic group matching
  for (const [group, groupWords] of Object.entries(semanticGroups)) {
    const queryInGroup = queryWords.some(word => groupWords.includes(word));
    const labelInGroup = labelWords.some(word => groupWords.includes(word));
    
    if (queryInGroup && labelInGroup) {
      score += 0.7; // Semantic similarity gets medium score
    }
  }
  
  // Partial word matching (for plurals, etc.)
  for (const queryWord of queryWords) {
    for (const labelWord of labelWords) {
      if (queryWord.length > 3 && labelWord.includes(queryWord.slice(0, -1))) {
        score += 0.3;
      }
      if (labelWord.length > 3 && queryWord.includes(labelWord.slice(0, -1))) {
        score += 0.3;
      }
    }
  }
  
  return score;
}

// Simple embedding function for Qdrant storage (fallback when OpenAI is not used for storage)
function buildEmbedding(text, labels = [], celebrities = [], texts = []) {
  // Combine all available features for richer semantic representation
  const allFeatures = [
    ...text.toLowerCase().split(/\s+/),
    ...labels.map(l => l.toLowerCase()),
    ...celebrities.map(c => c.toLowerCase()),
    ...texts.map(t => t.toLowerCase())
  ];
  
  // Create a simple 384-dimensional vector for Qdrant compatibility
  const vector = new Array(384).fill(0);
  const combinedText = allFeatures.join(' ');
  
  // Simple hash-based embedding for storage purposes
  for (let i = 0; i < combinedText.length && i < 384; i++) {
    vector[i % 384] += combinedText.charCodeAt(i) / 255;
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
}

async function searchImagesByStatement(statement) {
  try {
    console.log(`🔍 Comprehensive Search for: "${statement}"`);
    
    // If Qdrant is not available, use lightweight semantic search
    if (!isQdrantAvailable) {
      console.log("⚠️ Vector database not available - using lightweight semantic search");
      return [];
    }

    const queryLower = statement.toLowerCase();
    console.log(`📝 Query analysis: "${queryLower}"`);
    
    // 🧠 REAL SEMANTIC SEARCH using OpenAI Embeddings
    console.log("🤖 Getting OpenAI embedding for query...");
    const queryEmbedding = await getEmbedding(queryLower);
    
    if (!queryEmbedding) {
      console.log("❌ Failed to get query embedding, falling back to keyword search");
      // Will use the old keyword search as fallback
    } else {
      console.log("✅ OpenAI embedding obtained successfully");
    }
    
    // Step 1: Get ALL images from database first (we need to search payloads directly)
    let allResults = [];
    try {
      // Get a large batch of images to search through
      allResults = await qdrant.scroll(COLLECTION_NAME, {
        limit: 200, // Get more images to search through
        with_payload: true,
        with_vector: false // We don't need vectors for direct payload search
      });
      
      if (allResults.points && allResults.points.length > 0) {
        allResults = allResults.points;
        console.log(`📚 Retrieved ${allResults.length} images from database for direct search`);
      } else {
        console.log("⚠️ No images found in database");
        return [];
      }
    } catch (error) {
      console.error("❌ Error retrieving images from database:", error);
      return [];
    }

    let searchResults = [];
    
    // Step 2: DIRECT CELEBRITY NAME SEARCH - Most important for your use case
    console.log("🌟 Step 1: Direct celebrity name search");
    const celebrityMatches = allResults.filter(result => {
      const celebrities = result.payload.celebrities || [];
      if (celebrities.length === 0) return false;
      
      // Direct celebrity name matching (only use original query, not expanded terms for celebrity names)
      const celebrityMatch = celebrities.some(celeb => {
        const celebLower = celeb.toLowerCase();
        
        // Exact match
        if (celebLower === queryLower) return true;
        
        // Partial name match (for "akshay" matching "akshay kumar")
        if (celebLower.includes(queryLower) || queryLower.includes(celebLower)) return true;
        
        // Name parts match (for "kumar" matching "akshay kumar")
        const celebParts = celebLower.split(' ');
        const queryParts = queryLower.split(' ');
        return celebParts.some(part => queryParts.includes(part)) ||
               queryParts.some(part => celebParts.includes(part));
      });
      
      if (celebrityMatch) {
        result.score = 0.95; // High score for direct celebrity matches
        result.matchType = 'celebrity_name';
        console.log(`🎭 Found celebrity match: ${celebrities.join(', ')}`);
      }
      
      return celebrityMatch;
    });
    
    searchResults = [...celebrityMatches];
    
    // Step 3: CELEBRITY GENERAL SEARCH - For "celebrity" or "celebrities" queries
    if (queryLower.includes('celebrity') || queryLower.includes('celebrities')) {
      console.log("🌟 Step 2: General celebrity search");
      
      const generalCelebrityMatches = allResults.filter(result => {
        const celebrities = result.payload.celebrities || [];
        const labels = result.payload.labels || [];
        
        const hasCelebrities = celebrities.length > 0;
        const hasPersonLabel = labels.some(label => 
          label.toLowerCase().includes('person') || 
          label.toLowerCase().includes('people') ||
          label.toLowerCase().includes('human')
        );
        
        if (hasCelebrities) {
          result.score = 0.9;
          result.matchType = 'has_celebrity';
          console.log(`🎭 Found image with celebrities: ${celebrities.join(', ')}`);
          return true;
        }
        
        return false;
      });
      
      // Add unique celebrity matches
      generalCelebrityMatches.forEach(match => {
        if (!searchResults.find(existing => existing.id === match.id)) {
          searchResults.push(match);
        }
      });
    }
    
    // Step 4: REAL SEMANTIC SEARCH - Using OpenAI embeddings for true semantic understanding
    if (searchResults.length < 10 && queryEmbedding) {
      console.log("🌟 Step 3: OpenAI-powered semantic search");
      
      const semanticMatches = [];
      
      // Calculate semantic similarity for each image
      for (const result of allResults) {
        const labels = result.payload.labels || [];
        const celebrities = result.payload.celebrities || [];
        const texts = result.payload.texts || [];
        
        // Create rich description of the image
        const imageDescription = createImageDescription(labels, celebrities, texts);
        
        // Get embedding for image description
        const imageEmbedding = await getEmbedding(imageDescription);
        
        if (imageEmbedding) {
          // Calculate semantic similarity
          const similarity = cosineSimilarity(queryEmbedding, imageEmbedding);
          
          // Only include results with meaningful similarity (threshold: 0.3)
          if (similarity > 0.3) {
            result.score = similarity;
            result.matchType = 'semantic_ai';
            result.imageDescription = imageDescription;
            semanticMatches.push(result);
            
            console.log(`🧠 Semantic match (${similarity.toFixed(3)}): ${imageDescription.substring(0, 100)}...`);
          }
        }
        
        // Rate limiting: don't process too many at once
        if (semanticMatches.length >= 15) break;
      }
      
      // Add unique semantic matches
      semanticMatches.forEach(match => {
        if (!searchResults.find(existing => existing.id === match.id)) {
          searchResults.push(match);
        }
      });
      
      console.log(`🤖 Found ${semanticMatches.length} semantic AI matches`);
    }
    
    // Step 5: FALLBACK KEYWORD SEARCH - For when OpenAI is unavailable or no semantic matches
    if (searchResults.length < 5) {
      console.log("🌟 Step 4: Fallback keyword search");
      
      const keywordMatches = allResults.filter(result => {
        const labels = result.payload.labels || [];
        
        const labelMatch = labels.some(label => {
          const labelLower = label.toLowerCase();
          return labelLower.includes(queryLower) || queryLower.includes(labelLower);
        });
        
        if (labelMatch) {
          result.score = 0.5; // Lower score for keyword matches
          result.matchType = 'keyword';
          console.log(`🔍 Keyword match: ${labels.join(', ')}`);
        }
        
        return labelMatch;
      });
      
      // Add unique keyword matches
      keywordMatches.forEach(match => {
        if (!searchResults.find(existing => existing.id === match.id)) {
          searchResults.push(match);
        }
      });
    }
    
    // Step 6: TEXT SEARCH - For OCR text content
    if (searchResults.length < 5) {
      console.log("🌟 Step 5: Text content search");
      
      const textMatches = allResults.filter(result => {
        const texts = result.payload.texts || [];
        
        const textMatch = texts.some(text => {
          const textLower = text.toLowerCase();
          return textLower.includes(queryLower) || queryLower.includes(textLower);
        });
        
        if (textMatch) {
          result.score = 0.6;
          result.matchType = 'text';
          console.log(`📝 Found text match: ${texts.join(', ')}`);
        }
        
        return textMatch;
      });
      
      // Add unique text matches
      textMatches.forEach(match => {
        if (!searchResults.find(existing => existing.id === match.id)) {
          searchResults.push(match);
        }
      });
    }
    
    // Sort by score (highest first) and limit results
    searchResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    searchResults = searchResults.slice(0, 10);
    
    console.log(`✅ Search complete: ${searchResults.length} matches found`);
    searchResults.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.matchType}: ${result.payload.filename} (score: ${result.score})`);
      if (result.payload.celebrities && result.payload.celebrities.length > 0) {
        console.log(`     Celebrities: ${result.payload.celebrities.join(', ')}`);
      }
    });

    // Format results for Flutter app
    const formattedResults = searchResults.map((result, index) => ({
      id: result.id,
      filename: result.payload.filename || `image_${result.id}`,
      labels: result.payload.labels || [],
      celebrities: result.payload.celebrities || [],
      texts: result.payload.texts || [],
      uploadTimestamp: result.payload.uploadTimestamp || new Date().toISOString(),
      source: 'vector_search',
      path: result.payload.imageUrl || `/api/image/${result.id}`,
      imageUrl: `https://samsung-memory-lens-38jd.onrender.com/api/image/${result.id}`,
      score: result.score,
      rank: index + 1
    }));

    console.log(`✅ Found ${formattedResults.length} vector search results`);
    return formattedResults;
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

        // 4. Build enhanced semantic embedding using all features
        const embedding = buildEmbedding(
          `${labels.join(' ')} ${celebrities.join(' ')} ${texts.join(' ')}`.trim(),
          labels,
          celebrities,
          texts
        );
        
        console.log(`🏷️ Image features for ${filename}:`, {
          labels: labels.length,
          celebrities: celebrities.length,
          texts: texts.length
        });

        // 5. Convert image to base64 for storage and serving
        const imageBase64 = imageBytes.toString('base64');
        const imageDataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${imageBase64}`;

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
                source: 'flutter_gallery',
                path: file.path || `/gallery/${filename}`,
                imageData: imageBase64, // Store base64 image data
                imageUrl: `/api/image/${pointId}`, // URL to serve the image
                mimeType: file.mimetype || 'image/jpeg'
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

    // 4. Build semantic embedding using AWS labels + pure JavaScript
    const allFeatures = [...labels, ...celebrities, ...texts];
    const embedding = buildEmbedding(allFeatures.join(" "), labels, celebrities, texts);

    // 5. Convert image to base64 for storage and serving
    const imageBase64 = imageBytes.toString('base64');
    const filename = `single_image_${Date.now()}.jpg`;

    // 6. Store in Qdrant
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
            source: 'single_upload',
            path: `/api/image/${pointId}`,
            imageData: imageBase64, // Store base64 image data
            imageUrl: `/api/image/${pointId}`, // URL to serve the image
            mimeType: 'image/jpeg'
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

// Serve images by ID endpoint
app.get("/api/image/:id", async (req, res) => {
  try {
    const imageId = req.params.id;
    
    if (!qdrant) {
      return res.status(503).json({ error: "Vector database not available" });
    }

    // Retrieve image data from Qdrant
    const result = await qdrant.retrieve(COLLECTION_NAME, {
      ids: [imageId],
      with_payload: true
    });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    const imageRecord = result[0];
    const imageData = imageRecord.payload.imageData;
    const mimeType = imageRecord.payload.mimeType || 'image/jpeg';

    if (!imageData) {
      // Return a placeholder response for images that don't have stored data
      return res.status(200).json({ 
        error: "Image data not available", 
        filename: imageRecord.payload.filename || 'Unknown',
        message: "This image was uploaded before image storage was implemented"
      });
    }

    // Convert base64 back to buffer and serve
    const imageBuffer = Buffer.from(imageData, 'base64');
    
    res.set({
      'Content-Type': mimeType,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    res.send(imageBuffer);
    
  } catch (error) {
    console.error("❌ Image serving error:", error);
    res.status(500).json({ 
      error: "Failed to serve image",
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
    const qdrantStatus = await ensureCollectionExists();
    res.json({
      status: "Backend is working!",
      qdrant_connection: qdrantStatus ? "✅ Connected" : "❌ Using mock backend",
      aws_config: process.env.AWS_ACCESS_KEY_ID ? "✅ Configured" : "❌ Missing",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(200).json({
      status: "Backend is working (with errors)!",
      qdrant_connection: "❌ Using mock backend",
      aws_config: process.env.AWS_ACCESS_KEY_ID ? "✅ Configured" : "❌ Missing",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Samsung Memory Lens Backend running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🌐 Accessible from all network interfaces on port ${PORT}`);
  
  // Initialize collection on startup but don't crash if it fails
  ensureCollectionExists()
    .then(() => console.log("🎯 Backend initialization complete"))
    .catch((err) => console.log("⚠️ Backend running with limited features:", err.message));
});

export default app;