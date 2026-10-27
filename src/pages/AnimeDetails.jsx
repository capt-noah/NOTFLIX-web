import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { AnimeService } from '../services/animeService';
import TMDBService from '../services/tmdb';
import { SupabaseDB } from '../services/db';
import { RatingBadge } from '../components/RatingBadge';
import { DetailsPageSkeleton, ModalCardSkeleton } from '../components/Skeleton';
import MediaRow from '../components/MediaRow';
// ═══════════════ DEDICATED ANIME STREAMING SERVERS (SEPARATE SUB & DUB) ═══════════════

const getPlayerBase = () => {
    if (typeof window !== 'undefined') {
        const { hostname, pathname } = window.location;
        if (hostname === 'noah.enginner.et' || pathname.startsWith('/notflix')) {
            return '/notflix';
        }
    }
    return '';
};

export const ANIME_SUB_SERVERS = [
    {
        id: 'HD-1',
        name: 'HD-1 (MegaCloud)',
        badge: '1080P DEFAULT',
        getUrl: (id, isMovie, s = 1, ep = 1, title = '') => {
            return `${getPlayerBase()}/api/anime/player?id=${id}&s=${s}&ep=${ep}&type=sub&server=HD-1&title=${encodeURIComponent(title)}`;
        }
    },
    {
        id: 'HD-2',
        name: 'HD-2 (MegaPlay)',
        badge: 'FAST',
        getUrl: (id, isMovie, s = 1, ep = 1, title = '') => {
            return `${getPlayerBase()}/api/anime/player?id=${id}&s=${s}&ep=${ep}&type=sub&server=HD-2&title=${encodeURIComponent(title)}`;
        }
    },
    {
        id: 'HD-3',
        name: 'HD-3 (Vidstream V1)',
        badge: 'VIDSRC',
        getUrl: (id, isMovie, s = 1, ep = 1) => {
            return isMovie
                ? `https://vidsrc.pm/embed/movie/${id}`
                : `https://vidsrc.pm/embed/tv/${id}/${s}/${ep}`;
        }
    },
    {
        id: 'HD-4',
        name: 'HD-4 (Vidstream V2)',
        badge: 'VIDSRC',
        getUrl: (id, isMovie, s = 1, ep = 1) => {
            return isMovie
                ? `https://vidsrc.sh/embed/movie/${id}`
                : `https://vidsrc.sh/embed/tv/${id}/${s}/${ep}`;
        }
    },
    {
        id: 'HD-5',
        name: 'HD-5 (PrimeSrc)',
        badge: 'CDN',
        getUrl: (id, isMovie, s = 1, ep = 1) => {
            return isMovie
                ? `https://primesrc.me/embed/movie?tmdb=${id}`
                : `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${ep}`;
        }
    },
    {
        id: 'HD-6',
        name: 'HD-6 (2Embed)',
        badge: 'BACKUP',
        getUrl: (id, isMovie, s = 1, ep = 1) => {
            return isMovie
                ? `https://www.2embed.cc/embed/${id}`
                : `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${ep}`;
        }
    }
];

export const ANIME_DUB_SERVERS = [
    {
        id: 'HD-1-dub',
        name: 'HD-1 (MegaCloud Dub)',
        badge: 'DUB DEFAULT',
        getUrl: (id, isMovie, s = 1, ep = 1, title = '') => {
            return `${getPlayerBase()}/api/anime/player?id=${id}&s=${s}&ep=${ep}&type=dub&server=HD-1&title=${encodeURIComponent(title)}`;
        }
    },
    {
        id: 'HD-2-dub',
        name: 'HD-2 (MegaPlay Dub)',
        badge: 'DUB FAST',
        getUrl: (id, isMovie, s = 1, ep = 1, title = '') => {
            return `${getPlayerBase()}/api/anime/player?id=${id}&s=${s}&ep=${ep}&type=dub&server=HD-2&title=${encodeURIComponent(title)}`;
        }
    },
    {
        id: 'HD-3-dub',
        name: 'HD-3 (PrimeSrc Dub)',
        badge: 'DUB CDN',
        getUrl: (id, isMovie, s = 1, ep = 1) => {
            return isMovie
                ? `https://primesrc.me/embed/movie?tmdb=${id}&dub=1`
                : `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${ep}&dub=1`;
        }
    },
    {
        id: 'HD-4-dub',
        name: 'HD-4 (2Embed Dub)',
        badge: 'DUB BACKUP',
        getUrl: (id, isMovie, s = 1, ep = 1) => {
            return isMovie
                ? `https://www.2embed.cc/embed/${id}?dub=1`
                : `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${ep}`;
        }
    }
];

// Comprehensive AniList / MAL to TMDB ID Mapping
const ANIME_TMDB_MAP = {
    '113415': { tmdbId: 95479 },
    '145064': { tmdbId: 95479 },
    '131573': { tmdbId: 810693 },
    '95479': { tmdbId: 95479 },
    '85937': { tmdbId: 85937 },
    '101922': { tmdbId: 85937 },
    '129874': { tmdbId: 85937 },
    '145139': { tmdbId: 85937 },
    '166240': { tmdbId: 85937 },
    '16498': { tmdbId: 1429 },
    '20958': { tmdbId: 1429 },
    '99147': { tmdbId: 1429 },
    '110277': { tmdbId: 1429 },
    '1429': { tmdbId: 1429 },
    '21': { tmdbId: 37854 },
    '37854': { tmdbId: 37854 },
    '151807': { tmdbId: 127532 },
    '173778': { tmdbId: 127532 },
    '127532': { tmdbId: 127532 },
    '127230': { tmdbId: 114410 },
    '114410': { tmdbId: 114410 },
    '20': { tmdbId: 46260 },
    '46260': { tmdbId: 46260 },
    '1735': { tmdbId: 31910 },
    '31910': { tmdbId: 31910 },
    '269': { tmdbId: 30984 },
    '30984': { tmdbId: 30984 },
    '1535': { tmdbId: 13916 },
    '13916': { tmdbId: 13916 },
    '140960': { tmdbId: 120089 },
    '158871': { tmdbId: 120089 },
    '120089': { tmdbId: 120089 },
    '21459': { tmdbId: 65930 },
    '65930': { tmdbId: 65930 },
    '171018': { tmdbId: 251504 },
    '251504': { tmdbId: 251504 },
    '154587': { tmdbId: 209867 },
    '209867': { tmdbId: 209867 },
    '146065': { tmdbId: 138502 },
    '138502': { tmdbId: 138502 },
    '137822': { tmdbId: 137822 },
    '163146': { tmdbId: 137822 }
};

