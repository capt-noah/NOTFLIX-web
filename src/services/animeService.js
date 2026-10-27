import { API_BASE, HOSTED_BACKEND_URL, TMDBService } from './api.js';

// Cache for client-side queries
const clientCache = new Map();
const getClientCached = (key) => {
    const entry = clientCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        clientCache.delete(key);
        return null;
    }
    return entry.data;
};

const setClientCached = (key, data, ttlSeconds = 180) => {
    clientCache.set(key, {
        data,
        expiry: Date.now() + ttlSeconds * 1000
    });
};

const apiFetch = async (endpoint) => {
    // 1. Try configured API_BASE
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        // Proceed to fallback
    }

    // 2. Dual-tier fallback to hosted backend on https://noah.enginner.et/notflix
    if (API_BASE !== HOSTED_BACKEND_URL && !API_BASE.includes('noah.enginner.et')) {
        try {
            const res = await fetch(`${HOSTED_BACKEND_URL}${endpoint}`, {
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            // Fall through
        }
    }

    console.warn(`[AnimeService] Failed to fetch ${endpoint} from all endpoints`);
    throw new Error(`API error ${endpoint}`);
};

// Client-side AniList fallback if backend proxy is down or during standalone preview
const fallbackAniListQuery = async (query, variables = {}) => {
    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        if (!response.ok) return null;
        const json = await response.json();
        return json.data;
    } catch (e) {
        return null;
    }
};

