import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';

// Comprehensive AniList / MAL to TMDB ID Mapping from reference repository
const ANIME_TMDB_MAP = {
  // Jujutsu Kaisen
  '113415': { tmdbId: 95479 },
  '145064': { tmdbId: 95479 },
  '131573': { tmdbId: 810693 },
  '95479': { tmdbId: 95479 },
  // Demon Slayer
  '85937': { tmdbId: 85937 },
  '101922': { tmdbId: 85937 },
  '129874': { tmdbId: 85937 },
  '145139': { tmdbId: 85937 },
  '166240': { tmdbId: 85937 },
  // Attack on Titan
  '16498': { tmdbId: 1429 },
  '20958': { tmdbId: 1429 },
  '99147': { tmdbId: 1429 },
  '110277': { tmdbId: 1429 },
  '1429': { tmdbId: 1429 },
  // One Piece
  '21': { tmdbId: 37854 },
  '37854': { tmdbId: 37854 },
  // Solo Leveling
  '151807': { tmdbId: 127532 },
  '173778': { tmdbId: 127532 },
  '127532': { tmdbId: 127532 },
  // Chainsaw Man
  '127230': { tmdbId: 114410 },
  '114410': { tmdbId: 114410 },
  // Naruto & Naruto Shippuden
  '20': { tmdbId: 46260 },
  '46260': { tmdbId: 46260 },
  '1735': { tmdbId: 31910 },
  '31910': { tmdbId: 31910 },
  // Bleach
  '269': { tmdbId: 30984 },
  '30984': { tmdbId: 30984 },
  // Death Note
  '1535': { tmdbId: 13916 },
  '13916': { tmdbId: 13916 },
  // Spy x Family
  '140960': { tmdbId: 120089 },
  '158871': { tmdbId: 120089 },
  '120089': { tmdbId: 120089 },
  // My Hero Academia
  '21459': { tmdbId: 65930 },
  '65930': { tmdbId: 65930 },
  // Dandadan
  '171018': { tmdbId: 251504 },
  '251504': { tmdbId: 251504 },
  // Frieren
  '154587': { tmdbId: 209867 },
  '209867': { tmdbId: 209867 },
  // Kaiju No. 8
  '146065': { tmdbId: 138502 },
  '138502': { tmdbId: 138502 },
  // Blue Lock
  '137822': { tmdbId: 137822 },
  '163146': { tmdbId: 137822 }
};

// Full standard Movie & TV Show streaming servers (Verified 200 OK CDN Mirrors)
const STANDARD_SERVERS = [
  {
    id: 'vidbing',
    name: 'Vidbing Stream',
    shortName: 'Vidbing',
    getUrl: (id, isTv, season = 1, ep = 1) =>
      isTv
        ? `https://moviesapi.to/tv/${id}/${season}/${ep}`
        : `https://moviesapi.to/movie/${id}`,
  },
  {
    id: 'vidlink',
    name: 'VidLink HD',
    shortName: 'VidLink',
    getUrl: (id, isTv, season = 1, ep = 1) =>
      isTv
        ? `https://vidlink.pro/tv/${id}/${season}/${ep}?primaryColor=e50914`
        : `https://vidlink.pro/movie/${id}?primaryColor=e50914`,
  },
  {
    id: 'primesrc',
    name: 'PrimeSrc HD',
    shortName: 'PrimeSrc',
    getUrl: (id, isTv, season = 1, ep = 1) =>
      isTv
        ? `https://primesrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${ep}`
        : `https://primesrc.me/embed/movie?tmdb=${id}`,
  },
  {
    id: 'vidsrcnet',
    name: 'VidSrc.net',
    shortName: 'VidSrc.net',
    getUrl: (id, isTv, season = 1, ep = 1) =>
      isTv
        ? `https://vidsrc.net/embed/tv/${id}/${season}/${ep}`
        : `https://vidsrc.net/embed/movie/${id}`,
  },
  {
    id: 'vidsrcto',
    name: 'VidSrc.to',
    shortName: 'VidSrc.to',
    getUrl: (id, isTv, season = 1, ep = 1) =>
      isTv
        ? `https://vidsrc.to/embed/tv/${id}/${season}/${ep}`
        : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    id: 'twoembed',
    name: '2Embed',
    shortName: '2Embed',
    getUrl: (id, isTv, season = 1, ep = 1) =>
      isTv
        ? `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${ep}`
        : `https://www.2embed.cc/embed/${id}`,
  }
];

// Import dedicated Anime Sub and Dub servers
import { ANIME_SUB_SERVERS, ANIME_DUB_SERVERS } from '../pages/AnimeDetails';

