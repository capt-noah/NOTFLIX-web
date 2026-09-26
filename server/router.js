/**
 * NotFlix Modular Express Router
 * Can be mounted inside Portfolio server.js (at /notflix/api or /api)
 * or run standalone inside NotFlix server.js
 */

import express from 'express';
import { TMDBService } from './tmdbProxy.js';
import { resolveStream, handleStreamProxy, handleSubtitleProxy } from './streamResolver.js';
import { handleTorrentStreamRequest } from './torrentEngine.js';

const router = express.Router();

// Sanitization helpers
const sanitizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, 1000);
};

const sanitizeNumber = (num, min = 0, max = 2147483647) => {
    const parsed = parseInt(num, 10);
    if (isNaN(parsed)) return null;
    return Math.max(min, Math.min(max, parsed));
};

// ==============================================================================
// 1. HEALTH & DIAGNOSTICS
// ==============================================================================
router.get(['/health', '/status'], (req, res) => {
    res.json({
        status: 'ok',
        app: 'NOTFLIX',
        timestamp: new Date().toISOString(),
        streamResolver: 'active',
        tmdbCached: true,
    });
});

// ==============================================================================
// 2. STREAM RESOLVER & PROXY (Phase 2)
// ==============================================================================
router.get('/stream', async (req, res) => {
    const rawId = sanitizeString(req.query.tmdbId || req.query.id);
    const tmdbId = sanitizeNumber(rawId);
    const type = sanitizeString(req.query.type || 'movie');
    const season = sanitizeNumber(req.query.season, 1, 100) || 1;
    const episode = sanitizeNumber(req.query.episode, 1, 1000) || 1;
    const provider = sanitizeString(req.query.provider || 'auto');

    if (!tmdbId) {
        // Graceful fallback for non-numeric/mock catalog titles
        return res.json({
            success: true,
            tmdbId: rawId,
            type,
            stream: {
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                type: 'mp4',
                quality: '1080p',
                qualities: {
                    '1080p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                },
                provider: 'catalog-demo'
            },
            subtitles: []
        });
    }

    try {
        const streamData = await resolveStream({ tmdbId, type, season, episode, provider });
        res.json(streamData);
    } catch (error) {
        console.error('Stream resolver error:', error.message);
        res.status(500).json({ error: 'Failed to resolve stream', details: error.message });
    }
});

// Progressive Sequential Torrent Range Stream (HTTP 206)
router.get('/stream/torrent', handleTorrentStreamRequest);

// HLS Stream & Segment CORS Proxy
router.get(['/stream/proxy', '/proxy/stream'], handleStreamProxy);

// Subtitle WebVTT Conversion Proxy
router.get(['/stream/subtitles', '/subtitle/proxy', '/proxy/subtitles'], handleSubtitleProxy);

// ==============================================================================
// 3. TMDB PROXY ENDPOINTS (Safe In-Memory Caching & Rate-Limited)
// ==============================================================================
router.get('/tmdb/trending', async (req, res) => {
    try {
        const data = await TMDBService.getTrendingMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending movies' });
    }
});

router.get('/tmdb/trending/movies', async (req, res) => {
    try {
        const data = await TMDBService.getTrendingMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending movies' });
    }
});

router.get('/tmdb/trending/tv', async (req, res) => {
    try {
        const data = await TMDBService.getTrendingTV();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending TV shows' });
    }
});

router.get('/tmdb/top-rated/movies', async (req, res) => {
    try {
        const data = await TMDBService.getTopRatedMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top rated movies' });
    }
});

router.get('/tmdb/top-rated/tv', async (req, res) => {
    try {
        const data = await TMDBService.getTopRatedTV();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top rated TV shows' });
    }
});

router.get('/tmdb/now-playing', async (req, res) => {
    try {
        const data = await TMDBService.getNowPlayingMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch now playing movies' });
    }
});

router.get('/tmdb/genres', async (req, res) => {
    try {
        const data = await TMDBService.getGenres();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

router.get('/tmdb/movie/:id', async (req, res) => {
    const id = sanitizeNumber(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid movie ID' });

    try {
        const data = await TMDBService.getMediaDetails(id, 'movie');
        if (!data) return res.status(404).json({ error: 'Movie not found' });
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch movie details' });
    }
});

router.get('/tmdb/media/:type/:id', async (req, res) => {
    const type = sanitizeString(req.params.type);
    const id = sanitizeNumber(req.params.id);
    
    if (!id) return res.status(400).json({ error: 'Invalid media ID' });
    if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid media type' });
    
    try {
        const data = await TMDBService.getMediaDetails(id, type);
        if (!data) return res.status(404).json({ error: 'Media not found' });
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch media details' });
    }
});

router.get('/tmdb/media/:type/:id/cast', async (req, res) => {
    const type = sanitizeString(req.params.type);
    const id = sanitizeNumber(req.params.id);
    
    if (!id) return res.status(400).json({ error: 'Invalid media ID' });
    if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid media type' });
    
    try {
        const data = await TMDBService.getMediaCast(id, type);
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch cast' });
    }
});

router.get('/tmdb/media/:type/:id/similar', async (req, res) => {
    const type = sanitizeString(req.params.type);
    const id = sanitizeNumber(req.params.id);
    
    if (!id) return res.status(400).json({ error: 'Invalid media ID' });
    if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid media type' });
    
    try {
        const data = await TMDBService.getSimilarMedia(id, type);
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch similar media' });
    }
});

router.get('/tmdb/media/:type/:id/videos', async (req, res) => {
    const type = sanitizeString(req.params.type);
    const id = sanitizeNumber(req.params.id);
    
    if (!id) return res.status(400).json({ error: 'Invalid media ID' });
    if (type !== 'movie' && type !== 'tv') return res.status(400).json({ error: 'Invalid media type' });
    
    try {
        const data = await TMDBService.getMediaVideos(id, type);
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch media videos' });
    }
});

router.get('/tmdb/tv/:id', async (req, res) => {
    const id = sanitizeNumber(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid TV ID' });

    try {
        const data = await TMDBService.getMediaDetails(id, 'tv');
        if (!data) return res.status(404).json({ error: 'TV show not found' });
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch TV show details' });
    }
});

router.get('/tmdb/tv/:id/season/:season', async (req, res) => {
    const tvId = sanitizeNumber(req.params.id);
    const season = sanitizeNumber(req.params.season);
    
    if (!tvId || !season) return res.status(400).json({ error: 'Invalid TV ID or season number' });
    
    try {
        const data = await TMDBService.getSeasonDetails(tvId, season);
        if (!data) return res.status(404).json({ error: 'Season not found' });
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch season details' });
    }
});

router.get('/tmdb/search', async (req, res) => {
    const query = sanitizeString(req.query.query || '');
    const type = sanitizeString(req.query.type || 'all');
    const genres = req.query.genres ? req.query.genres.split(',').map(sanitizeNumber).filter(Boolean) : [];
    const providers = req.query.providers ? req.query.providers.split(',').map(sanitizeNumber).filter(Boolean) : [];
    const year = sanitizeNumber(req.query.year);
    const rating = sanitizeNumber(req.query.rating, 0, 10);
    
    try {
        const data = await TMDBService.searchMedia(query, { type, genres, providers, year, rating });
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/tmdb/action/movies', async (req, res) => {
    try {
        const data = await TMDBService.getActionMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch action movies' });
    }
});

router.get('/tmdb/comedy/movies', async (req, res) => {
    try {
        const data = await TMDBService.getComedyMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch comedy movies' });
    }
});

router.get('/tmdb/popular/movies', async (req, res) => {
    try {
        const data = await TMDBService.getPopularMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch popular movies' });
    }
});

router.get('/tmdb/action/tv', async (req, res) => {
    try {
        const data = await TMDBService.getActionTV();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch action TV shows' });
    }
});

router.get('/tmdb/popular/tv', async (req, res) => {
    try {
        const data = await TMDBService.getPopularTV();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch popular TV shows' });
    }
});

router.get('/tmdb/actor/:id/credits', async (req, res) => {
    const actorId = sanitizeNumber(req.params.id);
    if (!actorId) return res.status(400).json({ error: 'Invalid actor ID' });
    
    try {
        const data = await TMDBService.getActorCredits(actorId);
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch actor credits' });
    }
});

export default router;
export { router as notflixRouter };