const ANIME_TMDB_MAP = {
    '113415': { tmdbId: 95479, season: 1, totalSeasons: 2, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 24, id: '113415' }, { seasonNumber: 2, name: 'Season 2: Shibuya Incident', episodeCount: 23, id: '145064' }] },
    '145064': { tmdbId: 95479, season: 2, totalSeasons: 2, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 24, id: '113415' }, { seasonNumber: 2, name: 'Season 2: Shibuya Incident', episodeCount: 23, id: '145064' }] },
    '131573': { tmdbId: 810693, isMovie: true, seasons: [{ seasonNumber: 1, name: 'Movie: JUJUTSU KAISEN 0', episodeCount: 1, id: '131573' }] },
    '85937': { tmdbId: 85937, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1: Unwavering Resolve', episodeCount: 26, id: '101922' }, { seasonNumber: 2, name: 'Season 2: Entertainment District', episodeCount: 18, id: '129874' }, { seasonNumber: 3, name: 'Season 3: Swordsmith Village', episodeCount: 11, id: '145139' }, { seasonNumber: 4, name: 'Season 4: Hashira Training', episodeCount: 8, id: '166240' }] },
    '101922': { tmdbId: 85937, season: 1, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1: Unwavering Resolve', episodeCount: 26, id: '101922' }, { seasonNumber: 2, name: 'Season 2: Entertainment District', episodeCount: 18, id: '129874' }, { seasonNumber: 3, name: 'Season 3: Swordsmith Village', episodeCount: 11, id: '145139' }, { seasonNumber: 4, name: 'Season 4: Hashira Training', episodeCount: 8, id: '166240' }] },
    '129874': { tmdbId: 85937, season: 2, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 26, id: '101922' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 18, id: '129874' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 11, id: '145139' }, { seasonNumber: 4, name: 'Season 4', episodeCount: 8, id: '166240' }] },
    '145139': { tmdbId: 85937, season: 3, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 26, id: '101922' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 18, id: '129874' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 11, id: '145139' }, { seasonNumber: 4, name: 'Season 4', episodeCount: 8, id: '166240' }] },
    '166240': { tmdbId: 85937, season: 4, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 26, id: '101922' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 18, id: '129874' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 11, id: '145139' }, { seasonNumber: 4, name: 'Season 4', episodeCount: 8, id: '166240' }] },
    '16498': { tmdbId: 1429, season: 1, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 25, id: '16498' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 12, id: '20958' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 22, id: '99147' }, { seasonNumber: 4, name: 'Season 4: Final Season', episodeCount: 28, id: '110277' }] },
    '20958': { tmdbId: 1429, season: 2, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 25, id: '16498' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 12, id: '20958' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 22, id: '99147' }, { seasonNumber: 4, name: 'Season 4: Final Season', episodeCount: 28, id: '110277' }] },
    '99147': { tmdbId: 1429, season: 3, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 25, id: '16498' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 12, id: '20958' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 22, id: '99147' }, { seasonNumber: 4, name: 'Season 4: Final Season', episodeCount: 28, id: '110277' }] },
    '110277': { tmdbId: 1429, season: 4, totalSeasons: 4, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 25, id: '16498' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 12, id: '20958' }, { seasonNumber: 3, name: 'Season 3', episodeCount: 22, id: '99147' }, { seasonNumber: 4, name: 'Season 4: Final Season', episodeCount: 28, id: '110277' }] },
    '21': { tmdbId: 37854, totalSeasons: 1, seasons: [{ seasonNumber: 1, name: 'All Episodes', episodeCount: 1120, id: '21' }] },
    '151807': { tmdbId: 127532, season: 1, totalSeasons: 2, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 12, id: '151807' }, { seasonNumber: 2, name: 'Season 2: Arise from the Shadow', episodeCount: 12, id: '173778' }] },
    '173778': { tmdbId: 127532, season: 2, totalSeasons: 2, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 12, id: '151807' }, { seasonNumber: 2, name: 'Season 2: Arise from the Shadow', episodeCount: 12, id: '173778' }] },
    '127230': { tmdbId: 114410, season: 1, totalSeasons: 1, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 12, id: '127230' }] },
    '20': { tmdbId: 46260, totalSeasons: 5, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 52 }, { seasonNumber: 2, name: 'Season 2', episodeCount: 52 }, { seasonNumber: 3, name: 'Season 3', episodeCount: 52 }, { seasonNumber: 4, name: 'Season 4', episodeCount: 52 }, { seasonNumber: 5, name: 'Season 5', episodeCount: 12 }] },
    '1735': { tmdbId: 31910, totalSeasons: 21, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 32 }, { seasonNumber: 2, name: 'Season 2', episodeCount: 21 }, { seasonNumber: 3, name: 'Season 3', episodeCount: 18 }, { seasonNumber: 4, name: 'Season 4', episodeCount: 17 }] },
    '269': { tmdbId: 30984, totalSeasons: 16, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 20 }, { seasonNumber: 2, name: 'Season 2', episodeCount: 21 }, { seasonNumber: 3, name: 'Season 3', episodeCount: 22 }] },
    '1535': { tmdbId: 13916, totalSeasons: 1, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 37, id: '1535' }] },
    '140960': { tmdbId: 120089, season: 1, totalSeasons: 2, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 25, id: '140960' }, { seasonNumber: 2, name: 'Season 2', episodeCount: 12, id: '158871' }] },
    '21459': { tmdbId: 65930, season: 1, totalSeasons: 7, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 13 }, { seasonNumber: 2, name: 'Season 2', episodeCount: 25 }, { seasonNumber: 3, name: 'Season 3', episodeCount: 25 }, { seasonNumber: 4, name: 'Season 4', episodeCount: 25 }, { seasonNumber: 5, name: 'Season 5', episodeCount: 25 }, { seasonNumber: 6, name: 'Season 6', episodeCount: 25 }, { seasonNumber: 7, name: 'Season 7', episodeCount: 21 }] },
    '171018': { tmdbId: 251504, season: 1, totalSeasons: 1, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 12, id: '171018' }] },
    '154587': { tmdbId: 209867, season: 1, totalSeasons: 1, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 28, id: '154587' }] },
    '146065': { tmdbId: 138502, season: 1, totalSeasons: 1, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 12, id: '146065' }] },
    '137822': { tmdbId: 137822, season: 1, totalSeasons: 2, seasons: [{ seasonNumber: 1, name: 'Season 1', episodeCount: 24, id: '137822' }, { seasonNumber: 2, name: 'Season 2: vs. U-20 Japan', episodeCount: 14, id: '163146' }] }
};

