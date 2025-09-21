# Deploy Samsung Memory Lens Backend

## Option 1: Heroku (Free Tier Available)
```bash
# Install Heroku CLI, then:
heroku login
heroku create samsung-memory-lens-backend
git push heroku master
# Your permanent URL: https://samsung-memory-lens-backend.herokuapp.com
```

## Option 2: Railway (Free Tier)
```bash
# Connect GitHub repo to Railway
# Auto-deploy on git push
# Your URL: https://samsung-memory-lens-backend.railway.app
```

## Option 3: Render (Free Tier)
```bash
# Connect GitHub repo to Render
# Auto-deploy on git push  
# Your URL: https://samsung-memory-lens-backend.onrender.com
```

## Option 4: ngrok Static Domain (Paid - $8/month)
```bash
ngrok http 3002 --domain=your-static-domain.ngrok-free.app
# Same URL forever: https://your-static-domain.ngrok-free.app
```

## Option 5: Local Tunnel (Free Alternative to ngrok)
```bash
npm install -g localtunnel
lt --port 3002
# Get a semi-permanent URL
```