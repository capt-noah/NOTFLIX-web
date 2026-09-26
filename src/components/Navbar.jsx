import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { TMDBService, normalizeListResponse } from '../services/tmdb';
import { SupabaseDB } from '../services/db';
import debounce from 'lodash/debounce';

const NAV_TABS = [
    { id: 'home', label: 'Home', path: '#/' },
    { id: 'movies', label: 'Movies', path: '#/movies' },
    { id: 'tv', label: 'Series', path: '#/tv' },
    { id: 'for-you', label: 'For You', path: '#/for-you' },
    { id: 'watchlist', label: 'My List', path: '#/watchlist' },
    { id: 'history', label: 'History', path: '#/settings/history' },
];

export const Navbar = () => {
    const { 
        profile, 
        profiles,
        activeProfile,
        switchProfile,
        openProfileGate,
        user,
        setAuthModalOpen,
        notifications, 
        clearNotifications, 
        currentRoute, 
        navigateTo,
        isSyncing,
        syncAllData
    } = useApp();
    const { t } = useLanguage();
    
    const [searchVal, setSearchVal] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const notificationsRef = useRef(null);
    const profileMenuRef = useRef(null);

    // Search autocomplete state
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchContainerRef = useRef(null);

    // Sync search input if URL hash changes
    const [prevRoute, setPrevRoute] = useState(currentRoute);
    if (prevRoute !== currentRoute) {
        setPrevRoute(currentRoute);
        if (!currentRoute.startsWith('#/search')) {
            setSearchVal('');
        } else {
            const queryParams = new URLSearchParams(currentRoute.split('?')[1] || '');
            const q = queryParams.get('q');
            if (q) setSearchVal(q);
        }
    }

    // Close popups on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
                setShowProfileMenu(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search suggestions query
    const fetchSuggestions = useMemo(
        () => debounce(async (q) => {
            if (!q || q.length < 2) {
                setSuggestions([]);
                return;
            }
            setIsSearching(true);
            try {
                const results = normalizeListResponse(await TMDBService.searchMedia(q, { type: 'all' }));
                setSuggestions(results.slice(0, 8));
            } catch (error) {
                console.error(error);
            } finally {
                setIsSearching(false);
            }
        }, 350),
        []
    );

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchVal(val);
        setShowSuggestions(true);
        fetchSuggestions(val);
    };

    const handleSearchSubmit = (e) => {
        if (e.key === 'Enter') {
            setShowSuggestions(false);
            const query = searchVal.trim();
            if (query) {
                navigateTo(`#/search?q=${encodeURIComponent(query)}`);
            } else {
                navigateTo('#/search');
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const getActiveTabId = () => {
        const cleanPath = currentRoute.replace('#', '') || '/';
        if (cleanPath === '/' || cleanPath.startsWith('/movie/') || cleanPath.startsWith('/tv/')) return 'home';
        if (cleanPath.startsWith('/movies')) return 'movies';
        if (cleanPath.startsWith('/tv')) return 'tv';
        if (cleanPath.startsWith('/for-you')) return 'for-you';
        if (cleanPath.startsWith('/watchlist')) return 'watchlist';
        if (cleanPath.startsWith('/settings/history')) return 'history';
        return '';
    };

    const activeTabId = getActiveTabId();

    return (
        <>
            {/* Authentic Top Cinema Scrim Gradient */}
            <div className="fixed top-0 left-0 right-0 h-36 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-none z-40" />

            {/* Desktop & Mobile Main Header */}
            <header className="sticky top-0 w-full z-40 transition-all duration-300">
                <nav className="flex items-center justify-between px-4 md:px-8 h-20 max-w-7xl mx-auto">
                    
                    {/* ── 1. LOGO SECTION ── */}
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={() => navigateTo('#/')}
                            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                        >
                            <span className="text-2xl sm:text-3xl font-black tracking-tighter text-red-600 drop-shadow-[0_0_15px_rgba(229,9,20,0.6)] group-hover:scale-105 transition-transform duration-200">
                                NOTFLIX
                            </span>
                        </button>
                    </div>

                    {/* ── 2. CENTERED FLOATING SLIDING PILL NAVIGATION TABS ── */}
                    <div className="hidden lg:flex items-center bg-[#141418]/80 border border-white/10 p-1 rounded-full backdrop-blur-xl shadow-2xl">
                        {NAV_TABS.map(tab => {
                            const isActive = activeTabId === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => navigateTo(tab.path)}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                                        isActive
                                            ? 'text-white bg-white/15 border border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                                            : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── 3. RIGHT UTILITY SECTION ── */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        
                        {/* 240px Fixed-Width Glass Search Bar */}
                        <div className="relative flex items-center" ref={searchContainerRef}>
                            <div className="flex items-center w-36 sm:w-60 bg-black/40 border border-white/10 hover:border-white/25 focus-within:border-red-500 rounded-full px-3 py-1.5 backdrop-blur-md transition-all">
                                <span className="material-symbols-outlined text-lg text-white/50 shrink-0">search</span>
                                <input
                                    id="navbar-search-input"
                                    type="text"
                                    value={searchVal}
                                    onChange={handleSearchChange}
                                    onKeyDown={handleSearchSubmit}
                                    placeholder="Search titles, actors..."
                                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-white/40 ml-2"
                                />
                                {searchVal && (
                                    <button 
                                        onClick={() => { setSearchVal(''); setSuggestions([]); }} 
                                        className="text-white/50 hover:text-white flex items-center p-0.5 transition-colors cursor-pointer"
                                        title="Clear search"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                )}
                            </div>

                            {/* Autocomplete Dropdown Popup */}
                            {showSuggestions && searchVal.length >= 2 && (
                                <div className="absolute top-full mt-3 right-0 w-[85vw] max-w-[340px] max-h-[420px] overflow-y-auto bg-[#141418]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 backdrop-blur-2xl text-white custom-scrollbar animate-fade-in p-2">
                                    {isSearching ? (
                                        <div className="flex justify-center items-center py-6">
                                            <div className="w-6 h-6 border-2 border-white/20 border-t-red-600 rounded-full animate-spin"></div>
                                        </div>
                                    ) : suggestions.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {suggestions.map(item => (
                                                <div 
                                                    key={item.id}
                                                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group" 
                                                    onClick={() => { 
                                                        setShowSuggestions(false); 
                                                        setSearchVal('');
                                                        navigateTo(`#/${item.type}/${item.id}`); 
                                                    }}
                                                >
                                                    <img 
                                                        src={item.poster || 'https://via.placeholder.com/48x64?text=No+Img'} 
                                                        alt={item.title} 
                                                        className="w-10 h-14 object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform shrink-0" 
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                                                        <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1">
                                                            <span className="uppercase font-semibold text-red-500">{item.type}</span>
                                                            {item.year && <span>• {item.year}</span>}
                                                            {item.rating > 0 && <span className="text-amber-400 font-bold">★ {Number(item.rating).toFixed(1)}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button 
                                                className="p-2 text-center text-xs font-bold text-red-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setShowSuggestions(false);
                                                    navigateTo(`#/search?q=${encodeURIComponent(searchVal)}`);
                                                }}
                                            >
                                                See all results for "{searchVal}"
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-xs text-white/40">
                                            No results found for "{searchVal}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Dedicated Cloud Sync Status Button */}
                        <button
                            onClick={() => syncAllData(true)}
                            disabled={isSyncing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                                isSyncing
                                    ? 'bg-red-600/20 border-red-500/60 text-white'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/80 hover:text-white'
                            }`}
                            title="Sync Cloud Data & Reload Catalog"
                        >
                            <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin text-red-500' : 'text-white/70'}`}>
                                sync
                            </span>
                            <span className="hidden md:inline text-[11px]">
                                {isSyncing ? 'Syncing...' : 'Sync'}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        </button>

                        {/* Notifications Bell Dropdown */}
                        <div className="relative" ref={notificationsRef}>
                            <button 
                                onClick={() => {
                                    setShowNotifications(!showNotifications);
                                    setShowProfileMenu(false);
                                }}
                                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer relative active:scale-95"
                                title="Notifications"
                            >
                                <span className="material-symbols-outlined text-lg">notifications</span>
                                {notifications.length > 0 && (
                                    <span className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-md">
                                        {notifications.length}
                                    </span>
                                )}
                            </button>

                            {/* Notifications Panel */}
                            {showNotifications && (
                                <div className="absolute top-full mt-3 right-0 w-80 max-h-96 overflow-y-auto bg-[#141418]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 backdrop-blur-2xl text-white custom-scrollbar animate-fade-in p-3 space-y-2">
                                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                                        {notifications.length > 0 && (
                                            <button 
                                                onClick={clearNotifications}
                                                className="text-[10px] text-red-500 hover:text-red-400 font-bold cursor-pointer"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>

                                    {notifications.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {notifications.map((n, i) => (
                                                <div key={i} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex gap-2.5 items-start">
                                                    <span className="material-symbols-outlined text-base text-red-500 mt-0.5">
                                                        {n.icon || 'info'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="text-xs font-bold text-white">{n.title}</h5>
                                                        <p className="text-[11px] text-white/60 mt-0.5 leading-snug">{n.message}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-xs text-white/40">
                                            No new notifications
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Profile Avatar Menu */}
                        <div className="relative" ref={profileMenuRef}>
                            <button 
                                onClick={() => {
                                    setShowProfileMenu(!showProfileMenu);
                                    setShowNotifications(false);
                                }}
                                className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 hover:border-white/40 transition cursor-pointer active:scale-95 shadow-md flex items-center justify-center bg-neutral-900"
                                title={activeProfile?.name || 'Profile'}
                            >
                                <img 
                                    src={activeProfile?.avatar} 
                                    alt={activeProfile?.name || 'User'} 
                                    className="w-full h-full object-cover" 
                                />
                            </button>

                            {/* Profile Dropdown Menu */}
                            {showProfileMenu && (
                                <div className="absolute top-full mt-3 right-0 w-64 bg-[#141418]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] z-50 backdrop-blur-2xl text-white custom-scrollbar animate-fade-in p-2 space-y-1">
                                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                                        <div className="text-xs font-bold text-white truncate">{activeProfile?.name}</div>
                                        <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                                            {user ? `Cloud: ${user.email}` : 'Local Obsidian Profile'}
                                        </div>
                                    </div>

                                    {/* Profile Quick Switcher */}
                                    {profiles.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                switchProfile(p.id);
                                                setShowProfileMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                p.id === activeProfile?.id
                                                    ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <img src={p.avatar} alt={p.name} className="w-5 h-5 rounded object-cover" />
                                                <span className="truncate">{p.name}</span>
                                            </div>
                                            {p.id === activeProfile?.id && (
                                                <span className="material-symbols-outlined text-base text-red-500">check</span>
                                            )}
                                        </button>
                                    ))}

                                    <div className="border-t border-white/10 pt-1 mt-1 space-y-0.5">
                                        <button
                                            onClick={() => {
                                                setShowProfileMenu(false);
                                                openProfileGate();
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-base text-white/60">group</span>
                                            <span>Manage Profiles</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setShowProfileMenu(false);
                                                navigateTo('#/settings');
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-base text-white/60">settings</span>
                                            <span>Settings & Audio</span>
                                        </button>

                                        {user ? (
                                            <button
                                                onClick={async () => {
                                                    setShowProfileMenu(false);
                                                    await SupabaseDB.signOut();
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-600/10 flex items-center gap-2.5 transition cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">logout</span>
                                                <span>Sign Out</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setShowProfileMenu(false);
                                                    setAuthModalOpen(true);
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-600/10 flex items-center gap-2.5 transition cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">cloud_sync</span>
                                                <span>Sign In to Cloud</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Mobile Bottom Navigation Bar */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0f]/95 border-t border-white/10 backdrop-blur-xl px-4 py-2 flex items-center justify-around shadow-2xl">
                    {NAV_TABS.map(tab => {
                        const isActive = activeTabId === tab.id;
                        const iconMap = {
                            home: 'home',
                            movies: 'movie',
                            tv: 'tv',
                            'for-you': 'auto_awesome',
                            watchlist: 'bookmark',
                            history: 'history'
                        };
                        return (
                            <button
                                key={tab.id}
                                onClick={() => navigateTo(tab.path)}
                                className={`flex flex-col items-center gap-1 p-1 transition cursor-pointer ${
                                    isActive ? 'text-red-500 font-bold' : 'text-white/50 hover:text-white'
                                }`}
                            >
                                <span className="material-symbols-outlined text-xl">
                                    {iconMap[tab.id] || 'circle'}
                                </span>
                                <span className="text-[10px]">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </header>
        </>
    );
};
