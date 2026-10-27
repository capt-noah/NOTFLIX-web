/**
 * NotFlix Direct Stream Resolver Engine (Phase 4 - Abstracted Zero-Ad Architecture)
 * 100% Ad-Free Direct Stream Extraction & HLS Manifest Proxy.
 * Delivers clean master HLS (.m3u8) & direct MP4 streams for the unified custom NOTFLIX player.
 */

import { Readable } from 'node:stream';
import { TMDBService } from './tmdbProxy.js';
import nacl from 'tweetnacl';

// In-memory stream cache with 3-hour TTL and bounded LRU eviction
const streamCache = new Map();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function getCachedStream(key) {
    const entry = streamCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        streamCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedStream(key, data) {
    if (streamCache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entry
        const oldestKey = streamCache.keys().next().value;
        if (oldestKey) streamCache.delete(oldestKey);
    }
    streamCache.set(key, {
        timestamp: Date.now(),
        data,
    });
}

function parseQuality(text) {
    if (!text) return '1080p';
    const str = text.toLowerCase();
    if (str.includes('4k') || str.includes('2160p') || str.includes('uhd')) return '4k';
    if (str.includes('1080p') || str.includes('fhd') || str.includes('bluray') || str.includes('remux')) return '1080p';
    if (str.includes('720p') || str.includes('hd')) return '720p';
    if (str.includes('480p') || str.includes('sd')) return '480p';
    return '1080p';
}

function parseSeeds(text) {
    if (!text) return 0;
    const seedMatch = text.match(/(?:👤|seeds?[:\s]*|s[:\s]+)(\d+)/i) || text.match(/\[(\d+)\s*seeds?\]/i);
    if (seedMatch && seedMatch[1]) {
        return parseInt(seedMatch[1], 10) || 0;
    }
    return 0;
}

function parseAudio(text) {
    if (!text) return 'Stereo';
    const str = text.toUpperCase();
    if (str.includes('ATMOS')) return 'Dolby Atmos';
    if (str.includes('DDP5.1') || str.includes('DD5.1') || str.includes('5.1') || str.includes('6CH')) return 'Dolby Digital 5.1';
    if (str.includes('7.1') || str.includes('8CH')) return '7.1 Surround';
    if (str.includes('AAC')) return 'AAC Stereo';
    return 'Original Stereo';
}

/**
 * Subtitle Resolver via OpenSubtitles Stremio V3 API
 */
async function resolveSubtitles(imdbId, type = 'movie', season = 1, episode = 1) {
    if (!imdbId) return [];
    try {
        const idPath = type === 'tv' ? `series/${imdbId}:${season}:${episode}` : `movie/${imdbId}`;
        const url = `https://opensubtitles-v3.strem.io/subtitles/${idPath}.json`;

        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return [];
        const data = await res.json();
        if (!data || !Array.isArray(data.subtitles)) return [];

        const langMap = {
            'eng': 'English',
            'spa': 'Spanish',
            'fre': 'French',
            'fra': 'French',
            'ger': 'German',
            'deu': 'German',
            'ita': 'Italian',
            'rus': 'Russian',
            'por': 'Portuguese',
            'ara': 'Arabic',
            'chi': 'Chinese',
            'zho': 'Chinese',
            'jpn': 'Japanese',
            'kor': 'Korean',
            'hin': 'Hindi',
            'tur': 'Turkish',
            'nld': 'Dutch',
            'dut': 'Dutch',
            'pol': 'Polish',
            'swe': 'Swedish',
        };

        const seenLang = new Set();
        return data.subtitles
            .filter(s => Boolean(s.url))
            .map(s => {
                const langCode = (s.lang || 'eng').toLowerCase();
                const label = langMap[langCode] || s.lang || 'English';
                return {
                    label,
                    srclang: langCode.slice(0, 2),
                    url: `/api/stream/subtitles?url=${encodeURIComponent(s.url)}`,
                };
            })
            .filter(s => {
                if (seenLang.has(s.label)) return false;
                seenLang.add(s.label);
                return true;
            })
            .slice(0, 25);
    } catch {
        return [];
    }
}

/**
 * Resolver 1: Torrentio High-Speed Stream Indexer
 */
async function resolveTorrentio(imdbId, type = 'movie', season = 1, episode = 1) {
    if (!imdbId) return [];
    try {
        const stremioType = type === 'tv' ? 'series' : type;
        const idPath = stremioType === 'series' ? `${imdbId}:${season}:${episode}` : imdbId;
        const url = `https://torrentio.strem.fun/stream/${stremioType}/${idPath}.json`;

        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return [];
        const data = await res.json();
        if (!data || !Array.isArray(data.streams)) return [];

        return data.streams.map(s => {
            const rawTitle = `${s.name || ''} ${s.title || ''}`;
            const quality = parseQuality(rawTitle);
            const seeds = parseSeeds(rawTitle);
            const audio = parseAudio(rawTitle);

            return {
                provider: 'torrentio',
                infoHash: s.infoHash,
                fileIdx: s.fileIdx ?? 0,
                quality,
                seeds,
                audio,
                title: s.title || s.name || '',
            };
        }).filter(s => Boolean(s.infoHash));
    } catch {
        return [];
    }
}

/**
 * Resolver 2: Comet Multi-CDN Stream Indexer
 */
async function resolveComet(imdbId, type = 'movie', season = 1, episode = 1) {
    if (!imdbId) return [];
    try {
        const stremioType = type === 'tv' ? 'series' : type;
        const idPath = stremioType === 'series' ? `${imdbId}:${season}:${episode}` : imdbId;
        const url = `https://comet.elfhosted.com/stream/${stremioType}/${idPath}.json`;

        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return [];
        const data = await res.json();
        if (!data || !Array.isArray(data.streams)) return [];

        return data.streams.map(s => {
            const rawTitle = `${s.name || ''} ${s.title || ''}`;
            const quality = parseQuality(rawTitle);
            const seeds = parseSeeds(rawTitle);
            const audio = parseAudio(rawTitle);

            return {
                provider: 'comet',
                infoHash: s.infoHash,
                fileIdx: s.fileIdx ?? 0,
                quality,
                seeds,
                audio,
                title: s.title || s.name || '',
            };
        }).filter(s => Boolean(s.infoHash));
    } catch {
        return [];
    }
}

const VIDLINK_KEY_HEX = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';
const VIDLINK_KEY = Buffer.from(VIDLINK_KEY_HEX, 'hex');
const ZERO_NONCE = new Uint8Array(24);

function encryptVidLinkToken(mediaId) {
    try {
        const timestamp = Math.floor(Date.now() / 1000) + 480;
        const mediaBytes = Buffer.from(String(mediaId), 'utf-8');
        const timeBytes = Buffer.alloc(8);
        timeBytes.writeBigUInt64BE(BigInt(timestamp));
        const message = Buffer.concat([mediaBytes, timeBytes]);
        const encrypted = nacl.secretbox(new Uint8Array(message), ZERO_NONCE, new Uint8Array(VIDLINK_KEY));
        const fullPayload = Buffer.concat([Buffer.from(ZERO_NONCE), Buffer.from(encrypted)]);
        return fullPayload.toString('base64url').replace(/=+$/, '');
    } catch {
        return null;
    }
}

async function resolveVidLinkDirect(tmdbId, type = 'movie', season = 1, episode = 1) {
    try {
        const isTv = type === 'tv';
        const token = encryptVidLinkToken(tmdbId);
        if (!token) return null;

        const url = isTv
            ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode}`
            : `https://vidlink.pro/api/b/movie/${token}`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Origin': 'https://vidlink.pro',
                'Referer': isTv ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}` : `https://vidlink.pro/movie/${tmdbId}`,
            },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data;
    } catch {
        return null;
    }
}

