import AWS from "aws-sdk";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { PythonShell } from "python-shell";

dotenv.config();

// 🔹 AWS setup
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();

// 🔹 Qdrant setup
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION_NAME = "images";
const VECTOR_SIZE = 384; // SentenceTransformer (all-MiniLM-L6-v2)

// --- Ensure collection exists ---
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
      pythonPath:
        "C:\\Users\\gurum\\AppData\\Local\\Programs\\Python\\Python310\\python.exe", // 👈 full path to python.exe
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

// --- Store images into Qdrant ---
async function processAndStoreImageVectors(bucketName) {
  await ensureCollectionExists();

  const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise();
  const images = objects.Contents.filter((obj) =>
    /\.(jpg|jpeg|png)$/i.test(obj.Key)
  );

  for (const obj of images) {
    const params = {
      Image: { S3Object: { Bucket: bucketName, Name: obj.Key } },
    };

    // 1. Labels
    let labels = [];
    try {
      const labelData = await rekognition
        .detectLabels({ ...params, MaxLabels: 10, MinConfidence: 70 })
        .promise();
      labels = labelData.Labels.map((l) => l.Name.toLowerCase());
    } catch {}

    // 2. Celebrities
    let celebrities = [];
    try {
      const celebData = await rekognition
        .recognizeCelebrities(params)
        .promise();
      celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
    } catch {}

    // 3. Texts
    let texts = [];
    try {
      const textData = await rekognition.detectText(params).promise();
      texts = textData.TextDetections.map((t) => t.DetectedText.toLowerCase());
    } catch {}

    // 4. Build semantic embedding
    const allFeatures = [...labels, ...celebrities, ...texts];
    const embedding = await buildEmbedding(allFeatures.join(" "));

    // 5. Store in Qdrant
    await qdrant.upsert(COLLECTION_NAME, {
      points: [
        {
          id: uuidv4(),
          vector: embedding,
          payload: {
            url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
            fileName: obj.Key,
            labels,
            celebrities,
            texts,
          },
        },
      ],
    });

    console.log(`✅ Stored vector for ${obj.Key}`);
  }
}

// --- Search by user statement ---
async function searchImagesByStatement(statement) {
  const statementEmbedding = await buildEmbedding(statement);

  // 🚀 Let Qdrant do the similarity search
  const result = await qdrant.search(COLLECTION_NAME, {
    vector: statementEmbedding,
    limit: 1, // best match only
    with_payload: true,
  });

  if (result.length && result[0].payload?.fileName) {
    return result[0].payload.fileName;
  }
  return null;
}

// --- Example usage ---
async function main() {
  // Step 1: Process all S3 images & store vectors
  // await processAndStoreImageVectors("samsungmemorylens");

  // Step 2: Search for something
  const matchedFile = await searchImagesByStatement(
    "he is the king of bollywood. "
  );
  console.log("🎯 Best matched file:", matchedFile);
}

main().catch((err) => console.error("❌ Error:", err));
