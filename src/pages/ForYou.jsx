import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { TMDBService } from '../services/tmdb';
import { RecommendationEngine } from '../services/recommendationEngine';
import { ForYouSkeleton } from '../components/Skeleton';
import { getMediaRoute } from './Home';

const LOCAL_STORAGE_SUPPRESSED_KEY = 'notflix_suppressed_recommendations';

const readSuppressedIds = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUPPRESSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error('Invalid suppressed recommendations cache');
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch (error) {
    console.error('Error reading suppressed recommendations:', error);
    localStorage.removeItem(LOCAL_STORAGE_SUPPRESSED_KEY);
    return [];
  }
};

const writeSuppressedIds = (ids) => {
  const normalized = Array.from(new Set(ids.map((id) => String(id)).filter(Boolean)));
  localStorage.setItem(LOCAL_STORAGE_SUPPRESSED_KEY, JSON.stringify(normalized));
  return normalized;
};

export const ForYou = () => {
  const {
    user,
    watchlist = [],
    continueWatching = [],
    navigateTo,
    addNotification,
    playMedia,
    openDetails,
    setSelectedDetail,
  } = useApp();
  const { t } = useLanguage();

  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isDiscoveryDismissed, setIsDiscoveryDismissed] = useState(false);

  const feedContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const touchStartYRef = useRef(0);

  // Load feed items
  useEffect(() => {
    let active = true;
    const loadFeed = async () => {
      setLoading(true);
      try {
        const suppressedIds = readSuppressedIds();
        let allItems = [];

        if (user) {
          allItems = await RecommendationEngine.buildFeed(
            continueWatching,
            watchlist,
            suppressedIds,
            50
          );
        } else {
          allItems = await RecommendationEngine.buildTrendingFallback(suppressedIds);
        }

        if (!Array.isArray(allItems) || allItems.length === 0) {
          allItems = await RecommendationEngine.buildTrendingFallback([]);
        }

        const safeItems = Array.isArray(allItems) ? allItems.filter(Boolean) : [];
        if (active) {
          setFeedItems(safeItems);
        }
      } catch (error) {
        console.error('Error building For You feed:', error);
        try {
          const fallbackItems = await RecommendationEngine.buildTrendingFallback([]);
          if (active) {
            setFeedItems(Array.isArray(fallbackItems) ? fallbackItems.filter(Boolean) : []);
          }
        } catch (fallbackError) {
          console.error('Error loading For You fallback:', fallbackError);
          if (active) setFeedItems([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFeed();
    return () => {
      active = false;
    };
  }, [user, watchlist, continueWatching]);

  // Smooth programmatic scroll to a specific index
  const scrollToIndex = useCallback(
    (index) => {
      if (!feedContainerRef.current) return;
      const targetIndex = Math.max(0, Math.min(index, feedItems.length - 1));
      const container = feedContainerRef.current;
      const targetElement = container.children[targetIndex];

      if (targetElement) {
        isScrollingRef.current = true;
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setCurrentIndex(targetIndex);

        setTimeout(() => {
          isScrollingRef.current = false;
        }, 500);
      }
    },
    [feedItems.length]
  );

  const scrollNext = useCallback(() => {
    scrollToIndex(currentIndex + 1);
  }, [currentIndex, scrollToIndex]);

  const scrollPrev = useCallback(() => {
    scrollToIndex(currentIndex - 1);
  }, [currentIndex, scrollToIndex]);

  // Sync currentIndex with native scroll position
  const handleScroll = useCallback(() => {
    if (isScrollingRef.current || !feedContainerRef.current) return;
    const container = feedContainerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight || 1;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < feedItems.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, feedItems.length]);

  // TikTok-style mouse wheel snapping with debounce momentum lock
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    let wheelCooldownTimer = null;

    const handleWheel = (e) => {
      // If user is doing standard pinch or slow gesture, threshold it
      if (Math.abs(e.deltaY) < 25) return;

      e.preventDefault();

      if (isScrollingRef.current) return;

      if (e.deltaY > 25) {
        // Scroll Down -> Next Video
        scrollNext();
      } else if (e.deltaY < -25) {
        // Scroll Up -> Previous Video
        scrollPrev();
      }

      isScrollingRef.current = true;
      if (wheelCooldownTimer) clearTimeout(wheelCooldownTimer);
      wheelCooldownTimer = setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelCooldownTimer) clearTimeout(wheelCooldownTimer);
    };
  }, [scrollNext, scrollPrev]);

  // Touch swipe handling for mobile / trackpads
  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const diffY = touchStartYRef.current - touchEndY;

      if (Math.abs(diffY) > 40) {
        if (diffY > 0) {
          scrollNext();
        } else {
          scrollPrev();
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollNext, scrollPrev]);

  // Keyboard navigation listeners (Up/Down, W/S, PageUp/PageDown)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's' || e.key === 'PageDown') {
        e.preventDefault();
        scrollNext();
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key === 'PageUp') {
        e.preventDefault();
        scrollPrev();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollNext, scrollPrev]);

  const handleWatched = (id) => {
    if (!id) return;
    let suppressedIds = readSuppressedIds();

    const normalizedId = String(id);
    if (!suppressedIds.includes(normalizedId)) {
      suppressedIds.push(normalizedId);
      writeSuppressedIds(suppressedIds);
    }

    setFeedItems((prev) => prev.filter((item) => String(item.id) !== normalizedId));
    if (addNotification) {
      addNotification('Marked as Watched', "We won't recommend this title again.", 'visibility_off');
    }
    scrollNext();
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-[#08080a] pt-20 sm:pt-24 pb-12 px-2 sm:px-4 flex flex-col items-center justify-center relative select-none">
      {loading ? (
        <ForYouSkeleton />
      ) : feedItems.length > 0 ? (
        <div className="w-full max-w-[1550px] mx-auto flex flex-col items-center justify-center relative px-2">
          {/* Center Framed Feed Card */}
          <div className="relative w-full max-w-[440px] md:max-w-3xl flex items-center justify-center">
            
            {/* Floating Non-intrusive Discovery Pill (Never pushes layout down!) */}
            {!user && !isDiscoveryDismissed && (
              <div className="absolute top-4 left-4 z-40 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-xl border border-white/15 text-white text-xs shadow-2xl transition-all animate-fade-in pointer-events-auto">
                <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
                <span className="font-semibold text-[11px] text-white/90">
                  Personalized Discoveries
                </span>
                <button
                  onClick={() => navigateTo?.('#/profile')}
                  className="text-[11px] font-bold text-[#E50914] hover:text-red-400 underline underline-offset-2 ml-0.5 cursor-pointer"
                >
                  Profiles
                </button>
                <button
                  onClick={() => setIsDiscoveryDismissed(true)}
                  className="text-white/40 hover:text-white transition ml-1 flex items-center cursor-pointer"
                  title="Dismiss badge"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* Video Feed Scroller */}
            <div
              ref={feedContainerRef}
              onScroll={handleScroll}
              className="w-full aspect-[9/16] md:aspect-[16/10] max-h-[86vh] md:h-[82vh] overflow-y-scroll snap-y snap-mandatory no-scrollbar relative rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.9)] border border-white/10 bg-[#0e0e11] overscroll-contain"
              style={{
                scrollBehavior: 'smooth',
                scrollSnapType: 'y mandatory',
              }}
            >
              {feedItems.map((item, idx) => (
                <FeedItem
                  key={`${item.id}-${idx}`}
                  item={item}
                  isActive={idx === currentIndex}
                  onWatched={() => handleWatched(item.id)}
                  playMedia={playMedia}
                  openDetails={openDetails}
                  setSelectedDetail={setSelectedDetail}
                  isMuted={isMuted}
                  toggleMute={() => setIsMuted(!isMuted)}
                />
              ))}
            </div>

            {/* Desktop Navigation Chevrons & Feed Counter */}
            <div className="hidden md:flex absolute -right-20 top-1/2 -translate-y-1/2 flex-col items-center gap-3 z-50">
              {/* Previous Button */}
              <button
                onClick={scrollPrev}
                disabled={currentIndex === 0}
                className={`w-12 h-12 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all shadow-xl group cursor-pointer ${
                  currentIndex === 0
                    ? 'bg-black/30 border-white/10 text-white/20 cursor-not-allowed'
                    : 'bg-black/60 hover:bg-black/90 border-white/20 text-white hover:scale-110 active:scale-95'
                }`}
                title="Previous Recommendation (Arrow Up / W)"
              >
                <span className="material-symbols-outlined text-2xl group-hover:-translate-y-0.5 transition-transform">
                  keyboard_arrow_up
                </span>
              </button>

              {/* Slide Position Counter Badge */}
              <div className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-[10px] font-bold text-white/60 tracking-wider">
                {currentIndex + 1} / {feedItems.length}
              </div>

              {/* Next Button */}
              <button
                onClick={scrollNext}
                disabled={currentIndex === feedItems.length - 1}
                className={`w-12 h-12 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all shadow-xl group cursor-pointer ${
                  currentIndex === feedItems.length - 1
                    ? 'bg-black/30 border-white/10 text-white/20 cursor-not-allowed'
                    : 'bg-black/60 hover:bg-black/90 border-white/20 text-white hover:scale-110 active:scale-95'
                }`}
                title="Next Recommendation (Arrow Down / S)"
              >
                <span className="material-symbols-outlined text-2xl group-hover:translate-y-0.5 transition-transform">
                  keyboard_arrow_down
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 w-full flex flex-col items-center justify-center text-white/50 font-bold py-24">
          <span className="material-symbols-outlined text-5xl text-white/20 mb-2">movie_filter</span>
          <p className="text-sm">No recommendations available right now.</p>
        </div>
      )}
    </div>
  );
};

/* ═══════════════ FEED ITEM COMPONENT ═══════════════ */

const FeedItem = ({
  item,
  isActive,
  onWatched,
  playMedia,
  openDetails,
  setSelectedDetail,
  isMuted,
  toggleMute,
}) => {
  const { watchlist = [], addNotification, toggleWatchlist } = useApp();
  const [trailer, setTrailer] = useState(null);

  const itemId = item?.id;
  const itemType = item?.type === 'tv' ? 'tv' : 'movie';
  const isSaved = itemId ? watchlist.some((w) => String(w.id) === String(itemId)) : false;
  const rating = Number(item?.rating) || 0;

  // Load YouTube trailer only when slide is active
  useEffect(() => {
    let isMounted = true;
    if (isActive && !trailer && itemId) {
      TMDBService.getMediaVideos(itemId, itemType)
        .then((videos) => {
          if (!isMounted) return;
          const trailerVideo = Array.isArray(videos)
            ? videos.find((v) => v.type === 'Trailer' || v.type === 'Teaser') || videos[0]
            : null;
          if (trailerVideo?.key) setTrailer(trailerVideo.key);
        })
        .catch((error) => console.error('Error fetching trailer:', error));
    }
    return () => {
      isMounted = false;
    };
  }, [isActive, itemId, itemType, trailer]);

  if (!itemId) return null;

  const handleToggleWatchlist = async () => {
    try {
      await toggleWatchlist(item);
      if (addNotification) {
        addNotification(
          isSaved ? 'Removed from List' : 'Added to List',
          item.title || item.name,
          isSaved ? 'remove' : 'check'
        );
      }
    } catch (error) {
      console.error('Error updating watchlist from For You:', error);
    }
  };

  const handleOpenDetails = () => {
    navigateTo(getMediaRoute(item, false));
  };

  const handlePlay = () => {
    navigateTo(getMediaRoute(item, true));
  };

  return (
    <div className="w-full h-full snap-start snap-always relative overflow-hidden group shrink-0 transition-transform duration-500">
      {/* Background Media Layer */}
      <div className="absolute inset-0 bg-black z-0 flex items-center justify-center overflow-hidden">
        {isActive && trailer ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&mute=${
              isMuted ? 1 : 0
            }&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailer}&modestbranding=1&iv_load_policy=3&playsinline=1`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250vw] h-[250vh] md:w-[150vw] md:h-[150vh] pointer-events-none opacity-85 mix-blend-screen scale-105 transition-opacity duration-700"
            frameBorder="0"
            allow="autoplay; encrypted-media"
          />
        ) : (
          <img
            src={TMDBService.getImageUrl(
              item.backdrop_path || item.backdrop || item.poster_path || item.poster,
              'original'
            )}
            alt={item.title || item.name}
            className={`w-full h-full object-cover transition-all duration-700 ${
              isActive ? 'opacity-70 scale-100' : 'opacity-40 scale-105'
            }`}
            onError={(e) => {
              e.target.src = '/notflix-logo.png';
            }}
          />
        )}

        {/* Immersive Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      {/* Top Right Controls (Volume toggle) */}
      <div className="absolute top-5 right-5 z-30 pointer-events-auto">
        <button
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/20 flex items-center justify-center transition cursor-pointer text-white shadow-xl active:scale-90"
          title={isMuted ? 'Unmute Sound (M)' : 'Mute Sound (M)'}
        >
          <span className="material-symbols-outlined text-lg">
            {isMuted ? 'volume_off' : 'volume_up'}
          </span>
        </button>
      </div>

      {/* Bottom Details & Captions Panel */}
      <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 z-20 flex items-end justify-between gap-4 sm:gap-6 pointer-events-none pb-6 sm:pb-8">
        {/* Text Content */}
        <div className="flex-1 max-w-xl space-y-2.5 pointer-events-auto text-left">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {itemType === 'tv' && (
              <span className="px-2.5 py-0.5 rounded bg-[#E50914] text-white text-[10px] font-black tracking-widest uppercase shadow-md shadow-red-900/30">
                TV SERIES
              </span>
            )}
            {rating > 0 && (
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-yellow-400 font-bold text-xs">
                <span className="material-symbols-outlined text-xs">star</span>
                <span>{rating.toFixed(1)}</span>
              </div>
            )}
            {item.year && (
              <span className="text-white/80 text-xs font-semibold drop-shadow-md">
                {item.year}
              </span>
            )}

            {item.genres && item.genres.length > 0 && (
              <div className="flex gap-1.5 items-center">
                <span className="text-white/40">•</span>
                {item.genres.slice(0, 2).map((g, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-bold text-white/70 uppercase tracking-wider"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          <h2
            onClick={handleOpenDetails}
            className="text-xl sm:text-3xl font-black text-white leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] cursor-pointer hover:text-[#E50914] transition line-clamp-2"
          >
            {item.title || item.name}
          </h2>

          <p
            onClick={handleOpenDetails}
            className="text-white/80 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-normal max-w-lg cursor-pointer"
          >
            {item.overview || 'Explore this title and stream in high-definition now.'}
          </p>
        </div>

        {/* Right Action Bar (TikTok / Reels style controls) */}
        <div className="flex flex-col gap-3 pointer-events-auto items-center shrink-0">
          {/* Play Button */}
          <div
            className="flex flex-col items-center gap-1 cursor-pointer group/btn"
            onClick={handlePlay}
          >
            <div className="w-12 h-12 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.4)] group-hover/btn:scale-110 active:scale-95 transition-all duration-200">
              <span className="material-symbols-outlined text-2xl font-bold">play_arrow</span>
            </div>
            <span className="text-[9px] font-bold text-white/90 group-hover/btn:text-white uppercase tracking-wider">
              Play
            </span>
          </div>

          {/* More Info Details Button */}
          <div
            className="flex flex-col items-center gap-1 cursor-pointer group/btn"
            onClick={handleOpenDetails}
          >
            <div className="w-11 h-11 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-lg group-hover/btn:scale-110 active:scale-95 transition-all duration-200">
              <span className="material-symbols-outlined text-xl">info</span>
            </div>
            <span className="text-[9px] font-bold text-white/75 group-hover/btn:text-white uppercase tracking-wider">
              Details
            </span>
          </div>

          {/* My List Button */}
          <div
            className="flex flex-col items-center gap-1 cursor-pointer group/btn"
            onClick={handleToggleWatchlist}
          >
            <div
              className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center shadow-lg group-hover/btn:scale-110 active:scale-95 transition-all duration-200 ${
                isSaved
                  ? 'bg-[#E50914] border-[#E50914] text-white shadow-red-900/40'
                  : 'bg-black/60 border-white/25 text-white hover:bg-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {isSaved ? 'check' : 'add'}
              </span>
            </div>
            <span className="text-[9px] font-bold text-white/75 group-hover/btn:text-white uppercase tracking-wider">
              List
            </span>
          </div>

          {/* Mark as Watched / Skip Button */}
          <div
            className="flex flex-col items-center gap-1 cursor-pointer group/btn"
            onClick={onWatched}
          >
            <div className="w-11 h-11 rounded-full bg-black/60 hover:bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white/70 group-hover/btn:text-white shadow-lg group-hover/btn:scale-110 active:scale-95 transition-all duration-200">
              <span className="material-symbols-outlined text-lg">visibility_off</span>
            </div>
            <span className="text-[9px] font-bold text-white/75 group-hover/btn:text-white uppercase tracking-wider">
              Skip
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForYou;
