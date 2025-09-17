@echo off
echo 🚀 Samsung Memory Lens Backend Setup
echo =====================================

cd backend

echo 📦 Installing Node.js dependencies...
call npm install

echo 🐍 Installing Python dependencies...
call pip install sentence-transformers torch

echo 📝 Creating environment file...
if not exist .env (
    copy .env.example .env
    echo ⚠️  Please edit .env file with your AWS and Qdrant configuration
)

echo ✅ Setup complete!
echo.
echo 🏃 To start the backend server:
echo    cd backend
echo    npm run dev
echo.
echo 🌐 Backend will run at: http://localhost:3000
echo 📋 Health check: http://localhost:3000/health
echo.
pause