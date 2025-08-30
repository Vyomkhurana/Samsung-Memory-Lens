import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import session from "express-session";
import { Issuer, generators } from "openid-client";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const upload = multer(); // for handling audio files

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
 // ✅ FIXED
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
    const logoutUrl = `https://ap-south-15zqkoyhoa.auth.ap-south-1.amazoncognito.com/logout?client_id=29354hv0epi6galq8bhfhttast&logout_uri=http://localhost:3000/`;
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
    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/webm",
      },
      body: req.file.buffer,
    });

    const data = await response.json();

    const transcript =
      data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    res.json({ transcript });
  } catch (err) {
    console.error("Transcription Error:", err);
    res.status(500).json({ error: "Failed to transcribe" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
