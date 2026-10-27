/**
 * NotFlix Modular Express Router
 * Can be mounted inside Portfolio server.js (at /notflix/api or /api)
 * or run standalone inside NotFlix server.js
 */

import express from 'express';
import { TMDBService } from './tmdbProxy.js';
import { AnimeProxyService, ANIME_TMDB_MAP } from './animeProxy.js';
import { resolveStream, handleStreamProxy, handleSubtitleProxy } from './streamResolver.js';
import { handleTorrentStreamRequest } from './torrentEngine.js';

const router = express.Router();

// Permissive CORS middleware for all router endpoints
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

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
        const fallbackUrl = `/api/stream/proxy?url=${encodeURIComponent('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')}`;
        return res.json({
            success: true,
            tmdbId: rawId,
            type,
            stream: {
                url: fallbackUrl,
                type: 'hls',
                quality: '1080p FHD',
                qualities: {
                    '1080p FHD': fallbackUrl,
                    '720p HD': fallbackUrl,
                    'Auto': fallbackUrl
                },
                provider: 'notflix-direct'
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
router.get(['/tmdb/trending', '/tmdb/trending/movies', '/tmdb/trending/movie'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getTrendingMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending movies' });
    }
});

router.get(['/tmdb/trending/tv', '/tmdb/trending/shows'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getTrendingTV();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending TV shows' });
    }
});

router.get(['/tmdb/top-rated/movies', '/tmdb/top-rated/movie', '/tmdb/top_rated', '/tmdb/top-rated'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getTopRatedMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top rated movies' });
    }
});

router.get(['/tmdb/top-rated/tv', '/tmdb/top-rated/shows'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
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

router.get(['/tmdb/action/movies', '/tmdb/action/movie', '/tmdb/action'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getActionMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch action movies' });
    }
});

router.get(['/tmdb/comedy/movies', '/tmdb/comedy/movie', '/tmdb/comedy'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getComedyMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch comedy movies' });
    }
});

router.get(['/tmdb/popular/movies', '/tmdb/popular/movie', '/tmdb/popular'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getPopularMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch popular movies' });
    }
});

router.get(['/tmdb/scifi', '/tmdb/sci-fi'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getSciFiMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch sci-fi movies' });
    }
});

router.get(['/tmdb/horror', '/tmdb/thriller'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getHorrorMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch horror movies' });
    }
});

router.get('/tmdb/romance', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getRomanceMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch romance movies' });
    }
});

router.get('/tmdb/crime', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getCrimeMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch crime movies' });
    }
});

router.get(['/tmdb/documentary', '/tmdb/documentaries'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=86400');
        const data = await TMDBService.getDocumentaryMovies();
        res.json(data);
    } catch (error) {
        console.error('TMDB error:', error.message);
        res.status(500).json({ error: 'Failed to fetch documentary movies' });
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

router.get('/tmdb/anime/trending', async (req, res) => {
    try {
        const data = await TMDBService.getAnimeTrending();
        res.json(data);
    } catch (error) {
        console.error('TMDB anime trending error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending anime' });
    }
});

router.get('/tmdb/anime/airing', async (req, res) => {
    try {
        const data = await TMDBService.getAnimeAiring();
        res.json(data);
    } catch (error) {
        console.error('TMDB anime airing error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top airing anime' });
    }
});

router.get('/tmdb/anime/popular', async (req, res) => {
    try {
        const data = await TMDBService.getAnimePopular();
        res.json(data);
    } catch (error) {
        console.error('TMDB anime popular error:', error.message);
        res.status(500).json({ error: 'Failed to fetch popular anime' });
    }
});

router.get('/tmdb/anime/top-rated', async (req, res) => {
    try {
        const data = await TMDBService.getAnimeTopRated();
        res.json(data);
    } catch (error) {
        console.error('TMDB anime top-rated error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top rated anime' });
    }
});

router.get('/tmdb/anime/upcoming', async (req, res) => {
    try {
        const data = await TMDBService.getAnimeUpcoming();
        res.json(data);
    } catch (error) {
        console.error('TMDB anime upcoming error:', error.message);
        res.status(500).json({ error: 'Failed to fetch upcoming anime' });
    }
});

router.get('/tmdb/anime/action', async (req, res) => {
    try {
        const data = await TMDBService.getAnimeAction();
        res.json(data);
    } catch (error) {
        console.error('TMDB anime action error:', error.message);
        res.status(500).json({ error: 'Failed to fetch action anime' });
    }
});

