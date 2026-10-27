import { NotFlixData, notflixCatalog } from '../data/catalog.js';

export const HOSTED_BACKEND_URL = 'https://noah.enginner.et/notflix';

// Environment variable override for local testing (e.g. VITE_API_BASE_URL=http://localhost:3001)
const envApiUrl = import.meta.env?.VITE_API_BASE_URL || 
                  import.meta.env?.VITE_BACKEND_URL || 
                  import.meta.env?.VITE_SERVER_URL || 
                  import.meta.env?.VITE_API_BASE;

const getSubpathBase = () => {
    // 1. Production browser context detection (Plesk hosted or /notflix subpath)
    if (typeof window !== 'undefined') {
        const { hostname, pathname } = window.location;
        if (hostname === 'noah.enginner.et' || pathname.startsWith('/notflix')) {
            return '/notflix';
        }
    }

    // 2. Explicit local / dev env variable override
    if (typeof envApiUrl === 'string' && envApiUrl.trim()) {
        return envApiUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
    }

    // 3. Fallback for browser on other hosts or SSR
    if (typeof window !== 'undefined') {
        return '';
    }

    return HOSTED_BACKEND_URL;
};

export const API_BASE = getSubpathBase();

const CLIENT_TMDB_KEY = import.meta.env?.VITE_TMDB_API_KEY || import.meta.env?.TMDB_API_KEY || '21269750eb76a0b7c178e43c91b355e5';
const TMDB_DIRECT_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

class APIError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

const isValidImage = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeMediaItem = (item) => {
    if (!item || typeof item !== 'object') return null;

    const isAnime = item.type === 'anime' || item.isAnime || item.category === 'anime';
    const mediaType = isAnime ? 'anime' : (item.type === 'tv' ? 'tv' : 'movie');
    const id = item.id ?? item.tmdb_id;

    if (id === undefined || id === null || id === '') return null;

    return {
        ...item,
        id: String(id),
        tmdbId: String(id),
        type: mediaType,
        isAnime: isAnime,
        title: item.title || item.name || 'Unknown Title',
        overview: item.overview || '',
        backdrop: isValidImage(item.backdrop) ? item.backdrop : null,
        poster: isValidImage(item.poster) ? item.poster : null,
        rating: Number(item.rating) || 0,
        year: item.year || null,
        duration: item.duration || null,
        genres: Array.isArray(item.genres) ? item.genres : [],
        tag: item.tag || (isAnime ? 'Anime Series' : (mediaType === 'tv' ? 'Series' : 'Movie'))
    };
};

