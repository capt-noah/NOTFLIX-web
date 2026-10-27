import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupabaseDB } from '../services/db';
import { NETFLIX_CLASSIC_AVATARS, DEFAULT_KIDS_AVATAR } from '../data/netflixAvatars';
import { notflixCatalog } from '../data/catalog';

const AppContext = createContext();

// Helper to create initial default profiles
const createDefaultProfiles = (initialName = 'User', avatarUrl = null) => [
    {
        id: 'p_main',
        name: initialName,
        avatar: avatarUrl || NETFLIX_CLASSIC_AVATARS[0].url,
        isKids: false,
        createdAt: Date.now()
    },
    {
        id: 'p_kids',
        name: 'Kids',
        avatar: DEFAULT_KIDS_AVATAR,
        isKids: true,
        createdAt: Date.now() + 1
    }
];

export const AppProvider = ({ children }) => {
    // Auth & User
    const [user, setUser] = useState(null);
    const [authModalOpen, setAuthModalOpen] = useState(false);

    // Multi-Profile State
    const [profiles, setProfiles] = useState(() => {
        try {
            const saved = localStorage.getItem('notflix_profiles_guest');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Error reading profiles:', e);
        }
        return createDefaultProfiles('Guest');
    });

    const [activeProfileId, setActiveProfileId] = useState(() => {
        try {
            const saved = localStorage.getItem('notflix_active_profile_id_guest');
            if (saved) return saved;
        } catch (e) {
            console.warn('Error reading active profile:', e);
        }
        return 'p_main';
    });

    // Profile Gate ("Who's Watching?") state - only triggered on first-time login or explicit user switch
    const [isProfileGateOpen, setIsProfileGateOpen] = useState(false);
    const [hasSelectedSessionProfile, setHasSelectedSessionProfile] = useState(true);
    const [profileGateMode, setProfileGateMode] = useState('select'); // 'select' | 'manage'

    // Data state
    const [watchlist, setWatchlist] = useState([]);
    const [continueWatching, setContinueWatching] = useState([]);

    // UI state
    const [settings, setSettings] = useState(SupabaseDB.getSettings());
    const [notifications, setNotifications] = useState([]);
    
    // Playback state
    const [currentMedia, setCurrentMedia] = useState(null);
    const [currentSource, setCurrentSource] = useState('direct'); 
    
    // Detail Modal state
    const [selectedDetail, setSelectedDetail] = useState(null);
    const openDetails = useCallback((media) => setSelectedDetail(media), []);
    const closeDetails = useCallback(() => setSelectedDetail(null), []);

    // Routing state
    const [currentRoute, setCurrentRoute] = useState(window.location.hash || '#/');

    // Ad Shield (blocks popups, popunders & redirects on streaming server iframes)
    const [adShield, setAdShield] = useState(() => {
        try {
            const saved = localStorage.getItem('notflix_ad_shield');
            return saved !== null ? saved === 'true' : true;
        } catch {
            return true;
        }
    });

    const toggleAdShield = () => {
        setAdShield(prev => {
            const next = !prev;
            try {
                localStorage.setItem('notflix_ad_shield', String(next));
            } catch (e) {
                console.error('Failed to save ad shield preference:', e);
            }
            return next;
        });
    };

    // Active profile object
    const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || {
        id: 'p_main',
        name: 'User',
        avatar: NETFLIX_CLASSIC_AVATARS[0].url,
        isKids: false
    };

    const profile = {
        username: activeProfile.name,
        avatar_url: activeProfile.avatar,
        isKids: Boolean(activeProfile.isKids)
    };

    // ─── INIT AUTH ───
    useEffect(() => {
        let isInitialLoad = true;

        // Get initial session on page load / reload
        SupabaseDB.getSession().then((session) => {
            setUser(session?.user || null);
            // Allow initial hydration to complete without firing first-time login gate
            setTimeout(() => {
                isInitialLoad = false;
            }, 600);
        }).catch(err => {
            console.error("Session error:", err);
            isInitialLoad = false;
        });

        // Listen for auth changes
        const { data: { subscription } } = SupabaseDB.onAuthStateChange((session) => {
            const newUser = session?.user || null;
            // Only trigger if NOT during initial page reload and a user has newly logged in
            if (!isInitialLoad && newUser) {
                const profileSelectedKey = `notflix_profile_selected_${newUser.id}`;
                if (!localStorage.getItem(profileSelectedKey)) {
                    setIsProfileGateOpen(true);
                    setHasSelectedSessionProfile(false);
                }
            }
            setUser(newUser);
        });

        return () => subscription?.unsubscribe();
    }, []);

    // ─── USER & PROFILES PERSISTENCE SYNC ───
    useEffect(() => {
        const userScope = user ? user.id : 'guest';
        const profilesKey = `notflix_profiles_${userScope}`;
        const activeKey = `notflix_active_profile_id_${userScope}`;

        let currentProfiles = [];
        try {
            const saved = localStorage.getItem(profilesKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    currentProfiles = parsed;
                }
            }
        } catch (e) {
            console.error('Error loading profiles:', e);
        }

        if (currentProfiles.length === 0) {
            const defaultName = user?.email ? user.email.split('@')[0] : (user ? 'User' : 'Guest');
            currentProfiles = createDefaultProfiles(defaultName);
            try {
                localStorage.setItem(profilesKey, JSON.stringify(currentProfiles));
            } catch (e) {
                console.error(e);
            }
        }

        let activeId = 'p_main';
        try {
            const savedActive = localStorage.getItem(activeKey);
            if (savedActive && currentProfiles.some(p => p.id === savedActive)) {
                activeId = savedActive;
            } else {
                activeId = currentProfiles[0]?.id || 'p_main';
            }
        } catch (e) {
            console.error(e);
        }

        Promise.resolve().then(() => {
            setProfiles(currentProfiles);
            setActiveProfileId(activeId);
        });

        // If user logged in, sync primary profile with Supabase profile
        if (user) {
            SupabaseDB.getProfile(user.id, user.email).then(p => {
                if (p) {
                    // Update primary profile name and avatar if needed
                    setProfiles(prev => {
                        const updated = [...prev];
                        if (updated[0]) {
                            updated[0] = {
                                ...updated[0],
                                name: p.username || updated[0].name,
                                avatar: p.avatar_url || updated[0].avatar
                            };
                            try {
                                localStorage.setItem(profilesKey, JSON.stringify(updated));
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        return updated;
                    });
                }
            });
        }
    }, [user]);

    // ─── LOAD DATA FOR ACTIVE PROFILE (Local + Supabase Cloud Sync) ───
    useEffect(() => {
        let active = true;
        const userScope = user ? user.id : 'guest';
        const currentProf = profiles.find(p => p.id === activeProfileId) || profiles[0];
        const isPrimaryProfile = currentProf?.id === 'p_main' || currentProf?.id === profiles[0]?.id;

        // 1. Load Watchlist
        const localWatchlistKey = `notflix_watchlist_${userScope}_${activeProfileId}`;
        let localWl = [];
        try {
            const saved = localStorage.getItem(localWatchlistKey);
            if (saved) localWl = JSON.parse(saved);
        } catch (e) {
            console.error(e);
        }

        if (user?.id && isPrimaryProfile) {
            SupabaseDB.getWatchlist(user.id).then(w => {
                if (active) {
                    // Merge local items with cloud items
                    const cloudMap = new Map((w || []).map(i => [String(i.id), i]));
                    for (const localItem of localWl) {
                        if (!cloudMap.has(String(localItem.id))) {
                            cloudMap.set(String(localItem.id), localItem);
                        }
                    }
                    const merged = Array.from(cloudMap.values());
                    setWatchlist(merged);
                    try {
                        localStorage.setItem(localWatchlistKey, JSON.stringify(merged));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }).catch(() => {
                if (active) setWatchlist(localWl);
            });
        } else {
            setWatchlist(localWl);
        }

        // 2. Load Continue Watching
        const sanitizeCwItem = (item) => {
            if (!item) return item;
            const isTv = item.type === 'tv' || item.media_type === 'tv' || item.type === 'anime';
            const rawTitle = item.title || item.t_title || item.name || item.original_title || item.original_name;
            let resolvedTitle = 'Untitled';
            if (typeof rawTitle === 'object' && rawTitle) {
                resolvedTitle = rawTitle.english || rawTitle.romaji || rawTitle.userPreferred || rawTitle.native || 'Untitled';
            } else if (typeof rawTitle === 'string' && rawTitle.trim()) {
                resolvedTitle = rawTitle.trim();
            }

            const rawPoster = item.poster || item.poster_path || item.backdrop || item.backdrop_path || item.p_path || item.b_path || item.coverImage?.large || item.image || '';

            return {
                ...item,
                title: resolvedTitle,
                poster: rawPoster,
                backdrop: rawPoster,
                poster_path: item.poster_path || rawPoster,
                backdrop_path: item.backdrop_path || rawPoster,
                season: isTv && item.season !== null && item.season !== undefined ? Number(item.season) : null,
                episode: isTv && item.episode !== null && item.episode !== undefined ? Number(item.episode) : null,
            };
        };

        const localCwKey = `notflix_cw_${userScope}_${activeProfileId}`;
        let localCw = [];
        try {
            const saved = localStorage.getItem(localCwKey);
            if (saved) localCw = (JSON.parse(saved) || []).map(sanitizeCwItem);
        } catch (e) {
            console.error(e);
        }

        if (user?.id && isPrimaryProfile) {
            SupabaseDB.getContinueWatching(user.id).then(cw => {
                if (active) {
                    // Merge local metadata (currentTime, duration) into DB continue watching
                    const merged = (cw || []).map(item => {
                        const match = localCw.find(l => String(l.id) === String(item.id));
                        const titleCandidate = (item.title && item.title !== 'Untitled' && item.title !== 'Untitled Title')
                            ? item.title
                            : (match?.title || item.title || 'Untitled');
                        const posterCandidate = (item.poster && item.poster.trim() && !item.poster.endsWith('/notflix-logo.png'))
                            ? item.poster
                            : (match?.poster || item.poster || '');

                        return sanitizeCwItem({
                            ...item,
                            title: titleCandidate,
                            poster: posterCandidate,
                            backdrop: posterCandidate,
                            currentTime: match?.currentTime || item.currentTime || 0,
                            duration: match?.duration || item.duration || (item.type === 'tv' ? 2700 : 7200),
                            percent: item.percent || match?.percent || 0
                        });
                    });
                    setContinueWatching(merged);
                    try {
                        localStorage.setItem(localCwKey, JSON.stringify(merged));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }).catch(() => {
                if (active) setContinueWatching(localCw);
            });
        } else {
            setContinueWatching(localCw);
        }

        return () => { active = false; };
    }, [user, activeProfileId, profiles]);

    // ─── APP SHELL FX ───
    useEffect(() => {
        const handleHashChange = () => {
            setCurrentRoute(window.location.hash || '#/');
            document.getElementById('notifications-panel')?.classList.add('hidden');
            window.scrollTo(0, 0);
        };
        window.addEventListener('hashchange', handleHashChange);
        
        if (settings.lightMode) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [settings.lightMode]);

    // ─── HELPERS ───
    const navigateTo = (hash) => {
        window.location.hash = hash;
    };

    const [isSyncing, setIsSyncing] = useState(false);

    const addNotification = useCallback((title, message, icon = "notifications") => {
        const newNotif = { id: Date.now(), icon, title, message, time: "Just now" };
        setNotifications(prev => [newNotif, ...prev]);

        const bell = document.getElementById('notification-bell-btn');
        if (bell) {
            bell.classList.add('text-primary-container', 'scale-110');
            setTimeout(() => bell.classList.remove('text-primary-container', 'scale-110'), 1000);
        }
    }, []);

    const clearNotifications = () => {
        setNotifications([]);
    };

    // ─── CLOUD SYNC & REFRESH ───
    const syncAllData = useCallback(async (showToast = true) => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            const userScope = user ? user.id : 'guest';
            const effectiveCloudUserId = user ? user.id : DEFAULT_CLOUD_USER_ID;
            const currentProf = profiles.find(p => p.id === activeProfileId) || profiles[0];
            const isPrimaryProfile = currentProf?.id === 'p_main' || currentProf?.id === profiles[0]?.id;

            // 1. Sync profile info
            if (user) {
                const p = await SupabaseDB.getProfile(user.id, user.email);
                if (p) {
                    setProfiles(prev => {
                        const updated = [...prev];
                        if (updated[0]) {
                            updated[0] = {
                                ...updated[0],
                                name: p.username || updated[0].name,
                                avatar: p.avatar_url || updated[0].avatar
                            };
                            try {
                                localStorage.setItem(`notflix_profiles_${user.id}`, JSON.stringify(updated));
                            } catch (e) {
                                console.error(e);
                            }
                        }
                        return updated;
                    });
                }
            }

            // 2. Sync Watchlist
            if (user?.id && isPrimaryProfile) {
                const w = await SupabaseDB.getWatchlist(user.id);
                if (w) {
                    setWatchlist(w);
                    try {
                        localStorage.setItem(`notflix_watchlist_${userScope}_${activeProfileId}`, JSON.stringify(w));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            // 3. Sync Continue Watching
            if (user?.id && isPrimaryProfile) {
                const cw = await SupabaseDB.getContinueWatching(user.id);
                if (cw) {
                    const sanitized = cw.map(item => ({
                        ...item,
                        season: item.type === 'tv' && item.season !== null && item.season !== undefined ? Number(item.season) : null,
                        episode: item.type === 'tv' && item.episode !== null && item.episode !== undefined ? Number(item.episode) : null,
                    }));
                    setContinueWatching(sanitized);
                    try {
                        localStorage.setItem(`notflix_cw_${userScope}_${activeProfileId}`, JSON.stringify(sanitized));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            if (showToast) {
                addNotification("Cloud Sync Complete", "Watch progress, watchlist, and catalog synchronized.", "cloud_done");
            }
        } catch (err) {
            console.error("Sync error:", err);
        } finally {
            setTimeout(() => setIsSyncing(false), 500);
        }
    }, [isSyncing, user, profiles, activeProfileId, addNotification]);

    // Global Command+R / Ctrl+R Keyboard Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
                // If user is inside an input field, allow standard behavior if desired, otherwise trigger smooth cloud sync
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                    return;
                }
                e.preventDefault();
                syncAllData(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [syncAllData]);

    // ─── PROFILE MANAGEMENT ACTIONS ───
    const openProfileGate = useCallback((mode = 'select') => {
        setProfileGateMode(mode);
        setIsProfileGateOpen(true);
    }, []);

    const closeProfileGate = useCallback(() => {
        setIsProfileGateOpen(false);
    }, []);

    const switchProfile = useCallback((profileId) => {
        const target = profiles.find(p => p.id === profileId);
        if (!target) return;
        const userScope = user ? user.id : 'guest';
        setActiveProfileId(profileId);
        try {
            localStorage.setItem(`notflix_active_profile_id_${userScope}`, profileId);
            localStorage.setItem(`notflix_profile_selected_${userScope}`, 'true');
        } catch (e) {
            console.error(e);
        }
        setHasSelectedSessionProfile(true);
        setIsProfileGateOpen(false);
        addNotification('Profile Switched', `Welcome back, ${target.name}!`, 'account_circle');
    }, [profiles, user, addNotification]);

    const createProfile = useCallback(({ name, avatar, isKids = false }) => {
        if (profiles.length >= 5) {
            addNotification('Limit Reached', 'You can have a maximum of 5 profiles.', 'warning');
            return null;
        }
        const userScope = user ? user.id : 'guest';
        const newProfile = {
            id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: name.trim() || 'New Profile',
            avatar: avatar || (isKids ? DEFAULT_KIDS_AVATAR : NETFLIX_CLASSIC_AVATARS[0].url),
            isKids: Boolean(isKids),
            createdAt: Date.now()
        };

        const updated = [...profiles, newProfile];
        setProfiles(updated);
        try {
            localStorage.setItem(`notflix_profiles_${userScope}`, JSON.stringify(updated));
        } catch (e) {
            console.error(e);
        }
        addNotification('Profile Created', `Profile "${newProfile.name}" was added.`, 'add_circle');
        return newProfile;
    }, [profiles, user, addNotification]);

    const updateProfileData = useCallback(async (profileId, updates) => {
        const userScope = user ? user.id : 'guest';
        let updatedList = [];
        let updatedItem = null;

        setProfiles(prev => {
            updatedList = prev.map(p => {
                if (p.id === profileId) {
                    updatedItem = { ...p, ...updates };
                    return updatedItem;
                }
                return p;
            });
            try {
                localStorage.setItem(`notflix_profiles_${userScope}`, JSON.stringify(updatedList));
            } catch (e) {
                console.error(e);
            }
            return updatedList;
        });

        // If primary profile and user is logged in, sync with Supabase
        const isPrimary = profileId === 'p_main' || profileId === profiles[0]?.id;
        if (user && isPrimary && (updates.name || updates.avatar)) {
            try {
                await SupabaseDB.updateProfile(user.id, updates.name || profile.username, updates.avatar || profile.avatar_url);
            } catch (e) {
                console.error('Supabase profile sync error:', e);
            }
        }

        return updatedItem;
    }, [user, profiles, profile.username, profile.avatar_url]);

    const deleteProfile = useCallback((profileId) => {
        if (profiles.length <= 1) {
            addNotification('Action Blocked', 'You must keep at least one profile.', 'warning');
            return false;
        }
        const userScope = user ? user.id : 'guest';
        const target = profiles.find(p => p.id === profileId);
        const filtered = profiles.filter(p => p.id !== profileId);
        
        setProfiles(filtered);
        try {
            localStorage.setItem(`notflix_profiles_${userScope}`, JSON.stringify(filtered));
            localStorage.removeItem(`notflix_watchlist_${userScope}_${profileId}`);
            localStorage.removeItem(`notflix_cw_${userScope}_${profileId}`);
        } catch (e) {
            console.error(e);
        }

        // If deleted profile was active, switch to first available profile
        if (activeProfileId === profileId) {
            const nextActiveId = filtered[0].id;
            setActiveProfileId(nextActiveId);
            try {
                localStorage.setItem(`notflix_active_profile_id_${userScope}`, nextActiveId);
            } catch (e) {
                console.error(e);
            }
        }

        addNotification('Profile Deleted', `Profile "${target?.name || ''}" was removed.`, 'delete');
        return true;
    }, [profiles, user, activeProfileId, addNotification]);

    // Legacy updateProfile for compatibility with existing profile components
    const updateProfile = useCallback(async (username, avatar_url) => {
        return updateProfileData(activeProfileId, { name: username, avatar: avatar_url });
    }, [updateProfileData, activeProfileId]);

    // ─── WATCHLIST ACTIONS (Profile-Scoped) ───
    const toggleWatchlist = useCallback(async (mediaId, mediaType = 'movie', posterPath = '', title = '', rating = null) => {
        const userScope = user ? user.id : 'guest';
        const localWatchlistKey = `notflix_watchlist_${userScope}_${activeProfileId}`;
        const strId = String(mediaId);

        let added = false;
        setWatchlist(prev => {
            const exists = prev.some(item => String(item.id) === strId);
            let updated;
            if (exists) {
                updated = prev.filter(item => String(item.id) !== strId);
                addNotification('Removed from List', `"${title}" removed from your Watchlist.`, 'bookmark');
                added = false;
            } else {
                const newItem = {
                    id: strId,
                    type: mediaType,
                    poster: posterPath,
                    title: title || 'Untitled',
                    rating: rating
                };
                updated = [newItem, ...prev];
                addNotification('Added to List', `"${title}" saved to your Watchlist.`, 'bookmark');
                added = true;
            }
            try {
                localStorage.setItem(localWatchlistKey, JSON.stringify(updated));
            } catch (e) {
                console.error(e);
            }
            return updated;
        });

        // Sync to Supabase Cloud
        const isPrimary = activeProfileId === 'p_main' || activeProfileId === profiles[0]?.id;
        if (user?.id && isPrimary) {
            SupabaseDB.toggleWatchlist(user.id, mediaId, mediaType, posterPath, title, rating).catch(err => {
                console.error('Watchlist cloud sync error:', err);
            });
        }

        return added;
    }, [user, activeProfileId, profiles, addNotification]);

    // ─── CONTINUE WATCHING (Profile-Scoped & Auto-Resume) ───
    const saveProgress = useCallback(async (mediaId, percent, _remaining = null, season = null, episode = null, type = null, title = '', poster = '', currentTime = 0, duration = 0) => {
        void _remaining;
        if (!mediaId) return;
        const userScope = user ? user.id : 'guest';
        const localCwKey = `notflix_cw_${userScope}_${activeProfileId}`;
        const strId = String(mediaId);
        const resolvedType = type || currentMedia?.type || 'movie';
        
        let resolvedTitle = 'Untitled';
        if (typeof title === 'object' && title) {
            resolvedTitle = title.english || title.romaji || title.userPreferred || title.native || 'Untitled';
        } else if (typeof title === 'string' && title.trim() && title !== 'Untitled' && title !== 'Untitled Title') {
            resolvedTitle = title.trim();
        } else {
            const fallbackTitle = currentMedia?.title || currentMedia?.name || currentMedia?.original_title;
            if (typeof fallbackTitle === 'object' && fallbackTitle) {
                resolvedTitle = fallbackTitle.english || fallbackTitle.romaji || fallbackTitle.userPreferred || 'Untitled';
            } else if (typeof fallbackTitle === 'string' && fallbackTitle.trim()) {
                resolvedTitle = fallbackTitle.trim();
            }
        }

        let resolvedPoster = poster || currentMedia?.poster || currentMedia?.backdrop || currentMedia?.poster_path || currentMedia?.backdrop_path || currentMedia?.coverImage?.large || currentMedia?.image || '';
        if (typeof resolvedPoster === 'string') {
            resolvedPoster = resolvedPoster.trim();
        }

        const boundedPercent = Math.min(100, Math.max(0, Math.round(percent || 0)));
        const isTv = resolvedType === 'tv' || resolvedType === 'anime';

        setContinueWatching(prev => {
            const existing = prev.find(item => String(item.id) === strId);
            // If existing item had a valid title/poster and the new one is empty/Untitled, preserve existing
            if (resolvedTitle === 'Untitled' && existing?.title && existing.title !== 'Untitled' && existing.title !== 'Untitled Title') {
                resolvedTitle = existing.title;
            }
            if ((!resolvedPoster || resolvedPoster === '/notflix-logo.png') && existing?.poster && existing.poster !== '/notflix-logo.png') {
                resolvedPoster = existing.poster;
            }

            const entry = {
                id: strId,
                type: resolvedType,
                title: resolvedTitle,
                poster: resolvedPoster,
                backdrop: resolvedPoster,
                poster_path: resolvedPoster,
                backdrop_path: resolvedPoster,
                percent: boundedPercent,
                season: isTv && season !== null ? Number(season) : null,
                episode: isTv && episode !== null ? Number(episode) : null,
                currentTime: currentTime ? Math.floor(currentTime) : 0,
                duration: duration ? Math.floor(duration) : 0,
                lastWatched: new Date().toISOString()
            };

            const filtered = prev.filter(item => String(item.id) !== strId);
            const updated = [entry, ...filtered];
            try {
                localStorage.setItem(localCwKey, JSON.stringify(updated));
            } catch (e) {
                console.error(e);
            }
            return updated;
        });

        // Sync to Supabase Cloud only if authenticated
        const isPrimary = activeProfileId === 'p_main' || activeProfileId === profiles[0]?.id;
        if (user?.id && isPrimary) {
            SupabaseDB.saveProgress(user.id, mediaId, resolvedType === 'anime' ? 'tv' : resolvedType, resolvedTitle, resolvedPoster, boundedPercent, isTv ? season : null, isTv ? episode : null, resolvedPoster).catch(err => {
                console.error("Failed to sync progress to cloud:", err);
            });
        }
    }, [user, activeProfileId, profiles, currentMedia]);

    const removeFromContinueWatching = useCallback(async (mediaId) => {
        const userScope = user ? user.id : 'guest';
        const localCwKey = `notflix_cw_${userScope}_${activeProfileId}`;
        const strId = String(mediaId);

        setContinueWatching(prev => {
            const filtered = prev.filter(item => String(item.id) !== strId);
            try {
                localStorage.setItem(localCwKey, JSON.stringify(filtered));
            } catch (e) {
                console.error(e);
            }
            return filtered;
        });

        const isPrimary = activeProfileId === 'p_main' || activeProfileId === profiles[0]?.id;
        if (user?.id && isPrimary) {
            SupabaseDB.removeContinueWatchingItem(user.id, mediaId).catch(e => {
                console.error('Error removing from Continue Watching in cloud:', e);
            });
        }
    }, [user, activeProfileId, profiles]);
    
    // Auto-Resume playback launcher
    const playMedia = useCallback((media) => {
        if (!media) return;

        // Calculate resume time in seconds if continuing
        let resumeTime = 0;
        if (media.resumeTime !== undefined && media.resumeTime !== null) {
            resumeTime = Number(media.resumeTime) || 0;
        } else if (media.currentTime && media.currentTime > 5) {
            resumeTime = media.currentTime;
        } else if (media.percent && media.percent > 2 && media.percent < 95) {
            const totalSecs = media.duration || 5400;
            resumeTime = Math.floor((media.percent / 100) * totalSecs);
        }

        const isAnime = Boolean(
            media.isAnime ||
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

        const isTv = !media.isMovie && (
            media.type === 'tv' ||
            media.media_type === 'tv' ||
            Boolean(media.season) ||
            Boolean(media.first_air_date) ||
            Boolean(media.seasons) ||
            (isAnime && media.format !== 'MOVIE' && !media.isMovie)
        );

        const catalogMatch = notflixCatalog.find(c => String(c.id) === String(media.id));

        const cleanMedia = { ...media };
        delete cleanMedia.currentTime;
        delete cleanMedia.resumeTime;

        const mediaToPlay = {
            ...cleanMedia,
            id: String(media.id),
            isAnime,
            type: isAnime ? 'anime' : (isTv ? 'tv' : 'movie'),
            title: media.title || media.name || catalogMatch?.title || 'Untitled',
            poster: media.poster || media.backdrop || media.poster_path || media.backdrop_path || catalogMatch?.poster || '',
            backdrop: media.backdrop || media.poster || media.backdrop_path || media.poster_path || catalogMatch?.backdrop || '',
            season: isTv ? (media.season || 1) : null,
            episode: isTv ? (media.episode || 1) : null,
            episodeTitle: media.episodeTitle || media.episode_title || null,
            trailer: media.trailer || catalogMatch?.trailer || null,
            currentTime: resumeTime,
            resumeTime: resumeTime,
            autoPlay: true
        };

        setCurrentMedia(mediaToPlay);
    }, []);

    const closePlayer = useCallback(() => {
        setCurrentMedia(null);
    }, []);

    const updateSettings = useCallback((newSettings) => {
        const updated = SupabaseDB.saveSettings(newSettings);
        setSettings(updated);
        return updated;
    }, []);

    return (
        <AppContext.Provider value={{
            user,
            profile,
            profiles,
            activeProfile,
            activeProfileId,
            isProfileGateOpen,
            hasSelectedSessionProfile,
            profileGateMode,
            openProfileGate,
            closeProfileGate,
            switchProfile,
            createProfile,
            updateProfileData,
            deleteProfile,
            watchlist,
            continueWatching,
            settings,
            notifications,
            currentMedia,
            currentSource,
            currentRoute,
            authModalOpen,
            setAuthModalOpen,
            navigateTo,
            updateProfile,
            toggleWatchlist,
            saveProgress,
            addNotification,
            updateSettings,
            playMedia,
            closePlayer,
            removeFromContinueWatching,
            setCurrentSource,
            clearNotifications,
            adShield,
            toggleAdShield,
            isSyncing,
            syncAllData,
            selectedDetail,
            setSelectedDetail,
            openDetails,
            closeDetails
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
export default AppContext;
