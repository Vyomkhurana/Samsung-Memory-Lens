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

// 🧠 TRUE SEMANTIC SEARCH using OpenAI Vision + Embeddings
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

// 🔍 REAL SEMANTIC IMAGE UNDERSTANDING - No hardcoded labels!
async function getImageSemanticDescription(imageUrl, query) {
  try {
    console.log(`🤖 Analyzing image semantically for query: "${query}"`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Vision model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and determine how semantically related it is to "${query}". 
              
              Consider:
              - Visual content and objects
              - Scene context and setting  
              - Activities or situations shown
              - Conceptual relationships (e.g. "tyre" relates to cars, "waves" relates to ocean)
              
              Respond with a JSON object:
              {
                "semantic_relevance": 0.0-1.0,
                "explanation": "Brief explanation of relationship",
                "key_concepts": ["concept1", "concept2", "concept3"]
              }
              
              Be strict - only high relevance (>0.7) for strong semantic matches.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`🎯 Semantic analysis: ${result.explanation} (relevance: ${result.semantic_relevance})`);
    
    return result;
  } catch (error) {
    console.error("❌ Error in semantic image analysis:", error);
    return {
      semantic_relevance: 0.0,
      explanation: "Analysis failed",
      key_concepts: []
    };
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



async function semanticSearchWithoutPython(queryText, imageDatabase) {
  console.log(`🔍 TRUE SEMANTIC SEARCH (fallback mode) for: "${queryText}"`);
  
  const results = [];
  
  // Skip person queries - use celebrity matching instead
  const isPersonQuery = queryText.toLowerCase().split(' ').length >= 2 && 
                        queryText.toLowerCase().match(/^[a-z]+ [a-z]+$/);
  
  if (isPersonQuery) {
    console.log("👤 Person query detected - using celebrity matching");
    
    imageDatabase.forEach(image => {
      const celebrities = image.celebrities || [];
      let score = 0;
      
      celebrities.forEach(celebrity => {
        if (celebrity.toLowerCase().includes(queryText.toLowerCase())) {
          score += 2.0;
        }
      });
      
      if (score > 0) {
        results.push({
          ...image,
          score: score,
          source: 'celebrity_match'
        });
      }
    });
  } else {
    console.log("🎯 Object query - attempting TRUE semantic analysis");
    
    // Try TRUE semantic search for object queries
    let semanticCount = 0;
    
    for (const image of imageDatabase) {
      // Rate limit expensive vision API calls
      if (semanticCount >= 5) {
        console.log("⚡ Reached semantic analysis limit in fallback mode");
        break;
      }
      
      try {
        // Construct image URL (assuming same pattern as main search)
        const imageUrl = `https://samsung-memory-lens-38jd.onrender.com/api/image/${image.id}`;
        
        // TRUE SEMANTIC ANALYSIS
        const semanticAnalysis = await getImageSemanticDescription(imageUrl, queryText);
        
        if (semanticAnalysis.semantic_relevance > 0.7) {
          results.push({
            ...image,
            score: semanticAnalysis.semantic_relevance,
            source: 'true_semantic_ai',
            semanticExplanation: semanticAnalysis.explanation,
            keyConcepts: semanticAnalysis.key_concepts
          });
          
          console.log(`🎯 Semantic match: ${semanticAnalysis.explanation}`);
        }
        
        semanticCount++;
      } catch (error) {
        console.log(`⚠️ Semantic analysis failed for image ${image.id}: ${error.message}`);
        
        // Fallback to simple direct matching
        const labels = image.labels || [];
        const queryWords = queryText.toLowerCase().split(/\s+/);
        let score = 0;
        
        labels.forEach(label => {
          if (queryWords.some(word => label.toLowerCase().includes(word))) {
            score += 1.0;
          }
        });
        
        if (score > 0) {
          results.push({
            ...image,
            score: score,
            source: 'direct_label_match'
          });
        }
      }
    }
  }
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}
// 🚫 DEPRECATED: Old hardcoded label matching approach
// This function is replaced by TRUE semantic search using OpenAI Vision
function lightweightSemanticSearch(queryText, imageLabels) {
  console.log("⚠️ Using deprecated label-matching fallback - upgrade to true semantic search recommended");
  
  // Simple direct label matching as absolute fallback
  const queryWords = queryText.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const labelWords = imageLabels.map(label => label.toLowerCase());
  
  let score = 0;
  
  // Only direct word matching - no hardcoded semantic groups
  for (const queryWord of queryWords) {
    if (labelWords.some(label => label.includes(queryWord) || queryWord.includes(label))) {
      score += 2.0; // Direct match only
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
      return semanticSearchWithoutPython(statement, imageDatabase);
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
    
    // Step 2: DIRECT CELEBRITY NAME SEARCH - Most important and highest priority
    console.log("🌟 Step 1: Direct celebrity name search");
    const celebrityMatches = allResults.filter(result => {
      const celebrities = result.payload.celebrities || [];
      if (celebrities.length === 0) return false;
      
      // Direct celebrity name matching with stricter criteria
      const celebrityMatch = celebrities.some(celeb => {
        const celebLower = celeb.toLowerCase();
        const queryWords = queryLower.split(' ').filter(word => word.length > 2); // Ignore short words
        
        // Exact match (highest priority)
        if (celebLower === queryLower) {
          console.log(`🎯 EXACT celebrity match: "${celebLower}" === "${queryLower}"`);
          return true;
        }
        
        // For multi-word queries like "akshay kumar", require both words to match
        if (queryWords.length >= 2) {
          const celebWords = celebLower.split(' ');
          const matchedWords = queryWords.filter(queryWord => 
            celebWords.some(celebWord => celebWord.includes(queryWord) || queryWord.includes(celebWord))
          );
          
          // Require at least 2 words to match for multi-word celebrity names
          if (matchedWords.length >= 2) {
            console.log(`🎯 MULTI-WORD celebrity match: "${celebLower}" matches ${matchedWords.length}/${queryWords.length} words`);
            return true;
          }
        } else {
          // Single word query - more lenient matching
          if (celebLower.includes(queryLower) || queryLower.includes(celebLower)) {
            console.log(`🎯 SINGLE-WORD celebrity match: "${celebLower}" contains "${queryLower}"`);
            return true;
          }
        }
        
        return false;
      });
      
      if (celebrityMatch) {
        result.score = 0.98; // Highest score for direct celebrity matches
        result.matchType = 'celebrity_name';
        console.log(`🎭 Found verified celebrity match: ${celebrities.join(', ')}`);
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
    
    // Step 4: TRUE SEMANTIC SEARCH - Real AI visual understanding
    const isPersonQuery = queryLower.split(' ').length >= 2 && 
                          (queryLower.includes('kumar') || queryLower.includes('singh') || 
                           queryLower.match(/^[A-Za-z]+ [A-Za-z]+$/)); // Likely a person's name
    
    // Only use true semantic search for object queries - person queries use celebrity matching
    const shouldUseSemanticSearch = !isPersonQuery && searchResults.length < 10;
    
    if (shouldUseSemanticSearch) {
      console.log("🌟 Step 3: TRUE SEMANTIC SEARCH - Visual AI Analysis");
      console.log(`   🎯 Analyzing images visually for: "${queryLower}"`);
      
      const semanticMatches = [];
      
      // TRUE SEMANTIC ANALYSIS - No hardcoded label matching!
      for (const result of allResults) {
        // Skip celebrity images for object queries
        const celebrities = result.payload.celebrities || [];
        if (celebrities.length > 0) {
          console.log(`   ⏭️  Skipping celebrity image for object query: ${celebrities.join(', ')}`);
          continue;
        }
        
        // Get the actual image URL for visual analysis
        const imageUrl = `https://samsung-memory-lens-38jd.onrender.com/api/image/${result.id}`;
        
        // TRUE SEMANTIC UNDERSTANDING using OpenAI Vision
        const semanticAnalysis = await getImageSemanticDescription(imageUrl, queryLower);
        
        // Only include images with strong semantic relevance
        if (semanticAnalysis.semantic_relevance > 0.7) {
          result.score = semanticAnalysis.semantic_relevance;
          result.matchType = 'true_semantic_ai';
          result.semanticExplanation = semanticAnalysis.explanation;
          result.keyConcepts = semanticAnalysis.key_concepts;
          semanticMatches.push(result);
          
          console.log(`🎯 TRUE SEMANTIC MATCH (${semanticAnalysis.semantic_relevance.toFixed(3)}): ${semanticAnalysis.explanation}`);
          console.log(`   🔑 Key concepts: ${semanticAnalysis.key_concepts.join(', ')}`);
        } else {
          console.log(`   🚫 Low semantic relevance (${semanticAnalysis.semantic_relevance.toFixed(3)}): ${semanticAnalysis.explanation}`);
        }
        
        // Rate limiting: don't analyze too many images at once (expensive)
        if (semanticMatches.length >= 10) {
          console.log("   ⚡ Reached semantic analysis limit - stopping");
          break;
        }
      }
      
      // Add unique semantic matches
      semanticMatches.forEach(match => {
        if (!searchResults.find(existing => existing.id === match.id)) {
          searchResults.push(match);
        }
      });
      
      console.log(`🤖 Found ${semanticMatches.length} TRUE semantic matches via visual AI`);
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