const mapTMDBItem = (item, defaultType = 'movie') => {
    if (!item || typeof item !== 'object') return null;
    const isAnime = defaultType === 'anime' || item.type === 'anime' || item.isAnime;
    const type = isAnime ? 'anime' : (item.media_type || (defaultType === 'tv' ? 'tv' : 'movie'));
    const title = item.title || item.name || item.original_name || item.original_title || 'Unknown Title';
    const match = Math.floor(Math.random() * 15) + 85;

    const backdrop = item.backdrop_path 
        ? `${IMAGE_BASE_URL}${item.backdrop_path}` 
        : (item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : null);
    const poster = item.poster_path 
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
        : (item.backdrop_path ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}` : null);

    return {
        id: String(item.id),
        tmdbId: String(item.id),
        type: type,
        isAnime: isAnime,
        title: title,
        overview: item.overview || '',
        backdrop: backdrop,
        poster: poster,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 0,
        match: match,
        year: item.release_date ? parseInt(item.release_date.substring(0, 4), 10) : (item.first_air_date ? parseInt(item.first_air_date.substring(0, 4), 10) : null),
        genres: Array.isArray(item.genres) ? item.genres.map(g => g.name || g) : (Array.isArray(item.genre_ids) ? ['Animation', 'Action'] : (isAnime ? ['Anime'] : [])),
        tag: isAnime ? 'Anime Series' : (type === 'tv' ? 'Series' : 'Movie'),
        duration: isAnime ? 'TV Anime' : (type === 'tv' ? '1 Season' : '2h'),
        cast: Array.isArray(item.credits?.cast)
            ? item.credits.cast.slice(0, 10).map(c => ({
                name: c.name,
                character: c.character,
                avatar: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : 'https://i.pravatar.cc/100'
            }))
            : []
    };
};

const fetchDirectTMDB = async (endpoint) => {
    if (!CLIENT_TMDB_KEY) return null;
    try {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${TMDB_DIRECT_BASE}${endpoint}${separator}api_key=${CLIENT_TMDB_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
};

const normalizeListResponse = (data) => {
    if (Array.isArray(data)) {
        return data.map(normalizeMediaItem).filter(Boolean);
    }

    if (data && Array.isArray(data.results)) {
        return data.results.map(normalizeMediaItem).filter(Boolean);
    }

    return [];
};

const normalizeDetailsResponse = (data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) {
        throw new Error('Invalid media response');
    }

    return normalizeMediaItem(data);
};

const apiRequest = async (endpoint, timeoutMs = 2500) => {
    // 1. Try primary configured API_BASE
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${API_BASE}${endpoint}`, { signal: controller.signal })
            .finally(() => clearTimeout(timer));

        const data = await response.json().catch(() => null);

        if (response.ok && data && typeof data === 'object' && (!data.error || Array.isArray(data.results))) {
            return data;
        }
    } catch (primaryErr) {
        // Primary failed or timed out, attempt hosted fallback
    }

    // 2. Dual-tier fallback to hosted backend on https://noah.enginner.et/notflix
    if (API_BASE !== HOSTED_BACKEND_URL && !API_BASE.includes('noah.enginner.et')) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            const fallbackUrl = `${HOSTED_BACKEND_URL}${endpoint}`;
            const response = await fetch(fallbackUrl, { signal: controller.signal })
                .finally(() => clearTimeout(timer));

            const data = await response.json().catch(() => null);

            if (response.ok && data && typeof data === 'object' && (!data.error || Array.isArray(data.results))) {
                return data;
            }
        } catch (fallbackErr) {
            // Hosted fallback also failed
        }
    }

    throw new APIError('Network error', 0);
};

const requestListWithFallback = async (endpoint, fallbackFactory, directTMDBPath, defaultType = 'movie') => {
    try {
        const data = await apiRequest(endpoint);
        const list = normalizeListResponse(data);
        if (list.length > 0) return list;
    } catch {
        // Backend unavailable or 404, silently fallback
    }

    if (directTMDBPath && CLIENT_TMDB_KEY) {
        try {
            const tmdbData = await fetchDirectTMDB(directTMDBPath);
            if (tmdbData && Array.isArray(tmdbData.results) && tmdbData.results.length > 0) {
                const mapped = tmdbData.results
                    .map(i => mapTMDBItem(i, defaultType))
                    .filter(i => i && (i.backdrop || i.poster));
                if (mapped.length > 0) return mapped;
            }
        } catch {
            // fall through to catalog
        }
    }

    const fallback = typeof fallbackFactory === 'function' ? fallbackFactory() : [];
    return normalizeListResponse(fallback);
};

const requestMediaWithFallback = async (endpoint, fallbackFactory, directTMDBPath, defaultType = 'movie') => {
    try {
        const data = await apiRequest(endpoint);
        const item = normalizeDetailsResponse(data);
        if (item) return item;
    } catch {
        if (directTMDBPath && CLIENT_TMDB_KEY) {
            try {
                const tmdbData = await fetchDirectTMDB(directTMDBPath);
                if (tmdbData && !tmdbData.error) {
                    const mapped = mapTMDBItem(tmdbData, defaultType);
                    if (mapped) return mapped;
                }
            } catch {
                // fall through to catalog
            }
        }
    }
    const fallback = typeof fallbackFactory === 'function' ? fallbackFactory() : null;
    return fallback ? normalizeMediaItem(fallback) : null;
};

export { normalizeListResponse };

