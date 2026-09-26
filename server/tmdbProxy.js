import fs from 'fs';

const loadServerEnv = () => {
    const candidates = [
        decodeURIComponent(new URL('./.env', import.meta.url).pathname),
        decodeURIComponent(new URL('../.env', import.meta.url).pathname),
        decodeURIComponent(new URL('../.env.local', import.meta.url).pathname)
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) continue;

        fs.readFileSync(envPath, 'utf8')
            .split(/\r?\n/)
            .forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;

                const separatorIndex = trimmed.indexOf('=');
                if (separatorIndex === -1) return;

                const key = trimmed.slice(0, separatorIndex).trim();
                const value = trimmed.slice(separatorIndex + 1).trim();
                if (key && value && process.env[key] === undefined) {
                    process.env[key] = value;
                }
            });
    }
};

loadServerEnv();

const TMDB_API_KEY = process.env.TMDB_API_KEY || "21269750eb76a0b7c178e43c91b355e5";
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
    console.warn('[TMDB Proxy] Warning: TMDB_API_KEY environment variable is not set. TMDB requests will fail.');
}

const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getCached = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }
    return entry.data;
};

const setCached = (key, data, ttlMs = CACHE_TTL_MS) => {
    cache.set(key, { data, expiry: Date.now() + ttlMs });
};

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

const mapTMDBToNotFlix = (item, defaultType = 'movie') => {
    const type = item.media_type || defaultType;
    const title = item.title || item.name || 'Unknown Title';
    const match = Math.floor(Math.random() * 20) + 80;

    return {
        id: item.id.toString(),
        type: type,
        title: title,
        overview: item.overview || 'No overview available.',
        backdrop: item.backdrop_path ? `${IMAGE_BASE_URL}${item.backdrop_path}` : null,
        poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : null,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 0,
        match: match,
        year: item.release_date ? parseInt(item.release_date.substring(0, 4)) : (item.first_air_date ? parseInt(item.first_air_date.substring(0, 4)) : null),
        genres: [],
        tag: type === 'movie' ? 'Movie' : 'Series',
        duration: type === 'movie' ? '2h' : '1 Season',
        cast: [],
        trailer: "https://www.w3schools.com/html/mov_bbb.mp4"
    };
};

const fetchTMDB = async (endpoint) => {
    const cached = getCached(endpoint);
    if (cached) return cached;

    if (!TMDB_API_KEY) {
        console.warn('[TMDB Proxy] Warning: TMDB_API_KEY is not configured');
        return [];
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${TMDB_API_KEY}`;

    console.log('Fetching TMDB:', endpoint);

    const response = await fetch(url);
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`TMDB API Error: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
    }
    const data = await response.json();
    const results = data.results || [];
    setCached(endpoint, results);
    return results;
};

const fetchTMDBItem = async (endpoint) => {
    const cached = getCached(endpoint);
    if (cached) return cached;

    if (!TMDB_API_KEY) {
        console.warn('[TMDB Proxy] Warning: TMDB_API_KEY is not configured');
        return null;
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${TMDB_API_KEY}`;

    console.log('Fetching TMDB:', endpoint);

    const response = await fetch(url);
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`TMDB API Error: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
    }
    const data = await response.json();
    setCached(endpoint, data);
    return data;
};

