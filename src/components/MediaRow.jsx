import React, { useRef, useState, useMemo } from 'react';
import MediaCard from './MediaCard';
import { useApp } from '../context/AppContext';

export default function MediaRow({ title, items = [], progressMap = {}, onSelect, onPlay }) {
  const { watchlist = [], toggleWatchlist } = useApp();
  const rowRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const watchlistIdSet = useMemo(() => new Set((watchlist || []).map((w) => String(w.id))), [watchlist]);

  if (!Array.isArray(items) || items.length === 0) return null;

  const handleScroll = (direction) => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.75;
    const targetScroll = direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
    rowRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
  };

  const checkScrollability = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  return (
    <section className="relative my-8 sm:my-10 select-none group/row media-row-section">
      {/* Row Header */}
      <div className="flex items-center gap-2 px-6 sm:px-14 mb-4">
        <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
          {title}
        </h2>
        <span className="material-symbols-outlined text-sm sm:text-base text-white/40 group-hover/row:text-white/80 group-hover/row:translate-x-1 transition-all">
          chevron_right
        </span>
      </div>

      {/* Horizontal Carousel Container */}
      <div className="relative">
        {/* Left Scroll Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-2 top-0 bottom-8 z-30 w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 cursor-pointer backdrop-blur-md rounded-r-xl"
          >
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
        )}

        {/* Media Cards Track */}
        <div
          ref={rowRef}
          onScroll={checkScrollability}
          className="flex items-start gap-4 sm:gap-5 overflow-x-auto overflow-y-hidden px-6 sm:px-14 py-2 scroll-smooth no-scrollbar media-row-track"
        >
          {items.map((item) => {
            const itemId = String(item.id);
            const progress = progressMap[itemId] || item.watchProgress || (item.percent !== undefined || item.currentTime !== undefined ? item : null);
            const isSaved = watchlistIdSet.has(itemId);

            return (
              <MediaCard
                key={`${item.media_type || 'item'}-${item.id}`}
                item={item}
                progress={progress}
                isInWatchlist={isSaved}
                onSelect={() => onSelect?.(item)}
                onPlay={() => onPlay?.(item)}
                onToggleWatchlist={() => toggleWatchlist?.(item)}
              />
            );
          })}
        </div>

        {/* Right Scroll Arrow */}
        {canScrollRight && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-2 top-0 bottom-8 z-30 w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 cursor-pointer backdrop-blur-md rounded-l-xl"
          >
            <span className="material-symbols-outlined text-3xl">chevron_right</span>
          </button>
        )}
      </div>
    </section>
  );
}
