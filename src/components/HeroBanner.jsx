import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';

export const HeroBanner = ({ items = [], media = null }) => {
    const { toggleWatchlist, watchlist, navigateTo, playMedia } = useApp();
    const { t } = useLanguage();

    const heroList = Array.isArray(items) && items.length > 0 ? items : (media ? [media] : []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    // Auto-advance carousel every 6.5s unless hovered
    useEffect(() => {
        if (heroList.length <= 1 || isHovered) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % heroList.length);
        }, 6500);
        return () => clearInterval(interval);
    }, [heroList.length, isHovered]);

    const currentItem = heroList[currentIndex] || heroList[0];
    if (!currentItem) return null;

    const mediaType = currentItem.type === 'tv' ? 'tv' : 'movie';
    const mediaId = currentItem.id;
    const imageSrc = currentItem.backdrop || currentItem.poster;
    const inWatchlist = (watchlist || []).some(item => String(item.id) === String(mediaId));
    const rating = currentItem.rating ? Number(currentItem.rating).toFixed(1) : null;
    const year = currentItem.year || (currentItem.release_date ? currentItem.release_date.slice(0, 4) : null);
    const durationText = currentItem.duration || (currentItem.type === 'tv' ? 'Series' : '2h');

    return (
        <section 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative w-full h-[540px] sm:h-[620px] overflow-hidden flex items-end select-none"
        >
            {/* ── 1. FULL-BLEED BACKDROP IMAGE WITH SMOOTH CROSSFADE ── */}
            <div className="absolute inset-0 z-0 bg-black">
                {imageSrc && (
                    <img
                        key={currentItem.id}
                        src={imageSrc}
                        alt={currentItem.title}
                        className="w-full h-full object-cover object-center animate-fade-in duration-700"
                    />
                )}

                {/* Left-to-Right Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0f]/95 via-[#0d0d0f]/60 to-transparent w-full max-w-4xl" />

                {/* Bottom-to-Top Scrim Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/50 to-transparent" />
            </div>

            {/* ── 2. HERO CONTENT OVERLAY ── */}
            <div className="relative z-10 px-4 md:px-8 pb-12 max-w-7xl mx-auto w-full text-left space-y-4">
                
                {/* Badge Tag & Featured Counter */}
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-red-600 rounded text-[10px] font-black tracking-widest uppercase text-white shadow-md shadow-red-600/30">
                        {currentItem.tag || 'Trending This Week'}
                    </span>
                    {heroList.length > 1 && (
                        <span className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono font-bold text-white/70 backdrop-blur-md">
                            FEATURED {currentIndex + 1} / {heroList.length}
                        </span>
                    )}
                </div>

                {/* Big Title */}
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] max-w-2xl leading-none">
                    {currentItem.title}
                </h1>

                {/* Metadata Row: Rating • Year • Duration / Series */}
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-semibold text-white/80">
                    {rating && (
                        <div className="flex items-center gap-1 text-amber-400 font-bold bg-black/40 px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                            <span className="material-symbols-outlined text-sm fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            <span>{rating}</span>
                        </div>
                    )}

                    {year && (
                        <span>{year}</span>
                    )}

                    <span className="w-1 h-1 rounded-full bg-white/40" />

                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 text-xs font-semibold uppercase tracking-wider">
                        {currentItem.type === 'tv' ? 'TV Series' : 'Movie'}
                    </span>

                    <span className="w-1 h-1 rounded-full bg-white/40" />

                    <span>{durationText}</span>
                </div>

                {/* Synopsis Overview */}
                <p className="text-xs sm:text-sm md:text-base text-white/75 line-clamp-3 max-w-xl leading-relaxed drop-shadow-md">
                    {currentItem.overview}
                </p>

                {/* Action Buttons Row */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Watch Now Play Button */}
                    <button
                        onClick={() => playMedia(currentItem)}
                        className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all text-xs sm:text-sm shadow-xl shadow-red-600/40 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                            play_arrow
                        </span>
                        <span>Watch Now</span>
                    </button>

                    {/* Add to Watchlist Button */}
                    <button
                        onClick={() => toggleWatchlist(mediaId, mediaType, currentItem.poster, currentItem.title, currentItem.rating)}
                        className="bg-white/10 hover:bg-white/20 active:scale-95 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all text-xs sm:text-sm backdrop-blur-md border border-white/15 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-xl">
                            {inWatchlist ? 'check' : 'add'}
                        </span>
                        <span>{inWatchlist ? 'In My List' : 'Add to List'}</span>
                    </button>

                    {/* More Info Button */}
                    <button
                        onClick={() => navigateTo(`#/${mediaType}/${mediaId}`)}
                        className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all backdrop-blur-md border border-white/15 cursor-pointer"
                        title="More Info"
                    >
                        <span className="material-symbols-outlined text-xl">info</span>
                    </button>
                </div>

                {/* Carousel Navigation Indicator Dots */}
                {heroList.length > 1 && (
                    <div className="flex items-center gap-1.5 pt-4">
                        {heroList.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                                    idx === currentIndex 
                                        ? 'w-6 bg-red-600' 
                                        : 'w-1.5 bg-white/30 hover:bg-white/60'
                                }`}
                                title={`Slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};