export const TMDBService = {
    getTrendingMovies: async () => {
        const results = await fetchTMDB('/trending/movie/week');
        return results.map(item => mapTMDBToNotFlix(item, 'movie')).filter(i => i.backdrop && i.poster);
    },

    getTrendingTV: async () => {
        const results = await fetchTMDB('/trending/tv/week');
        return results.map(item => mapTMDBToNotFlix(item, 'tv')).filter(i => i.backdrop && i.poster);
    },

    getTopRatedMovies: async () => {
        const results = await fetchTMDB('/discover/movie?sort_by=vote_average.desc&vote_count.gte=10000');
        return results.map(item => mapTMDBToNotFlix(item, 'movie')).filter(i => i.backdrop && i.poster);
    },

    getTopRatedTV: async () => {
        const results = await fetchTMDB('/discover/tv?sort_by=vote_average.desc&vote_count.gte=5000');
        return results.map(item => mapTMDBToNotFlix(item, 'tv')).filter(i => i.backdrop && i.poster);
    },

    getNowPlayingMovies: async () => {
        const results = await fetchTMDB('/movie/now_playing');
        return results.map(item => mapTMDBToNotFlix(item, 'movie')).filter(i => i.backdrop && i.poster);
    },

    getActionMovies: async () => {
        const results = await fetchTMDB('/discover/movie?with_genres=28');
        return results.map(item => mapTMDBToNotFlix(item, 'movie')).filter(i => i.backdrop && i.poster);
    },

    getComedyMovies: async () => {
        const results = await fetchTMDB('/discover/movie?with_genres=35');
        return results.map(item => mapTMDBToNotFlix(item, 'movie')).filter(i => i.backdrop && i.poster);
    },

    getPopularMovies: async () => {
        const results = await fetchTMDB('/discover/movie?sort_by=revenue.desc');
        return results.map(item => mapTMDBToNotFlix(item, 'movie')).filter(i => i.backdrop && i.poster);
    },

    getActionTV: async () => {
        const results = await fetchTMDB('/discover/tv?with_genres=10759');
        return results.map(item => mapTMDBToNotFlix(item, 'tv')).filter(i => i.backdrop && i.poster);
    },

    getPopularTV: async () => {
        const results = await fetchTMDB('/discover/tv?sort_by=vote_count.desc');
        return results.map(item => mapTMDBToNotFlix(item, 'tv')).filter(i => i.backdrop && i.poster);
    },

    getMediaDetails: async (id, type = 'movie') => {
        const data = await fetchTMDBItem(`/${type}/${id}`);
        const mapped = mapTMDBToNotFlix(data, type);
        mapped.genres = data.genres ? data.genres.map(g => g.name) : [];
        
        if (type === 'movie') {
            const h = Math.floor(data.runtime / 60);
            const m = data.runtime % 60;
            mapped.duration = data.runtime ? `${h}h ${m}m` : 'N/A';
        } else {
            mapped.duration = data.number_of_seasons ? `${data.number_of_seasons} Seasons` : '1 Season';
            mapped.totalSeasons = data.number_of_seasons || 1;
        }
        
        return mapped;
    },

    getMediaCast: async (id, type = 'movie') => {
        const data = await fetchTMDBItem(`/${type}/${id}/credits`);
        if (!data || !data.cast) return [];
        return data.cast.slice(0, 10).map(actor => ({
            id: actor.id,
            name: actor.name,
            character: actor.character,
            avatar: actor.profile_path ? `${IMAGE_BASE_URL}${actor.profile_path}` : 'https://via.placeholder.com/150'
        }));
    },

    getMediaVideos: async (id, type = 'movie') => {
        const data = await fetchTMDBItem(`/${type}/${id}/videos`);
        if (!data || !data.results) return [];
        return data.results.filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip'));
    },

    getActorCredits: async (actorId) => {
        const data = await fetchTMDBItem(`/person/${actorId}/combined_credits`);
        if (!data || !data.cast) return [];
        return data.cast
            .map(item => mapTMDBToNotFlix(item, item.media_type))
            .filter(i => i.backdrop && i.poster)
            .sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
    },

    getSimilarMedia: async (id, type = 'movie') => {
        const results = await fetchTMDB(`/${type}/${id}/similar`);
        return results.map(item => mapTMDBToNotFlix(item, type)).filter(i => i.backdrop && i.poster);
    },

    getSeasonDetails: async (tvId, seasonNumber) => {
        const data = await fetchTMDBItem(`/tv/${tvId}/season/${seasonNumber}`);
        if (!data) return null;
        return {
            seasonNumber: data.season_number,
            name: data.name || `Season ${seasonNumber}`,
            episodes: (data.episodes || []).map(ep => ({
                episodeNumber: ep.episode_number,
                name: ep.name || `Episode ${ep.episode_number}`,
                overview: ep.overview || '',
                still: ep.still_path ? `${IMAGE_BASE_URL}${ep.still_path}` : null,
                runtime: ep.runtime || 0,
                airDate: ep.air_date
            }))
        };
    },

    getGenres: async () => {
        const [movieData, tvData] = await Promise.all([
            fetchTMDBItem('/genre/movie/list'),
            fetchTMDBItem('/genre/tv/list')
        ]);
        
        const movieGenres = movieData?.genres || [];
        const tvGenres = tvData?.genres || [];
        
        const genreMap = new Map();
        [...movieGenres, ...tvGenres].forEach(g => {
            genreMap.set(g.id, g.name);
        });
        
        return Array.from(genreMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    searchMedia: async (query, filters = {}) => {
        const { type = 'all', genres = [], providers = [], year, rating } = filters;
        
        let endpoint = '';
        let queryParams = '';
        
        if (query && query.trim() !== '') {
            if (type === 'movie') endpoint = '/search/movie';
            else if (type === 'tv') endpoint = '/search/tv';
            else endpoint = '/search/multi';
            
            queryParams += `&query=${encodeURIComponent(query)}`;
        } else {
            if (type === 'movie' || type === 'all') endpoint = '/discover/movie';
            else endpoint = '/discover/tv';
            
            if (genres.length > 0) {
                queryParams += `&with_genres=${encodeURIComponent(genres.join('|'))}`;
            }
            if (providers.length > 0) {
                queryParams += `&with_watch_providers=${encodeURIComponent(providers.join('|'))}&watch_region=US`;
            }
            if (year) {
                if (endpoint.includes('movie')) queryParams += `&primary_release_year=${year}`;
                if (endpoint.includes('tv')) queryParams += `&first_air_date_year=${year}`;
            }
            if (rating) {
                queryParams += `&vote_average.gte=${rating}`;
            }
        }

        let results = await fetchTMDB(`${endpoint}?include_adult=false${queryParams}`);
        
        // Typo-tolerant fallback: if TMDB returned 0 results, test phonetic and character variations
        if ((!results || results.length === 0) && query && query.trim().length >= 3) {
            const cleanQ = query.toLowerCase().trim();
            const variants = new Set();
            if (cleanQ.includes('ie')) variants.add(cleanQ.replace(/ie/g, 'ei'));
            if (cleanQ.includes('ei')) variants.add(cleanQ.replace(/ei/g, 'ie'));
            if (cleanQ.includes('rak')) variants.add(cleanQ.replace('rak', 'reak'));
            if (cleanQ.includes('ak')) variants.add(cleanQ.replace('ak', 'eak'));
            if (cleanQ.includes('spidr')) variants.add(cleanQ.replace('spidr', 'spider'));
            if (cleanQ.includes('avengr')) variants.add(cleanQ.replace('avengr', 'avenger'));
            if (cleanQ.includes('oppenhiemer')) variants.add('oppenheimer');
            if (cleanQ.includes('interstelar')) variants.add('interstellar');
            const dedupe = cleanQ.replace(/(.)\1+/g, '$1');
            if (dedupe !== cleanQ) variants.add(dedupe);
            const words = cleanQ.split(/\s+/).filter(w => w.length >= 4);
            for (const w of words) variants.add(w);

            for (const variant of variants) {
                if (variant === cleanQ) continue;
                const altResults = await fetchTMDB(`${endpoint}?include_adult=false&query=${encodeURIComponent(variant)}`);
                if (altResults && altResults.length > 0) {
                    results = altResults;
                    break;
                }
            }
        }
        
        let mapped = results.map(item => mapTMDBToNotFlix(item, endpoint.includes('tv') ? 'tv' : 'movie'))
            .filter(i => i.backdrop && i.poster);

        if (query && query.trim() !== '') {
            if (year) {
                mapped = mapped.filter(item => item.year === parseInt(year));
            }
            if (rating) {
                mapped = mapped.filter(item => item.rating >= parseInt(rating));
            }
        }
        
        if (!query && type === 'all') {
            const tvEndpoint = '/discover/tv';
            const tvResults = await fetchTMDB(`${tvEndpoint}?include_adult=false${queryParams}`);
            const tvMapped = tvResults.map(item => mapTMDBToNotFlix(item, 'tv'))
                .filter(i => i.backdrop && i.poster);
            
            let blended = [];
            const maxLen = Math.max(mapped.length, tvMapped.length);
            for (let i = 0; i < maxLen; i++) {
                if (mapped[i]) blended.push(mapped[i]);
                if (tvMapped[i]) blended.push(tvMapped[i]);
            }
            mapped = blended;
        }

        return mapped;
    },

    getExternalIds: async (id, type = 'movie') => {
        const data = await fetchTMDBItem(`/${type}/${id}/external_ids`);
        return data || {};
    }
};