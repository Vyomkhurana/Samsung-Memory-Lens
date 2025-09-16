import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import session from "express-session";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";
import { PythonShell } from "python-shell";


dotenv.config();

const app = express();
const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const upload = multer(); 

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

app.use(
  session({
    secret: "some secret",
    resave: false,
    saveUninitialized: false,
  })
);

// 🔹 Qdrant setup
const qdrant = new QdrantClient({
  url: process.env.QDRANTDB_ENDPOINT,
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
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log("✅ Collection created.");
  }
}

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

    let labels = [];
    try {
      const labelData = await rekognition
        .detectLabels({ ...params, MaxLabels: 10, MinConfidence: 70 })
        .promise();
      labels = labelData.Labels.map((l) => l.Name.toLowerCase());
    } catch {}

    let celebrities = [];
    try {
      const celebData = await rekognition
        .recognizeCelebrities(params)
        .promise();
      celebrities = celebData.CelebrityFaces.map((c) => c.Name.toLowerCase());
    } catch {}

    let texts = [];
    try {
      const textData = await rekognition.detectText(params).promise();
      texts = textData.TextDetections.map((t) => t.DetectedText.toLowerCase());
    } catch {}

    const allFeatures = [...labels, ...celebrities, ...texts];
    const embedding = await buildEmbedding(allFeatures.join(" "));

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

async function searchImagesByStatement(statement) {
  const statementEmbedding = await buildEmbedding(statement);

  const result = await qdrant.search(COLLECTION_NAME, {
    vector: statementEmbedding,
    limit: 1,
    with_payload: true,
  });

  if (result.length && result[0].payload?.fileName) {
    return result[0].payload.fileName;
  }
  return null;
}

async function main() {
 
  // await processAndStoreImageVectors("samsungmemorylens");

  const matchedFile = await searchImagesByStatement(
    "he is the king of bollywood. "
  );
  console.log("🎯 Best matched file:", matchedFile);
}

main().catch((err) => console.error("❌ Error:", err));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
