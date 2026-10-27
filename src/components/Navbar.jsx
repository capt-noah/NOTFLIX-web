import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import AvatarIcon from './AvatarIcon';
import TMDBService from '../services/tmdb';

export default function Navbar() {
  const {
    currentRoute = '#/',
    navigateTo,
    activeProfile,
    openProfileGate,
    openDetails,
    setSelectedDetail,
    setCurrentMedia,
    notifications = [],
    clearNotifications,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);

  // Derive active tab from currentRoute
  const getActiveTab = () => {
    const route = currentRoute.replace(/^#\/?/, '').split('?')[0];
    if (!route || route === '') return 'home';
    if (route.startsWith('movies')) return 'movies';
    if (route.startsWith('tv') || route.startsWith('series')) return 'series';
    if (route.startsWith('anime')) return 'anime';
    if (route.startsWith('for-you')) return 'forYou';
    if (route.startsWith('watchlist')) return 'watchlist';
    return '';
  };

  const activeTab = getActiveTab();

  // Track scroll for subtle navbar opacity transition
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Debounced search
  useEffect(() => {
    const query = (searchQuery || '').trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await TMDBService.searchMulti(query);
        setSearchResults((results || []).slice(0, 8));
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setIsSearchOpen(false);
      navigateTo?.(`#/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navTabs = [
    { id: 'home', label: 'Home', path: '#/' },
    { id: 'movies', label: 'Movies', path: '#/movies' },
    { id: 'series', label: 'TV Shows', path: '#/tv' },
    { id: 'anime', label: 'Anime', path: '#/anime' },
    { id: 'forYou', label: 'For You', path: '#/for-you' },
    { id: 'watchlist', label: 'Watchlist', path: '#/watchlist' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 select-none">
      {/* Top Gradient Cinema Scrim */}
      <div className="absolute inset-0 h-28 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />

      {/* Main Navbar Bar */}
      <div
        className={`relative z-10 flex items-center justify-between px-4 sm:px-8 py-3.5 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#0a0a0c]/85 backdrop-blur-xl shadow-2xl'
            : 'bg-transparent'
        }`}
      >
        {/* Left Section: Logo */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              navigateTo?.('#/');
              setSearchQuery('');
            }}
            className="group relative cursor-pointer focus:outline-none"
          >
            <span
              className="text-2xl sm:text-3xl font-extrabold tracking-[0.15em] text-[#E50914] uppercase transition-all duration-300 drop-shadow-[0_0_12px_rgba(229,9,20,0.6)] group-hover:drop-shadow-[0_0_20px_rgba(229,9,20,0.95)]"
              style={{ fontFamily: "'Monoton', 'Outfit', sans-serif" }}
            >
              NotFlix
            </span>
          </button>
        </div>

        {/* Center Section: Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-inner">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  navigateTo?.(tab.path);
                  setSearchQuery('');
                }}
                className={`relative px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-white bg-white/15 border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Utilities (Search, Sync, Notifications, Profile) */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Search Bar */}
          <div ref={searchRef} className="relative">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 ${
                isSearchOpen || searchQuery
                  ? 'w-48 sm:w-64 bg-[#141418] border-white/30 shadow-lg'
                  : 'w-9 sm:w-36 bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-lg text-white/60 shrink-0">search</span>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search catalog..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-white/40 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Instant Search Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-12 right-0 w-80 sm:w-96 bg-[#121216]/98 border border-white/15 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl z-50 animate-fade-in max-h-[420px] overflow-y-auto custom-scrollbar">
                <div className="px-3 py-2 text-[11px] font-bold text-white/50 uppercase tracking-wider border-b border-white/10">
                  Search Results
                </div>
                <div className="divide-y divide-white/5">
                  {searchResults.map((item) => (
                    <div
                      key={`${item.media_type || 'media'}-${item.id}`}
                      onClick={() => {
                        if (openDetails) openDetails(item);
                        else if (setSelectedDetail) setSelectedDetail(item);
                        else if (setCurrentMedia) setCurrentMedia(item);
                        setIsSearchOpen(false);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 cursor-pointer transition"
                    >
                      <img
                        src={TMDBService.getImageUrl(item.poster_path || item.backdrop_path, 'w92')}
                        alt={item.title || item.name}
                        className="w-10 h-14 object-cover rounded-md bg-white/5 shrink-0"
                        onError={(e) => {
                          e.target.src = '/notflix-logo.png';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.title || item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/50">
                          <span>{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || 'N/A'}</span>
                          <span>•</span>
                          <span className="capitalize">{item.media_type || 'Movie'}</span>
                          {item.vote_average > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-yellow-400 font-bold">★ {item.vote_average.toFixed(1)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition cursor-pointer relative ${
                showNotifications
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-lg">notifications</span>
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-black text-white bg-[#E50914] rounded-full shadow-md">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div className="absolute top-12 right-0 w-80 bg-[#121216]/98 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl z-50 animate-fade-in overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-[11px] font-bold text-[#E50914] hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-white/5 custom-scrollbar p-2">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-white/40 text-xs">
                      <span className="material-symbols-outlined text-2xl mb-1 block opacity-40">notifications_off</span>
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((notif, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl hover:bg-white/5 transition flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-[#E50914]/15 text-[#E50914] shrink-0">
                          <span className="material-symbols-outlined text-base">
                            {notif.icon || 'notifications'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-white">{notif.title}</h5>
                          <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">{notif.message}</p>
                          <span className="text-[9px] text-white/40 block mt-1">{notif.time || 'Just now'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Settings Link / Avatar */}
          {activeProfile && (
            <button
              onClick={() => navigateTo?.('#/settings')}
              title={`Profile & Settings (${activeProfile.name})`}
              className="cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none"
            >
              <AvatarIcon
                avatarIdOrUrl={activeProfile.avatar}
                size={36}
                className="border-2 border-white/30 hover:border-white shadow-md"
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export { Navbar };