export default function VideoPlayer({ media, onClose, onNextEpisode }) {
  const { saveProgress } = useApp();
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [audioMode, setAudioMode] = useState('sub'); // 'sub' | 'dub' (anime only)
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerContainerRef = useRef(null);
  const lastSavedKeyRef = useRef(null);

  if (!media) return null;

  // Accurate anime detection (Japanese animation vs Western movie/TV series)
  const isAnime = Boolean(
    media.isAnime ||
    media.anime ||
    media.type === 'anime' ||
    media.category === 'anime' ||
    (typeof media.tag === 'string' && media.tag.toLowerCase().includes('anime')) ||
    ((media.original_language === 'ja' || media.originalLanguage === 'ja') && (
      (Array.isArray(media.genre_ids) && media.genre_ids.includes(16)) ||
      (Array.isArray(media.genres) && media.genres.some(g => {
        const name = typeof g === 'string' ? g : g?.name;
        return typeof name === 'string' && (name.toLowerCase() === 'animation' || name.toLowerCase() === 'anime');
      }))
    ))
  );

  const isSeries = !media.isMovie && (
    media.type === 'tv' ||
    media.media_type === 'tv' ||
    Boolean(media.season) ||
    Boolean(media.first_air_date) ||
    Boolean(media.seasons) ||
    (isAnime && media.format !== 'MOVIE' && !media.isMovie)
  );

  const activeServers = isAnime
    ? (audioMode === 'dub' ? ANIME_DUB_SERVERS : ANIME_SUB_SERVERS)
    : STANDARD_SERVERS;
  const currentSeason = Number(media.season) || 1;
  const currentEpisode = Number(media.episode) || 1;
  const rawId = String(media.id);

  // Resolve AniList ID to TMDB ID for anime if mapped
  const resolvedMediaId = useMemo(() => {
    if (isAnime) {
      return media.tmdbId || ANIME_TMDB_MAP[rawId]?.tmdbId || rawId;
    }
    return rawId;
  }, [isAnime, media.tmdbId, rawId]);

  const currentServer = activeServers[selectedServerIndex] || activeServers[0];
  const streamUrl = isAnime
    ? currentServer.getUrl(
        resolvedMediaId,
        !isSeries,
        currentSeason,
        currentEpisode,
        media.title || media.name || ''
      )
    : currentServer.getUrl(
        resolvedMediaId,
        isSeries,
        currentSeason,
        currentEpisode
      );

  // Real-time playback progress tracking & auto-save
  const playbackSecondsRef = useRef(0);

  useEffect(() => {
    if (!resolvedMediaId || typeof saveProgress !== 'function') return;

    // Initialize from media progress if available
    playbackSecondsRef.current = Number(media.currentTime) || Number(media.resumeTime) || 0;

    const dur = isAnime
      ? 1440
      : (isSeries ? 2700 : (media.runtime ? Number(media.runtime) * 60 : 7200));

    const doSave = () => {
      if (typeof saveProgress !== 'function') return;
      const cur = playbackSecondsRef.current;
      const pct = Math.min(100, Math.max(1, Math.round((cur / dur) * 100)));
      saveProgress(
        resolvedMediaId,
        pct,
        null,
        isSeries ? currentSeason : null,
        isSeries ? currentEpisode : null,
        isAnime ? 'anime' : (isSeries ? 'tv' : 'movie'),
        media.title || media.name || 'Untitled',
        media.poster || media.backdrop || '',
        cur,
        dur
      );
    };

    // Initial save
    doSave();

    // 1-second elapsed ticker while player is open and tab is visible
    const timer = setInterval(() => {
      if (!document.hidden) {
        playbackSecondsRef.current += 1;
      }
    }, 1000);

    // 5-second persistence interval
    const persistInterval = setInterval(() => {
      doSave();
    }, 5000);

    // Message listener in case iframe reports exact time
    const handlePlayerMessage = (e) => {
      if (e.data && (e.data.type === 'timeupdate' || e.data.type === 'notflix_time_update')) {
        if (typeof e.data.currentTime === 'number' && e.data.currentTime > 0) {
          playbackSecondsRef.current = Math.floor(e.data.currentTime);
        }
      }
    };
    window.addEventListener('message', handlePlayerMessage);

    const handleBeforeUnload = () => {
      doSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      clearInterval(persistInterval);
      window.removeEventListener('message', handlePlayerMessage);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      doSave();
    };
  }, [
    resolvedMediaId,
    isSeries,
    isAnime,
    currentSeason,
    currentEpisode,
    saveProgress,
    media.title,
    media.name,
    media.poster,
    media.backdrop,
    media.runtime,
    media.currentTime,
    media.resumeTime
  ]);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else if (onClose) {
          onClose();
        }
      } else if (e.key.toLowerCase() === 'f' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'n' && isSeries && onNextEpisode) {
        onNextEpisode({
          episode_number: currentEpisode + 1,
          name: `Episode ${currentEpisode + 1}`,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, toggleFullscreen, isSeries, onNextEpisode, currentEpisode]);

  return (
    <div
      ref={playerContainerRef}
      className="fixed inset-0 z-[9995] bg-black flex flex-col select-none overflow-hidden animate-fade-in"
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-8 py-3 bg-gradient-to-b from-black/95 via-black/75 to-transparent pointer-events-auto">
        {/* Left: Back Button & Media Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
          <button
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 backdrop-blur-md transition cursor-pointer active:scale-95 shadow-xl shrink-0"
            title="Back / Close (Esc)"
          >
            <span className="material-symbols-outlined text-lg sm:text-xl">arrow_back</span>
          </button>

          <div className="flex flex-col text-left min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                {media.title || media.name}
              </h3>
              {isAnime ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#E50914] text-white shrink-0">
                  ANIME
                </span>
              ) : isSeries ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white/90 shrink-0">
                  TV
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white/90 shrink-0">
                  MOVIE
                </span>
              )}
            </div>
            {isSeries && (
              <span className="text-[11px] font-semibold text-[#E50914] flex items-center gap-1.5 truncate">
                <span>Season {currentSeason} • Episode {currentEpisode}</span>
                {media.episodeTitle && (
                  <span className="text-white/60 truncate max-w-[120px] sm:max-w-[200px]">
                    : {media.episodeTitle}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right: Sub/Dub Toggle (Anime Only), Server Switcher Pills, Next Episode, Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Sub / Dub Audio Toggle (Anime ONLY) */}
          {isAnime && (
            <div className="flex items-center bg-black/60 border border-white/15 rounded-xl p-0.5 sm:p-1 backdrop-blur-md shadow-lg shrink-0">
              <button
                onClick={() => {
                  if (audioMode !== 'sub') {
                    setAudioMode('sub');
                    setSelectedServerIndex(0);
                  }
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold uppercase transition cursor-pointer flex items-center gap-1 ${
                  audioMode === 'sub'
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Japanese Audio with English Subtitles"
              >
                <span className="material-symbols-outlined text-[12px] sm:text-[13px]">closed_caption</span>
                <span>SUB</span>
              </button>
              <button
                onClick={() => {
                  if (media?.dubCount === 0 || media?.dubCount === null) return;
                  if (audioMode !== 'dub') {
                    setAudioMode('dub');
                    setSelectedServerIndex(0);
                  }
                }}
                disabled={media?.dubCount === 0 || media?.dubCount === null}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold uppercase transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 ${
                  audioMode === 'dub'
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title={media?.dubCount === 0 || media?.dubCount === null ? "English Dub not available for this title" : "English Dubbed Audio"}
              >
                <span className="material-symbols-outlined text-[12px] sm:text-[13px]">mic</span>
                <span>DUB</span>
              </button>
            </div>
          )}

          {/* Server Switcher Pill Buttons */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-xl p-0.5 sm:p-1 backdrop-blur-md shadow-lg overflow-x-auto max-w-[160px] sm:max-w-[340px] md:max-w-none custom-scrollbar">
            {activeServers.map((srv, idx) => {
              const isSelected = idx === selectedServerIndex;
              return (
                <button
                  key={srv.id}
                  onClick={() => setSelectedServerIndex(idx)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#E50914] text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title={srv.name}
                >
                  <span>{srv.shortName || srv.name}</span>
                  {srv.badge && (
                    <span className="text-[8.5px] px-1 py-0.2 rounded font-black opacity-80 bg-white/20">
                      {srv.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Next Episode Button (TV Shows & Anime Series) */}
          {isSeries && onNextEpisode && (
            <button
              onClick={() => {
                onNextEpisode({
                  episode_number: currentEpisode + 1,
                  name: `Episode ${currentEpisode + 1}`,
                });
              }}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[11px] sm:text-xs font-bold backdrop-blur-md transition cursor-pointer active:scale-95 shadow-lg shrink-0"
              title="Next Episode (N)"
            >
              <span className="material-symbols-outlined text-sm sm:text-base">skip_next</span>
              <span className="hidden sm:inline">Next</span>
            </button>
          )}

          {/* Reload Button */}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer active:scale-95 shadow-lg shrink-0"
            title="Reload Stream"
          >
            <span className="material-symbols-outlined text-sm sm:text-base">refresh</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-white hidden sm:flex items-center justify-center backdrop-blur-md transition cursor-pointer active:scale-95 shadow-lg shrink-0"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
          >
            <span className="material-symbols-outlined text-sm sm:text-base">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Stream Iframe Container */}
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <iframe
          key={`${streamUrl}-${reloadKey}`}
          src={streamUrl}
          title={media.title || media.name || 'Video Player'}
          className="w-full h-full border-0 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="origin"
        />
      </div>
    </div>
  );
}

export { VideoPlayer };
