// Supabase Edge Function for TMDB Proxy
// Runs on Deno runtime

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TMDB_BASE_URL = Deno.env.get('TMDB_BASE_URL') || 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

const mapTMDBToNotFlix = (item: any, defaultType = 'movie') => {
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
        trailer: 'https://www.w3schools.com/html/mov_bbb.mp4',
    };
};

const fetchTMDB = async (endpoint: string, apiKey: string) => {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TMDB Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.results || [];
};

const fetchTMDBItem = async (endpoint: string, apiKey: string) => {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`TMDB Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') || '';
    if (!TMDB_API_KEY) {
        return new Response(JSON.stringify({ error: 'TMDB_API_KEY is not configured on Supabase' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/tmdb', '').replace(/\/+$/, '');

    try {
        let data: any;
        let match: RegExpMatchArray | null = null;

        if (path === '/trending/movies') {
            const results = await fetchTMDB('/trending/movie/week', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'movie')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/trending/tv') {
            const results = await fetchTMDB('/trending/tv/week', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'tv')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/top-rated/movies') {
            const results = await fetchTMDB('/movie/top_rated', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'movie')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/top-rated/tv') {
            const results = await fetchTMDB('/tv/top_rated', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'tv')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/now-playing') {
            const results = await fetchTMDB('/movie/now_playing', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'movie')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/action/movies') {
            const results = await fetchTMDB('/discover/movie?with_genres=28', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'movie')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/comedy/movies') {
            const results = await fetchTMDB('/discover/movie?with_genres=35', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'movie')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/popular/movies') {
            const results = await fetchTMDB('/movie/popular', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'movie')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/action/tv') {
            const results = await fetchTMDB('/discover/tv?with_genres=10759', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'tv')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/popular/tv') {
            const results = await fetchTMDB('/tv/popular', TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, 'tv')).filter((i: any) => i.backdrop && i.poster);
        } else if (path === '/genres') {
            const movieGenres = await fetchTMDBItem('/genre/movie/list', TMDB_API_KEY);
            const tvGenres = await fetchTMDBItem('/genre/tv/list', TMDB_API_KEY);
            const combined = [...(movieGenres.genres || []), ...(tvGenres.genres || [])];
            const unique = Array.from(new Map(combined.map(g => [g.id, g])).values());
            data = unique;
        } else if ((match = path.match(/^\/media\/(movie|tv)\/(\d+)$/))) {
            const type = match[1];
            const id = match[2];
            const raw = await fetchTMDBItem(`/${type}/${id}`, TMDB_API_KEY);
            const mapped = mapTMDBToNotFlix(raw, type);
            mapped.genres = raw.genres ? raw.genres.map((g: any) => g.name) : [];
            if (type === 'movie') {
                const h = Math.floor((raw.runtime || 0) / 60);
                const m = (raw.runtime || 0) % 60;
                mapped.duration = raw.runtime ? `${h}h ${m}m` : 'N/A';
            } else {
                mapped.duration = raw.number_of_seasons ? `${raw.number_of_seasons} Seasons` : '1 Season';
            }
            data = mapped;
        } else if ((match = path.match(/^\/media\/(movie|tv)\/(\d+)\/cast$/))) {
            const type = match[1];
            const id = match[2];
            const raw = await fetchTMDBItem(`/${type}/${id}/credits`, TMDB_API_KEY);
            data = (raw?.cast || []).slice(0, 10).map((actor: any) => ({
                id: actor.id,
                name: actor.name,
                character: actor.character,
                avatar: actor.profile_path ? `${IMAGE_BASE_URL}${actor.profile_path}` : 'https://via.placeholder.com/150',
            }));
        } else if ((match = path.match(/^\/media\/(movie|tv)\/(\d+)\/similar$/))) {
            const type = match[1];
            const id = match[2];
            const results = await fetchTMDB(`/${type}/${id}/similar`, TMDB_API_KEY);
            data = results.map((item: any) => mapTMDBToNotFlix(item, type)).filter((i: any) => i.backdrop && i.poster);
        } else if ((match = path.match(/^\/tv\/(\d+)\/season\/(\d+)$/))) {
            const tvId = match[1];
            const seasonNumber = match[2];
            const raw = await fetchTMDBItem(`/tv/${tvId}/season/${seasonNumber}`, TMDB_API_KEY);
            data = raw ? {
                seasonNumber: raw.season_number,
                name: raw.name || `Season ${seasonNumber}`,
                episodes: (raw.episodes || []).map((ep: any) => ({
                    episodeNumber: ep.episode_number,
                    name: ep.name || `Episode ${ep.episode_number}`,
                    overview: ep.overview || 'No description available.',
                    still: ep.still_path ? `${IMAGE_BASE_URL}${ep.still_path}` : null,
                    airDate: ep.air_date,
                })),
            } : null;
        } else if ((match = path.match(/^\/actor\/(\d+)\/credits$/))) {
            const actorId = match[1];
            const raw = await fetchTMDBItem(`/person/${actorId}/combined_credits`, TMDB_API_KEY);
            data = (raw?.cast || [])
                .map((item: any) => mapTMDBToNotFlix(item, item.media_type))
                .filter((i: any) => i.backdrop && i.poster)
                .sort((a: any, b: any) => Number(b.popularity || 0) - Number(a.popularity || 0));
        } else if (path === '/search') {
            const q = url.searchParams.get('query') || '';
            const type = url.searchParams.get('type');
            const genres = url.searchParams.get('genres');
            const year = url.searchParams.get('year');

            if (!q.trim() && !genres && !year) {
                data = [];
            } else {
                let endpoint = '';
                if (q.trim()) {
                    endpoint = type === 'tv'
                        ? `/search/tv?query=${encodeURIComponent(q)}`
                        : (type === 'movie' ? `/search/movie?query=${encodeURIComponent(q)}` : `/search/multi?query=${encodeURIComponent(q)}`);
                } else {
                    endpoint = type === 'tv'
                        ? `/discover/tv?sort_by=popularity.desc`
                        : `/discover/movie?sort_by=popularity.desc`;
                }
                if (year) {
                    endpoint += `&${type === 'tv' ? 'first_air_date_year' : 'primary_release_year'}=${year}`;
                }
                if (genres) {
                    endpoint += `&with_genres=${genres}`;
                }
                const results = await fetchTMDB(endpoint, TMDB_API_KEY);
                data = results.map((item: any) => mapTMDBToNotFlix(item, type || 'movie')).filter((i: any) => i.backdrop && i.poster);
            }
        } else {
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('TMDB Edge Function error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});