const normalizeFallbackMedia = (m) => {
    if (!m) return null;
    const title = m.title?.english || m.title?.romaji || m.title?.native || 'Anime';
    const idStr = String(m.id);
    const malIdStr = m.idMal ? String(m.idMal) : null;
    const extra = ANIME_TMDB_MAP[idStr] || (malIdStr ? ANIME_TMDB_MAP[malIdStr] : null) || {};

    const relations = m.relations?.edges?.map(rel => ({
        relationType: rel.relationType,
        id: String(rel.node?.id),
        title: rel.node?.title?.english || rel.node?.title?.romaji,
        poster: rel.node?.coverImage?.large,
        format: rel.node?.format,
        status: rel.node?.status
    })) || [];

    let seasons = extra.seasons;
    let totalSeasons = extra.totalSeasons;

    if (!seasons) {
        const sequels = relations.filter(r => r.relationType === 'SEQUEL' && r.format !== 'MANGA');
        if (sequels.length > 0) {
            totalSeasons = 1 + sequels.length;
            seasons = [
                { seasonNumber: 1, name: 'Season 1', episodeCount: m.episodes || 12, id: idStr },
                ...sequels.map((seq, idx) => ({
                    seasonNumber: idx + 2,
                    name: seq.title || `Season ${idx + 2}`,
                    episodeCount: null,
                    id: String(seq.id)
                }))
            ];
        } else {
            totalSeasons = 1;
            seasons = [
                { seasonNumber: 1, name: m.format === 'MOVIE' ? 'Movie' : 'Season 1', episodeCount: m.episodes || 12, id: idStr }
            ];
        }
    }

    // Calculate sub & dub counts and next airing episode
    const nextAiring = m.nextAiringEpisode ? {
        id: m.nextAiringEpisode.id,
        episode: m.nextAiringEpisode.episode,
        airingAt: m.nextAiringEpisode.airingAt,
        timeUntilAiring: m.nextAiringEpisode.timeUntilAiring
    } : null;

    let subCount = null;
    if (nextAiring?.episode) {
        subCount = Math.max(1, nextAiring.episode - 1);
    } else if (m.episodes) {
        subCount = m.episodes;
    } else {
        subCount = 12;
    }

    const titleLower = title.toLowerCase();
    const isPopularOrDubbed = 
        Boolean(extra.tmdbId) ||
        (m.averageScore && m.averageScore >= 68) ||
        m.format === 'MOVIE' ||
        ['jujutsu', 'demon slayer', 'one piece', 'naruto', 'bleach', 'titan', 'solo leveling', 'chainsaw', 'frieren', 'dandadan', 'spy x family', 'blue lock', 'hero academia', 'death note', 'kaiju', 'dragon ball'].some(k => titleLower.includes(k));

    let dubCount = null;
    if (isPopularOrDubbed && subCount > 0) {
        if (nextAiring?.episode) {
            const estimatedDub = subCount - 2;
            dubCount = estimatedDub > 0 ? estimatedDub : null;
        } else {
            dubCount = subCount;
        }
    }

    return {
        id: idStr,
        malId: malIdStr,
        tmdbId: extra.tmdbId ? String(extra.tmdbId) : null,
        type: 'anime',
        title,
        alternativeTitle: m.title?.native || m.title?.romaji || '',
        poster: m.coverImage?.extraLarge || m.coverImage?.large,
        backdrop: m.bannerImage || m.coverImage?.extraLarge,
        rating: m.averageScore ? Number((m.averageScore / 10).toFixed(1)) : 8.0,
        year: m.seasonYear || m.startDate?.year || null,
        duration: m.duration ? `${m.duration}m` : null,
        genres: m.genres || [],
        tag: 'Anime',
        status: m.status || 'COMPLETED',
        totalSeasons: totalSeasons || 1,
        seasons,
        episodesCount: m.episodes || subCount,
        subCount,
        dubCount,
        nextAiringEpisode: nextAiring,
        episodes: { sub: subCount, dub: dubCount, eps: m.episodes || subCount },
        overview: m.description ? m.description.replace(/<[^>]*>/g, '').trim() : '',
        synopsis: m.description ? m.description.replace(/<[^>]*>/g, '').trim() : '',
        studios: m.studios?.nodes?.map(s => s.name) || [],
        characters: m.characters?.edges?.map(edge => ({
            role: edge.role,
            id: edge.node?.id,
            name: edge.node?.name?.full,
            image: edge.node?.image?.large,
            voiceActor: edge.voiceActors?.[0] ? {
                id: edge.voiceActors[0].id,
                name: edge.voiceActors[0].name?.full,
                image: edge.voiceActors[0].image?.large
            } : null
        })) || [],
        recommendations: m.recommendations?.nodes?.map(n => n.mediaRecommendation ? {
            id: String(n.mediaRecommendation.id),
            type: 'anime',
            title: n.mediaRecommendation.title?.english || n.mediaRecommendation.title?.romaji,
            poster: n.mediaRecommendation.coverImage?.large,
            rating: n.mediaRecommendation.averageScore ? Number((n.mediaRecommendation.averageScore / 10).toFixed(1)) : 8.0
        } : null).filter(Boolean) || [],
        relations
    };
};

