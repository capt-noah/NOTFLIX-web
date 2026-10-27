import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import TMDBService from '../services/tmdb';

export default function HeroBanner({ items = [], onPlay, onMoreInfo }) {
  const { watchlist = [], toggleWatchlist } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const heroList = Array.isArray(items) && items.length > 0 ? items : [];
  const currentItem = heroList[currentIndex] || heroList[0];

  // Auto-advance timer (6.5s)
  useEffect(() => {
    if (heroList.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroList.length);
    }, 6500);

    return () => clearInterval(interval);
  }, [heroList.length, isHovered]);

  if (!currentItem) return null;

  const isInWatchlist = (watchlist || []).some((w) => String(w.id) === String(currentItem.id));
  const imageSource = currentItem.backdrop_path || currentItem.backdrop || currentItem.poster_path || currentItem.poster;
  const backdropUrl = TMDBService.getImageUrl(imageSource, 'original');

  const releaseYear =
    currentItem.release_date?.slice(0, 4) ||
    currentItem.first_air_date?.slice(0, 4) ||
    '';
  const rating = currentItem.vote_average ? currentItem.vote_average.toFixed(1) : '8.5';
  const isSeries = currentItem.media_type === 'tv' || Boolean(currentItem.first_air_date);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-[580px] sm:h-[680px] select-none overflow-hidden bg-[#0c0c0e]"
    >
      {/* Full-bleed Backdrop Image with Smooth Fade */}
      <div
        key={currentItem.id}
        className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-out scale-100 animate-fade-in"
        style={{ backgroundImage: `url(${backdropUrl})` }}
      />

      {/* Cinematic Multi-Directional Gradient Scrims */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/95 via-[#0a0a0c]/65 to-transparent w-full sm:w-2/3" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-black/90 via-black/50 to-transparent" />

      {/* Hero Content Information */}
      <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-14 pb-16 sm:pb-20 pt-28 sm:pt-36 max-w-4xl">
        {/* Badges */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className="px-2.5 py-1 text-[11px] font-black tracking-wider text-white bg-[#E50914] rounded-sm uppercase shadow-md shadow-red-900/30">
            {currentItem.tag || (isSeries ? 'Featured Series' : 'Trending Movie')}
          </span>
          {heroList.length > 1 && (
            <span className="px-2 py-1 text-[10px] font-bold text-white/75 bg-white/10 backdrop-blur-md rounded-sm">
              FEATURED {currentIndex + 1} / {heroList.length}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight leading-tight mb-4 drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] line-clamp-2">
          {currentItem.title || currentItem.name}
        </h1>

        {/* Metadata Chips */}
        <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-white/80 mb-4">
          <div className="flex items-center gap-1 text-yellow-400 font-bold">
            <span className="material-symbols-outlined text-base">star</span>
            <span>{rating}</span>
          </div>
          <span>•</span>
          <span>{releaseYear}</span>
          <span>•</span>
          <span>{isSeries ? 'Series' : 'Feature Film'}</span>
          <span>•</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold border border-white/30 rounded text-white/90">
            4K Ultra HD
          </span>
        </div>

        {/* Overview Synopsis */}
        <p className="text-xs sm:text-sm text-white/80 line-clamp-3 leading-relaxed max-w-xl mb-6 drop-shadow-md">
          {currentItem.overview}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3.5">
          {/* Play Button */}
          <button
            onClick={() => onPlay?.(currentItem)}
            className="flex items-center gap-2 px-7 py-3 rounded-xl bg-white text-black font-bold text-sm sm:text-base hover:bg-white/90 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shadow-white/20"
          >
            <span className="material-symbols-outlined text-2xl">play_arrow</span>
            <span>Play</span>
          </button>

          {/* More Info Button */}
          <button
            onClick={() => onMoreInfo?.(currentItem)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 text-white font-semibold text-sm sm:text-base backdrop-blur-md active:scale-95 transition-all duration-200 cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-xl">info</span>
            <span>More Info</span>
          </button>

          {/* Watchlist Toggle Button */}
          <button
            onClick={() => toggleWatchlist?.(currentItem)}
            title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 ${
              isInWatchlist
                ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-red-900/40'
                : 'bg-black/50 border-white/30 hover:border-white text-white backdrop-blur-md'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              {isInWatchlist ? 'check' : 'add'}
            </span>
          </button>
        </div>
      </div>

      {/* Pagination Capsules (Bottom Right) */}
      {heroList.length > 1 && (
        <div className="absolute bottom-10 right-8 sm:right-14 z-20 flex items-center gap-2">
          {heroList.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'w-7 bg-[#E50914] shadow-[0_0_10px_#e50914]'
                    : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Navigation Arrows (Hover Overlay) */}
      {heroList.length > 1 && (
        <div
          className={`absolute inset-y-0 inset-x-4 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={() =>
              setCurrentIndex((prev) => (prev - 1 + heroList.length) % heroList.length)
            }
            className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto transition cursor-pointer active:scale-90 shadow-xl"
          >
            <span className="material-symbols-outlined text-2xl">chevron_left</span>
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % heroList.length)}
            className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto transition cursor-pointer active:scale-90 shadow-xl"
          >
            <span className="material-symbols-outlined text-2xl">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}
