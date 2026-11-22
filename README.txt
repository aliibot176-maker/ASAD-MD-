╔══════════════════════════════════════════════════════╗
║       ⚡ 𝛥𝑆𝛥𝐷 𝛭𝐷 𝐵𝛩𝑇 - Complete 135 Commands Pack
║         👑 Developer: 𝛥𝑆𝛥𝐷
╚══════════════════════════════════════════════════════╝

DEPLOY ON RENDER.COM (FREE / PAID WEB SERVICE):
1. Extract ASAD_MD_BOT.zip and push the folder contents to a GitHub repository.
2. Open https://dashboard.render.com -> Click "New +" -> "Web Service" (or "Blueprint" using render.yaml).
3. Select your GitHub repository & set:
   - Runtime: Node (or Docker using included Dockerfile for ffmpeg + yt-dlp)
   - Build Command: npm install
   - Start Command: npm start
   - Health Check Path: /health
4. Add Environment Variables in Render (if not set in render.yaml):
   - OWNER_NUMBER=923226761726
   - TELEGRAM_BOT_TOKEN=(optional BotFather token)
   - WA_CHANNEL_LINK=https://whatsapp.com/channel/0029VbATSM74dTnMw4evnN13
   - FORCE_CHANNEL_LINK=https://whatsapp.com/channel/0029VbATSM74dTnMw4evnN13
5. Click "Deploy Web Service".

YOUR LIVE RENDER PAIR SITE LINK:
- Once deployed, Render gives you a URL like: https://your-service-name.onrender.com
- Open that URL (or /pair) — your Multi-User Web Pairing Site runs directly on that exact Render link!
- Every user who opens https://your-service-name.onrender.com can join your channel, pair with code ASADMD11, and run their own isolated WhatsApp bot!

LOCAL / VPS INSTALL:
  npm install
  cp .env.example .env
  npm start
