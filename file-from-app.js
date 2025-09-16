import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { PythonShell } from "python-shell";

dotenv.config();

const app = express();
const upload = multer();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const rekognition = new AWS.Rekognition();

const qdrant = new QdrantClient({ url: process.env.QDRANTDB_ENDPOINT, apiKey: process.env.QDRANTDB_API_KEY });
const COLLECTION_NAME = "images";
const VECTOR_SIZE = 384; // SentenceTransformer (all-MiniLM-L6-v2)

async function ensureCollectionExists() {
  try {
    await qdrant.getCollection(COLLECTION_NAME);
    console.log("✅ Collection exists.");
  } catch (err) {
    console.log("⚠️ Collection does not exist. Creating...");
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log("✅ Collection created.");
  }
}

// --- Build embedding (via Python) ---
async function buildEmbedding(text) {
  return new Promise((resolve, reject) => {
    let result = "";

    const pyshell = new PythonShell("embeddings.py", {
      mode: "text",
      pythonOptions: ["-u"],
      pythonPath: "C:\\Users\\gurum\\AppData\\Local\\Programs\\Python\\Python310\\python.exe",
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

// --- Endpoint to receive and process a single image ---
app.post("/analyze-image", upload.single("image"), async (req, res) => {
  await ensureCollectionExists();
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imageBytes = req.file.buffer;

  // 1. Labels
  let labels = [];
  try {
    const labelData = await rekognition
      .detectLabels({ Image: { Bytes: imageBytes }, MaxLabels: 10, MinConfidence: 70 })
      .promise();
    labels = labelData.Labels.map((l) => l.Name.toLowerCase());
  } catch {}

  // 2. Celebrities
  let celebrities = [];
  try {
    const celebData = await rekognition
      .recognizeCelebrities({ Image: { Bytes: imageBytes } })
      .promise();
    celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
  } catch {}

  // 3. Texts
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
        },
      },
    ],
  });

  res.json({
    id: pointId,
    labels,
    celebrities,
    texts,
  });
});

// --- Search by user statement ---
async function searchImagesByStatement(statement) {
  const statementEmbedding = await buildEmbedding(statement);

  const result = await qdrant.search(COLLECTION_NAME, {
    vector: statementEmbedding,
    limit: 1,
    with_payload: true,
  });

  if (result.length && result[0].payload) {
    return result[0].payload;
  
  return null;
}

// --- Example usage for search ---
async function main() {
  // To test search, comment out the app.listen below and uncomment this:
  // const matched = await searchImagesByStatement("he is the king of bollywood.");
  // console.log("🎯 Best matched file:", matched);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});