import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import session from "express-session";
import { Issuer, generators } from "openid-client";
import AWS from "aws-sdk";

dotenv.config();

const app = express();
const rekognition = new AWS.Rekognition();


const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const upload = multer(); // for handling audio files

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const s3 = new AWS.S3();

let client;
async function initializeClient() {
  const issuer = await Issuer.discover(
    "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_5zqKoYHoA"
  );
  client = new issuer.Client({
    client_id: process.env.aws_cognito_client_id,
    client_secret: process.env.aws_cognito_client_secret,
   redirect_uris: [
     "https://samsung-memory-lens.onrender.com/callback"
   ],
    response_types: ["code"],
  });
}
initializeClient().catch(console.error);

app.use(
  session({
    secret: "some secret",
    resave: false,
    saveUninitialized: false,
  })
);




const checkAuth = (req, res, next) => {
  if (!req.session.userInfo) return res.redirect("/login");
  next();
};
// Home route
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/dashboard", checkAuth, (req, res) => {
 
  res.render("dashboard", {
    isAuthenticated: true,
    userInfo: req.session.userInfo,
  });
});

async function analyzeBucketImages(bucketName) {
  const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise();
  const results = [];

  for (const obj of objects.Contents) {
    if (!obj.Key.match(/\.(jpg|jpeg|png)$/i)) continue; // only images

    const params = {
      Image: {
        S3Object: { Bucket: bucketName, Name: obj.Key },
      },
      MaxLabels: 10,
      MinConfidence: 70,
    };

    const labelsResponse = await rekognition.detectLabels(params).promise();
    const labels = labelsResponse.Labels.map(l => l.Name.toLowerCase());

    results.push({
      key: obj.Key,
      url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
      tags: labels,
    });
  }

  return results;
}



app.get("/login", (req, res) => {
  const nonce = generators.nonce();
  const state = generators.state();

  req.session.nonce = nonce;
  req.session.state = state;

  const authUrl = client.authorizationUrl({
    scope: "openid email phone",
    state,
    nonce,
  });

  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  try {
    const params = client.callbackParams(req);

    // dynamically build redirect URI depending on where the request came from
    const redirectUri =
      req.hostname === "localhost"
        ? "http://localhost:3000/callback"
        : "https://samsung-memory-lens.onrender.com/callback";

    const tokenSet = await client.callback(
      redirectUri,
      params,
      { nonce: req.session.nonce, state: req.session.state }
    );

    const userInfo = await client.userinfo(tokenSet.access_token);
    req.session.userInfo = userInfo;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Callback error:", err);
    res.redirect("/");
  }
});


// Helper function to get the path from the URL. Example: "http://localhost/hello" returns "/hello"

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    const baseUrl = process.env.NODE_ENV === "production" 
      ? "https://samsung-memory-lens.onrender.com"
      : "http://localhost:3000";

    const logoutUrl = `https://ap-south-15zqkoyhoa.auth.ap-south-1.amazoncognito.com/logout?client_id=${process.env.aws_cognito_client_id}&logout_uri=${baseUrl}/`;
    res.redirect(logoutUrl);
  });
});


// Voice page route
app.get("/voice", (req, res) => {
  res.render("voice");
});

// Provide Deepgram API key (for debugging only — remove in production!)
app.get("/get-deepgram-key", (req, res) => {
  res.json({ key: process.env.DEEPGRAM_API_KEY || "No Key Found" });
});
// ✅ Route to transcribe audio
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    // 1. Transcribe audio
    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": req.file.mimetype || "audio/webm",
      },
      body: req.file.buffer,
    });

    const data = await response.json();
    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    // 2. Tokenize transcript
    const tokens = tokenize(transcript);

    // 3. Analyze all S3 images
    const bucketName = "samsungmemorylens"; // change if needed
    const analyzedImages = await analyzeBucketImages(bucketName);

    // 4. Filter images by matching tokens with tags
    const matchedImages = analyzedImages.filter(img =>
      img.tags.some(tag => tokens.includes(tag))
    );

    // 5. Respond
    res.json({ transcript, tokens, matchedImages });
    console.log("Transcript:", transcript);
    console.log("Tokens:", tokens);
    console.log("Matched Images:", matchedImages.map(img => img.key));
  } catch (err) {
    console.error("Error in /search-images:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

function tokenize(sentence) {
  return sentence.match(/\b\w+\b/g);
}

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
