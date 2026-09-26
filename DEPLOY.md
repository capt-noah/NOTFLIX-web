# NOTFLIX — Plesk Deployment Guide (Unified & Standalone)

This guide explains how to deploy **NOTFLIX** to your **Plesk Node.js server**.

You have two simple options:
- **Option A (Recommended — Unified with Portfolio)**: Mounts directly into your existing Portfolio Express server at `https://yourdomain.com/notflix` with **zero extra Node processes**.
- **Option B (Standalone)**: Runs as its own independent Plesk Node application on a subdomain like `https://notflix.yourdomain.com`.

---

## Architecture Overview

```
                         https://yourdomain.com
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        / (Root)               /selihom             /notflix
     Portfolio App          Selihom Charity       NOTFLIX Streaming
   (Vite SPA + MySQL)     (Vite SPA + MySQL)    (Vite SPA + Supabase)
                                                        │
                                                        ▼
                                                  /notflix/api
                                            (Stream Resolver + TMDB)
```

---

## Option A: Unified Deployment (Inside Existing Portfolio Server)

Your Portfolio `server.js` is already configured with dynamic NotFlix detection and mounting!

### 1. Build the Frontend Locally
Run the production build:
```bash
npm run build
```
This outputs a completely portable bundle in `dist/` using relative asset paths (`base: './'`).

### 2. Files to Upload to Plesk
In your Plesk file manager or via SFTP, place a `notflix` folder inside your Portfolio app root (where `server.js` is):

```
/var/www/vhosts/yourdomain.com/httpdocs/ (Portfolio Root)
├── server.js               ← Portfolio unified server
├── dist/                   ← Portfolio frontend
├── selihom/                ← Selihom charity frontend & database
└── notflix/                ← [NEW] NOTFLIX folder
    ├── dist/               ← Upload NOTFLIX dist/ folder here
    ├── server/             ← Upload NOTFLIX server/ folder here
    │   ├── router.js       ← Modular NotFlix router
    │   ├── streamResolver.js ← HLS Stream resolver & CORS proxy
    │   └── tmdbProxy.js    ← TMDB API cache proxy
    └── package.json        ← Package metadata
```

### 3. Restart Portfolio Node App
In Plesk → **Node.js**:
Click **Restart App**.

### 4. Verify
Visit:
- **Health Check**: `https://yourdomain.com/hello`
  - Should report `"notflixMounted": true`
- **API Status**: `https://yourdomain.com/notflix/api/health`
  - Returns `{"status":"ok","app":"NOTFLIX","streamResolver":"active"}`
- **Web App**: `https://yourdomain.com/notflix/#/`
  - Loads NotFlix with instant playback and Supabase auth!

---

## Option B: Standalone Plesk Node App (e.g. Subdomain)

If you prefer to run NotFlix on its own dedicated subdomain (`stream.yourdomain.com` or `notflix.yourdomain.com`):

### 1. Build the Frontend
```bash
npm run build
```

### 2. Upload Files to Subdomain Root
Upload the following files to the subdomain document root:
```
dist/                       ← Vite build output
server/                     ← Server directory
server.js                   ← Root server entry point
package.json
package-lock.json
.env                        ← Server environment variables
```

> **Do NOT upload `node_modules/`** — Plesk will install them with one click.

### 3. Configure Plesk Node.js Settings
In Plesk → Subdomain → **Node.js**:

| Setting | Value |
| :--- | :--- |
| **Node.js version** | 20 LTS or higher |
| **Application Mode** | `production` |
| **Application Root** | `/var/www/vhosts/yourdomain.com/notflix.yourdomain.com` |
| **Application Startup File** | `server.js` |

Click **NPM Install**, then click **Restart App**.

---

## Environment Variables (.env)

Set these either in `.env` or in Plesk Node.js **Environment Variables**:

```env
# TMDB Metadata API Key
VITE_TMDB_API_KEY=21269750eb76a0b7c178e43c91b355e5
TMDB_API_KEY=21269750eb76a0b7c178e43c91b355e5

# Supabase Cloud Database & Auth (capt-noah project)
VITE_SUPABASE_URL=https://ijcptfcyltdrpkrrewzc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqY3B0ZmN5bHRkcnBrcnJld3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMTE1MTIsImV4cCI6MjEwNTY4NzUxMn0.ycwuFsFf_W_aKh8Cs8niglASGDbKc2dpeIC2dmJ2BM4
SUPABASE_URL=https://ijcptfcyltdrpkrrewzc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqY3B0ZmN5bHRkcnBrcnJld3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMTE1MTIsImV4cCI6MjEwNTY4NzUxMn0.ycwuFsFf_W_aKh8Cs8niglASGDbKc2dpeIC2dmJ2BM4

# Server Port (Only needed when running standalone, default 3001)
PORT=3001
NODE_ENV=production
```

---

## Native Swift / macOS Desktop App Usage

For the native macOS desktop app (Swift `AVPlayer`):
- Swift will query your server endpoint directly:
  `GET https://yourdomain.com/notflix/api/stream?tmdbId=550&type=movie`
- Response:
  ```json
  {
    "success": true,
    "stream": {
      "url": "https://upstream-cdn-cluster.net/hls/master.m3u8",
      "type": "hls",
      "quality": "1080p",
      "headers": {
        "Referer": "https://vidsrc.me/"
      }
    },
    "subtitles": []
  }
  ```
- Swift sets `AVURLAssetHTTPHeaderFieldsKey: ["Referer": stream.headers.Referer]` and plays the upstream stream directly with 0 server bandwidth and native hardware acceleration.