export const AnimeService = {
    // 1. Get Home Page (High-Res TMDB Anime Pipeline matching macOS Desktop)
    getHome: async () => {
        const cacheKey = 'client:anime:home:v2';
        const cached = getClientCached(cacheKey);
        if (cached) return cached;

        try {
            const [trending, airing, popular, topRated, upcoming] = await Promise.all([
                TMDBService.getAnimeTrending().catch(() => []),
                TMDBService.getAnimeAiring().catch(() => []),
                TMDBService.getAnimePopular().catch(() => []),
                TMDBService.getAnimeTopRated().catch(() => []),
                TMDBService.getAnimeUpcoming().catch(() => [])
            ]);

            if (trending && trending.length > 0) {
                const spotlight = trending.slice(0, 5).map((item, idx) => ({
                    ...item,
                    rank: idx + 1,
                    tag: 'Trending Spotlight'
                }));

                const result = {
                    spotlight,
                    trending,
                    topAiring: airing.length > 0 ? airing : trending.slice(5),
                    mostPopular: popular.length > 0 ? popular : trending,
                    topRated: topRated.length > 0 ? topRated : popular,
                    upcoming: upcoming.length > 0 ? upcoming : popular.slice(4),
                    latestEpisodes: airing.length > 0 ? airing.slice(0, 10) : trending.slice(0, 10),
                    topUpcoming: upcoming.length > 0 ? upcoming.slice(0, 10) : popular.slice(0, 10),
                    genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Supernatural']
                };

                setClientCached(cacheKey, result, 300);
                return result;
            }
        } catch (e) {
            console.warn('[AnimeService] TMDB anime home failed, falling back:', e.message);
        }

        try {
            const data = await apiFetch('/api/anime/home');
            if (data && (data.spotlight?.length || data.trending?.length)) {
                setClientCached(cacheKey, data, 300);
                return data;
            }
        } catch (e) {
            // Fallback to client-side AniList
        }

        const query = `
        query {
          trending: Page(page: 1, perPage: 12) {
            media(type: ANIME, sort: TRENDING_DESC) {
              id idMal title { romaji english native } coverImage { extraLarge large } bannerImage averageScore episodes genres status seasonYear description(asHtml: false)
            }
          }
          popular: Page(page: 1, perPage: 12) {
            media(type: ANIME, sort: POPULARITY_DESC) {
              id idMal title { romaji english native } coverImage { extraLarge large } bannerImage averageScore episodes genres status seasonYear description(asHtml: false)
            }
          }
          topAiring: Page(page: 1, perPage: 12) {
            media(type: ANIME, sort: SCORE_DESC, status: RELEASING) {
              id idMal title { romaji english native } coverImage { extraLarge large } bannerImage averageScore episodes genres status seasonYear description(asHtml: false)
            }
          }
        }
        `;
        const data = await fallbackAniListQuery(query);
        const trending = (data?.trending?.media || []).map(normalizeFallbackMedia).filter(Boolean);
        const popular = (data?.popular?.media || []).map(normalizeFallbackMedia).filter(Boolean);
        const topAiring = (data?.topAiring?.media || []).map(normalizeFallbackMedia).filter(Boolean);

        const result = {
            spotlight: trending.slice(0, 5).map((item, idx) => ({ ...item, rank: idx + 1, tag: 'Trending Spotlight' })),
            trending,
            topAiring,
            mostPopular: popular,
            latestEpisodes: trending.slice(4),
            topUpcoming: popular.slice(4),
            genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Supernatural']
        };

        setClientCached(cacheKey, result, 300);
        return result;
    },

    // 2. Category list
    getList: async (category = 'trending', page = 1) => {
        const cacheKey = `client:anime:list:${category}:${page}`;
        const cached = getClientCached(cacheKey);
        if (cached) return cached;

        try {
            let tmdbItems = [];
            if (category === 'trending') {
                tmdbItems = await TMDBService.getAnimeTrending();
            } else if (category === 'top-airing' || category === 'airing') {
                tmdbItems = await TMDBService.getAnimeAiring();
            } else if (category === 'popular' || category === 'most-popular') {
                tmdbItems = await TMDBService.getAnimePopular();
            } else if (category === 'top-rated') {
                tmdbItems = await TMDBService.getAnimeTopRated();
            } else if (category === 'upcoming' || category === 'top-upcoming') {
                tmdbItems = await TMDBService.getAnimeUpcoming();
            } else if (category === 'action') {
                tmdbItems = await TMDBService.getAnimeAction();
            }

            if (tmdbItems && tmdbItems.length > 0) {
                setClientCached(cacheKey, tmdbItems, 180);
                return tmdbItems;
            }
        } catch (e) {
            // Fallback
        }

        try {
            const data = await apiFetch(`/api/anime/${category}?page=${page}`);
            if (Array.isArray(data)) {
                setClientCached(cacheKey, data, 180);
                return data;
            }
        } catch (e) {
            // Fallback
        }

        const query = `
        query ($page: Int) {
          Page(page: $page, perPage: 24) {
            media(type: ANIME, sort: TRENDING_DESC) {
              id idMal title { romaji english native } coverImage { extraLarge large } bannerImage averageScore episodes genres status seasonYear description(asHtml: false)
            }
          }
        }
        `;
        const data = await fallbackAniListQuery(query, { page: Number(page) || 1 });
        const list = (data?.Page?.media || []).map(normalizeFallbackMedia).filter(Boolean);
        setClientCached(cacheKey, list, 180);
        return list;
    },

    // 3. Search anime
    search: async (keyword, page = 1, genre = null) => {
        const q = (keyword || '').trim();
        const cacheKey = `client:anime:search:${q}:${page}:${genre || ''}`;
        const cached = getClientCached(cacheKey);
        if (cached) return cached;

        // If genre is selected, use high-resolution TMDB Anime genre discover
        if (genre) {
            try {
                const genreResults = await TMDBService.getAnimeByGenre(genre);
                if (genreResults && genreResults.length > 0) {
                    setClientCached(cacheKey, genreResults, 180);
                    return genreResults;
                }
            } catch (e) {
                // Fall through
            }
        }

        if (q) {
            try {
                const searchResults = await TMDBService.searchMulti(q);
                if (searchResults && searchResults.length > 0) {
                    const animeMatches = searchResults.filter(item => 
                        item.type === 'anime' || 
                        item.isAnime ||
                        (item.original_language === 'ja' && (item.genre_ids?.includes(16) || item.genres?.some(g => String(g).toLowerCase().includes('animation')))) ||
                        item.tag?.toLowerCase().includes('anime')
                    );
                    const finalResults = (animeMatches.length > 0 ? animeMatches : searchResults).map(item => ({
                        ...item,
                        type: 'anime',
                        isAnime: true,
                        tag: 'Anime'
                    }));
                    setClientCached(cacheKey, finalResults, 120);
                    return finalResults;
                }
            } catch (e) {
                // Fall through
            }
        }

        try {
            const params = new URLSearchParams();
            if (q) params.append('query', q);
            if (page) params.append('page', page);
            if (genre) params.append('genre', genre);

            const data = await apiFetch(`/api/anime/search?${params.toString()}`);
            if (Array.isArray(data) && data.length > 0) {
                setClientCached(cacheKey, data, 120);
                return data;
            }
        } catch (e) {
            // Fallback
        }

        const query = `
        query ($search: String, $page: Int, $genre: String) {
          Page(page: $page, perPage: 20) {
            media(type: ANIME, search: $search, genre: $genre, sort: POPULARITY_DESC) {
              id idMal title { romaji english native } coverImage { extraLarge large } bannerImage averageScore episodes genres status seasonYear description(asHtml: false)
              nextAiringEpisode { id airingAt timeUntilAiring episode }
            }
          }
        }
        `;
        const data = await fallbackAniListQuery(query, { search: q || undefined, page: Number(page) || 1, genre: genre || undefined });
        const list = (data?.Page?.media || []).map(normalizeFallbackMedia).filter(Boolean);
        setClientCached(cacheKey, list, 120);
        return list;
    },

    // 4. Details
    getDetails: async (id) => {
        const idStr = String(id);
        const cacheKey = `client:anime:details:${idStr}`;
        const cached = getClientCached(cacheKey);
        if (cached) return cached;

        const mappedTmdbId = ANIME_TMDB_MAP[idStr]?.tmdbId;
        const resolvedId = mappedTmdbId ? String(mappedTmdbId) : idStr;

        // 1. Try TMDB details directly for high-resolution 16:9 artwork & official metadata
        try {
            const tmdbData = await TMDBService.getMediaDetails(resolvedId, 'tv');
            if (tmdbData && tmdbData.title) {
                const totalSeasons = tmdbData.totalSeasons || 1;
                const details = {
                    id: idStr,
                    tmdbId: String(tmdbData.id || resolvedId),
                    type: 'anime',
                    isAnime: true,
                    title: tmdbData.title || tmdbData.name,
                    alternativeTitle: tmdbData.original_name || tmdbData.original_title || '',
                    overview: tmdbData.overview || '',
                    synopsis: tmdbData.overview || '',
                    backdrop: tmdbData.backdrop || tmdbData.backdrop_path,
                    poster: tmdbData.poster || tmdbData.poster_path,
                    rating: tmdbData.rating || 8.5,
                    year: tmdbData.year,
                    duration: tmdbData.duration || 'TV Anime',
                    genres: tmdbData.genres?.length ? tmdbData.genres : ['Anime'],
                    tag: 'Anime Series',
                    status: 'COMPLETED',
                    totalSeasons,
                    seasons: Array.from({ length: totalSeasons }, (_, i) => ({
                        seasonNumber: i + 1,
                        name: `Season ${i + 1}`,
                        id: idStr
                    })),
                    episodesCount: 12,
                    cast: tmdbData.cast || []
                };

                setClientCached(cacheKey, details, 600);
                return details;
            }
        } catch (e) {
            // Fall through to backend proxy or AniList
        }

        try {
            const data = await apiFetch(`/api/anime/details/${id}`);
            if (data && data.title) {
                setClientCached(cacheKey, data, 600);
                return data;
            }
        } catch (e) {
            // Fallback
        }

        const isNumeric = /^\d+$/.test(id);
        const query = isNumeric
            ? `
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                id idMal title { romaji english native } coverImage { extraLarge large } bannerImage
                startDate { year month day } description(asHtml: false) format status episodes duration genres averageScore
                nextAiringEpisode { id airingAt timeUntilAiring episode }
                studios(isMain: true) { nodes { id name } }
                characters(sort: ROLE, perPage: 8) {
                  edges {
                    role node { id name { full } image { large } }
                    voiceActors(language: JAPANESE) { id name { full } image { large } }
                  }
                }
                recommendations(perPage: 8) {
                  nodes {
                    mediaRecommendation { id title { romaji english } coverImage { large } averageScore episodes }
                  }
                }
              }
            }
            `
            : `
            query ($search: String) {
              Media(search: $search, type: ANIME) {
                id idMal title { romaji english native } coverImage { extraLarge large } bannerImage
                startDate { year month day } description(asHtml: false) format status episodes duration genres averageScore
                nextAiringEpisode { id airingAt timeUntilAiring episode }
                studios(isMain: true) { nodes { id name } }
                characters(sort: ROLE, perPage: 8) {
                  edges {
                    role node { id name { full } image { large } }
                    voiceActors(language: JAPANESE) { id name { full } image { large } }
                  }
                }
                recommendations(perPage: 8) {
                  nodes {
                    mediaRecommendation { id title { romaji english } coverImage { large } averageScore episodes }
                  }
                }
              }
            }
            `;

        const variables = isNumeric ? { id: parseInt(id, 10) } : { search: id.replace(/-/g, ' ') };
        const data = await fallbackAniListQuery(query, variables);
        const result = normalizeFallbackMedia(data?.Media);
        if (result) {
            setClientCached(cacheKey, result, 600);
        }
        return result;
    },

    // Resolve AniList / custom ID to TMDB TV ID via search if not in map
    resolveAnimeTmdbId: async (id, title = '') => {
        const idStr = String(id);
        if (ANIME_TMDB_MAP[idStr]?.tmdbId) return ANIME_TMDB_MAP[idStr].tmdbId;

        let searchTitle = title;
        if (!searchTitle && /^\d+$/.test(idStr)) {
            try {
                const details = await AnimeService.getDetails(idStr);
                searchTitle = details?.title || details?.titleEnglish || details?.titleRomaji || '';
            } catch (e) {}
        }
        if (!searchTitle) return idStr;

        const clean = searchTitle.replace(/[:\-]/g, ' ').replace(/\s+/g, ' ').trim();
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=21269750eb76a0b7c178e43c91b355e5&query=${encodeURIComponent(clean)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    const match = data.results[0].id;
                    ANIME_TMDB_MAP[idStr] = { tmdbId: match };
                    return match;
                }
            }
        } catch (e) {}
        return idStr;
    },

    // 5. Episodes (Season-Aware with Full Rich Metadata)
    getEpisodes: async (id, season = 1, title = '', subCount = null, dubCount = null) => {
        const seasonNum = parseInt(season, 10) || 1;
        const cacheKey = `client:anime:episodes:${id}:s${seasonNum}`;
        const cached = getClientCached(cacheKey);
        if (cached) return cached;

        const resolvedTmdbId = await AnimeService.resolveAnimeTmdbId(id, title);

        // 1. Primary: Fetch direct from TMDB for official episode titles, thumbnails, and overviews
        try {
            const tmdbSeason = await TMDBService.getSeasonDetails(resolvedTmdbId, seasonNum);
            if (tmdbSeason && Array.isArray(tmdbSeason.episodes) && tmdbSeason.episodes.length > 0) {
                const eps = tmdbSeason.episodes.map((ep, idx) => {
                    const epNum = ep.episodeNumber || idx + 1;
                    const realTitle = ep.title || ep.name;
                    const hasSub = (subCount === null || subCount === undefined || epNum <= subCount);
                    const hasDub = (dubCount !== null && dubCount !== undefined && dubCount > 0 && epNum <= dubCount);
                    return {
                        id: `${id}::s=${seasonNum}::ep=${epNum}`,
                        episodeNumber: epNum,
                        seasonNumber: seasonNum,
                        title: realTitle ? (realTitle.startsWith(`${epNum}.`) ? realTitle : `${epNum}. ${realTitle}`) : `Episode ${epNum}`,
                        alternativeTitle: '',
                        overview: ep.overview || '',
                        still: ep.thumbnail || ep.still || null,
                        thumbnail: ep.thumbnail || ep.still || null,
                        airDate: ep.airDate || null,
                        runtime: ep.duration || (ep.runtime ? `${ep.runtime}m` : '24m'),
                        isFiller: false,
                        fillerType: 'canon',
                        hasSub,
                        hasDub
                    };
                });
                setClientCached(cacheKey, eps, 600);
                return eps;
            }
        } catch (e) {
            // Fall through to backend proxy
        }

        // 2. Secondary fallback: Fetch enriched episodes from backend proxy
        try {
            const data = await apiFetch(`/api/anime/episodes/${id}?season=${seasonNum}`);
            if (Array.isArray(data) && data.length > 0) {
                const normalized = data.map((ep, idx) => {
                    const epNum = ep.episodeNumber || idx + 1;
                    return {
                        id: ep.id || `${id}::s=${seasonNum}::ep=${epNum}`,
                        episodeNumber: epNum,
                        seasonNumber: seasonNum,
                        title: ep.title || `Episode ${epNum}`,
                        alternativeTitle: ep.alternativeTitle || '',
                        overview: ep.overview || '',
                        still: ep.still || ep.thumbnail || null,
                        thumbnail: ep.still || ep.thumbnail || null,
                        airDate: ep.airDate || null,
                        runtime: ep.runtime || '24m',
                        isFiller: Boolean(ep.isFiller),
                        fillerType: ep.fillerType || (ep.isFiller ? 'filler' : 'canon'),
                        voteAverage: ep.voteAverage || null
                    };
                });
                setClientCached(cacheKey, normalized, 600);
                return normalized;
            }
        } catch (e) {
            // Fall through to synthesis
        }

        // 3. Tertiary fallback: Synthesize from anime details
        const details = await AnimeService.getDetails(id);
        const seasonInfo = (details?.seasons || []).find(s => s.seasonNumber === seasonNum);
        const count = seasonInfo?.episodeCount || (seasonNum === 1 ? (details?.episodesCount || 12) : 12);
        const total = Math.min(Math.max(count, 1), 2000);
        const eps = Array.from({ length: total }, (_, i) => ({
            id: `${id}::s=${seasonNum}::ep=${i + 1}`,
            episodeNumber: i + 1,
            seasonNumber: seasonNum,
            title: `Episode ${i + 1}`,
            alternativeTitle: '',
            overview: details?.overview || '',
            still: details?.backdrop || details?.cover || null,
            thumbnail: details?.backdrop || details?.cover || null,
            airDate: details?.year ? `${details.year}` : null,
            runtime: details?.duration ? `${details.duration}m` : '24m',
            isFiller: false,
            fillerType: 'canon'
        }));
        setClientCached(cacheKey, eps, 600);
        return eps;
    },

    // 6. Servers
    getServers: async (episodeId) => {
        try {
            const data = await apiFetch(`/api/anime/servers?id=${encodeURIComponent(episodeId)}`);
            if (data && (data.sub || data.dub)) return data;
        } catch (e) {
            // Fallback
        }

        return {
            sub: [
                { index: 1, type: 'sub', id: 'hd-1', name: 'HD-1 (HLS)' },
                { index: 2, type: 'sub', id: 'hd-2', name: 'HD-2 (MegaCloud)' },
                { index: 4, type: 'sub', id: 'hd-4', name: 'HD-4 (Ultra)' }
            ],
            dub: [
                { index: 1, type: 'dub', id: 'hd-1-dub', name: 'HD-1 (Dub)' },
                { index: 2, type: 'dub', id: 'hd-2-dub', name: 'HD-2 (Dub)' }
            ]
        };
    },

    // 7. Stream (No Big Buck Bunny fallback)
    getStream: async (episodeId, server = 'HD-1', type = 'sub', title = '') => {
        try {
            const titleParam = title ? `&title=${encodeURIComponent(title)}` : '';
            const data = await apiFetch(`/api/anime/stream?id=${encodeURIComponent(episodeId)}&server=${encodeURIComponent(server)}&type=${encodeURIComponent(type)}${titleParam}`);
            if (data && data.sources?.length && data.hasHls) return data;
        } catch (e) {
            // Fallback
        }

        return {
            sources: [],
            subtitles: [],
            hasHls: false,
            serverUsed: server,
            typeUsed: type,
            isFallback: true
        };
    }
};

export default AnimeService;
