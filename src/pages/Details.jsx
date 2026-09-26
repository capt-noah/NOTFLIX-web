import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { TMDBService } from '../services/tmdb';
import { RatingBadge } from '../components/RatingBadge';
import { openSubtitles } from '../utils/mediaActions';
import { ShareModal } from '../components/ShareModal';
import { DetailsPageSkeleton, EpisodeListSkeleton, ActorCreditsSkeleton } from '../components/Skeleton';

export const Details = ({ id }) => {
    const {
        toggleWatchlist,
        watchlist,
        continueWatching,
        navigateTo,
        saveProgress,
        playMedia
    } = useApp();
    const { t } = useLanguage();

    const mediaId = id;
    const type = window.location.hash.includes('/tv/') ? 'tv' : 'movie';

    // Core data
    const [media, setMedia] = useState(null);
    const [cast, setCast] = useState([]);
    const [similar, setSimilar] = useState([]);
    const [loading, setLoading] = useState(true);

    // Actor Modal State
    const [selectedActor, setSelectedActor] = useState(null);
    const [actorCredits, setActorCredits] = useState([]);
    const [isActorModalOpen, setIsActorModalOpen] = useState(false);
    const [loadingActorCredits, setLoadingActorCredits] = useState(false);

    // Share Modal State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // TV show state
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [seasonData, setSeasonData] = useState(null);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);

    const episodesContainerRef = useRef(null);
    const scrollTargetRef = useRef(null);

    // ─── Fetch media details, cast, similar, seasons ───
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setMedia(null);
            setCast([]);
            setSimilar([]);
            setSeasonData(null);
            window.scrollTo(0, 0);

            try {
                const detailsData = await TMDBService.getMediaDetails(mediaId, type);
                if (!detailsData || !detailsData.id) {
                    throw new Error('Invalid details response');
                }

                setMedia(detailsData);

                const [castData, similarData] = await Promise.all([
                    TMDBService.getMediaCast(mediaId, type).catch((error) => {
                        console.error("Error fetching cast:", error);
                        return [];
                    }),
                    TMDBService.getSimilarMedia(mediaId, type).catch((error) => {
                        console.error("Error fetching similar media:", error);
                        return [];
                    })
                ]);

                setCast(Array.isArray(castData) ? castData : []);
                setSimilar(Array.isArray(similarData) ? similarData : []);

                if (type === 'tv' && detailsData.totalSeasons > 0) {
                    setSelectedSeason(1);
                    setSelectedEpisode(1);
                    try {
                        const season = await TMDBService.getSeasonDetails(mediaId, 1);
                        setSeasonData(season && season.episodes ? season : { ...season, episodes: [] });
                    } catch (seasonError) {
                        console.error("Error fetching season details:", seasonError);
                        setSeasonData({ episodes: [] });
                    }
                }
            } catch (error) {
                console.error("Error fetching media details:", error);
                setMedia(null);
            } finally {
                setLoading(false);
            }
        };
        if (mediaId) loadData();
    }, [mediaId, type]);

    // ─── Handlers ───
    const existingProgress = (continueWatching || []).find(item => String(item.id) === String(mediaId));

    const handlePlay = (fromBeginning = false) => {
        if (!media?.id) return;
        
        const seasonNum = type === 'tv' ? (fromBeginning ? 1 : (existingProgress?.season || selectedSeason || 1)) : null;
        const episodeNum = type === 'tv' ? (fromBeginning ? 1 : (existingProgress?.episode || selectedEpisode || 1)) : null;
        const resumeSecs = fromBeginning ? 0 : (existingProgress?.currentTime || (existingProgress?.percent ? Math.floor((existingProgress.percent / 100) * 5400) : 0));

        playMedia({
            ...media,
            id: String(media.id),
            type: type,
            title: media.title,
            poster: media.poster || media.backdrop,
            backdrop: media.backdrop || media.poster,
            season: seasonNum,
            episode: episodeNum,
            currentTime: resumeSecs,
            resumeTime: resumeSecs,
            autoPlay: true
        });
    };

    const handleSeasonChange = async (seasonNum) => {
        if (!mediaId || !seasonNum) return;
        setSelectedSeason(seasonNum);
        setLoadingEpisodes(true);
        try {
            const season = await TMDBService.getSeasonDetails(mediaId, seasonNum);
            setSeasonData(season && season.episodes ? season : { ...season, episodes: [] });
            if (season?.episodes?.length > 0) {
                setSelectedEpisode(season.episodes[0].episodeNumber);
            }
        } catch (error) {
            console.error("Error fetching season details:", error);
            setSeasonData({ episodes: [] });
        } finally {
            setLoadingEpisodes(false);
        }
    };

    const handleEpisodeClick = (epNumber) => {
        if (!media?.id || !epNumber) return;
        setSelectedEpisode(epNumber);
        playMedia({
            ...media,
            id: String(media.id),
            type: 'tv',
            title: media.title,
            poster: media.poster || media.backdrop,
            backdrop: media.backdrop || media.poster,
            season: selectedSeason,
            episode: epNumber,
            currentTime: 0,
            resumeTime: 0,
            autoPlay: true
        });
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
            console.error("Error fetching actor credits:", error);
            setActorCredits([]);
        } finally {
            setLoadingActorCredits(false);
        }
    };

    const scrollToContent = () => {
        if (scrollTargetRef.current) {
            scrollTargetRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    if (loading) {
        return <DetailsPageSkeleton />;
    }

    if (!media) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
                <h2 className="text-2xl font-bold text-white">Content Not Found</h2>
                <button onClick={() => window.history.back()} className="mt-4 px-6 py-2 btn-primary rounded-xl font-bold">
                    Go Back
                </button>
            </div>
        );
    }

    const inWatchlist = watchlist.some(item => String(item.id) === String(media.id));

    return (
        <div className="w-full pb-24 text-left bg-background relative selection:bg-red-600 selection:text-white">
            {/* ═══════════════ CINEMATIC HERO STAGE (macOS MediaDetailView Parity) ═══════════════ */}
            <section className="relative w-full min-h-[75vh] md:min-h-[640px] lg:h-[700px] flex items-end overflow-hidden">
                {/* Full-bleed Backdrop Image */}
                <div className="absolute inset-0 z-0">
                    <img
                        className="w-full h-full object-cover object-top filter brightness-95"
                        src={media.backdrop || media.poster}
                        alt={media.title}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/1280x720?text=No+Image'; }}
                    />
                    {/* Multi-directional Cinema Scrim Vignettes */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/60 to-transparent z-10"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0f]/90 via-[#0d0d0f]/40 to-transparent z-10"></div>
                </div>

                {/* Back Button */}
                <button
                    onClick={() => window.history.back()}
                    className="absolute top-24 left-6 md:left-12 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all shadow-2xl cursor-pointer active:scale-95"
                    title="Go Back"
                >
                    <span className="material-symbols-outlined text-xl">arrow_back</span>
                </button>

                {/* Hero Information Overlay */}
                <div className="relative z-20 w-full max-w-container-max mx-auto px-4 md:px-edge-margin pb-10 md:pb-14">
                    <div className="max-w-3xl space-y-4">
                        {/* Title */}
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none drop-shadow-2xl">
                            {media.title}
                        </h1>

                        {/* Metadata Row: Genre • Type • Year • Rating • Duration */}
                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-sm md:text-base font-semibold text-white/90">
                            {media.genres?.[0] && (
                                <>
                                    <span className="text-white/80">{media.genres[0]}</span>
                                    <span className="text-white/30">•</span>
                                </>
                            )}
                            <span className="text-red-500 font-extrabold uppercase tracking-wider text-xs">
                                {type === 'tv' ? 'TV Show' : 'Movie'}
                            </span>
                            <span className="text-white/30">•</span>
                            <span className="text-white/70">{media.year || (media.releaseDate ? media.releaseDate.split('-')[0] : '')}</span>
                            
                            {media.rating > 0 && (
                                <>
                                    <span className="text-white/30">•</span>
                                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-xs font-bold text-white border border-white/10">
                                        <span className="text-yellow-400">★</span>
                                        <span>{media.rating.toFixed(1)}</span>
                                    </div>
                                </>
                            )}

                            {media.duration && (
                                <>
                                    <span className="text-white/30">•</span>
                                    <span className="text-white/70 text-xs sm:text-sm">{media.duration}</span>
                                </>
                            )}
                        </div>

                        {/* Synopsis */}
                        <p className="text-white/80 text-sm md:text-base lg:text-lg line-clamp-3 leading-relaxed max-w-2xl drop-shadow-md">
                            {media.overview || 'No synopsis available.'}
                        </p>

                        {/* CTAs: Play / Resume + Watchlist + Share + Subtitles */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                                onClick={() => handlePlay(false)}
                                className="bg-red-600 hover:bg-red-700 text-white px-7 sm:px-9 py-3.5 rounded-xl font-black text-base flex items-center gap-2.5 transition-all active:scale-95 shadow-xl shadow-red-600/40 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    play_arrow
                                </span>
                                <span>
                                    {existingProgress 
                                        ? `Resume ${existingProgress.season ? `S${existingProgress.season}:E${existingProgress.episode}` : ''}`
                                        : 'Play Now'}
                                </span>
                            </button>

                            {existingProgress && (
                                <button
                                    onClick={() => handlePlay(true)}
                                    className="glass-panel px-5 py-3.5 rounded-xl font-bold text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all border border-white/20 active:scale-95 cursor-pointer"
                                    title="Start from Beginning"
                                >
                                    Start Over
                                </button>
                            )}

                            <button
                                onClick={() => toggleWatchlist(media.id, type, media.poster, media.title, media.rating)}
                                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                                    inWatchlist 
                                        ? 'bg-red-600/20 text-red-400 border-red-500/40 shadow-lg shadow-red-600/20' 
                                        : 'glass-panel text-white border-white/20 hover:bg-white/10'
                                }`}
                                title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                            >
                                <span className="material-symbols-outlined text-xl">
                                    {inWatchlist ? 'check' : 'bookmark_add'}
                                </span>
                            </button>

                            <button
                                onClick={() => setIsShareModalOpen(true)}
                                className="w-12 h-12 rounded-xl glass-panel text-white/80 hover:text-white border border-white/20 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="Share"
                            >
                                <span className="material-symbols-outlined text-xl">share</span>
                            </button>

                            <button
                                onClick={() => openSubtitles(media.title, media.year, selectedSeason, selectedEpisode)}
                                className="w-12 h-12 rounded-xl glass-panel text-white/80 hover:text-white border border-white/20 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                                title="Download Subtitles (.SRT)"
                            >
                                <span className="material-symbols-outlined text-xl">subtitles</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Center Red Double Arrow Scroll Indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
                    <button
                        onClick={scrollToContent}
                        className="flex flex-col items-center text-red-500 hover:text-red-400 transition-transform animate-bounce cursor-pointer"
                        title="Scroll for episodes and details"
                    >
                        <span className="material-symbols-outlined text-sm font-black -mb-2">keyboard_arrow_down</span>
                        <span className="material-symbols-outlined text-sm font-black">keyboard_arrow_down</span>
                    </button>
                </div>
            </section>

            <div ref={scrollTargetRef}></div>

            {/* ═══════════════ SEASON / EPISODE SELECTOR (TV only) ═══════════════ */}
            {type === 'tv' && media.totalSeasons > 0 && (
                <section className="px-4 md:px-edge-margin py-8 md:py-12 max-w-container-max mx-auto">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(229,9,20,0.8)]"></span>
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-wide">
                                Episodes
                            </h2>
                            <div className="relative ml-2">
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                                    className="bg-white/10 border border-white/20 appearance-none pr-9 pl-4 py-2 rounded-xl text-white font-bold text-sm cursor-pointer outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-md shadow-lg"
                                >
                                    {Array.from({ length: media.totalSeasons }, (_, i) => i + 1).map(s => (
                                        <option key={s} value={s} style={{ background: '#111113', color: 'white' }}>
                                            Season {s}
                                        </option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 text-lg">
                                    expand_more
                                </span>
                            </div>
                        </div>

                        {/* Left / Right Episode Arrows */}
                        {seasonData?.episodes?.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleScrollEpisodes('left')}
                                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                                    title="Scroll Left"
                                >
                                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                                </button>
                                <button
                                    onClick={() => handleScrollEpisodes('right')}
                                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
                                    title="Scroll Right"
                                >
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Episode Horizontal Reel */}
                    {loadingEpisodes ? (
                        <EpisodeListSkeleton count={4} />
                    ) : (
                        <div 
                            ref={episodesContainerRef}
                            className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar scroll-smooth"
                        >
                            {seasonData?.episodes?.map(ep => (
                                <div
                                    key={`ep-${ep.episodeNumber}`}
                                    onClick={() => handleEpisodeClick(ep.episodeNumber)}
                                    className="flex-shrink-0 w-[260px] md:w-[290px] rounded-xl overflow-hidden bg-surface-container-low border border-white/10 hover:border-red-600 transition-all duration-300 hover:scale-105 group cursor-pointer shadow-lg hover:shadow-[0_10px_30px_rgba(229,9,20,0.3)]"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative aspect-video bg-black/40">
                                        {ep.still ? (
                                            <img
                                                src={ep.still}
                                                alt={ep.name}
                                                className="w-full h-full object-cover group-hover:brightness-90 transition-all"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-3xl text-white/20">movie</span>
                                            </div>
                                        )}
                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-11 h-11 bg-red-600 rounded-full flex items-center justify-center shadow-2xl text-white">
                                                <span className="material-symbols-outlined text-2xl ml-0.5 fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                    play_arrow
                                                </span>
                                            </div>
                                        </div>
                                        {/* Episode Badge */}
                                        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-white">
                                            E{ep.episodeNumber}
                                        </div>
                                    </div>
                                    {/* Info */}
                                    <div className="p-3">
                                        <h4 className="font-bold text-sm text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                            {ep.name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-white/40 text-xs mt-1">
                                            {ep.runtime > 0 && <span>{ep.runtime}m</span>}
                                            {ep.runtime > 0 && ep.airDate && <span>•</span>}
                                            {ep.airDate && <span>{ep.airDate.split('-')[0]}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ═══════════════ CAST SECTION ═══════════════ */}
            {cast.length > 0 && (
                <section className="px-4 md:px-edge-margin py-8 md:py-10 max-w-container-max mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(229,9,20,0.8)]"></span>
                        <h2 className="text-xl md:text-2xl font-black text-white tracking-wide">
                            Top Cast
                        </h2>
                    </div>
                    <div className="flex gap-6 md:gap-8 overflow-x-auto pb-4 hide-scrollbar scroll-smooth">
                        {cast.slice(0, 16).map((actor, idx) => (
                            <div 
                                key={`cast-${idx}`} 
                                className="flex-shrink-0 flex flex-col items-center gap-2.5 group cursor-pointer w-24 md:w-28 text-center"
                                onClick={() => handleActorClick(actor)}
                            >
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-red-600 group-hover:scale-105 transition-all duration-300 shadow-xl bg-surface-container-high">
                                    <img
                                        className="w-full h-full object-cover transition-all group-hover:brightness-110"
                                        src={actor.avatar}
                                        alt={actor.name}
                                        loading="lazy"
                                        onError={(e) => { e.target.src = "https://via.placeholder.com/150?text=Actor"; }}
                                    />
                                </div>
                                <div className="w-full">
                                    <p className="font-bold text-xs md:text-sm text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                        {actor.name}
                                    </p>
                                    <p className="text-[11px] text-white/50 line-clamp-1">{actor.character}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ═══════════════ MORE LIKE THIS (Similar Recommendations) ═══════════════ */}
            {similar.length > 0 && (
                <section className="px-4 md:px-edge-margin py-8 md:py-12 max-w-container-max mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(229,9,20,0.8)]"></span>
                        <h2 className="text-xl md:text-2xl font-black text-white tracking-wide">
                            More Like This
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                        {similar.slice(0, 12).map((item, idx) => (
                            <div
                                key={`similar-${item.id}-${idx}`}
                                className="group cursor-pointer"
                                onClick={() => item?.id && navigateTo(`#/${item.type || type}/${item.id}`)}
                            >
                                <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-surface-container-low border border-white/10 group-hover:border-red-600 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_10px_30px_rgba(229,9,20,0.35)]">
                                    <img
                                        className="w-full h-full object-cover"
                                        src={item.poster}
                                        alt={item.title}
                                        loading="lazy"
                                        onError={(e) => { e.target.src = "https://via.placeholder.com/300x450?text=No+Image"; }}
                                    />
                                    {/* Top Rating */}
                                    {item.rating > 0 && (
                                        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1">
                                            <span className="text-yellow-400">★</span>
                                            <span>{item.rating.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-red-600 shadow-2xl flex items-center justify-center text-white">
                                            <span className="material-symbols-outlined text-2xl ml-0.5 fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                play_arrow
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 text-left space-y-0.5">
                                    <h4 className="font-semibold text-xs md:text-sm text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                        {item.title}
                                    </h4>
                                    <p className="text-[11px] text-white/50">{item.year || ''}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ═══════════════ ACTOR CREDITS MODAL ═══════════════ */}
            {isActorModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12 animate-fade-in">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={() => setIsActorModalOpen(false)}></div>
                    <div className="relative w-full max-w-5xl max-h-[85vh] bg-[#141416] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10 animate-slide-up">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10 flex items-center gap-5 bg-white/5 sticky top-0 z-10 backdrop-blur-md">
                            {selectedActor?.avatar && (
                                <img src={selectedActor.avatar} alt={selectedActor.name} className="w-14 h-14 rounded-full object-cover shadow-lg border border-white/20" />
                            )}
                            <div className="flex-1">
                                <h3 className="text-xl md:text-2xl font-black text-white">
                                    {selectedActor?.name}
                                </h3>
                                <p className="text-white/50 text-xs mt-0.5">Known For & Filmography</p>
                            </div>
                            <button 
                                onClick={() => setIsActorModalOpen(false)}
                                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {loadingActorCredits ? (
                                <ActorCreditsSkeleton count={6} />
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {actorCredits.map((item, idx) => (
                                        <div 
                                            key={`actor-credit-${item.id}-${idx}`} 
                                            className="group cursor-pointer flex flex-col"
                                            onClick={() => {
                                                setIsActorModalOpen(false);
                                                navigateTo(`#/${item.type || 'movie'}/${item.id}`);
                                            }}
                                        >
                                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-surface-container-low border border-white/10 group-hover:border-red-600 transition-all duration-300 group-hover:scale-105">
                                                <img 
                                                    src={item.poster || 'https://via.placeholder.com/300x450?text=No+Image'} 
                                                    alt={item.title} 
                                                    className="w-full h-full object-cover" 
                                                    loading="lazy" 
                                                />
                                            </div>
                                            <p className="font-bold text-xs text-white line-clamp-1 group-hover:text-red-400 transition-colors">{item.title}</p>
                                            <p className="text-[10px] text-white/50">{item.year} {item.type === 'tv' ? '• Series' : '• Movie'}</p>
                                        </div>
                                    ))}
                                    {actorCredits.length === 0 && (
                                        <div className="col-span-full text-center py-10 text-white/50">
                                            No filmography found for this actor.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ SHARE MODAL ═══════════════ */}
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                media={media}
                type={type}
            />
        </div>
    );
};

export default Details;
