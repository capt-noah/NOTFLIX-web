import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import TMDBService from '../services/tmdb';
import { SupabaseDB } from '../services/db';
import { RatingBadge } from '../components/RatingBadge';
import { DetailsPageSkeleton, EpisodeListSkeleton, ModalCardSkeleton } from '../components/Skeleton';
import MediaRow from '../components/MediaRow';

// Highly reliable Movie & TV Show streaming servers (Verified 200 OK CDN Mirrors)
const MOVIE_TV_SERVERS = [
    {
        id: 'vidbing',
        name: 'Vidbing',
        getUrl: (id, type, s = 1, e = 1) =>
            type === 'tv'
                ? `https://moviesapi.to/tv/${id}/${s}/${e}`
                : `https://moviesapi.to/movie/${id}`
    },
    {
        id: 'vidlink',
        name: 'VidLink HD',
        getUrl: (id, type, s = 1, e = 1) =>
            type === 'tv'
                ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e50914`
                : `https://vidlink.pro/movie/${id}?primaryColor=e50914`
    },
    {
        id: 'primesrc',
        name: 'PrimeSrc HD',
        getUrl: (id, type, s = 1, e = 1) =>
            type === 'tv'
                ? `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
                : `https://primesrc.me/embed/movie?tmdb=${id}`
    },
    {
        id: 'vidsrcnet',
        name: 'VidSrc.net',
        getUrl: (id, type, s = 1, e = 1) =>
            type === 'tv'
                ? `https://vidsrc.net/embed/tv/${id}/${s}/${e}`
                : `https://vidsrc.net/embed/movie/${id}`
    },
    {
        id: 'vidsrcto',
        name: 'VidSrc.to',
        getUrl: (id, type, s = 1, e = 1) =>
            type === 'tv'
                ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
                : `https://vidsrc.to/embed/movie/${id}`
    },
    {
        id: 'twoembed',
        name: '2Embed',
        getUrl: (id, type, s = 1, e = 1) =>
            type === 'tv'
                ? `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
                : `https://www.2embed.cc/embed/${id}`
    }
];