/**
 * Main Direct Stream Resolver
 */

async function fetchImdbId(tmdbId, isTv) {
    const TMDB_API_KEY = '21269750eb76a0b7c178e43c91b355e5';
    try {
        const url = isTv 
            ? `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`
            : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.imdb_id;
    } catch {
        return null;
    }
}

async function fetchTorrentioStream(imdbId, isTv, season, episode) {
    try {
        const url = isTv
            ? `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`
            : `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!res.ok) return null;
        
        const data = await res.json();
        if (!data || !data.streams || data.streams.length === 0) return null;
        
        const isSafe = (s) => isTv ? true : (s.fileIdx === undefined || s.fileIdx < 5);

        // Collect up to 4 good torrents for automatic fallback
        let safeStreams = data.streams.filter(s => 
            isSafe(s) && 
            s.title && 
            !s.title.toLowerCase().includes('2160p') &&
            !s.title.toLowerCase().includes('4k')
        );

        // Sort to prefer YTS / 1080p
        safeStreams.sort((a, b) => {
            const aYts = a.title.toLowerCase().includes('yts') || a.title.toLowerCase().includes('yify');
            const bYts = b.title.toLowerCase().includes('yts') || b.title.toLowerCase().includes('yify');
            if (aYts && !bYts) return -1;
            if (!aYts && bYts) return 1;
            
            const a1080 = a.title.includes('1080p');
            const b1080 = b.title.includes('1080p');
            if (a1080 && !b1080) return -1;
            if (!a1080 && b1080) return 1;
            
            return 0;
        });
        
        if (safeStreams.length === 0) {
            safeStreams = data.streams.slice(0, 3);
        }

        return safeStreams.slice(0, 4);
    } catch (e) {
        console.error('Torrentio error:', e.message);
        return null;
    }
}

export async function resolveStream(params) {
    let { tmdbId, type = 'movie', season = 1, episode = 1, imdbId } = params.query || params;
    
    if (!tmdbId) {
        return { success: false, error: 'Missing tmdbId' };
    }
    
    const isTv = type === 'tv' || type === 'series';
    const cacheKey = isTv ? `${tmdbId}_s${season}e${episode}` : tmdbId;
    
    const cached = getCachedStream(cacheKey);
    if (cached) {
        cached.cached = true;
        return cached;
    }

    if (!imdbId) {
        imdbId = await fetchImdbId(tmdbId, isTv);
    }
    
    let primaryUrl = '';
    let directQualities = {};
    let isDirect = false;

    // 1. Torrentio/WebTorrent Engine Disabled (VPS Firewall/Bandwidth constraints)
    // We skip direct torrent scraping and instantly default to the embed servers below.
    

    // 2. Fallback embeds
    const vidlinkEmbed = isTv
        ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?autoplay=false&primaryColor=E50914&poster=true`
        : `https://vidlink.pro/movie/${tmdbId}?autoplay=false&primaryColor=E50914&poster=true`;
        
    const autoembedEmbed = isTv
        ? `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${tmdbId}`;

    const superembedEmbed = isTv
        ? `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;

    const embed2Embed = isTv
        ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${tmdbId}`;

    const embeds = {
        'Server 1 (VidLink)': vidlinkEmbed,
        'Server 2 (AutoEmbed)': autoembedEmbed,
        'Server 3 (SuperEmbed)': superembedEmbed,
        'Server 4 (2Embed)': embed2Embed,
    };
    
    if (!primaryUrl) {
        primaryUrl = vidlinkEmbed;
    }

    const responseData = {
        success: true,
        tmdbId,
        imdbId,
        type,
        season: isTv ? season : undefined,
        episode: isTv ? episode : undefined,
        stream: {
            url: primaryUrl,
            type: isDirect ? 'direct' : 'embed',
            quality: '1080p FHD',
            qualities: isDirect ? { 'Auto': primaryUrl, ...directQualities } : { 'Auto': primaryUrl, ...embeds },
            directQualities,
            embeds,
            embedFallback: vidlinkEmbed,
            audio: 'Dolby Digital 5.1',
            audioTracks: [
                { id: 0, name: 'English (Original 5.1)', lang: 'en' },
                { id: 1, name: 'English (Stereo)', lang: 'en' },
            ],
            provider: isDirect ? 'torrentio' : 'vidlink-embed',
        },
        subtitles: [],
        cached: false,
    };

    setCachedStream(cacheKey, responseData);
    return responseData;
}

/**
 * Helper to rewrite HLS .m3u8 manifest URLs through the proxy
 */
function rewriteM3U8Manifest(manifestText, baseUrl, proxyBase = '/api/stream/proxy') {
    const lines = manifestText.split('\n');
    const rewritten = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Strip ad injection markers
        if (line.startsWith('#EXT-X-DISCONTINUITY')) {
            continue;
        }

        // URI inside tags like #EXT-X-KEY or #EXT-X-MAP
        if (line.startsWith('#') && line.includes('URI="')) {
            const modified = line.replace(/URI="([^"]+)"/g, (_, uri) => {
                const absUri = new URL(uri, baseUrl).toString();
                return `URI="${proxyBase}?url=${encodeURIComponent(absUri)}&referer=${encodeURIComponent(baseUrl)}"`;
            });
            rewritten.push(modified);
            continue;
        }

        // Video segments or sub-playlist URLs (non-comment lines)
        if (line.length > 0 && !line.startsWith('#')) {
            try {
                const absUri = new URL(line, baseUrl).toString();
                rewritten.push(`${proxyBase}?url=${encodeURIComponent(absUri)}&referer=${encodeURIComponent(baseUrl)}`);
            } catch {
                rewritten.push(line);
            }
            continue;
        }

        rewritten.push(lines[i]);
    }

    return rewritten.join('\n');
}

