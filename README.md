# NOTFLIX 🍿🎬 • Obsidian Edition

A high-performance, ad-free cinema streaming platform with 4K UHD progressive torrent & direct stream resolution, full native player controls, and real-time cross-platform cloud sync between macOS and Web.

---

## ✨ Key Capabilities
* **Zero Ads, Zero Iframes:** 100% native HTML5 cinema player with WebVTT subtitles, custom audio boost, playback speed controls, and auto-countdown up next episodes.
* **4K UHD Multi-Stream Engine:** Torrent progressive streaming daemon with HTTP 206 partial content streaming & multi-indexer stream fallback resolution.
* **Obsidian Cinema Design:** Deep glassmorphic aesthetic with multi-stage gradient scrims, sliding capsule pill navbar, auto-advancing hero carousels, and 16:9 detail stages.
* **Cross-Device Cloud Sync:** Real-time Supabase sync for watch progress, watchlists, viewing history, and custom avatars.
* **Extensive Catalog:** Trending, Top Rated, Now Playing, and genre-based movie & TV collections via TMDB.

---

## 🛠️ Architecture & Tech Stack
* **Frontend:** React 19, Vite, Tailwind CSS
* **Backend:** Express.js streaming daemon with WebTorrent progressive stream resolution
* **Database & Auth:** Supabase (PostgreSQL)
* **Data Engine:** TMDB API & Multi-indexer resolution

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v18+)
- Supabase Project & Credentials
- TMDB API Key

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory for the frontend:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_BASE=http://localhost:3001
   ```
   Create a `.env` in the root / `server/` directory:
   ```env
   PORT=3001
   TMDB_API_KEY=your_tmdb_api_key
   ```

3. **Start Development Server & Torrent Streaming Engine:**
   ```bash
   npm run dev:all
   ```

---

## 💻 Platforms
- **Web:** Runs modern desktop & mobile browsers.
- **macOS Desktop:** Native Swift / SwiftUI app located in `NOTFLIX-macOS`.