router.get('/tmdb/anime/genre/:genre', async (req, res) => {
    const genre = sanitizeString(req.params.genre);
    if (!genre) return res.status(400).json({ error: 'Invalid genre' });

    try {
        const data = await TMDBService.getAnimeByGenre(genre);
        res.json(data);
    } catch (error) {
        console.error('TMDB anime genre error:', error.message);
        res.status(500).json({ error: 'Failed to fetch anime by genre' });
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

// ==============================================================================
// 4. ANIME PROXY ENDPOINTS (AniList & HiAnime)
// ==============================================================================

router.get('/anime/home', async (req, res) => {
    try {
        const data = await AnimeProxyService.getHome();
        res.json(data);
    } catch (error) {
        console.error('Anime home error:', error.message);
        res.status(500).json({ error: 'Failed to fetch anime home' });
    }
});

router.get('/anime/trending', async (req, res) => {
    try {
        const page = sanitizeNumber(req.query.page, 1, 100) || 1;
        const data = await AnimeProxyService.getList('trending', page);
        res.json(data);
    } catch (error) {
        console.error('Anime trending error:', error.message);
        res.status(500).json({ error: 'Failed to fetch trending anime' });
    }
});

router.get('/anime/popular', async (req, res) => {
    try {
        const page = sanitizeNumber(req.query.page, 1, 100) || 1;
        const data = await AnimeProxyService.getList('popular', page);
        res.json(data);
    } catch (error) {
        console.error('Anime popular error:', error.message);
        res.status(500).json({ error: 'Failed to fetch popular anime' });
    }
});

router.get('/anime/top-rated', async (req, res) => {
    try {
        const page = sanitizeNumber(req.query.page, 1, 100) || 1;
        const data = await AnimeProxyService.getList('top-rated', page);
        res.json(data);
    } catch (error) {
        console.error('Anime top-rated error:', error.message);
        res.status(500).json({ error: 'Failed to fetch top rated anime' });
    }
});

router.get('/anime/upcoming', async (req, res) => {
    try {
        const page = sanitizeNumber(req.query.page, 1, 100) || 1;
        const data = await AnimeProxyService.getList('upcoming', page);
        res.json(data);
    } catch (error) {
        console.error('Anime upcoming error:', error.message);
        res.status(500).json({ error: 'Failed to fetch upcoming anime' });
    }
});

router.get('/anime/search', async (req, res) => {
    try {
        const query = sanitizeString(req.query.query || req.query.keyword || req.query.q || '');
        const page = sanitizeNumber(req.query.page, 1, 100) || 1;
        const genre = sanitizeString(req.query.genre || '');
        const data = await AnimeProxyService.search(query, page, genre || null);
        res.json(data);
    } catch (error) {
        console.error('Anime search error:', error.message);
        res.status(500).json({ error: 'Anime search failed' });
    }
});

router.get('/anime/details/:id', async (req, res) => {
    const id = sanitizeString(req.params.id);
    if (!id) return res.status(400).json({ error: 'Anime ID is required' });

    try {
        const data = await AnimeProxyService.getDetails(id);
        if (!data) return res.status(404).json({ error: 'Anime not found' });
        res.json(data);
    } catch (error) {
        console.error('Anime details error:', error.message);
        res.status(500).json({ error: 'Failed to fetch anime details' });
    }
});

router.get('/anime/episodes/:id', async (req, res) => {
    const id = sanitizeString(req.params.id);
    const season = req.query.season ? sanitizeNumber(req.query.season, 1, 100) : 1;
    if (!id) return res.status(400).json({ error: 'Anime ID is required' });

    try {
        const data = await AnimeProxyService.getEpisodes(id, season);
        res.json(data);
    } catch (error) {
        console.error('Anime episodes error:', error.message);
        res.status(500).json({ error: 'Failed to fetch anime episodes' });
    }
});

router.get('/anime/servers', async (req, res) => {
    const episodeId = sanitizeString(req.query.id || req.query.episodeId || '');
    if (!episodeId) return res.status(400).json({ error: 'Episode ID is required' });

    try {
        const data = await AnimeProxyService.getServers(episodeId);
        res.json(data);
    } catch (error) {
        console.error('Anime servers error:', error.message);
        res.status(500).json({ error: 'Failed to fetch episode servers' });
    }
});

router.get('/anime/stream', async (req, res) => {
    const episodeId = sanitizeString(req.query.id || req.query.episodeId || '');
    const server = sanitizeString(req.query.server || 'HD-1');
    const type = sanitizeString(req.query.type || 'sub');
    const title = sanitizeString(req.query.title || '');

    if (!episodeId) return res.status(400).json({ error: 'Episode ID is required' });

    try {
        const data = await AnimeProxyService.getStream(episodeId, server, type, title);
        res.json(data);
    } catch (error) {
        console.error('Anime stream error:', error.message);
        res.status(500).json({ error: 'Failed to fetch anime stream' });
    }
});

router.get('/anime/player', async (req, res) => {
    const rawId = sanitizeString(req.query.id || req.query.episodeId || '');
    const season = parseInt(req.query.s || req.query.season || '1', 10) || 1;
    const episode = parseInt(req.query.ep || req.query.episode || '1', 10) || 1;
    const type = sanitizeString(req.query.type || req.query.audioMode || 'sub').toLowerCase();
    const title = sanitizeString(req.query.title || '');
    const server = sanitizeString(req.query.server || 'HD-1');

    if (!rawId) {
        return res.status(400).send('<html><body style="background:#08080a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><h3>Anime ID is required</h3></body></html>');
    }

    try {
        const embedUrl = await AnimeProxyService.resolveMegaCloudEmbed(rawId, season, episode, type, title);
        if (embedUrl) {
            return res.redirect(embedUrl);
        }
    } catch (err) {
        console.warn('[AnimePlayer] MegaCloud resolution error, using fallback:', err.message);
    }

    // Direct fallback to standalone embed players (Never show error or initializing box)
    let tmdbId = ANIME_TMDB_MAP[rawId]?.tmdbId;
    if (!tmdbId && title) {
        try {
            const tmdbRes = await TMDBService.searchMedia(title);
            if (tmdbRes?.[0]?.id) {
                tmdbId = tmdbRes[0].id;
            }
        } catch (e) {}
    }
    const finalId = tmdbId || rawId;
    if (type === 'dub') {
        return res.redirect(`https://primesrc.me/embed/tv?tmdb=${finalId}&season=${season}&episode=${episode}&dub=1`);
    } else {
        return res.redirect(`https://vidsrc.pm/embed/tv/${finalId}/${season}/${episode}`);
    }
});

router.get('/anime/hls-proxy', async (req, res) => {
    const rawUrl = req.query.url;
    const referer = req.query.referer || 'https://megacloud.tv';

    if (!rawUrl) {
        return res.status(400).send('URL is required');
    }

    try {
        const decodedUrl = decodeURIComponent(rawUrl);
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': referer,
            'Origin': referer,
            'Accept': '*/*'
        };

        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const upstreamRes = await fetch(decodedUrl, {
            headers,
            signal: AbortSignal.timeout(12000)
        });

        if (!upstreamRes.ok) {
            return res.status(upstreamRes.status).send(`Upstream error: ${upstreamRes.status}`);
        }

        const contentType = upstreamRes.headers.get('content-type') || 'application/vnd.apple.mpegurl';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
        res.setHeader('Content-Type', contentType);

        if (decodedUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL')) {
            res.setHeader('Cache-Control', 'no-cache');
            const content = await upstreamRes.text();
            const basePath = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

            const hlsProxyBase = (req.baseUrl || '/notflix/api') + '/anime/hls-proxy';
            const rewrittenLines = content.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return line;

                let target = trimmed;
                if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                    target = basePath + trimmed;
                }
                return `${hlsProxyBase}?url=${encodeURIComponent(target)}&referer=${encodeURIComponent(referer)}`;
            });

            return res.send(rewrittenLines.join('\n'));
        }

        // For .ts chunks or video binary data
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const arrayBuf = await upstreamRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuf));
    } catch (e) {
        return res.status(500).send(`HLS proxy error: ${e.message}`);
    }
});

// ==============================================================================
// 5. CATCH-ALL JSON 404 ROUTE (Guarantees API routes never return HTML)
// ==============================================================================
router.use((req, res) => {
    res.status(404).json({
        error: 'NotFlix API endpoint not found',
        method: req.method,
        path: req.originalUrl || req.url,
        timestamp: new Date().toISOString()
    });
});

export default router;
export { router as notflixRouter };