export const TMDBService = {
    getImageUrl: (path, size = 'original') => {
        if (!path || typeof path !== 'string' || !path.trim()) return '/notflix-logo.png';
        const trimmed = path.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/assets') || trimmed.startsWith('data:') || trimmed.startsWith('/notflix-logo.png')) {
            return trimmed;
        }
        const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        const cleanSize = size === 'w500' || size === 'w300' || size === 'w185' || size === 'w92' || size === 'original' ? size : 'original';
        return `https://image.tmdb.org/t/p/${cleanSize}${cleanPath}`;
    },
    searchMulti: (query) => TMDBService.searchMedia(query),
    getDetails: (type, id) => TMDBService.getMediaDetails(id, type),
    getRecommendations: (type, id) => TMDBService.getSimilarMedia(id, type),
    resolveStream: (tmdbId, type = 'movie', season = 1, episode = 1, provider = 'auto') => 
        TMDBService.getStreamSource(tmdbId, type, season, episode, provider),
    getTrendingMovies: () => requestListWithFallback(
        '/api/tmdb/trending', 
        () => NotFlixData.getMovies(),
        '/trending/movie/week',
        'movie'
    ),
    getTrendingTV: () => requestListWithFallback(
        '/api/tmdb/trending/tv', 
        () => NotFlixData.getTVShows(),
        '/trending/tv/week',
        'tv'
    ),
    getTopRatedMovies: () => requestListWithFallback(
        '/api/tmdb/top-rated/movies', 
        () => [...NotFlixData.getMovies()].sort((a, b) => (b.rating || 0) - (a.rating || 0)),
        '/movie/top_rated',
        'movie'
    ),
    getTopRatedTV: () => requestListWithFallback(
        '/api/tmdb/top-rated/tv', 
        () => [...NotFlixData.getTVShows()].sort((a, b) => (b.rating || 0) - (a.rating || 0)),
        '/tv/top_rated',
        'tv'
    ),
    getNowPlayingMovies: () => requestListWithFallback(
        '/api/tmdb/now-playing', 
        () => [...NotFlixData.getMovies()].reverse(),
        '/movie/now_playing',
        'movie'
    ),
    getActionMovies: () => requestListWithFallback(
        '/api/tmdb/action/movies', 
        () => {
            const action = NotFlixData.getByGenre('Action');
            return action.length > 0 ? action : NotFlixData.getMovies();
        },
        '/discover/movie?with_genres=28',
        'movie'
    ),
    getComedyMovies: () => requestListWithFallback(
        '/api/tmdb/comedy/movies', 
        () => {
            const comedy = NotFlixData.getByGenre('Comedy');
            return comedy.length > 0 ? comedy : NotFlixData.getMovies();
        },
        '/discover/movie?with_genres=35',
        'movie'
    ),
    getPopularMovies: () => requestListWithFallback(
        '/api/tmdb/popular/movies', 
        () => NotFlixData.getMovies(),
        '/movie/popular',
        'movie'
    ),
    getActionTV: () => requestListWithFallback(
        '/api/tmdb/action/tv', 
        () => NotFlixData.getTVShows(),
        '/discover/tv?with_genres=10759',
        'tv'
    ),
    getPopularTV: () => requestListWithFallback(
        '/api/tmdb/popular/tv', 
        () => NotFlixData.getTVShows(),
        '/tv/popular',
        'tv'
    ),
    getAnimeTrending: () => requestListWithFallback(
        '/api/tmdb/anime/trending',
        () => NotFlixData.getAnime(),
        '/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc',
        'anime'
    ),
    getAnimeAiring: () => requestListWithFallback(
        '/api/tmdb/anime/airing',
        () => NotFlixData.getAnime(),
        '/discover/tv?with_genres=16&with_original_language=ja&air_date.gte=2024-01-01&sort_by=popularity.desc',
        'anime'
    ),
    getAnimePopular: () => requestListWithFallback(
        '/api/tmdb/anime/popular',
        () => NotFlixData.getAnime(),
        '/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_count.desc',
        'anime'
    ),
    getAnimeTopRated: () => requestListWithFallback(
        '/api/tmdb/anime/top-rated',
        () => NotFlixData.getAnime(),
        '/discover/tv?with_genres=16&with_original_language=ja&sort_by=vote_average.desc&vote_count.gte=100',
        'anime'
    ),
    getAnimeUpcoming: () => requestListWithFallback(
        '/api/tmdb/anime/upcoming',
        () => NotFlixData.getAnime(),
        '/discover/tv?with_genres=16&with_original_language=ja&first_air_date.gte=2025-01-01&sort_by=popularity.desc',
        'anime'
    ),
    getAnimeAction: () => requestListWithFallback(
        '/api/tmdb/anime/action',
        () => NotFlixData.getAnime(),
        '/discover/tv?with_genres=16,10759&with_original_language=ja&sort_by=popularity.desc',
        'anime'
    ),
    getAnimeByGenre: (genre) => {
        const genreMap = {
            'Action': '10759',
            'Adventure': '10759',
            'Comedy': '35',
            'Drama': '18',
            'Fantasy': '10765',
            'Horror': '9648',
            'Mystery': '9648',
            'Romance': '10749',
            'Sci-Fi': '10765',
            'Supernatural': '10765'
        };
        const genreParam = genreMap[genre] || '16';
        return requestListWithFallback(
            `/api/tmdb/anime/genre/${encodeURIComponent(genre)}`,
            () => NotFlixData.getAnime(),
            `/discover/tv?with_genres=16,${genreParam}&with_original_language=ja&sort_by=popularity.desc`,
            'anime'
        );
    },

    getMediaDetails: (id, type = 'movie') => requestMediaWithFallback(
        `/api/tmdb/${type}/${id}`, 
        () => {
            const match = NotFlixData.getById(id);
            if (match) return match;
            const template = notflixCatalog.find(i => i.type === type) || notflixCatalog[0];
            return {
                ...template,
                id: String(id),
                type: type,
                title: template.title
            };
        },
        `/${type}/${id}?append_to_response=credits,videos,similar`,
        type
    ),
    getMediaCast: (id, type = 'movie') => requestListWithFallback(
        `/api/tmdb/media/${type}/${id}/cast`, 
        () => {
            const item = NotFlixData.getById(id);
            return (item && item.cast) || notflixCatalog[0]?.cast || [];
        },
        `/${type}/${id}/credits`,
        type
    ),
    getMediaVideos: (id, type = 'movie') => requestListWithFallback(
        `/api/tmdb/media/${type}/${id}/videos`, 
        () => [{ id: '1', key: 'dQw4w9WgXcQ', name: 'Official Trailer', type: 'Trailer', site: 'YouTube' }],
        `/${type}/${id}/videos`,
        type
    ),
    getSimilarMedia: (id, type = 'movie') => requestListWithFallback(
        `/api/tmdb/media/${type}/${id}/similar`, 
        () => {
            const filtered = notflixCatalog.filter(i => String(i.id) !== String(id) && i.type === type);
            return filtered.length > 0 ? filtered : notflixCatalog.filter(i => String(i.id) !== String(id));
        },
        `/${type}/${id}/similar`,
        type
    ),
    getSeasonDetails: async (tvId, seasonNumber) => {
        try {
            const data = await apiRequest(`/api/tmdb/tv/${tvId}/season/${seasonNumber}`);
            if (data && typeof data === 'object' && Array.isArray(data.episodes) && data.episodes.length > 0) {
                return data;
            }
        } catch {
            if (CLIENT_TMDB_KEY) {
                try {
                    const tmdbData = await fetchDirectTMDB(`/tv/${tvId}/season/${seasonNumber}`);
                    if (tmdbData && Array.isArray(tmdbData.episodes)) {
                        return {
                            seasonNumber: Number(seasonNumber),
                            episodes: tmdbData.episodes.map(ep => ({
                                episodeNumber: ep.episode_number,
                                title: ep.name,
                                overview: ep.overview,
                                duration: ep.runtime ? `${ep.runtime}m` : '45m',
                                thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null
                            }))
                        };
                    }
                } catch {
                    // fall through
                }
            }
        }
        const show = NotFlixData.getById(tvId) || notflixCatalog.find(i => i.type === 'tv');
        const sNum = parseInt(seasonNumber, 10) || 1;
        const season = show?.seasons?.find(s => s.seasonNumber === sNum) || show?.seasons?.[0];
        if (season && Array.isArray(season.episodes)) {
            return season;
        }
        return {
            seasonNumber: sNum,
            episodes: [
                { episodeNumber: 1, title: 'Episode 1: Pilot', overview: 'The story begins.', duration: '45m' },
                { episodeNumber: 2, title: 'Episode 2: Discovery', overview: 'A strange revelation.', duration: '48m' },
                { episodeNumber: 3, title: 'Episode 3: Confrontation', overview: 'Tension escalates.', duration: '50m' }
            ]
        };
    },
    getGenres: () => requestListWithFallback('/api/tmdb/genres', () => {
        return NotFlixData.getGenresList().map((g, i) => ({ id: i + 1, name: g }));
    }),

    searchMedia: async (query, filters = {}) => {
        try {
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            params.append('type', filters.type || 'all');
            if (filters.genres && filters.genres.length > 0) params.append('genres', filters.genres.join(','));
            if (filters.providers && filters.providers.length > 0) params.append('providers', filters.providers.join(','));
            if (filters.year) params.append('year', filters.year);
            if (filters.rating) params.append('rating', filters.rating);
            
            const data = await apiRequest(`/api/tmdb/search?${params.toString()}`);
            const list = normalizeListResponse(data);
            if (list.length > 0) return list;
        } catch {
            if (query && CLIENT_TMDB_KEY) {
                try {
                    let tmdbData = await fetchDirectTMDB(`/search/multi?query=${encodeURIComponent(query)}`);
                    if ((!tmdbData || !Array.isArray(tmdbData.results) || tmdbData.results.length === 0) && query.trim().length >= 3) {
                        const cleanQ = query.toLowerCase().trim();
                        const variants = [
                            cleanQ.includes('ie') ? cleanQ.replace(/ie/g, 'ei') : null,
                            cleanQ.includes('ei') ? cleanQ.replace(/ei/g, 'ie') : null,
                            cleanQ.includes('rak') ? cleanQ.replace('rak', 'reak') : null,
                            cleanQ.includes('ak') ? cleanQ.replace('ak', 'eak') : null,
                            cleanQ.includes('spidr') ? cleanQ.replace('spidr', 'spider') : null,
                            cleanQ.includes('avengr') ? cleanQ.replace('avengr', 'avenger') : null,
                            cleanQ.includes('oppenhiemer') ? 'oppenheimer' : null,
                            cleanQ.includes('interstelar') ? 'interstellar' : null,
                        ].filter(Boolean);

                        for (const v of variants) {
                            const altRes = await fetchDirectTMDB(`/search/multi?query=${encodeURIComponent(v)}`);
                            if (altRes && Array.isArray(altRes.results) && altRes.results.length > 0) {
                                tmdbData = altRes;
                                break;
                            }
                        }
                    }

                    if (tmdbData && Array.isArray(tmdbData.results) && tmdbData.results.length > 0) {
                        const mapped = tmdbData.results
                            .filter(i => i.media_type === 'movie' || i.media_type === 'tv')
                            .map(i => mapTMDBItem(i, i.media_type))
                            .filter(i => i.backdrop || i.poster);
                        if (mapped.length > 0) return mapped;
                    }
                } catch {
                    // fall through
                }
            }
        }
        
        let results = NotFlixData.search(query || '');
        if ((!query || !query.trim()) && results.length === 0) {
            results = notflixCatalog;
        }
        if (filters.type && filters.type !== 'all') {
            results = results.filter(i => i.type === filters.type);
        }
        if (filters.rating) {
            const minRating = Number(filters.rating) || 0;
            results = results.filter(i => (i.rating || 0) >= minRating);
        }
        return normalizeListResponse(results);
    },

    getActorCredits: (actorId) => requestListWithFallback(`/api/tmdb/actor/${actorId}/credits`, () => {
        return NotFlixData.getMovies().slice(0, 8);
    }),

    getStreamSource: async (tmdbId, type = 'movie', season = 1, episode = 1, provider = 'auto') => {
        try {
            const providerParam = provider && provider !== 'auto' ? `&provider=${encodeURIComponent(provider)}` : '';
            const endpoint = `/api/stream?tmdbId=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(type)}&season=${encodeURIComponent(season)}&episode=${encodeURIComponent(episode)}${providerParam}`;
            
            let response = null;
            try {
                response = await fetch(`${API_BASE}${endpoint}`, { signal: AbortSignal.timeout(10000) });
            } catch {
                // fallback removed to prevent CORS on local IPs
            }

            if (response && response.ok) {
                const data = await response.json();
                if (data && data.stream && data.stream.url) {
                    // Resolve relative API paths to absolute stream URLs
                    const makeAbsUrl = (u) => {
                        if (!u) return '';
                        if (u.startsWith('http://') || u.startsWith('https://')) return u;
                        const base = API_BASE.startsWith('http') ? API_BASE : (API_BASE || '');
                        return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
                    };

                    const absStreamUrl = makeAbsUrl(data.stream.url);
                    const absQualities = {};
                    if (data.stream.qualities && typeof data.stream.qualities === 'object') {
                        for (const [qKey, qUrl] of Object.entries(data.stream.qualities)) {
                            absQualities[qKey] = makeAbsUrl(qUrl);
                        }
                    } else {
                        absQualities[data.stream.quality || '1080p'] = absStreamUrl;
                    }

                    const absSubtitles = (data.subtitles || []).map(s => ({
                        ...s,
                        url: makeAbsUrl(s.url),
                        vttUrl: makeAbsUrl(s.url),
                    }));

                    return {
                        ...data,
                        stream: {
                            ...data.stream,
                            url: absStreamUrl,
                            qualities: absQualities,
                        },
                        subtitles: absSubtitles,
                    };
                }
            }
        } catch (e) {
            console.warn('Stream resolver query warning:', e.message);
        }

        // Check catalog mock item with demo trailer
        const catalogItem = notflixCatalog.find(c => String(c.id) === String(tmdbId));
        if (catalogItem && catalogItem.trailer) {
            return {
                success: true,
                stream: {
                    url: catalogItem.trailer,
                    type: 'mp4',
                    quality: '1080p',
                    qualities: { '1080p': catalogItem.trailer },
                    audio: 'Dolby Digital 5.1',
                    audioTracks: [{ id: 0, name: 'English (Original)', lang: 'en' }],
                    provider: 'catalog-trailer'
                },
                subtitles: []
            };
        }

        // Resilient fallback video stream
        const demoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        return {
            success: true,
            stream: {
                url: demoUrl,
                type: 'mp4',
                quality: '1080p',
                qualities: { '1080p': demoUrl },
                audio: 'Dolby Digital 5.1',
                audioTracks: [{ id: 0, name: 'English (Original)', lang: 'en' }],
                provider: 'direct-cdn'
            },
            subtitles: []
        };
    },

    getStreamProxyUrl: (streamUrl, referer = '') => {
        if (!streamUrl) return '';
        if (streamUrl.includes('/api/stream/torrent')) return streamUrl;
        const encodedUrl = encodeURIComponent(streamUrl);
        const refParam = referer ? `&referer=${encodeURIComponent(referer)}` : '';
        const base = API_BASE.startsWith('http') ? API_BASE : (API_BASE || '');
        return `${base}/api/stream/proxy?url=${encodedUrl}${refParam}`;
    },

    getSubtitleProxyUrl: (subUrl) => {
        if (!subUrl) return '';
        const encodedUrl = encodeURIComponent(subUrl);
        const base = API_BASE.startsWith('http') ? API_BASE : (API_BASE || '');
        return `${base}/api/stream/subtitles?url=${encodedUrl}`;
    }
};
