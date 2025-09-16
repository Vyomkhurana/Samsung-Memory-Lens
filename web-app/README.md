# Samsung Memory Lens - Web Application

A web-based photo gallery application with AI-powered content analysis using AWS Rekognition.

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js
- **Frontend**: EJS templates, CSS
- **AI/ML**: AWS Rekognition, Python embeddings
- **Cloud**: AWS S3 for storage

## 📁 Project Structure

```
web-app/
├── index.js           # Main server file
├── package.json       # Node.js dependencies
├── rekognition.js     # AWS Rekognition integration
├── embeddings.py      # Python script for embeddings
├── public/           # Static assets (CSS, JS, images)
├── views/            # EJS templates
└── README.md         # This file
```

## 🚀 Setup Instructions

1. **Install Dependencies**
   ```bash
   cd web-app
   npm install
   ```

2. **Configure AWS Credentials**
   - Set up AWS credentials for Rekognition service
   - Configure S3 bucket settings

3. **Environment Variables**
   Create a `.env` file with:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=your_region
   S3_BUCKET_NAME=your_bucket_name
   ```

4. **Run the Application**
   ```bash
   npm start
   ```

5. **Access the App**
   Open your browser and navigate to `http://localhost:3000`

## 📋 Features

- **Photo Upload**: Upload images to the gallery
- **AI Analysis**: Automatic content analysis using AWS Rekognition
- **Search**: Find photos based on detected content
- **Responsive Design**: Works on desktop and mobile browsers

## 🔧 API Endpoints

- `GET /` - Main gallery page
- `POST /upload` - Upload new photos
- `GET /search` - Search photos by content
- `GET /analyze/:id` - Get AI analysis for specific photo

## 🤝 Contributing

This is the legacy web version. For new features, consider contributing to the mobile app version in `/mobile-app/`.

## 📝 Notes

- This version uses server-side rendering with EJS
- Image processing is handled on the backend
- Requires AWS account for full functionality