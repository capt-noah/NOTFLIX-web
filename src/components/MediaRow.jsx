import { useRef, useState, useCallback, useEffect, memo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';

export const MediaRow = memo(({ title, items, type = 'poster', showViewAll = false }) => {
    const { toggleWatchlist, watchlist, navigateTo, removeFromContinueWatching, playMedia } = useApp();
    const { t } = useLanguage();
    
    const scrollContainerRef = useRef(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollStartRef = useRef(0);
    const hasDraggedRef = useRef(false);
    
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const updateScrollButtons = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 15);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 15);
    }, []);

    useEffect(() => {
        updateScrollButtons();
        window.addEventListener('resize', updateScrollButtons);
        return () => window.removeEventListener('resize', updateScrollButtons);
    }, [items, updateScrollButtons]);

    // Discrete chevron button scroll (smooth page jump)
    const scrollByAmount = (direction) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const amount = Math.max(el.clientWidth * 0.75, 280);
        el.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth'
        });
        setTimeout(updateScrollButtons, 350);
    };

    // Horizontal mouse wheel scroll with Shift key support
    const handleWheel = (e) => {
        const el = scrollContainerRef.current;
        if (!el) return;

        if (e.shiftKey && Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
            updateScrollButtons();
        }
    };

    // Drag-to-scroll implementation
    const handleMouseDown = (e) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        startXRef.current = e.pageX - el.offsetLeft;
        scrollStartRef.current = el.scrollLeft;
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current || !scrollContainerRef.current) return;
        const el = scrollContainerRef.current;
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startXRef.current) * 1.3;
        if (Math.abs(walk) > 6) {
            hasDraggedRef.current = true;
        }
        el.scrollLeft = scrollStartRef.current - walk;
        updateScrollButtons();
    };

    const handleMouseUpOrLeave = () => {
        isDraggingRef.current = false;
    };

    const handleCardClick = (targetHash) => {
        if (hasDraggedRef.current) {
            hasDraggedRef.current = false;
            return;
        }
        navigateTo(targetHash);
    };

    if (!items || items.length === 0) return null;
    const safeItems = items.filter(Boolean);
    if (safeItems.length === 0) return null;

    return (
        <section className="space-y-4 text-left relative group/row">
            {/* Row Title Header with macOS Red Accent Pill & Chevron */}
            <div className="flex flex-wrap justify-between items-center gap-2 px-1">
                <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(229,9,20,0.8)]"></span>
                    <h2 className="font-bold text-lg md:text-2xl text-white tracking-wide flex items-center gap-2">
                        <span>{title}</span>
                        <span className="material-symbols-outlined text-white/30 text-lg group-hover/row:text-red-500 group-hover/row:translate-x-0.5 transition-all">
                            chevron_right
                        </span>
                    </h2>
                </div>
                {showViewAll && (
                    <button 
                        onClick={() => navigateTo('#/movies')} 
                        className="text-white/50 hover:text-red-400 font-semibold text-xs md:text-sm cursor-pointer transition-colors"
                    >
                        {t?.mediaRow?.viewAll || 'View All'}
                    </button>
                )}
            </div>

            {/* Left Chevron Button */}
            {canScrollLeft && (
                <button
                    onClick={() => scrollByAmount('left')}
                    className="hidden md:flex absolute left-0 top-[55%] -translate-y-1/2 z-30 w-11 h-28 bg-black/85 hover:bg-red-600 text-white items-center justify-center rounded-r-xl opacity-0 group-hover/row:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-md border-y border-r border-white/20 shadow-2xl"
                    aria-label="Scroll left"
                >
                    <span className="material-symbols-outlined text-3xl">chevron_left</span>
                </button>
            )}

            {/* Right Chevron Button */}
            {canScrollRight && (
                <button
                    onClick={() => scrollByAmount('right')}
                    className="hidden md:flex absolute right-0 top-[55%] -translate-y-1/2 z-30 w-11 h-28 bg-black/85 hover:bg-red-600 text-white items-center justify-center rounded-l-xl opacity-0 group-hover/row:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-md border-y border-l border-white/20 shadow-2xl"
                    aria-label="Scroll right"
                >
                    <span className="material-symbols-outlined text-3xl">chevron_right</span>
                </button>
            )}

            {/* Horizontal Scroll Area */}
            <div 
                ref={scrollContainerRef}
                onWheel={handleWheel}
                onScroll={updateScrollButtons}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                className="flex gap-4 md:gap-5 overflow-x-auto hide-scrollbar pb-4 select-none cursor-grab active:cursor-grabbing scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
                {safeItems.map((item, idx) => {
                    const media = item;
                    if (!media) return null;

                    const isTv = media.type === 'tv' || Boolean(media.season);
                    const isInWatchlist = watchlist.some(w => String(w.id) === String(media.id));

                    // 1. PROGRESS MODE CARDS (Continue Watching with Auto-Resume)
                    if (type === 'progress') {
                        const resumeSecs = media.currentTime || (media.percent ? Math.floor((media.percent / 100) * (media.duration || 5400)) : 0);
                        const handleResume = () => {
                            if (hasDraggedRef.current) {
                                hasDraggedRef.current = false;
                                return;
                            }
                            playMedia({
                                ...media,
                                id: String(media.id),
                                type: isTv ? 'tv' : 'movie',
                                title: media.title || item.title,
                                poster: media.poster || media.backdrop,
                                backdrop: media.backdrop || media.poster,
                                season: isTv ? (media.season || 1) : null,
                                episode: isTv ? (media.episode || 1) : null,
                                percent: media.percent || 0,
                                currentTime: resumeSecs,
                                resumeTime: resumeSecs,
                                autoPlay: true
                            });
                        };

                        return (
                            <div 
                                key={`progress-${media.id}-${idx}`} 
                                className="flex-none w-44 md:w-52 lg:w-56 group cursor-pointer"
                                onClick={handleResume}
                            >
                                <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-surface-container-low border border-white/10 group-hover:border-red-600 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_10px_30px_rgba(229,9,20,0.35)]">
                                    <img 
                                        src={media.poster || media.backdrop || 'https://via.placeholder.com/300x450?text=No+Image'} 
                                        alt={media.title} 
                                        className="w-full h-full object-cover pointer-events-none" 
                                        loading="lazy" 
                                    />

                                    {/* Top Badges */}
                                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-30 pointer-events-none">
                                        {isTv && (
                                            <span className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-white uppercase tracking-wider">
                                                {media.season ? `S${media.season}:E${media.episode || 1}` : 'SERIES'}
                                            </span>
                                        )}
                                        <span className="ml-auto bg-red-600/95 shadow-[0_0_8px_rgba(229,9,20,0.8)] px-2 py-0.5 rounded text-[11px] font-black text-white">
                                            {media.percent || 0}%
                                        </span>
                                    </div>

                                    {/* Quick Actions (Info & Remove) */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-40">
                                        <button
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                navigateTo(`#/${isTv ? 'tv' : 'movie'}/${media.id}`); 
                                            }}
                                            className="w-7 h-7 rounded-full bg-black/80 hover:bg-white/30 text-white flex items-center justify-center border border-white/20 transition-colors shadow-lg cursor-pointer"
                                            title="View Details"
                                        >
                                            <span className="material-symbols-outlined text-sm">info</span>
                                        </button>
                                        <button
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                removeFromContinueWatching(media.id); 
                                            }}
                                            className="w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center border border-white/20 transition-colors shadow-lg cursor-pointer"
                                            title="Remove from Continue Watching"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-600 shadow-2xl flex items-center justify-center text-white transform group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-2xl md:text-3xl ml-0.5 fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                play_arrow
                                            </span>
                                        </div>
                                    </div>

                                    {/* Red Curtain Progress Bar */}
                                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                                        <div 
                                            className="h-full bg-red-600 shadow-[0_0_10px_rgba(229,9,20,0.9)] transition-all duration-300"
                                            style={{ width: `${media.percent || 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="mt-2.5 text-left">
                                    <h3 className="font-semibold text-sm text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                        {media.title || item.title || 'Untitled'}
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-xs text-white/50 mt-0.5 font-medium">
                                        {isTv && media.season && (
                                            <span>S{media.season} : E{media.episode || 1}</span>
                                        )}
                                        {isTv && media.season && <span>•</span>}
                                        <span className="text-red-400 font-bold">{media.percent || 0}% watched</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // 2. LATEST / BACKDROP MODE CARDS
                    if (type === 'latest') {
                        return (
                            <div 
                                key={`latest-${media.id}-${idx}`} 
                                className="flex-none w-[260px] md:w-[310px] group cursor-pointer"
                                onClick={() => handleCardClick(`#/${media.type || 'movie'}/${media.id}`)}
                            >
                                <div className="relative rounded-xl overflow-hidden aspect-video bg-surface-container-low border border-white/10 group-hover:border-red-600 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_10px_30px_rgba(229,9,20,0.35)]">
                                    <img 
                                        className="w-full h-full object-cover pointer-events-none" 
                                        src={media.backdrop || media.poster || 'https://via.placeholder.com/640x360?text=No+Image'}
                                        alt={media.title}
                                        loading="lazy" 
                                    />

                                    {/* Top Left Tag */}
                                    <div className="absolute top-2 left-2 z-30">
                                        <span className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-red-400 uppercase tracking-wider">
                                            {media.tag || (media.rating ? `★ ${media.rating.toFixed(1)}` : 'NEW')}
                                        </span>
                                    </div>

                                    {/* Watchlist Bookmark Button */}
                                    <button
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            toggleWatchlist(media.id, media.type || 'movie', media.poster, media.title, media.rating); 
                                        }}
                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-30 cursor-pointer active:scale-90"
                                        title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {isInWatchlist ? 'check' : 'bookmark_add'}
                                        </span>
                                    </button>

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <div className="w-12 h-12 rounded-full bg-red-600 shadow-2xl flex items-center justify-center text-white transform group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-2xl ml-0.5 fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                play_arrow
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2.5 text-left space-y-0.5">
                                    <h4 className="font-semibold text-sm text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                        {media.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                                        <span>{media.year || ''}</span>
                                        {media.genres?.[0] && (
                                            <>
                                                <span>•</span>
                                                <span className="truncate">{media.genres[0]}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // 3. POSTER CARDS (Default - Trending, Top Rated, Genre Rows)
                    return (
                        <div 
                            key={`poster-${media.id}-${idx}`} 
                            className="flex-none w-44 md:w-52 lg:w-56 group cursor-pointer"
                            onClick={() => handleCardClick(`#/${media.type || 'movie'}/${media.id}`)}
                        >
                            <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-surface-container-low border border-white/10 group-hover:border-red-600 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_10px_30px_rgba(229,9,20,0.35)]">
                                <img 
                                    className="w-full h-full object-cover pointer-events-none" 
                                    src={media.poster || media.backdrop || 'https://via.placeholder.com/300x450?text=No+Image'} 
                                    alt={media.title}
                                    loading="lazy" 
                                />

                                {/* Top Badges (Left: Series tag or Rating, Right: Watchlist) */}
                                <div className="absolute top-2 left-2 z-30 flex items-center gap-1">
                                    {isTv ? (
                                        <span className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-white uppercase tracking-wider">
                                            SERIES
                                        </span>
                                    ) : media.rating > 0 ? (
                                        <div className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1">
                                            <span className="text-yellow-400 text-xs">★</span>
                                            <span>{media.rating.toFixed(1)}</span>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Watchlist Toggle Button */}
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        toggleWatchlist(media.id, media.type || 'movie', media.poster, media.title, media.rating); 
                                    }}
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/80 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-30 cursor-pointer active:scale-90"
                                    title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                                >
                                    <span className="material-symbols-outlined text-base">
                                        {isInWatchlist ? 'check' : 'bookmark_add'}
                                    </span>
                                </button>

                                {/* Play Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-600 shadow-2xl flex items-center justify-center text-white transform group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-2xl md:text-3xl ml-0.5 fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            play_arrow
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2.5 text-left space-y-0.5">
                                <h3 className="font-semibold text-sm text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                    {media.title || 'Untitled'}
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs text-white/50">
                                    <span>{media.year || (media.releaseDate ? media.releaseDate.split('-')[0] : '')}</span>
                                    {media.genres?.[0] && (
                                        <>
                                            <span>•</span>
                                            <span className="truncate">{media.genres[0]}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
});

MediaRow.displayName = 'MediaRow';
