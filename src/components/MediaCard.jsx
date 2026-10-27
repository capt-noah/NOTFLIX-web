import React, { useState } from 'react';
import TMDBService from '../services/tmdb';
import { useApp } from '../context/AppContext';

export const getMediaRoute = (item, play = false) => {
  if (!item) return '#/';
  const isAnime = Boolean(
    item.isAnime ||
    item.anime ||
    item.type === 'anime' ||
    item.category === 'anime' ||
    (typeof item.tag === 'string' && item.tag.toLowerCase().includes('anime')) ||
    (item.original_language === 'ja' && (
      (Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) ||
      (Array.isArray(item.genres) && item.genres.some(g => (g.name || g).toString().toLowerCase().includes('animation')))
    ))
  );
  const isTv = item.media_type === 'tv' || item.type === 'tv' || Boolean(item.first_air_date) || Boolean(item.season) || Boolean(item.seasons);
  
  let path = '#/movie/' + item.id;
  if (isAnime) {
    path = '#/anime/' + item.id;
  } else if (isTv) {
    path = '#/tv/' + item.id;
  }
  if (!play) return path;

  const s = item.season || 1;
  const ep = item.episode || 1;
  return `${path}?play=true&season=${s}&episode=${ep}`;
};

function MediaCard({ item, progress, onSelect, onPlay, onToggleWatchlist, isInWatchlist }) {
  const { navigateTo, openDetails } = useApp();
  const [isHovered, setIsHovered] = useState(false);

  if (!item) return null;

  const rawTitle = item.title || item.name || item.t_title || item.original_title || item.original_name;
  const displayTitle = typeof rawTitle === 'object' && rawTitle
    ? (rawTitle.english || rawTitle.romaji || rawTitle.userPreferred || rawTitle.native || 'Untitled')
    : (rawTitle || 'Untitled');

  const imageSource = item.poster_path || item.poster || item.backdrop_path || item.backdrop || item.p_path || item.b_path || item.coverImage?.large || item.coverImage?.extraLarge || item.image || item.cover;
  const posterUrl = TMDBService.getImageUrl(imageSource, 'w500');
  const releaseYear = item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || item.year || '';
  const isSeries = item.media_type === 'tv' || item.type === 'tv' || Boolean(item.first_air_date) || Boolean(item.season);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : (item.rating ? Number(item.rating).toFixed(1) : null);

  const isAnime = Boolean(
    item.isAnime ||
    item.anime ||
    item.type === 'anime' ||
    item.category === 'anime' ||
    (typeof item.tag === 'string' && item.tag.toLowerCase().includes('anime')) ||
    (item.original_language === 'ja' && (
      (Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) ||
      (Array.isArray(item.genres) && item.genres.some(g => (g.name || g).toString().toLowerCase().includes('animation')))
    ))
  );

  const subCount = Number(item.subCount || item.episodes?.sub || 0);
  const dubCount = Number(item.dubCount || item.episodes?.dub || 0);
  const hasSub = subCount > 0;
  const hasDub = dubCount > 0;

  const handleCardClick = () => {
    if (onSelect) onSelect(item);
    else openDetails(item);
  };

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (onPlay) onPlay(item);
    else navigateTo(getMediaRoute(item, true));
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col gap-2.5 cursor-pointer select-none transition-transform duration-300 ease-out hover:scale-105 shrink-0"
      style={{ width: 195 }}
    >
      {/* Poster Image Stage */}
      <div className="relative w-[195px] h-[285px] rounded-2xl overflow-hidden bg-[#18181c] border border-white/10 group-hover:border-[#E50914] group-hover:shadow-[0_0_25px_rgba(229,9,20,0.45)] transition-all duration-300">
        <img
          src={posterUrl}
          alt={displayTitle}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.target.src = '/notflix-logo.png';
          }}
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 flex-wrap max-w-[70%]">
            {isAnime && (hasSub || hasDub) ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white text-[10px] font-semibold shadow-md">
                {hasSub && (
                  <span className="flex items-center gap-0.5 text-emerald-400 font-bold" title={`${subCount} Subbed Episodes`}>
                    <span className="material-symbols-outlined text-[11px] leading-none font-bold">closed_caption</span>
                    <span>{subCount}</span>
                  </span>
                )}
                {hasSub && hasDub && <span className="text-white/20 text-[9px] font-light">|</span>}
                {hasDub && (
                  <span className="flex items-center gap-0.5 text-amber-400 font-bold" title={`${dubCount} Dubbed Episodes`}>
                    <span className="material-symbols-outlined text-[11px] leading-none font-bold">mic</span>
                    <span>{dubCount}</span>
                  </span>
                )}
              </div>
            ) : isSeries ? (
              <span className="px-2 py-0.5 text-[9px] font-black tracking-wider text-white bg-black/80 backdrop-blur-md rounded-sm uppercase">
                {item.episodeTag || 'SERIES'}
              </span>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {progress ? (
              <span className="px-2 py-0.5 text-[10px] font-black text-white bg-[#E50914] rounded-sm shadow-md">
                {Math.round(
                  progress.percent !== undefined && progress.percent !== null && progress.percent > 0
                    ? progress.percent
                    : ((progress.currentTime || 0) / (progress.duration || 1)) * 100
                )}%
              </span>
            ) : rating ? (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-sm text-yellow-400 text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">star</span>
                <span>{rating}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Quick Hover Action Overlay (Apple TV / Netflix style) */}
        <div
          className={`absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-3 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {/* Quick Play Button */}
            <button
              onClick={handlePlayClick}
              className="w-9 h-9 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center shadow-lg transition active:scale-90 cursor-pointer"
              title="Play Now"
            >
              <span className="material-symbols-outlined text-xl">play_arrow</span>
            </button>

            {/* Quick Watchlist Toggle */}
            {onToggleWatchlist && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatchlist?.(item);
                }}
                className={`w-9 h-9 rounded-full border flex items-center justify-center backdrop-blur-md transition active:scale-90 cursor-pointer ${
                  isInWatchlist
                    ? 'bg-[#E50914] border-[#E50914] text-white shadow-md'
                    : 'bg-black/60 border-white/30 text-white hover:border-white'
                }`}
                title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              >
                <span className="material-symbols-outlined text-lg">
                  {isInWatchlist ? 'check' : 'add'}
                </span>
              </button>
            )}

            {/* Details Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              className="w-9 h-9 rounded-full bg-black/60 hover:bg-white/20 border border-white/30 text-white flex items-center justify-center backdrop-blur-md transition ml-auto active:scale-90 cursor-pointer"
              title="More Info"
            >
              <span className="material-symbols-outlined text-lg">info</span>
            </button>
          </div>
        </div>

        {/* Continue Watching Bottom Progress Bar */}
        {progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
            <div
              className="h-full bg-[#E50914] shadow-[0_0_8px_#e50914]"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    1,
                    Math.round(
                      progress.percent !== undefined && progress.percent !== null && progress.percent > 0
                        ? progress.percent
                        : ((progress.currentTime || 0) / (progress.duration || 1)) * 100
                    )
                  )
                )}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Title & Metadata Details */}
      <div className="flex flex-col gap-0.5 text-left">
        <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#E50914] transition line-clamp-1">
          {displayTitle}
        </h4>
        <div className="flex items-center gap-2 text-[11px] text-white/50">
          {progress ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(item.season || progress.season) && (
                <>
                  <span className="text-white/80 font-bold">
                    S{item.season || progress.season}:E{item.episode || progress.episode || 1}
                  </span>
                  <span className="text-white/30">•</span>
                </>
              )}
              <span className="text-[#E50914] font-bold">
                {Math.round(
                  progress.percent !== undefined && progress.percent !== null && progress.percent > 0
                    ? progress.percent
                    : ((progress.currentTime || 0) / (progress.duration || 1)) * 100
                )}% watched
              </span>
            </div>
          ) : (
            <>
              <span>{releaseYear}</span>
              {item.genres?.length > 0 && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[90px]">{item.genres[0]}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const MemoizedMediaCard = React.memo(MediaCard);
export default MemoizedMediaCard;
export { MemoizedMediaCard as MediaCard };