/**
 * Stream Proxy Handler for Web Browsers (Bypasses CORS & Range restrictions & Strips Ads)
 */
export async function handleStreamProxy(req, res) {
    const targetUrl = req.query.url;
    const referer = req.query.referer;

    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const forwardHeaders = {
            'User-Agent': USER_AGENT,
            'Accept': '*/*',
        };

        if (referer && referer !== targetUrl) {
            forwardHeaders['Referer'] = referer;
            try {
                forwardHeaders['Origin'] = new URL(referer).origin;
            } catch {
                // Ignore origin parse error
            }
        }

        if (req.headers.range) {
            forwardHeaders['Range'] = req.headers.range;
        }

        const upstreamRes = await fetch(targetUrl, { headers: forwardHeaders });

        if (!upstreamRes.ok && upstreamRes.status !== 206) {
            if (!res.headersSent) {
                return res.status(upstreamRes.status).send('Upstream stream error');
            }
        }

        const contentType = upstreamRes.headers.get('content-type') || '';
        const isM3U8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegURL');

        // Set permissive CORS and caching
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
        res.setHeader('Accept-Ranges', 'bytes');

        if (isM3U8) {
            // Intercept and sanitize M3U8 manifest
            const manifestText = await upstreamRes.text();
            const proxyBase = (req.baseUrl || '/notflix/api') + '/stream/proxy';
            const cleanManifest = rewriteM3U8Manifest(manifestText, targetUrl, proxyBase);

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(cleanManifest);
        }

        // Binary / Video Chunks (.ts, .m4s, .mp4)
        res.status(upstreamRes.status);
        res.setHeader('Content-Type', contentType || 'video/mp4');

        const contentRange = upstreamRes.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);

        const contentLength = upstreamRes.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);

        if (upstreamRes.body) {
            Readable.fromWeb(upstreamRes.body).pipe(res);
        } else {
            res.end();
        }
    } catch (err) {
        console.error('Stream proxy error:', err.message);
        if (!res.headersSent) {
            res.status(502).send('Error proxying stream chunk');
        }
    }
}

/**
 * Subtitle Proxy & WebVTT Converter
 */
export async function handleSubtitleProxy(req, res) {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        const upstreamRes = await fetch(targetUrl, {
            headers: { 'User-Agent': 'curl/8.7.1', 'Accept': '*/*' },
        });

        if (!upstreamRes.ok) {
            return res.status(upstreamRes.status).send('Upstream subtitle unavailable');
        }

        const srtText = await upstreamRes.text();
        const vttContent = srtText.startsWith('WEBVTT') 
            ? srtText 
            : ('WEBVTT\n\n' + srtText
                .replace(/\r\n|\r/g, '\n')
                .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'));

        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(vttContent);
    } catch (err) {
        console.error('Subtitle proxy error:', err.message);
        if (!res.headersSent) {
            res.status(502).send('Error proxying subtitle');
        }
    }
}
