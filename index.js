import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const upload = multer(); // for handling audio files

// Home route
app.get("/", (req, res) => {
    res.render("home");
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
                "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
                "Content-Type": "audio/webm"
            },
            body: req.file.buffer
        });

        const data = await response.json();

        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
        res.json({ transcript });
    } catch (err) {
        console.error("Transcription Error:", err);
        res.status(500).json({ error: "Failed to transcribe" });
    }
});

app.listen(PORT, () => {
    console.log(` Server running at http://localhost:${PORT}`);
});