export const Details = ({ id, media: mediaProp, onClose, onPlay: onPlayProp }) => {
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

    const mediaId = id || mediaProp?.id || (window.location.hash.split('/')[2] || '').split('?')[0];
    const type = window.location.hash.includes('/tv/') || mediaProp?.type === 'tv' || mediaProp?.media_type === 'tv' ? 'tv' : 'movie';

    // Core data
    const [media, setMedia] = useState(() => mediaProp || null);
    const [cast, setCast] = useState([]);
    const [similar, setSimilar] = useState([]);
    const [loading, setLoading] = useState(() => !mediaProp);
    const [backdropLoaded, setBackdropLoaded] = useState(false);
    const [reviews, setReviews] = useState([]);

    // Review form state
    const [newReviewRating, setNewReviewRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [newReviewText, setNewReviewText] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Actor Modal / info
    const [selectedActor, setSelectedActor] = useState(null);
    const [actorCredits, setActorCredits] = useState([]);
    const [isActorModalOpen, setIsActorModalOpen] = useState(false);
    const [loadingActorCredits, setLoadingActorCredits] = useState(false);

    // Player state (Default server: vidbing)
    const [isPlaying, setIsPlaying] = useState(() => window.location.hash.includes('play=true'));
    const [currentServer, setCurrentServer] = useState('vidbing');

    // TV show state
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [seasonData, setSeasonData] = useState(null);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);

    const episodesContainerRef = useRef(null);
    const playerContainerRef = useRef(null);
    const scrolledContentRef = useRef(null);
    const lastSavedKeyRef = useRef(null);
    const [isUniversalFullscreen, setIsUniversalFullscreen] = useState(false);

    const handleScrollDown = () => {
        scrolledContentRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Universal Fullscreen synchronization & keyboard shortcuts
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

    // Fetch main details
    useEffect(() => {
        let active = true;
        const loadData = async () => {
            setLoading(true);
            setBackdropLoaded(false);
            if (mediaProp && String(mediaProp.id) === String(mediaId)) {
                setMedia(mediaProp);
            } else {
                setMedia(null);
            }
            setCast([]);
            setSimilar([]);
            setSeasonData(null);
            setCurrentServer('vidbing');
            if (!onClose && isPlaying) {
                window.scrollTo(0, 0);
            }

            try {
                const detailsData = await TMDBService.getMediaDetails(mediaId, type);
                if (!active) return;
                if (!detailsData || !detailsData.id) {
                    throw new Error('Invalid details response');
                }

                // If this is detected as Japanese Animation, redirect to Anime Details
                const isDetectedAnime = Boolean(
                    detailsData.isAnime ||
                    detailsData.type === 'anime' ||
                    (detailsData.original_language === 'ja' && Array.isArray(detailsData.genres) && detailsData.genres.some(g => (g.name || g).toString().toLowerCase().includes('animation')))
                );
                if (isDetectedAnime && !window.location.hash.startsWith('#/anime/')) {
                    navigateTo(`#/anime/${mediaId}`);
                    return;
                }

                setMedia(detailsData);

                const [castData, similarData] = await Promise.all([
                    TMDBService.getMediaCast(mediaId, type).catch(() => []),
                    TMDBService.getSimilarMedia(mediaId, type).catch(() => [])
                ]);

                if (!active) return;
                setCast(Array.isArray(castData) ? castData : []);
                setSimilar(Array.isArray(similarData) ? similarData : []);

                SupabaseDB.getMediaReviews(mediaId).then(revs => {
                    if (active) setReviews(Array.isArray(revs) ? revs : []);
                }).catch(() => {});

                if (type === 'tv') {
                    setSelectedSeason(1);
                    setSelectedEpisode(1);
                    try {
                        const season = await TMDBService.getSeasonDetails(mediaId, 1);
                        if (active) {
                            setSeasonData(season && season.episodes ? season : { ...season, episodes: [] });
                        }
                    } catch (seasonError) {
                        if (active) setSeasonData({ episodes: [] });
                    }
                }
            } catch (error) {
                console.error("Error fetching media details:", error);
            } finally {
                if (active) setLoading(false);
            }
        };

        if (mediaId) loadData();
        return () => { active = false; };
    }, [mediaId, type, navigateTo]);

    // Build memoized player URL for current server
    const playerUrl = React.useMemo(() => {
        const srv = MOVIE_TV_SERVERS.find(s => s.id === currentServer) || MOVIE_TV_SERVERS[0];
        return srv.getUrl(mediaId, type, selectedSeason, selectedEpisode);
    }, [currentServer, mediaId, type, selectedSeason, selectedEpisode]);

    // Playback duration tracking & real progress saving (Continuous & unmount/beforeunload)
    const playbackSecondsRef = useRef(0);

    useEffect(() => {
        if (!isPlaying || !mediaId || !media) return;

        playbackSecondsRef.current = Number(media.currentTime) || Number(media.resumeTime) || 0;
        const finalTitle = media.title || media.name || media.original_title || '';
        const finalPoster = media.poster || media.poster_path || media.backdrop || media.backdrop_path || '';
        const dur = type === 'tv' ? 2700 : (media.runtime ? Number(media.runtime) * 60 : 7200);

        const doSave = () => {
            if (typeof saveProgress !== 'function') return;
            const cur = playbackSecondsRef.current;
            const pct = Math.min(100, Math.max(1, Math.round((cur / dur) * 100)));
            saveProgress(
                mediaId,
                pct,
                null,
                type === 'tv' ? selectedSeason : null,
                type === 'tv' ? selectedEpisode : null,
                type === 'tv' ? 'tv' : 'movie',
                finalTitle,
                finalPoster,
                cur,
                dur
            );
        };

        // Initial save
        doSave();

        // 1-second ticker while active and visible
        const timer = setInterval(() => {
            if (!document.hidden) {
                playbackSecondsRef.current += 1;
            }
        }, 1000);

        // 5-second persistence interval
        const persistInterval = setInterval(() => {
            doSave();
        }, 5000);

        const handleBeforeUnload = () => {
            doSave();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(timer);
            clearInterval(persistInterval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            doSave();
        };
    }, [isPlaying, mediaId, type, selectedSeason, selectedEpisode, media, saveProgress]);

    // Handlers
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
            await SupabaseDB.submitReview(user.id, mediaId, newReviewRating, newReviewText);
            addNotification?.('Success', 'Your review has been posted!', 'check_circle');

            const optimisticReview = {
                id: Math.random(),
                user_id: user.id,
                username: user.user_metadata?.name || user.email?.split('@')[0] || 'You',
                rating: newReviewRating,
                comment: newReviewText,
                timestamp: new Date().toISOString()
            };
            setReviews(prev => [optimisticReview, ...prev]);
            setNewReviewRating(0);
            setHoverRating(0);
            setNewReviewText('');
        } catch (error) {
            addNotification?.('Error', 'Failed to post review. Please try again.', 'error');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleWatchNow = () => {
        if (onPlayProp) {
            onPlayProp({ ...media, type });
            return;
        }
        setIsPlaying(true);
        if (type === 'tv') {
            setSelectedSeason(selectedSeason || 1);
            setSelectedEpisode(selectedEpisode || 1);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSeasonChange = async (seasonNum) => {
        if (!mediaId || !seasonNum) return;
        setSelectedSeason(seasonNum);
        setLoadingEpisodes(true);
        try {
            const season = await TMDBService.getSeasonDetails(mediaId, seasonNum);
            setSeasonData(season && season.episodes ? season : { ...season, episodes: [] });
            if (season?.episodes?.length > 0) {
                setSelectedEpisode(season.episodes[0].episodeNumber || season.episodes[0].episode_number || 1);
            }
        } catch (error) {
            setSeasonData({ episodes: [] });
        } finally {
            setLoadingEpisodes(false);
        }
    };

    const handleEpisodeClick = (epNumber) => {
        if (!epNumber) return;
        setSelectedEpisode(epNumber);
        setIsPlaying(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleScrollEpisodes = (direction) => {
        if (episodesContainerRef.current) {
            const scrollAmount = direction === 'left' ? -500 : 500;
            episodesContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const handleActorClick = async (actor) => {
        if (!actor?.id) return;
        setSelectedActor(actor);
        setIsActorModalOpen(true);
        setLoadingActorCredits(true);
        try {
            const credits = await TMDBService.getActorCredits(actor.id);
            setActorCredits(Array.isArray(credits) ? credits : []);
        } catch (error) {
            setActorCredits([]);
        } finally {
            setLoadingActorCredits(false);
        }
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            navigateTo('#/');
        }
    };

    // Keyboard listener for Escape to close modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isPlaying) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, onClose]);

    const currentMedia = media || mediaProp;
    const inWatchlist = currentMedia ? watchlist.some(item => String(item.id) === String(currentMedia.id)) : false;
    const currentEpisodeData = seasonData?.episodes?.find(
        ep => (ep.episodeNumber || ep.episode_number) === selectedEpisode
    );

    if (!onClose && loading && !currentMedia) {
        return <DetailsPageSkeleton />;
    }

    if (!onClose && !currentMedia) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <span className="material-symbols-outlined text-6xl text-[#E50914] mb-4">error</span>
                <h2 className="text-2xl font-bold text-white mb-2">Content Not Found</h2>
                <p className="text-white/60 mb-6">The requested movie or series could not be retrieved.</p>
                <button
                    onClick={handleClose}
                    className="px-6 py-2.5 bg-[#E50914] hover:bg-[#b8070f] text-white rounded-xl font-bold text-sm transition cursor-pointer"
                >
                    Go Back
                </button>
            </div>
        );
    }

    // ─── SUB-SECTIONS (Reused in both Pop-up Card and Player Screen) ───
    const renderEpisodesSection = () => {
        if (!currentMedia || type !== 'tv' || !(currentMedia.number_of_seasons > 0 || currentMedia.totalSeasons > 0 || seasonData?.episodes?.length > 0)) {
            return null;
        }

        return (
            <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-3 text-white">
                            <span className="w-1.5 h-7 bg-[#E50914] rounded-full"></span>
                            Episodes
                        </h2>
                        <div className="relative">
                            <select
                                value={selectedSeason}
                                onChange={(e) => handleSeasonChange(parseInt(e.target.value, 10))}
                                className="appearance-none pr-10 pl-4 py-2 rounded-xl text-white font-bold text-xs sm:text-sm cursor-pointer outline-none focus:ring-2 focus:ring-[#E50914]/50 bg-[#141418] border border-white/20 hover:border-[#E50914]/50 transition-all shadow-md"
                            >
                                {Array.from({ length: currentMedia.number_of_seasons || currentMedia.totalSeasons || 1 }, (_, i) => i + 1).map(s => (
                                    <option key={s} value={s} style={{ background: '#141418', color: 'white' }}>
                                        Season {s}
                                    </option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 text-base sm:text-lg">
                                expand_more
                            </span>
                        </div>
                    </div>

                    {seasonData?.episodes?.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleScrollEpisodes('left')}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#141418] border border-white/15 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shadow-md cursor-pointer"
                                title="Previous Episodes"
                                aria-label="Previous Episodes"
                            >
                                <span className="material-symbols-outlined text-lg sm:text-xl">chevron_left</span>
                            </button>
                            <button
                                onClick={() => handleScrollEpisodes('right')}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#141418] border border-white/15 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shadow-md cursor-pointer"
                                title="Next Episodes"
                                aria-label="Next Episodes"
                            >
                                <span className="material-symbols-outlined text-lg sm:text-xl">chevron_right</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Episode Cards Container */}
                {loadingEpisodes ? (
                    <EpisodeListSkeleton count={5} />
                ) : (
                    <div className="relative group/episodes">
                        <div 
                            ref={episodesContainerRef}
                            className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar scroll-smooth"
                        >
                            {seasonData?.episodes?.map(ep => {
                                const epNum = ep.episodeNumber || ep.episode_number;
                                const isActive = selectedEpisode === epNum && isPlaying;
                                const epThumbnail = ep.still || ep.still_path ? TMDBService.getImageUrl(ep.still || ep.still_path, 'w300') : (media.backdrop || media.poster);
                                return (
                                    <div
                                        key={epNum}
                                        onClick={() => handleEpisodeClick(epNum)}
                                        className={`flex-none w-[240px] sm:w-[280px] md:w-[300px] rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 bg-[#18181c] ${
                                            isActive
                                                ? 'ring-2 ring-[#E50914] shadow-lg shadow-red-600/20 scale-[1.02]'
                                                : 'border border-white/10 hover:border-white/25 hover:shadow-xl'
                                        }`}
                                    >
                                        {/* Episode Thumbnail */}
                                        <div className="relative aspect-video bg-white/5 overflow-hidden">
                                            <img
                                                src={epThumbnail}
                                                alt={ep.name || ep.title}
                                                className="w-full h-full object-cover group-hover:brightness-90 transition-all duration-300"
                                                loading="lazy"
                                                onError={(e) => { e.target.src = '/notflix-logo.png'; }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
                                                <div className="w-11 h-11 bg-[#E50914]/90 rounded-full flex items-center justify-center shadow-xl backdrop-blur-sm">
                                                    <span className="material-symbols-outlined text-white text-2xl">
                                                        play_arrow
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white/80">
                                                E{epNum}
                                            </div>
                                            {isActive && (
                                                <div className="absolute top-2 right-2 bg-[#E50914] px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                                                    Playing
                                                </div>
                                            )}
                                        </div>

                                        {/* Episode Meta */}
                                        <div className="p-3.5 space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-white line-clamp-1 group-hover:text-[#E50914] transition">
                                                    {epNum}. {ep.name || ep.title || `Episode ${epNum}`}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                                                {ep.overview || 'No episode description available.'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>
        );
    };

    const renderCastSection = () => {
        if (!cast || cast.length === 0) return null;
        return (
            <section className="space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#E50914]">groups</span>
                    Cast & Crew
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                    {cast.slice(0, 12).map((actor, idx) => (
                        <div
                            key={actor.id || idx}
                            onClick={() => handleActorClick(actor)}
                            className="bg-[#18181c] p-3 rounded-2xl border border-white/10 flex items-center gap-3 hover:border-white/20 transition cursor-pointer"
                        >
                            <img
                                src={actor.avatar || actor.profile_path ? TMDBService.getImageUrl(actor.avatar || actor.profile_path, 'w185') : '/notflix-logo.png'}
                                alt={actor.name}
                                className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0"
                                onError={(e) => { e.target.src = '/notflix-logo.png'; }}
                            />
                            <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{actor.name}</h4>
                                <span className="text-[10px] text-white/40 truncate block">{actor.character || 'Actor'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    const renderSimilarSection = () => {
        if (!similar || similar.length === 0) return null;
        return (
            <MediaRow
                title="More Like This"
                items={similar}
                onSelect={(item) => {
                    if (onClose) onClose();
                    navigateTo(`#/${item.type || type}/${item.id}`);
                }}
                onPlay={(item) => {
                    if (onClose) onClose();
                    navigateTo(`#/${item.type || type}/${item.id}?play=true`);
                }}
            />
        );
    };

    const renderReviewsSection = () => {
        return (
            <section className="space-y-6 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-400 fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        Community Reviews
                        <span className="text-xs text-white/40 font-normal">({reviews.length})</span>
                    </h2>
                </div>

                <div className="bg-[#18181c] p-5 rounded-2xl border border-white/10 space-y-4">
                    <h4 className="text-sm font-bold text-white">Leave your review for {currentMedia?.title || currentMedia?.name || 'this title'}</h4>
                    
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
                        placeholder="Write your review and thoughts..."
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

                <div className="space-y-3">
                    {reviews.length === 0 ? (
                        <p className="text-white/40 text-xs py-4 text-center">Be the first to review this title!</p>
                    ) : (
                        reviews.map((rev) => (
                            <div key={rev.id} className="bg-[#18181c] p-4 rounded-xl border border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">{rev.username || 'Anonymous'}</span>
                                        <span className="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                            ★ {rev.rating}/10
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-white/40">
                                        {rev.timestamp ? new Date(rev.timestamp).toLocaleDateString() : 'Recent'}
                                    </span>
                                </div>
                                <p className="text-white/80 text-xs leading-relaxed">{rev.comment}</p>
                            </div>
                        ))
                    )}
                </div>
            </section>
        );
    };

    // ═══════════════ 1. STREAMING / PLAYER PAGE VIEW (WHEN PLAYING) ═══════════════
    if (isPlaying && currentMedia) {
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
                                    key={`${currentServer}-${mediaId}-${type}-${selectedSeason}-${selectedEpisode}`}
                                    src={playerUrl}
                                    className="absolute inset-0 w-full h-full border-0 bg-black"
                                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock"
                                    allowFullScreen
                                    referrerPolicy="origin"
                                    title={currentMedia.title || currentMedia.name || 'Video Player'}
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

                {/* Server Selection Toolbar Below Player */}
                <section className="px-4 sm:px-8 md:px-14 py-4 max-w-[1400px] mx-auto">
                    <div className="bg-[#141418] border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 overflow-hidden w-full">
                        <div className="flex items-center justify-between md:justify-start gap-3 min-w-0 w-full md:w-auto">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="material-symbols-outlined text-[#E50914] text-2xl shrink-0">play_circle</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-white text-xs sm:text-sm truncate">{currentMedia.title || currentMedia.name}</p>
                                    {type === 'tv' && currentEpisodeData && (
                                        <p className="text-white/50 text-[11px] sm:text-xs truncate">
                                            S{selectedSeason} · E{selectedEpisode} — {currentEpisodeData.name || currentEpisodeData.title}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={toggleUniversalFullscreen}
                                className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-[#E50914] text-white border border-white/15 transition-all shrink-0 ml-2 cursor-pointer active:scale-95"
                                title="Toggle Fullscreen"
                            >
                                <span className="material-symbols-outlined text-base">
                                    {isUniversalFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                                </span>
                                <span>{isUniversalFullscreen ? 'Exit' : 'Fullscreen'}</span>
                            </button>
                        </div>

                        {/* Working Movie/TV Server Buttons */}
                        <div className="w-full md:w-auto md:flex-1 min-w-0 flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
                            <span className="text-white/40 text-xs font-bold uppercase tracking-wider mr-1 hidden lg:inline shrink-0">Server</span>
                            {MOVIE_TV_SERVERS.map(srv => {
                                const isSelected = currentServer === srv.id;
                                return (
                                    <button
                                        key={srv.id}
                                        onClick={() => setCurrentServer(srv.id)}
                                        className={`shrink-0 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                            isSelected
                                                ? 'bg-[#E50914] text-white shadow-lg shadow-red-600/30 border border-red-500'
                                                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <span>{srv.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Scrolled Down Sections: Episodes, Cast, Similar, Reviews */}
                <div className="max-w-[1400px] mx-auto px-4 sm:px-8 md:px-14 py-4 space-y-12">
                    {renderEpisodesSection()}
                    {renderCastSection()}
                    {renderSimilarSection()}
                    {renderReviewsSection()}
                </div>
            </div>
        );
    }

    // ═══════════════ 2. MACOS DESKTOP 16:9 POP-UP CARD MODAL (WHEN NOT PLAYING) ═══════════════
    const isModalLoading = !currentMedia;
    const displayGenre = currentMedia && Array.isArray(currentMedia.genres) && currentMedia.genres.length > 0
        ? (typeof currentMedia.genres[0] === 'object' ? currentMedia.genres[0].name : currentMedia.genres[0])
        : null;

    const displayYear = currentMedia ? (currentMedia.year || (currentMedia.release_date || currentMedia.first_air_date || '').split('-')[0]) : null;
    const displayRating = currentMedia ? Number(currentMedia.rating || currentMedia.vote_average || 8.0).toFixed(1) : '8.0';
    const displayDuration = currentMedia ? (currentMedia.duration || (currentMedia.runtime ? `${Math.floor(currentMedia.runtime / 60)}h ${currentMedia.runtime % 60}m` : (currentMedia.number_of_seasons ? `${currentMedia.number_of_seasons} ${currentMedia.number_of_seasons === 1 ? 'Season' : 'Seasons'}` : null))) : null;

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
                    {currentMedia && (
                        <img
                            className={`w-full h-full object-cover object-center transform scale-[1.01] transition-opacity duration-300 ${backdropLoaded ? 'opacity-100' : 'opacity-0'}`}
                            src={currentMedia.backdrop || currentMedia.backdrop_path || currentMedia.poster || currentMedia.poster_path}
                            alt={currentMedia.title || currentMedia.name}
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
                                    {currentMedia.title || currentMedia.name}
                                </h1>

                                {/* Metadata Row: genre • type • year • rating • duration */}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-medium mb-2.5 sm:mb-3 text-white/90 drop-shadow">
                                    {displayGenre && (
                                        <>
                                            <span className="font-semibold text-white/95">{displayGenre}</span>
                                            <span className="text-white/40">•</span>
                                        </>
                                    )}
                                    <span className="text-[#E50914] font-bold uppercase tracking-wide">
                                        {type === 'tv' ? 'TV Show' : 'Movie'}
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
                                    {currentMedia.overview}
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
                                        onClick={() => toggleWatchlist?.(currentMedia)}
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
                        {renderCastSection()}
                        {renderSimilarSection()}
                        {renderReviewsSection()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Details;