export const AnimeDetails = ({ id, anime: animeProp, onClose, onPlay: onPlayProp }) => {
    const {
        toggleWatchlist,
        watchlist = [],
        navigateTo,
        saveProgress,
        user,
        setAuthModalOpen,
        addNotification
    } = useApp();
    const { t = {} } = useLanguage();

    const animeId = id || animeProp?.id || (window.location.hash.split('/anime/')[1] || '').split('?')[0];

    // Parse URL hash query for season and episode
    const hashParts = (typeof window !== 'undefined' ? window.location.hash : '').split('?');
    const hashQuery = new URLSearchParams(hashParts[1] || '');
    const urlSeason = parseInt(hashQuery.get('season') || '', 10);
    const urlEpisode = parseInt(hashQuery.get('episode') || '', 10);
    const initialSeason = (animeProp?.season && Number(animeProp.season) > 0)
        ? Number(animeProp.season)
        : (urlSeason > 0 ? urlSeason : 1);
    const initialEpisode = (animeProp?.episode && Number(animeProp.episode) > 0)
        ? Number(animeProp.episode)
        : (urlEpisode > 0 ? urlEpisode : 1);

    // Core anime data
    const [anime, setAnime] = useState(() => animeProp || null);
    const currentAnime = anime || animeProp;
    const nextAiring = currentAnime?.nextAiringEpisode;

    // Live Airing Countdown Timer (Real-time 1s ticker)
    const [currentTimeSeconds, setCurrentTimeSeconds] = useState(() => Math.floor(Date.now() / 1000));
    useEffect(() => {
        if (!nextAiring?.airingAt) return;
        const interval = setInterval(() => {
            setCurrentTimeSeconds(Math.floor(Date.now() / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [nextAiring?.airingAt]);

    const secondsRemaining = nextAiring?.airingAt ? Math.max(0, nextAiring.airingAt - currentTimeSeconds) : 0;
    const daysRemaining = Math.floor(secondsRemaining / 86400);
    const hoursRemaining = Math.floor((secondsRemaining % 86400) / 3600);
    const minsRemaining = Math.floor((secondsRemaining % 3600) / 60);
    const secsRemaining = secondsRemaining % 60;

    let countdownDisplay = 'Airing Now!';
    if (secondsRemaining > 0) {
        if (daysRemaining > 0) {
            countdownDisplay = `${daysRemaining}d ${hoursRemaining}h ${minsRemaining}m ${secsRemaining}s`;
        } else {
            countdownDisplay = `${hoursRemaining}h ${minsRemaining}m ${secsRemaining}s`;
        }
    }

    const formattedAirDateTime = nextAiring?.airingAt
        ? new Date(nextAiring.airingAt * 1000).toLocaleString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        })
        : '';

    const handleAddToCalendar = () => {
        if (!nextAiring?.airingAt) return;
        const startDate = new Date(nextAiring.airingAt * 1000);
        const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
        const title = `${currentAnime?.title || 'Anime'} - Episode ${nextAiring.episode}`;
        const details = `Stream the new episode on NOTFLIX!`;

        const isoStart = startDate.toISOString().replace(/-|:|\.\d+/g, '');
        const isoEnd = endDate.toISOString().replace(/-|:|\.\d+/g, '');

        const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${isoStart}/${isoEnd}&details=${encodeURIComponent(details)}`;
        window.open(gCalUrl, '_blank', 'noopener,noreferrer');
    };

    const [resolvedTmdbId, setResolvedTmdbId] = useState(() => {
        return animeProp?.tmdbId || ANIME_TMDB_MAP[String(animeId)]?.tmdbId || null;
    });
    const [loading, setLoading] = useState(() => !animeProp);
    const [backdropLoaded, setBackdropLoaded] = useState(false);
    const [episodes, setEpisodes] = useState([]);
    const [loadingEpisodes, setLoadingEpisodes] = useState(true);
    const [selectedSeason, setSelectedSeason] = useState(initialSeason);
    const [seasons, setSeasons] = useState([]);
    const [selectedEpisodeNum, setSelectedEpisodeNum] = useState(initialEpisode);

    // Episode chunking & pagination state
    const [chunkIndex, setChunkIndex] = useState(0);
    const EPISODES_PER_CHUNK = 50;

    // Dual View Mode & Episode Search Filter State (Zoro / HiAnime style)
    const [episodesViewMode, setEpisodesViewMode] = useState(() => {
        try {
            return localStorage.getItem('notflix_anime_ep_view_mode') || 'grid';
        } catch (e) {
            return 'grid';
        }
    });
    const handleSetViewMode = (mode) => {
        setEpisodesViewMode(mode);
        try {
            localStorage.setItem('notflix_anime_ep_view_mode', mode);
        } catch (e) {}
    };

    const [episodeSearchQuery, setEpisodeSearchQuery] = useState('');
    const [fillerFilter, setFillerFilter] = useState('all'); // 'all' | 'canon' | 'filler'
    const [expandedOverviewEp, setExpandedOverviewEp] = useState(null);

    // Filtered Episodes computation
    const filteredEpisodes = useMemo(() => {
        return episodes.filter(ep => {
            // 1. Filler filter
            if (fillerFilter === 'canon' && ep.isFiller) return false;
            if (fillerFilter === 'filler' && !ep.isFiller) return false;

            // 2. Text Search Query
            if (episodeSearchQuery.trim()) {
                const q = episodeSearchQuery.toLowerCase().trim();
                const epNumMatch = String(ep.episodeNumber) === q || `ep ${ep.episodeNumber}`.includes(q) || `episode ${ep.episodeNumber}`.includes(q);
                const titleMatch = (ep.title || '').toLowerCase().includes(q);
                const altMatch = (ep.alternativeTitle || '').toLowerCase().includes(q);
                const overviewMatch = (ep.overview || '').toLowerCase().includes(q);
                return epNumMatch || titleMatch || altMatch || overviewMatch;
            }
            return true;
        });
    }, [episodes, episodeSearchQuery, fillerFilter]);

    const isSearching = Boolean(episodeSearchQuery.trim() || fillerFilter !== 'all');
    const totalChunks = isSearching ? 1 : Math.ceil(episodes.length / EPISODES_PER_CHUNK);
    const visibleEpisodes = isSearching 
        ? filteredEpisodes 
        : episodes.slice(chunkIndex * EPISODES_PER_CHUNK, (chunkIndex + 1) * EPISODES_PER_CHUNK);

    // Zero-Cost Local Watched/Seen Episodes Tracking (localStorage)
    const [watchedEpisodes, setWatchedEpisodes] = useState(() => {
        try {
            const stored = localStorage.getItem('notflix_watched_episodes');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    });

    const isWatched = (epNum, sNum = selectedSeason) => {
        const key = `${animeId}:s${sNum}:ep${epNum}`;
        return watchedEpisodes.includes(key);
    };

    const markAsWatched = (epNum, sNum = selectedSeason) => {
        const key = `${animeId}:s${sNum}:ep${epNum}`;
        if (!watchedEpisodes.includes(key)) {
            const updated = [...watchedEpisodes, key];
            setWatchedEpisodes(updated);
            try {
                localStorage.setItem('notflix_watched_episodes', JSON.stringify(updated));
            } catch (e) {}
        }
    };

    // Auto-Skip Intro / Outro & Auto Next Preferences
    const [autoSkipIntro, setAutoSkipIntro] = useState(() => {
        try {
            return localStorage.getItem('notflix_auto_skip_intro') !== 'false';
        } catch (e) {
            return true;
        }
    });
    const [autoSkipOutro, setAutoSkipOutro] = useState(() => {
        try {
            return localStorage.getItem('notflix_auto_skip_outro') !== 'false';
        } catch (e) {
            return true;
        }
    });
    const [autoNext, setAutoNext] = useState(() => {
        try {
            return localStorage.getItem('notflix_auto_next') !== 'false';
        } catch (e) {
            return true;
        }
    });

    const handleToggleAutoSkipIntro = (val) => {
        setAutoSkipIntro(val);
        try { localStorage.setItem('notflix_auto_skip_intro', String(val)); } catch (e) {}
    };
    const handleToggleAutoSkipOutro = (val) => {
        setAutoSkipOutro(val);
        try { localStorage.setItem('notflix_auto_skip_outro', String(val)); } catch (e) {}
    };
    const handleToggleAutoNext = (val) => {
        setAutoNext(val);
        try { localStorage.setItem('notflix_auto_next', String(val)); } catch (e) {}
    };

    // Player state (Separate servers for Sub and Dub)
    const [isPlaying, setIsPlaying] = useState(() => window.location.hash.includes('play=true'));
    const [audioMode, setAudioMode] = useState('sub'); // 'sub' or 'dub'
    const [currentSubServer, setCurrentSubServer] = useState('HD-1');
    const [currentDubServer, setCurrentDubServer] = useState('HD-1-dub');
    const [isUniversalFullscreen, setIsUniversalFullscreen] = useState(false);

    const currentServer = audioMode === 'dub' ? currentDubServer : currentSubServer;
    const setCurrentServer = (srvId) => {
        if (audioMode === 'dub') {
            setCurrentDubServer(srvId);
        } else {
            setCurrentSubServer(srvId);
        }
    };
    const activeServers = audioMode === 'dub' ? ANIME_DUB_SERVERS : ANIME_SUB_SERVERS;

    // Reviews & Modal State
    const [reviews, setReviews] = useState([]);
    const [newReviewRating, setNewReviewRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [newReviewText, setNewReviewText] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    const playerContainerRef = useRef(null);
    const scrolledContentRef = useRef(null);
    const lastSavedKeyRef = useRef(null);

    const handleScrollDown = () => {
        scrolledContentRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Universal Fullscreen & keyboard shortcut ('F')
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
            setIsUniversalFullscreen(isFs);
        };

        const handleKeyDown = (e) => {
            if (isPlaying && (e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
                toggleUniversalFullscreen();
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isPlaying]);

    const toggleUniversalFullscreen = () => {
        const el = playerContainerRef.current;
        if (!el) return;

        const isFs = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (!isFs) {
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(() => {});
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.mozRequestFullScreen) {
                el.mozRequestFullScreen();
            } else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    // 1. Fetch Anime Details & Season 1 Episode List
    useEffect(() => {
        let active = true;
        const loadAnimeData = async () => {
            setLoading(true);
            setBackdropLoaded(false);
            if (animeProp && String(animeProp.id) === String(animeId)) {
                setAnime(animeProp);
            } else {
                setAnime(null);
            }
            setEpisodes([]);
            const initialTmdb = animeProp?.tmdbId || ANIME_TMDB_MAP[String(animeId)]?.tmdbId || null;
            if (initialTmdb) {
                setResolvedTmdbId(String(initialTmdb));
            }
            if (!onClose && isPlaying) {
                window.scrollTo(0, 0);
            }

            try {
                const data = await AnimeService.getDetails(animeId);
                if (!active) return;
                setAnime(data);

                // Resolve TMDB ID for streams if not directly in map
                let tmdbId = data?.tmdbId || initialTmdb || ANIME_TMDB_MAP[String(animeId)]?.tmdbId;
                if (!tmdbId && data?.title) {
                    try {
                        const resolvedId = await AnimeService.resolveAnimeTmdbId(animeId, data.title);
                        if (resolvedId && resolvedId !== String(animeId)) {
                            tmdbId = resolvedId;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
                if (tmdbId && active) {
                    setResolvedTmdbId(String(tmdbId));
                }

                // Build seasons list
                const availableSeasons = data?.seasons && data.seasons.length > 0
                    ? data.seasons
                    : (data?.totalSeasons > 1
                        ? Array.from({ length: data.totalSeasons }, (_, i) => ({
                            seasonNumber: i + 1,
                            name: `Season ${i + 1}`,
                            id: animeId
                        }))
                        : [{ seasonNumber: 1, name: data?.format === 'MOVIE' ? 'Movie' : 'Season 1', id: animeId }]
                    );
                setSeasons(availableSeasons);
                setSelectedSeason(initialSeason);

                // Fetch reviews from SupabaseDB
                SupabaseDB.getMediaReviews(animeId).then(revs => {
                    if (active) setReviews(Array.isArray(revs) ? revs : []);
                }).catch(() => {});

                // Fetch episode list for the initial season
                setLoadingEpisodes(true);
                const epList = await AnimeService.getEpisodes(animeId, initialSeason, data?.title, data?.subCount, data?.dubCount);
                if (active) {
                    setEpisodes(epList || []);
                    if (epList && epList.length > 0) {
                        const hasInitial = epList.some(e => e.episodeNumber === initialEpisode);
                        setSelectedEpisodeNum(hasInitial ? initialEpisode : (epList[0].episodeNumber || 1));
                    }
                }
            } catch (err) {
                console.error('Failed to load anime details:', err);
            } finally {
                if (active) {
                    setLoading(false);
                    setLoadingEpisodes(false);
                }
            }
        };

        if (animeId) {
            loadAnimeData();
        }
        return () => { active = false; };
    }, [animeId, animeProp]);

    // 2. Playback duration tracking & real progress saving (Continuous & unmount/beforeunload)
    const playbackSecondsRef = useRef(0);

    useEffect(() => {
        if (!isPlaying || !animeId) return;

        // Initialize from existing progress if resuming
        playbackSecondsRef.current = animeProp?.currentTime || 0;

        const rawTitle = anime?.title || anime?.name || anime?.romaji || anime?.english;
        const finalTitle = typeof rawTitle === 'object' && rawTitle
            ? (rawTitle.english || rawTitle.romaji || rawTitle.userPreferred || 'Anime')
            : (rawTitle || 'Anime');
        const finalPoster = anime?.poster || anime?.backdrop || anime?.coverImage?.large || anime?.image || '';
        const dur = 1440; // 24 minutes in seconds

        const saveCurrentProgress = () => {
            if (typeof saveProgress !== 'function') return;
            const cur = playbackSecondsRef.current;
            const pct = Math.min(100, Math.max(1, Math.round((cur / dur) * 100)));
            saveProgress(
                anime?.id || animeId,
                pct,
                null,
                selectedSeason,
                selectedEpisodeNum,
                'anime',
                finalTitle,
                finalPoster,
                cur,
                dur
            );
        };

        // Initial save
        saveCurrentProgress();

        // 1-second elapsed ticker while player is active and visible
        const timer = setInterval(() => {
            if (!document.hidden) {
                playbackSecondsRef.current += 1;
            }
        }, 1000);

        // 5-second persistence interval
        const persistInterval = setInterval(() => {
            saveCurrentProgress();
        }, 5000);

        const handleBeforeUnload = () => {
            saveCurrentProgress();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(timer);
            clearInterval(persistInterval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            saveCurrentProgress();
        };
    }, [isPlaying, selectedEpisodeNum, selectedSeason, anime, animeId, saveProgress]);


    const syncHashState = (ep, s = selectedSeason, play = isPlaying) => {
        if (typeof window === 'undefined') return;
        const base = `#/anime/${animeId}`;
        const newHash = play ? `${base}?play=true&season=${s}&episode=${ep}` : `${base}?season=${s}&episode=${ep}`;
        window.history.replaceState(null, '', newHash);
    };

    // Handle Season Change
    const handleSeasonChange = async (seasonNum) => {
        setSelectedSeason(seasonNum);
        setSelectedEpisodeNum(1);
        setChunkIndex(0);
        setLoadingEpisodes(true);

        const sObj = seasons.find(s => s.seasonNumber === seasonNum);
        if (sObj?.id && String(sObj.id) !== String(animeId)) {
            navigateTo(`#/anime/${sObj.id}?play=true&season=1&episode=1`);
            return;
        }

        syncHashState(1, seasonNum, isPlaying);

        try {
            const epList = await AnimeService.getEpisodes(animeId, seasonNum, anime?.title, anime?.subCount, anime?.dubCount);
            setEpisodes(epList || []);
            if (epList && epList.length > 0) {
                setSelectedEpisodeNum(epList[0].episodeNumber || 1);
            }
        } catch (e) {
            console.error('Failed to load season episodes:', e);
        } finally {
            setLoadingEpisodes(false);
        }
    };

    // Navigation handlers
    const currentEpisodeIndex = episodes.findIndex(e => e.episodeNumber === selectedEpisodeNum);
    const hasNextEpisode = currentEpisodeIndex < episodes.length - 1;
    const hasPrevEpisode = currentEpisodeIndex > 0;

    const handleNextEpisode = () => {
        if (hasNextEpisode) {
            const nextEp = episodes[currentEpisodeIndex + 1];
            setSelectedEpisodeNum(nextEp.episodeNumber);
            syncHashState(nextEp.episodeNumber, selectedSeason, true);
            const nextChunk = Math.floor((nextEp.episodeNumber - 1) / EPISODES_PER_CHUNK);
            if (nextChunk !== chunkIndex) setChunkIndex(nextChunk);
        }
    };

    const handlePrevEpisode = () => {
        if (hasPrevEpisode) {
            const prevEp = episodes[currentEpisodeIndex - 1];
            setSelectedEpisodeNum(prevEp.episodeNumber);
            syncHashState(prevEp.episodeNumber, selectedSeason, true);
            const prevChunk = Math.floor((prevEp.episodeNumber - 1) / EPISODES_PER_CHUNK);
            if (prevChunk !== chunkIndex) setChunkIndex(prevChunk);
        }
    };

    const handleSelectEpisode = (epNum) => {
        setSelectedEpisodeNum(epNum);
        markAsWatched(epNum);
        syncHashState(epNum, selectedSeason, true);
        if (onPlayProp) {
            onPlayProp({ ...anime, type: 'anime', episode: epNum, season: selectedSeason || 1, tmdbId: resolvedTmdbId });
            return;
        }
        setIsPlaying(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleWatchNow = () => {
        const ep = selectedEpisodeNum || 1;
        markAsWatched(ep);
        syncHashState(ep, selectedSeason, true);
        if (onPlayProp) {
            onPlayProp({ ...anime, type: 'anime', episode: ep, season: selectedSeason || 1, tmdbId: resolvedTmdbId });
            return;
        }
        setIsPlaying(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            navigateTo('#/anime');
        }
    };

    // Keyboard listener for Escape to close modal when not playing
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isPlaying) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, onClose]);

    // Auto-Next Episode message listener from embedded player
    useEffect(() => {
        const handlePlayerMessage = (e) => {
            if (e.data?.type === 'notflix_auto_next_episode' && hasNextEpisode) {
                handleNextEpisode();
            }
        };
        window.addEventListener('message', handlePlayerMessage);
        return () => window.removeEventListener('message', handlePlayerMessage);
    }, [hasNextEpisode, currentEpisodeIndex, episodes]);

    // Construct memoized embed URL for dedicated Anime servers
    const playerUrl = useMemo(() => {
        const mediaIdStr = String(anime?.id || animeId);
        const resolvedId = resolvedTmdbId || anime?.tmdbId || ANIME_TMDB_MAP[mediaIdStr]?.tmdbId || anime?.id || animeId;
        const isMovie = anime?.format === 'MOVIE' || anime?.isMovie;
        const s = selectedSeason || 1;
        const ep = selectedEpisodeNum || 1;
        const srvList = audioMode === 'dub' ? ANIME_DUB_SERVERS : ANIME_SUB_SERVERS;
        const activeServerId = audioMode === 'dub' ? currentDubServer : currentSubServer;
        const srv = srvList.find(item => item.id === activeServerId) || srvList[0];
        const base = srv.getUrl(resolvedId, isMovie, s, ep, anime?.title || '');
        if (base.includes('/api/anime/player')) {
            return `${base}&autoSkipIntro=${autoSkipIntro ? 1 : 0}&autoSkipOutro=${autoSkipOutro ? 1 : 0}&autoNext=${autoNext ? 1 : 0}`;
        }
        return base;
    }, [anime, animeId, resolvedTmdbId, currentSubServer, currentDubServer, selectedSeason, selectedEpisodeNum, audioMode, autoSkipIntro, autoSkipOutro, autoNext]);

    // Review submission handler
    const handleReviewSubmit = async () => {
        if (!user) {
            setAuthModalOpen?.(true);
            return;
        }
        if (newReviewRating === 0) {
            addNotification?.('Rating Required', 'Please select a star rating first.', 'error');
            return;
        }
        if (!newReviewText.trim()) {
            addNotification?.('Comment Required', 'Please write a review comment.', 'error');
            return;
        }

        setIsSubmittingReview(true);
        try {
            await SupabaseDB.submitReview(user.id, animeId, newReviewRating, newReviewText);
            addNotification?.('Success', 'Your anime review has been posted!', 'check_circle');
            setReviews(prev => [
                {
                    id: Date.now(),
                    user_id: user.id,
                    username: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                    rating: newReviewRating,
                    comment: newReviewText,
                    created_at: new Date().toISOString()
                },
                ...prev
            ]);
            setNewReviewText('');
            setNewReviewRating(0);
        } catch (e) {
            addNotification?.('Error', 'Failed to post review.', 'error');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const inWatchlist = currentAnime ? watchlist.some(item => String(item.id) === String(currentAnime.id)) : false;

    if (!onClose && loading && !currentAnime) {
        return <DetailsPageSkeleton />;
    }

    if (!onClose && !currentAnime) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <span className="material-symbols-outlined text-6xl text-[#E50914] mb-4">search_off</span>
                <h2 className="text-2xl font-bold text-white mb-2">Anime Not Found</h2>
                <p className="text-white/60 mb-6">We couldn't retrieve the details for this anime.</p>
                <button
                    onClick={handleClose}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#E50914] hover:bg-[#b8070f] transition cursor-pointer text-white"
                >
                    Back to Anime
                </button>
            </div>
        );
    }

    // ─── SUB-SECTIONS (Reused in both Pop-up Card and Player Screen) ───

    const renderEpisodesSection = () => (
        <section className="space-y-5">
            {/* Header Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#E50914]">playlist_play</span>
                            Episodes
                            <span className="text-xs text-white/40 font-normal">
                                ({isSearching ? `${filteredEpisodes.length} of ${episodes.length}` : `${episodes.length} Episodes`})
                            </span>
                        </h2>
                        <p className="text-white/50 text-xs mt-1">Select an episode to stream in high definition.</p>
                    </div>

                    {/* Season Selector Dropdown */}
                    {seasons && seasons.length > 0 && (
                        <div className="relative ml-0 sm:ml-2">
                            <select
                                value={selectedSeason}
                                onChange={(e) => handleSeasonChange(parseInt(e.target.value, 10))}
                                className="appearance-none pr-10 pl-4 py-2 rounded-xl text-white font-bold text-xs sm:text-sm cursor-pointer outline-none focus:ring-2 focus:ring-[#E50914]/50 bg-[#141418] border border-white/20 hover:border-[#E50914]/50 transition-all shadow-md"
                                aria-label="Season Selector"
                            >
                                {seasons.map(s => {
                                    const arc = s.arcName ? ` - ${s.arcName}` : (s.name && !s.name.startsWith('Season') ? ` - ${s.name}` : '');
                                    return (
                                        <option key={s.seasonNumber} value={s.seasonNumber} style={{ background: '#141418', color: 'white' }}>
                                            Season {s.seasonNumber}{arc} {s.episodeCount ? `(${s.episodeCount} eps)` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 text-lg">
                                expand_more
                            </span>
                        </div>
                    )}
                </div>

                {/* Filter & View Mode Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Real-time Episode Search Input */}
                    <div className="relative min-w-[170px] sm:min-w-[210px] flex-1 sm:flex-none">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-base pointer-events-none">
                            search
                        </span>
                        <input
                            type="text"
                            value={episodeSearchQuery}
                            onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                            placeholder="Filter ep # or title..."
                            className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#141418] border border-white/15 text-white placeholder-white/40 text-xs focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
                        />
                        {episodeSearchQuery && (
                            <button
                                onClick={() => setEpisodeSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition cursor-pointer"
                                title="Clear search"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>

                    {/* Filler Filter Chips */}
                    <div className="flex items-center bg-[#141418] rounded-xl border border-white/10 p-0.5">
                        <button
                            onClick={() => setFillerFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                fillerFilter === 'all'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/50 hover:text-white'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFillerFilter('canon')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                fillerFilter === 'canon'
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/50 hover:text-white'
                            }`}
                        >
                            Canon
                        </button>
                        <button
                            onClick={() => setFillerFilter('filler')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                                fillerFilter === 'filler'
                                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                    : 'text-amber-400/60 hover:text-amber-300'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Filler
                        </button>
                    </div>

                    {/* Dual View Mode Toggle Switcher */}
                    <div className="flex items-center bg-[#141418] rounded-xl border border-white/10 p-0.5" title="Toggle episode view mode">
                        <button
                            onClick={() => handleSetViewMode('grid')}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                                episodesViewMode === 'grid'
                                    ? 'bg-[#E50914] text-white shadow-sm'
                                    : 'text-white/50 hover:text-white'
                            }`}
                            title="Thumbnail Card Grid"
                        >
                            <span className="material-symbols-outlined text-base">grid_view</span>
                        </button>
                        <button
                            onClick={() => handleSetViewMode('compact')}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                                episodesViewMode === 'compact'
                                    ? 'bg-[#E50914] text-white shadow-sm'
                                    : 'text-white/50 hover:text-white'
                            }`}
                            title="Compact Number Matrix"
                        >
                            <span className="material-symbols-outlined text-base">apps</span>
                        </button>
                        <button
                            onClick={() => handleSetViewMode('list')}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                                episodesViewMode === 'list'
                                    ? 'bg-[#E50914] text-white shadow-sm'
                                    : 'text-white/50 hover:text-white'
                            }`}
                            title="Detailed List"
                        >
                            <span className="material-symbols-outlined text-base">view_list</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Chunk Range Switcher (When Not Filtering and Episodes > 50) */}
            {!isSearching && totalChunks > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar max-w-full pb-1">
                    <span className="text-[11px] font-bold text-white/40 uppercase mr-1 shrink-0">Range:</span>
                    {Array.from({ length: totalChunks }, (_, idx) => {
                        const start = idx * EPISODES_PER_CHUNK + 1;
                        const end = Math.min((idx + 1) * EPISODES_PER_CHUNK, episodes.length);
                        return (
                            <button
                                key={idx}
                                onClick={() => setChunkIndex(idx)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    chunkIndex === idx
                                        ? 'bg-[#E50914] text-white shadow-md shadow-red-600/30 ring-1 ring-red-400'
                                        : 'bg-[#141418] text-white/60 hover:text-white border border-white/10 hover:border-white/25'
                                }`}
                            >
                                {start}-{end}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Next Episode Airing Schedule Banner (Zoro / AnimeSuge style) */}
            {nextAiring && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#181820] to-emerald-950/20 border border-emerald-500/30 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in my-1">
                    <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-md">
                            <span className="material-symbols-outlined text-2xl">broadcast_on_home</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                                    Next Episode Airing
                                </span>
                                <span className="text-white/30 text-xs">•</span>
                                <span className="text-xs font-bold text-white">
                                    Episode {nextAiring.episode}
                                </span>
                            </div>
                            <h4 className="text-sm sm:text-base font-bold text-white mt-1">
                                {formattedAirDateTime}
                            </h4>
                            <p className="text-[11px] text-white/50 mt-0.5">
                                Official broadcast schedule in your local timezone. Subtitled streams typically arrive ~1 hour after TV broadcast.
                            </p>
                        </div>
                    </div>

                    {/* Live Countdown & Remind Me Button */}
                    <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0 shrink-0">
                        <div 
                            className="px-3.5 py-2 rounded-xl bg-black/60 border border-emerald-500/30 text-emerald-300 font-mono text-xs sm:text-sm font-bold flex items-center gap-2 shadow-inner"
                            title="Live countdown until release"
                        >
                            <span className="material-symbols-outlined text-base text-emerald-400">schedule</span>
                            <span>{countdownDisplay}</span>
                        </div>

                        <button
                            onClick={handleAddToCalendar}
                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-white/10 shadow-sm"
                            title="Add reminder to Google / Apple Calendar"
                        >
                            <span className="material-symbols-outlined text-base text-white/80">calendar_add_on</span>
                            <span className="hidden sm:inline">Remind Me</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Completed Series Tag */}
            {!nextAiring && (currentAnime?.status === 'FINISHED' || currentAnime?.status === 'COMPLETED') && (
                <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-white/70 my-1">
                    <span className="material-symbols-outlined text-base text-emerald-400">task_alt</span>
                    <span>All {episodes.length || currentAnime?.episodesCount || 12} Episodes Available • Series Completed</span>
                </div>
            )}

            {/* Episodes Content View */}
            {loadingEpisodes ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="aspect-video bg-white/5 rounded-2xl animate-pulse border border-white/5"></div>
                    ))}
                </div>
            ) : visibleEpisodes.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-2xl bg-[#141418] border border-white/10 space-y-3">
                    <span className="material-symbols-outlined text-4xl text-white/30">search_off</span>
                    <p className="text-white/60 text-sm">No episodes match your search query or filter.</p>
                    {(episodeSearchQuery || fillerFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setEpisodeSearchQuery('');
                                setFillerFilter('all');
                            }}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            ) : episodesViewMode === 'grid' ? (
                /* ═══════════════ 1. THUMBNAIL CARD GRID VIEW (Zoro / HiAnime / Crunchyroll) ═══════════════ */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visibleEpisodes.map((ep) => {
                        const isCurrent = ep.episodeNumber === selectedEpisodeNum;
                        const watched = isWatched(ep.episodeNumber);
                        const stillUrl = ep.still || ep.thumbnail || currentAnime?.backdrop || currentAnime?.poster;
                        const isOverviewExpanded = expandedOverviewEp === ep.episodeNumber;
                        const hasDub = ep.hasDub ?? (currentAnime?.dubCount && ep.episodeNumber <= currentAnime.dubCount);
                        const hasSub = ep.hasSub ?? true;

                        return (
                            <div
                                key={ep.id || ep.episodeNumber}
                                onClick={() => handleSelectEpisode(ep.episodeNumber)}
                                className={`group relative flex flex-col rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300 ${
                                    isCurrent
                                        ? 'bg-[#181824] border-[#E50914] ring-2 ring-[#E50914]/80 shadow-xl shadow-red-600/20'
                                        : watched
                                            ? 'bg-[#141418] border-emerald-500/40 ring-1 ring-emerald-500/25 hover:border-emerald-400 hover:bg-[#1a1a22]'
                                            : 'bg-[#141418] border-white/10 hover:border-white/30 hover:bg-[#1a1a22]'
                                }`}
                            >
                                {/* 16:9 Thumbnail Image */}
                                <div className="relative aspect-video w-full bg-black/60 overflow-hidden">
                                    {stillUrl ? (
                                        <img
                                            src={stillUrl}
                                            alt={ep.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            loading="lazy"
                                            onError={(e) => {
                                                if (currentAnime?.backdrop && e.target.src !== currentAnime.backdrop) {
                                                    e.target.src = currentAnime.backdrop;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white/30">
                                            <span className="material-symbols-outlined text-3xl">movie</span>
                                        </div>
                                    )}

                                    {/* Gradient Dark Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

                                    {/* Top-Left Episode Number Badge */}
                                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-white font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-md">
                                        <span className={isCurrent ? 'text-red-400' : (watched ? 'text-emerald-400' : 'text-white/60')}>EP</span>
                                        <span>{ep.episodeNumber}</span>
                                    </div>

                                    {/* Top-Right Badges (Sub/Dub, Watched, Filler, Recap) */}
                                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                        {/* Sub & Dub Micro Pill */}
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-bold shadow-md">
                                            {hasSub && (
                                                <span className="flex items-center text-emerald-400" title="Subtitled">
                                                    <span className="material-symbols-outlined text-[12px] leading-none">closed_caption</span>
                                                </span>
                                            )}
                                            {hasDub && (
                                                <span className="flex items-center text-amber-400" title="Dubbed">
                                                    <span className="material-symbols-outlined text-[12px] leading-none">mic</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Watched Seen Badge */}
                                        {watched && !isCurrent && (
                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md" title="Watched">
                                                <span className="material-symbols-outlined text-[12px] leading-none">check_circle</span>
                                                <span className="hidden sm:inline">Seen</span>
                                            </span>
                                        )}

                                        {ep.isFiller && (
                                            <span className="px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                                                Filler
                                            </span>
                                        )}
                                        {ep.fillerType === 'recap' && (
                                            <span className="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-300 border border-purple-500/50 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                                                Recap
                                            </span>
                                        )}
                                        {ep.fillerType === 'mixed' && (
                                            <span className="px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-300 border border-blue-500/50 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                                                Mixed
                                            </span>
                                        )}
                                    </div>

                                    {/* Bottom Info Row on Thumbnail */}
                                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-medium text-white/80">
                                        <span>{ep.airDate || ''}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white/70 font-mono text-[10px]">
                                            {ep.runtime || '24m'}
                                        </span>
                                    </div>

                                    {/* Center Play Button Overlay on Hover / Active Indicator */}
                                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                                        isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/40'
                                    }`}>
                                        {isCurrent && isPlaying ? (
                                            <div className="px-3 py-1.5 rounded-xl bg-[#E50914] text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl animate-pulse">
                                                <span className="material-symbols-outlined text-sm">equalizer</span>
                                                Playing
                                            </div>
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-[#E50914] text-white flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-xl pl-0.5">play_arrow</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Text Details */}
                                <div className="p-3.5 flex flex-col flex-1 justify-between">
                                    <div>
                                        <h3 className={`text-sm font-bold line-clamp-1 transition-colors ${
                                            isCurrent ? 'text-red-400' : (watched ? 'text-white/90 group-hover:text-red-400' : 'text-white group-hover:text-red-400')
                                        }`}>
                                            {ep.title}
                                        </h3>
                                        {ep.alternativeTitle && ep.alternativeTitle !== ep.title && (
                                            <p className="text-[11px] text-white/40 truncate mt-0.5 font-medium">
                                                {ep.alternativeTitle}
                                            </p>
                                        )}
                                        {ep.overview && (
                                            <p className={`text-xs text-white/60 mt-2 leading-relaxed transition-all ${
                                                isOverviewExpanded ? '' : 'line-clamp-2'
                                            }`}>
                                                {ep.overview}
                                            </p>
                                        )}
                                    </div>

                                    {ep.overview && ep.overview.length > 90 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedOverviewEp(isOverviewExpanded ? null : ep.episodeNumber);
                                            }}
                                            className="text-[10px] font-bold text-white/40 hover:text-white mt-2 self-start transition cursor-pointer"
                                        >
                                            {isOverviewExpanded ? 'Show less' : 'Read more'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : episodesViewMode === 'compact' ? (
                /* ═══════════════ 2. COMPACT NUMBER MATRIX VIEW (Zoro / HiAnime Fast Jump) ═══════════════ */
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2.5">
                    {visibleEpisodes.map((ep) => {
                        const isCurrent = ep.episodeNumber === selectedEpisodeNum;
                        const watched = isWatched(ep.episodeNumber);
                        const hasDub = ep.hasDub ?? (currentAnime?.dubCount && ep.episodeNumber <= currentAnime.dubCount);
                        const hasSub = ep.hasSub ?? true;

                        return (
                            <button
                                key={ep.id || ep.episodeNumber}
                                onClick={() => handleSelectEpisode(ep.episodeNumber)}
                                title={`${ep.title} (${ep.runtime || '24m'})${ep.isFiller ? ' [Filler]' : ''}${watched ? ' [Watched]' : ''}`}
                                className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer group ${
                                    isCurrent
                                        ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-red-600/30 ring-2 ring-red-400'
                                        : watched
                                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold hover:bg-emerald-900/50'
                                            : ep.isFiller
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400 hover:bg-amber-500/20'
                                                : 'bg-[#141418] border-white/10 text-white/80 hover:border-white/30 hover:text-white hover:bg-[#1a1a22]'
                                }`}
                            >
                                <span className="font-mono text-sm font-black flex items-center gap-0.5">
                                    {ep.episodeNumber}
                                    {watched && !isCurrent && (
                                        <span className="material-symbols-outlined text-[10px] text-emerald-400">check</span>
                                    )}
                                </span>
                                <div className="flex items-center gap-0.5 text-[7.5px] font-bold tracking-tight opacity-75">
                                    {hasSub && <span className="text-emerald-400">CC</span>}
                                    {hasDub && <span className="text-amber-400">DUB</span>}
                                    {ep.isFiller && <span className="text-orange-400">FIL</span>}
                                </div>
                                {isCurrent && isPlaying && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping absolute top-1.5 right-1.5"></span>
                                )}
                            </button>
                        );
                    })}
                </div>
            ) : (
                /* ═══════════════ 3. DETAILED HORIZONTAL LIST VIEW ═══════════════ */
                <div className="space-y-3">
                    {visibleEpisodes.map((ep) => {
                        const isCurrent = ep.episodeNumber === selectedEpisodeNum;
                        const watched = isWatched(ep.episodeNumber);
                        const stillUrl = ep.still || ep.thumbnail || currentAnime?.backdrop || currentAnime?.poster;
                        const hasDub = ep.hasDub ?? (currentAnime?.dubCount && ep.episodeNumber <= currentAnime.dubCount);
                        const hasSub = ep.hasSub ?? true;

                        return (
                            <div
                                key={ep.id || ep.episodeNumber}
                                onClick={() => handleSelectEpisode(ep.episodeNumber)}
                                className={`group p-3 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all cursor-pointer ${
                                    isCurrent
                                        ? 'bg-[#181824] border-[#E50914] ring-1 ring-[#E50914] shadow-lg shadow-red-600/20'
                                        : watched
                                            ? 'bg-[#141418] border-emerald-500/40 hover:border-emerald-400 hover:bg-[#1a1a22]'
                                            : 'bg-[#141418] border-white/10 hover:border-white/25 hover:bg-[#1a1a22]'
                                }`}
                            >
                                {/* Left Episode Still */}
                                <div className="relative aspect-video w-full sm:w-44 shrink-0 rounded-xl overflow-hidden bg-black/60">
                                    {stillUrl ? (
                                        <img
                                            src={stillUrl}
                                            alt={ep.title}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/30">
                                            <span className="material-symbols-outlined text-2xl">movie</span>
                                        </div>
                                    )}

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined text-white text-2xl">play_circle</span>
                                    </div>

                                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white/80">
                                        {ep.runtime || '24m'}
                                    </div>
                                </div>

                                {/* Right Episode Info */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`font-mono text-xs font-bold ${isCurrent ? 'text-red-400' : (watched ? 'text-emerald-400' : 'text-red-400')}`}>
                                            EP {ep.episodeNumber}
                                        </span>
                                        <h4 className={`text-sm sm:text-base font-bold transition-colors truncate ${isCurrent ? 'text-red-400' : 'text-white group-hover:text-red-400'}`}>
                                            {ep.title}
                                        </h4>
                                        {/* Sub / Dub Indicators */}
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-[9px] font-bold">
                                            {hasSub && <span className="text-emerald-400">CC</span>}
                                            {hasDub && <span className="text-amber-400">DUB</span>}
                                        </div>
                                        {watched && !isCurrent && (
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[11px]">check</span>
                                                Seen
                                            </span>
                                        )}
                                        {ep.isFiller && (
                                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase">
                                                Filler
                                            </span>
                                        )}
                                        {isCurrent && isPlaying && (
                                            <span className="px-2 py-0.5 rounded bg-[#E50914] text-white text-[9px] font-bold uppercase animate-pulse">
                                                Playing
                                            </span>
                                        )}
                                    </div>

                                    {ep.alternativeTitle && ep.alternativeTitle !== ep.title && (
                                        <p className="text-xs text-white/40 truncate font-medium">
                                            {ep.alternativeTitle}
                                        </p>
                                    )}

                                    {ep.overview && (
                                        <p className="text-xs text-white/60 line-clamp-2 leading-relaxed pt-1">
                                            {ep.overview}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );

    const renderCharactersSection = () => {
        if (!currentAnime?.characters || currentAnime.characters.length === 0) return null;
        return (
            <section className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#E50914]">record_voice_over</span>
                    Characters & Voice Actors
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {currentAnime.characters.slice(0, 8).map((char) => (
                        <div
                            key={char.id || char.name}
                            className="bg-[#141418] p-3 rounded-xl border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-all"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                    src={char.image || '/notflix-logo.png'}
                                    alt={char.name}
                                    className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                                    onError={(e) => { e.target.src = '/notflix-logo.png'; }}
                                />
                                <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-white truncate">{char.name}</h4>
                                    <span className="text-[10px] text-white/40 uppercase">{char.role || 'Main'}</span>
                                </div>
                            </div>

                            {char.voiceActor && (
                                <div className="flex items-center gap-2 text-right shrink-0">
                                    <div className="text-right">
                                        <h5 className="text-[11px] font-semibold text-white/80 line-clamp-1">{char.voiceActor.name}</h5>
                                        <span className="text-[9px] text-red-400">Japanese VA</span>
                                    </div>
                                    <img
                                        src={char.voiceActor.image || '/notflix-logo.png'}
                                        alt={char.voiceActor.name}
                                        className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                                        onError={(e) => { e.target.src = '/notflix-logo.png'; }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    const renderRecommendationsSection = () => {
        if (!currentAnime?.recommendations || currentAnime.recommendations.length === 0) return null;
        return (
            <MediaRow
                title="Fans Also Liked"
                items={currentAnime.recommendations}
                onSelect={(item) => navigateTo(`#/anime/${item.id}`)}
                onPlay={(item) => navigateTo(`#/anime/${item.id}?play=true`)}
            />
        );
    };

    const renderReviewsSection = () => (
        <section className="space-y-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    Community Reviews
                    <span className="text-xs text-white/40 font-normal">({reviews.length})</span>
                </h2>
            </div>

            {/* Write Review Form */}
            <div className="bg-[#141418] p-5 rounded-2xl border border-white/10 space-y-4">
                <h4 className="text-sm font-bold text-white">Leave your review for {currentAnime?.title || 'this anime'}</h4>
                
                {/* Rating stars */}
                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setNewReviewRating(star)}
                            className="cursor-pointer text-white/30 hover:scale-110 transition-transform"
                        >
                            <span
                                className={`material-symbols-outlined text-xl ${
                                    (hoverRating || newReviewRating) >= star ? 'text-amber-400 fill' : 'text-white/30'
                                }`}
                                style={{ fontVariationSettings: (hoverRating || newReviewRating) >= star ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                star
                            </span>
                        </button>
                    ))}
                    <span className="text-xs font-mono text-white/60 ml-2">
                        {hoverRating || newReviewRating ? `${hoverRating || newReviewRating} / 10` : 'Select score'}
                    </span>
                </div>

                <textarea
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                    placeholder="Share your thoughts about the animation, storyline, pacing..."
                    rows="3"
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/40 focus:border-[#E50914] focus:outline-none resize-none"
                />

                <div className="flex justify-end">
                    <button
                        onClick={handleReviewSubmit}
                        disabled={isSubmittingReview}
                        className="bg-[#E50914] hover:bg-[#b8070f] disabled:opacity-50 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        {isSubmittingReview ? 'Posting...' : 'Post Review'}
                    </button>
                </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
                {reviews.length === 0 ? (
                    <p className="text-white/40 text-xs py-4 text-center">Be the first to review this anime!</p>
                ) : (
                    reviews.map((rev) => (
                        <div key={rev.id} className="bg-[#141418] p-4 rounded-xl border border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{rev.username || 'Anonymous'}</span>
                                    <span className="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                        ★ {rev.rating}/10
                                    </span>
                                </div>
                                <span className="text-[10px] text-white/40">
                                    {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recent'}
                                </span>
                            </div>
                            <p className="text-white/80 text-xs leading-relaxed">{rev.comment}</p>
                        </div>
                    ))
                )}
            </div>
        </section>
    );

    // ═══════════════ 1. STREAMING / PLAYER PAGE VIEW (WHEN PLAYING) ═══════════════
    if (isPlaying) {
        return (
            <div className="w-full pb-20 text-left bg-[#08080a] relative font-sans min-h-screen">
                {/* Cinema Video Player Container with Snug Navbar Spacing */}
                <section className="relative w-full overflow-hidden">
                    <div
                        ref={playerContainerRef}
                        className={`w-full bg-black relative group transition-all duration-300 ${
                            isUniversalFullscreen ? 'h-screen flex items-center justify-center p-0 m-0' : 'pt-16 md:pt-18 px-0 md:px-4 max-w-[1400px] mx-auto'
                        }`}
                    >
                        <div className={`w-full mx-auto ${isUniversalFullscreen ? 'h-full' : 'aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-950'}`}>
                            <div className="relative w-full h-full">
                                <iframe
                                    key={`${currentServer}-${resolvedTmdbId || animeId}-${selectedSeason}-${selectedEpisodeNum}-${audioMode}`}
                                    src={playerUrl}
                                    className="absolute inset-0 w-full h-full border-0 bg-black"
                                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock"
                                    allowFullScreen
                                    referrerPolicy="origin"
                                    title={`${anime?.title || animeProp?.title || 'Anime'} - Season ${selectedSeason} Episode ${selectedEpisodeNum}`}
                                />
                            </div>
                        </div>

                        {/* Floating Universal Fullscreen Fallback Button */}
                        <button
                            onClick={toggleUniversalFullscreen}
                            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-40 bg-black/85 hover:bg-[#E50914] text-white px-3 py-2 rounded-full backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-200 opacity-80 hover:opacity-100 flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title={isUniversalFullscreen ? "Exit Fullscreen (Esc or F)" : "Universal Fullscreen (F)"}
                        >
                            <span className="material-symbols-outlined text-lg sm:text-xl">
                                {isUniversalFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                            </span>
                            <span className="text-xs font-bold pr-1 hidden sm:inline">
                                {isUniversalFullscreen ? 'Exit' : 'Fullscreen'}
                            </span>
                        </button>
                    </div>
                </section>

                {/* Stream Action Toolbar Below Player */}
                <section className="px-4 sm:px-8 md:px-14 py-4 max-w-[1400px] mx-auto">
                    <div className="bg-[#141418] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 overflow-hidden w-full">
                        <div className="flex items-center justify-between md:justify-start gap-3 min-w-0 w-full md:w-auto">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="material-symbols-outlined text-[#E50914] text-2xl shrink-0">play_circle</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-white text-xs sm:text-sm truncate">{anime.title}</p>
                                    <p className="text-white/50 text-[11px] sm:text-xs truncate">
                                        Season {selectedSeason} · Episode {selectedEpisodeNum}
                                    </p>
                                </div>
                            </div>

                            {/* Prev / Next Episode quick buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-auto md:ml-4">
                                <button
                                    onClick={handlePrevEpisode}
                                    disabled={!hasPrevEpisode}
                                    className="px-2.5 py-1.5 rounded-lg border border-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 flex items-center gap-1 cursor-pointer bg-white/5 transition text-xs font-bold"
                                    title="Previous Episode"
                                >
                                    <span className="material-symbols-outlined text-sm">skip_previous</span>
                                    <span className="hidden sm:inline">Prev</span>
                                </button>
                                <button
                                    onClick={handleNextEpisode}
                                    disabled={!hasNextEpisode}
                                    className="px-2.5 py-1.5 rounded-lg border border-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 flex items-center gap-1 cursor-pointer bg-white/5 transition text-xs font-bold"
                                    title="Next Episode"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <span className="material-symbols-outlined text-sm">skip_next</span>
                                </button>
                            </div>
                        </div>

                        {/* Audio Mode, Auto-Skip Toggles, and Dedicated Anime Servers List */}
                        <div className="w-full md:w-auto md:flex-1 min-w-0 flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
                            {/* Sub / Dub Audio Toggle (ANIME ONLY) with Dub Availability Guard */}
                            <div className="flex items-center bg-white/10 p-0.5 rounded-lg shrink-0 border border-white/10 mr-1">
                                <button
                                    onClick={() => setAudioMode('sub')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                        audioMode === 'sub' ? 'bg-[#E50914] text-white shadow' : 'text-white/60 hover:text-white'
                                    }`}
                                >
                                    SUB
                                </button>
                                <button
                                    onClick={() => {
                                        if (anime?.dubCount !== 0 && anime?.dubCount !== null) {
                                            setAudioMode('dub');
                                        } else {
                                            addNotification?.('Dub Unavailable', 'English Dub is not currently available for this title.', 'info');
                                        }
                                    }}
                                    disabled={anime?.dubCount === 0 || anime?.dubCount === null}
                                    title={anime?.dubCount === 0 || anime?.dubCount === null ? 'English Dub not available for this anime' : 'Switch to English Dub'}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                        audioMode === 'dub' ? 'bg-[#E50914] text-white shadow' : 'text-white/60 hover:text-white'
                                    }`}
                                >
                                    DUB
                                </button>
                            </div>

                            {/* Auto Skip & Next Toggles */}
                            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 gap-0.5 text-[11px] font-semibold text-white/80 shrink-0">
                                <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-white/10 transition select-none" title="Automatically skip opening intro">
                                    <input
                                        type="checkbox"
                                        checked={autoSkipIntro}
                                        onChange={(e) => handleToggleAutoSkipIntro(e.target.checked)}
                                        className="cursor-pointer accent-[#E50914]"
                                    />
                                    <span className="hidden sm:inline">Auto Intro</span>
                                    <span className="sm:hidden">Intro</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-white/10 transition select-none" title="Automatically skip ending outro">
                                    <input
                                        type="checkbox"
                                        checked={autoSkipOutro}
                                        onChange={(e) => handleToggleAutoSkipOutro(e.target.checked)}
                                        className="cursor-pointer accent-[#E50914]"
                                    />
                                    <span className="hidden sm:inline">Auto Outro</span>
                                    <span className="sm:hidden">Outro</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-white/10 transition select-none" title="Automatically play next episode">
                                    <input
                                        type="checkbox"
                                        checked={autoNext}
                                        onChange={(e) => handleToggleAutoNext(e.target.checked)}
                                        className="cursor-pointer accent-[#E50914]"
                                    />
                                    <span className="hidden sm:inline">Auto Next</span>
                                    <span className="sm:hidden">Next</span>
                                </label>
                            </div>

                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider mr-1 hidden lg:inline shrink-0">
                                {audioMode === 'dub' ? 'Dub Servers' : 'Sub Servers'}
                            </span>

                            {activeServers.map(srv => {
                                const isSelected = currentServer === srv.id;
                                return (
                                    <button
                                        key={srv.id}
                                        onClick={() => setCurrentServer(srv.id)}
                                        className={`shrink-0 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                            isSelected
                                                ? 'bg-[#E50914] text-white shadow-lg shadow-red-600/40 border border-red-500'
                                                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <span>{srv.name}</span>
                                        {srv.badge && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-black tracking-wider ${
                                                isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'
                                            }`}>
                                                {srv.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Scrolled Down Sections: Episodes, Characters, Recommendations, Reviews */}
                <div className="max-w-[1400px] mx-auto px-4 sm:px-8 md:px-14 py-4 space-y-12">
                    {renderEpisodesSection()}
                    {renderCharactersSection()}
                    {renderRecommendationsSection()}
                    {renderReviewsSection()}
                </div>
            </div>
        );
    }

    // ═══════════════ 2. MACOS DESKTOP 16:9 POP-UP CARD MODAL (WHEN NOT PLAYING) ═══════════════
    const isModalLoading = !currentAnime;
    const displayGenre = currentAnime && Array.isArray(currentAnime.genres) && currentAnime.genres.length > 0
        ? (typeof currentAnime.genres[0] === 'object' ? currentAnime.genres[0].name : currentAnime.genres[0])
        : null;

    const displayYear = currentAnime ? (currentAnime.year || (currentAnime.releaseDate ? String(currentAnime.releaseDate).slice(0, 4) : null)) : null;
    const displayRating = currentAnime ? Number(currentAnime.rating || 8.4).toFixed(1) : '8.4';
    const displayDuration = currentAnime ? (currentAnime.format === 'MOVIE' ? 'Movie' : (episodes.length > 0 ? `${episodes.length} Episodes` : (seasons.length > 1 ? `${seasons.length} Seasons` : '1 Season'))) : null;

    return (
        <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 md:p-6 lg:p-8 animate-fade-in"
            onClick={handleClose}
        >
            <div 
                className="relative w-full max-w-4xl lg:max-w-5xl xl:max-w-[1100px] aspect-[16/9] max-h-[86vh] bg-[#141418] rounded-3xl overflow-y-auto custom-scrollbar border border-white/10 shadow-2xl shadow-black/95 text-left flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Initial 16:9 Stage Area */}
                <div className="relative w-full aspect-[16/9] min-h-[100%] overflow-hidden bg-neutral-950 flex-none">
                    {/* Backdrop Image Shimmer / Fade */}
                    {(!backdropLoaded || isModalLoading) && (
                        <div className="absolute inset-0 bg-neutral-900 skeleton-shimmer z-0"></div>
                    )}
                    {currentAnime && (
                        <img
                            className={`w-full h-full object-cover object-center transform scale-[1.01] transition-opacity duration-300 ${backdropLoaded ? 'opacity-100' : 'opacity-0'}`}
                            src={TMDBService.getImageUrl(currentAnime.backdrop || currentAnime.backdrop_path || currentAnime.poster || currentAnime.poster_path, 'original')}
                            alt={currentAnime.title || currentAnime.name || 'Anime'}
                            onLoad={() => setBackdropLoaded(true)}
                            onError={(e) => { e.target.src = '/notflix-logo.png'; setBackdropLoaded(true); }}
                        />
                    )}

                    {/* Studio-Quality Cinema Scrim Gradient - Perfectly smooth multi-stop transition with zero hard lines */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(to top, #141418 0%, rgba(20, 20, 24, 0.90) 12%, rgba(20, 20, 24, 0.60) 24%, rgba(20, 20, 24, 0.28) 36%, rgba(20, 20, 24, 0.08) 48%, rgba(20, 20, 24, 0) 58%)'
                        }}
                    />
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse 75% 55% at 0% 100%, rgba(20, 20, 24, 0.45) 0%, rgba(20, 20, 24, 0.15) 35%, transparent 70%)'
                        }}
                    />

                    {/* Top Right Close Button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 sm:top-5 sm:right-5 z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/70 hover:bg-[#E50914] text-white flex items-center justify-center border border-white/20 backdrop-blur-md transition cursor-pointer shadow-xl active:scale-95"
                        title="Close (Esc)"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>

                    {/* Bottom Details (Desktop Aligned) */}
                    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end p-5 sm:p-7 md:p-9 max-w-4xl">
                        {isModalLoading ? (
                            <div className="space-y-3 max-w-2xl">
                                <div className="skeleton-shimmer w-3/4 h-8 sm:h-11 rounded-xl" />
                                <div className="skeleton-shimmer w-1/2 h-5 rounded-lg" />
                                <div className="skeleton-shimmer w-5/6 h-4 rounded" />
                                <div className="skeleton-shimmer w-2/3 h-4 rounded" />
                                <div className="flex items-center gap-3.5 pt-1.5">
                                    <div className="skeleton-shimmer w-28 sm:w-36 h-10 sm:h-12 rounded-xl" />
                                    <div className="skeleton-shimmer w-11 sm:w-12 h-11 sm:h-12 rounded-full" />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Title: 2 lines max */}
                                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-black text-white tracking-tight leading-[1.1] mb-2 sm:mb-2.5 line-clamp-2 max-w-3xl drop-shadow-2xl">
                                    {currentAnime.title}
                                </h1>

                                {/* Metadata Row: genre • Anime • year • rating • duration/episodes */}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-medium mb-2.5 sm:mb-3 text-white/90 drop-shadow">
                                    {displayGenre && (
                                        <>
                                            <span className="font-semibold text-white/95">{displayGenre}</span>
                                            <span className="text-white/40">•</span>
                                        </>
                                    )}
                                    <span className="text-[#E50914] font-bold uppercase tracking-wide">
                                        Anime
                                    </span>
                                    {displayYear && (
                                        <>
                                            <span className="text-white/40">•</span>
                                            <span className="text-white/85">{displayYear}</span>
                                        </>
                                    )}
                                    <span className="text-white/40">•</span>
                                    <span className="flex items-center gap-1 text-white font-bold">
                                        <span className="material-symbols-outlined text-amber-400 text-sm sm:text-base fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        {displayRating}
                                    </span>
                                    {displayDuration && (
                                        <>
                                            <span className="text-white/40">•</span>
                                            <span className="text-white/85">{displayDuration}</span>
                                        </>
                                    )}
                                </div>

                                {/* Description: 2 lines max */}
                                <p className="text-white/90 text-xs sm:text-sm md:text-[15px] mb-4 line-clamp-2 leading-relaxed max-w-2xl drop-shadow">
                                    {currentAnime.overview || currentAnime.synopsis}
                                </p>

                                {/* Action Buttons: Play + Watchlist */}
                                <div className="flex items-center gap-3 sm:gap-3.5 pt-1">
                                    <button
                                        onClick={handleWatchNow}
                                        className="bg-white hover:bg-neutral-200 text-black px-7 sm:px-9 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-white/10 cursor-pointer text-sm sm:text-base"
                                    >
                                        <span className="material-symbols-outlined text-2xl sm:text-3xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                        <span>Play</span>
                                    </button>

                                    <button
                                        onClick={() => toggleWatchlist?.(currentAnime)}
                                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/30 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md shadow-md"
                                        title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                                    >
                                        <span className="material-symbols-outlined text-2xl sm:text-3xl">
                                            {inWatchlist ? 'check' : 'add'}
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bottom Center Double Red Downward Arrow */}
                    {!isModalLoading && (
                        <button
                            onClick={handleScrollDown}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center -space-y-3.5 text-[#E50914] hover:scale-110 transition duration-300 animate-bounce cursor-pointer p-2"
                            title="Scroll down for more"
                        >
                            <span className="material-symbols-outlined text-2xl font-black drop-shadow-[0_0_10px_rgba(229,9,20,0.9)]">keyboard_arrow_down</span>
                            <span className="material-symbols-outlined text-2xl font-black drop-shadow-[0_0_10px_rgba(229,9,20,0.9)]">keyboard_arrow_down</span>
                        </button>
                    )}
                </div>

                {/* Scrolled Down Sections inside the card */}
                {!isModalLoading && (
                    <div id="scrolledContentSection" ref={scrolledContentRef} className="p-5 sm:p-8 md:p-10 space-y-10 bg-[#141418]">
                        {renderEpisodesSection()}
                        {renderCharactersSection()}
                        {renderRecommendationsSection()}
                        {renderReviewsSection()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnimeDetails;
