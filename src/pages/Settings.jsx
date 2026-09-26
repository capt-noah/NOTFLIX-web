import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { SupabaseDB } from '../services/db';
import { HOSTED_BACKEND_URL } from '../services/api';
import { 
    NETFLIX_CLASSIC_AVATARS, 
    NETFLIX_CHARACTER_AVATARS, 
    NETFLIX_KIDS_AVATARS,
    DEFAULT_AVATAR,
    DEFAULT_KIDS_AVATAR
} from '../data/netflixAvatars';

/* ─────────────────────────────────────────────
   Obsidian Glass Toggle Switch
   ───────────────────────────────────────────── */
const ToggleSwitch = ({ on, onToggle, label = '' }) => (
    <button
        onClick={onToggle}
        aria-checked={on}
        aria-label={label}
        role="switch"
        className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0 ${
            on ? 'bg-red-600 shadow-[0_0_12px_rgba(229,9,20,0.5)]' : 'bg-white/20'
        }`}
    >
        <div
            className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                on ? 'translate-x-6' : 'translate-x-0'
            }`}
        />
    </button>
);

export const Settings = () => {
    const {
        settings,
        updateSettings,
        user,
        setAuthModalOpen,
        profiles,
        activeProfile,
        activeProfileId,
        switchProfile,
        updateProfileData,
        createProfile,
        deleteProfile,
        continueWatching,
        removeFromHistory,
        playMedia,
        addNotification,
        navigateTo,
        adShield,
        toggleAdShield,
    } = useApp();
    const { t, language, changeLanguage } = useLanguage();

    // ── Navigation Tab State ──
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'account' | 'playback' | 'subtitles' | 'activity'

    // ── Profile Editor State ──
    const [editingProfileId, setEditingProfileId] = useState(activeProfileId || profiles[0]?.id || 'p_main');
    const targetProfile = profiles.find(p => p.id === editingProfileId) || activeProfile || profiles[0] || {
        id: 'p_main',
        name: 'Noah',
        avatar: DEFAULT_AVATAR,
        isKids: false
    };

    const [displayName, setDisplayName] = useState(targetProfile.name || '');
    const [avatarUrl, setAvatarUrl] = useState(targetProfile.avatar || DEFAULT_AVATAR);
    const [isKids, setIsKids] = useState(Boolean(targetProfile.isKids));
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [activeAvatarTab, setActiveAvatarTab] = useState('classics');
    const [showAddProfileModal, setShowAddProfileModal] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileIsKids, setNewProfileIsKids] = useState(false);
    const fileInputRef = useRef(null);

    // Sync profile state when changing selected profile
    const [prevProfileId, setPrevProfileId] = useState(editingProfileId);
    if (editingProfileId !== prevProfileId) {
        setPrevProfileId(editingProfileId);
        setDisplayName(targetProfile.name || '');
        setAvatarUrl(targetProfile.avatar || DEFAULT_AVATAR);
        setIsKids(Boolean(targetProfile.isKids));
    }

    // ── Local Settings State ──
    const [lightTheme, setLightTheme] = useState(settings.lightMode || false);
    const [autoPlayNext, setAutoPlayNext] = useState(settings.autoPlayNext ?? true);
    const [autoPlayPreviews, setAutoPlayPreviews] = useState(settings.autoPlayPreviews ?? true);
    const [streamQuality, setStreamQuality] = useState(settings.streamQuality || 'high');
    
    // Subtitle Customizer State
    const [subtitleFont, setSubtitleFont] = useState(settings.subtitleFont || 'sans');
    const [subtitleSize, setSubtitleSize] = useState(settings.subtitleSize || 'medium');
    const [subtitleColor, setSubtitleColor] = useState(settings.subtitleColor || '#FFFFFF');
    const [subtitleBg, setSubtitleBg] = useState(settings.subtitleBg || 'rgba(0,0,0,0.75)');

    // Delete Account / Wipe Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleThemeToggle = () => {
        const next = !lightTheme;
        setLightTheme(next);
        updateSettings({ lightMode: next });
        addNotification(
            t?.settings?.themeChanged || 'Theme Changed',
            `Switched to ${next ? 'Light' : 'Dark'} mode`,
            'contrast'
        );
    };

    const handleAutoPlayNextToggle = () => {
        const next = !autoPlayNext;
        setAutoPlayNext(next);
        updateSettings({ autoPlayNext: next });
        addNotification('Playback Settings', `Autoplay next episode ${next ? 'enabled' : 'disabled'}.`, 'play_circle');
    };

    const handleAutoPlayPreviewsToggle = () => {
        const next = !autoPlayPreviews;
        setAutoPlayPreviews(next);
        updateSettings({ autoPlayPreviews: next });
    };

    const handleQualityChange = (q) => {
        setStreamQuality(q);
        updateSettings({ streamQuality: q });
        addNotification('Streaming Quality', `Default quality set to ${q.toUpperCase()}.`, 'hd');
    };

    const handleSaveSubtitles = () => {
        updateSettings({
            subtitleFont,
            subtitleSize,
            subtitleColor,
            subtitleBg
        });
        addNotification('Subtitles Updated', 'Your subtitle appearance was saved.', 'subtitles');
    };

    const handleSaveProfile = async (e) => {
        e?.preventDefault();
        const name = displayName.trim();
        if (!name) return;

        try {
            await updateProfileData(targetProfile.id, {
                name,
                avatar: avatarUrl,
                isKids
            });
            addNotification("Profile Saved", `Profile "${name}" updated successfully.`, "check_circle");
        } catch(err) {
            console.error(err);
            addNotification("Error", "Failed to update profile.", "error");
        }
    };

    const handleCreateProfile = () => {
        const name = newProfileName.trim();
        if (!name) return;
        const newP = createProfile({
            name,
            avatar: newProfileIsKids ? DEFAULT_KIDS_AVATAR : DEFAULT_AVATAR,
            isKids: newProfileIsKids
        });
        if (newP) {
            setEditingProfileId(newP.id);
            setShowAddProfileModal(false);
            setNewProfileName('');
            setNewProfileIsKids(false);
            addNotification('Profile Created', `Welcome, ${name}!`, 'person_add');
        }
    };

    const handleDeleteProfile = (profileId) => {
        if (profiles.length <= 1) {
            addNotification("Action Blocked", "You cannot delete the only remaining profile.", "warning");
            return;
        }
        const pToDelete = profiles.find(p => p.id === profileId);
        if (window.confirm(`Delete profile "${pToDelete?.name}"? All watch history will be removed.`)) {
            deleteProfile(profileId);
            const remaining = profiles.filter(p => p.id !== profileId);
            setEditingProfileId(remaining[0]?.id || 'p_main');
            addNotification('Profile Deleted', `Removed profile "${pToDelete?.name}".`, 'delete');
        }
    };

    const confirmDeleteAccount = async () => {
        setShowDeleteModal(false);
        addNotification('Resetting Account...', 'Wiping cloud sync data and watchlist.', 'delete');
        try {
            if (user) {
                await SupabaseDB.wipeUserData(user.id);
            }
            localStorage.clear();
            addNotification('Complete', 'Account data wiped.', 'check_circle');
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            console.error('Delete error:', e);
            addNotification('Error', 'Failed to reset account.', 'error');
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert("Please choose an image under 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result;
            if (dataUrl) {
                setAvatarUrl(dataUrl);
                setShowAvatarPicker(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="min-h-screen bg-[#0d0d0f] text-white pt-20 pb-24 px-4 sm:px-6 lg:px-10 selection:bg-red-600 selection:text-white">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* ═══════════════ TOP HEADER & BACK NAVIGATION ═══════════════ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigateTo('#/')}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all duration-200 text-xs font-semibold cursor-pointer group shadow-md"
                        >
                            <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                            <span>Back to Browse</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                    Settings & Profile
                                </h1>
                                <span className="bg-red-600/20 text-red-500 border border-red-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Obsidian Cinema
                                </span>
                            </div>
                            <p className="text-white/40 text-xs mt-0.5">
                                Manage profiles, sync accounts, streaming mirrors, and playback settings.
                            </p>
                        </div>
                    </div>

                    {/* Supabase Cloud Sync Status Badge */}
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full self-start sm:self-auto shadow-inner">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                        <span className="text-[11px] font-semibold text-white/80">
                            {user ? `Cloud Sync: ${user.email}` : 'Cloud Sync: Active (Supabase)'}
                        </span>
                    </div>
                </div>

                {/* ═══════════════ 2-COLUMN OBSIDIAN LAYOUT ═══════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* ──── LEFT SIDEBAR NAVIGATION (4 Cols) ──── */}
                    <aside className="lg:col-span-4 bg-[#141418]/90 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-xl shadow-2xl space-y-2">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                            Preferences & Controls
                        </div>

                        <nav className="space-y-1">
                            {[
                                { id: 'profile', label: 'Profiles & Avatars', icon: 'badge', desc: 'Icon, switchers & kids mode' },
                                { id: 'playback', label: 'Playback & Servers', icon: 'stream', desc: 'Hosted proxy, 4K & ad shield' },
                                { id: 'subtitles', label: 'Audio & Subtitles', icon: 'subtitles', desc: 'Styling, sizing & preview' },
                                { id: 'activity', label: 'Viewing Activity', icon: 'history', desc: `${continueWatching?.length || 0} items in history` },
                                { id: 'account', label: 'Account & Security', icon: 'shield_person', desc: 'Cloud ID, sync & reset' },
                            ].map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left cursor-pointer group ${
                                            isActive
                                                ? 'bg-red-600/15 border border-red-500/40 text-white shadow-lg'
                                                : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                                isActive ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(229,9,20,0.6)]' : 'bg-white/5 text-white/60 group-hover:text-white group-hover:bg-white/10'
                                            }`}>
                                                <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white group-hover:text-white">
                                                    {tab.label}
                                                </div>
                                                <div className="text-[10px] text-white/40 truncate max-w-[170px]">
                                                    {tab.desc}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`material-symbols-outlined text-base transition-transform ${
                                            isActive ? 'text-red-500 translate-x-0.5' : 'text-white/20 group-hover:text-white/60'
                                        }`}>
                                            chevron_right
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Sidebar Footer: Quick Profile Summary & Auth Button */}
                        <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <img
                                        src={activeProfile?.avatar || DEFAULT_AVATAR}
                                        alt={activeProfile?.name || 'User'}
                                        className="w-8 h-8 rounded-lg object-cover border border-white/20"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white truncate max-w-[120px]">
                                            {activeProfile?.name || 'Noah'}
                                        </div>
                                        <div className="text-[9px] text-green-400 font-semibold">
                                            Active Profile
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[9px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded font-bold">
                                    4K HDR
                                </span>
                            </div>

                            {user ? (
                                <button
                                    onClick={async () => {
                                        try {
                                            await SupabaseDB.signOut();
                                            addNotification('Signed Out', 'You have been signed out.', 'logout');
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }}
                                    className="w-full py-2.5 px-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-base">logout</span>
                                    <span>Sign Out of Cloud</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setAuthModalOpen(true)}
                                    className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-600/20"
                                >
                                    <span className="material-symbols-outlined text-base">cloud_sync</span>
                                    <span>Sign In with Cloud</span>
                                </button>
                            )}
                        </div>
                    </aside>

                    {/* ──── RIGHT CONTENT PANE (8 Cols) ──── */}
                    <main className="lg:col-span-8 bg-[#141418]/90 border border-white/10 rounded-2xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl">
                        
                        {/* ═══════════════ TAB 1: PROFILES & AVATARS ═══════════════ */}
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-fade-in text-left">
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                        <span>Profiles & Avatars</span>
                                        <span className="text-xs font-normal text-white/40">({profiles.length}/5 active)</span>
                                    </h2>
                                    <p className="text-xs text-white/50 mt-1">
                                        Switch active viewers, configure avatars, maturity filters, and manage multi-profile cinema experiences.
                                    </p>
                                </div>

                                {/* Who's Watching Profile Cards Switcher */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                                            Who's Watching? (1-Click Switch)
                                        </label>
                                        {profiles.length < 5 && (
                                            <button
                                                onClick={() => setShowAddProfileModal(true)}
                                                className="text-xs text-red-500 hover:text-red-400 font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-sm">add</span>
                                                <span>Add Profile</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {profiles.map((p) => {
                                            const isActive = p.id === activeProfile?.id;
                                            const isSelectedForEdit = p.id === editingProfileId;
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => {
                                                        switchProfile(p.id);
                                                        setEditingProfileId(p.id);
                                                    }}
                                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center gap-2 group relative ${
                                                        isActive
                                                            ? 'bg-red-600/15 border-red-500 shadow-md ring-1 ring-red-500/50'
                                                            : isSelectedForEdit
                                                                ? 'bg-white/10 border-white/30'
                                                                : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-white/5'
                                                    }`}
                                                >
                                                    <div className="relative">
                                                        <img
                                                            src={p.avatar}
                                                            alt={p.name}
                                                            className="w-14 h-14 rounded-xl object-cover border border-white/20 group-hover:scale-105 transition-transform shadow-md"
                                                        />
                                                        {isActive && (
                                                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#141418] rounded-full shadow-sm" />
                                                        )}
                                                    </div>
                                                    <div className="w-full">
                                                        <div className="text-xs font-bold text-white truncate max-w-full">
                                                            {p.name}
                                                        </div>
                                                        <div className="text-[10px] text-white/40 mt-0.5">
                                                            {p.isKids ? 'Kids Friendly' : 'Unrestricted'}
                                                        </div>
                                                    </div>
                                                    {isActive && (
                                                        <span className="text-[9px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full">
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Profile Editor Section */}
                                <form onSubmit={handleSaveProfile} className="pt-6 border-t border-white/10 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-white/60">
                                            Edit Profile Details: <span className="text-red-500 font-extrabold">{targetProfile.name}</span>
                                        </h3>
                                        {profiles.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteProfile(targetProfile.id)}
                                                className="text-xs text-red-500 hover:text-red-400 font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                <span>Delete Profile</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 items-start">
                                        {/* Avatar Column */}
                                        <div className="sm:col-span-1 flex flex-col items-center gap-2">
                                            <div
                                                onClick={() => setShowAvatarPicker(true)}
                                                className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-white/20 group cursor-pointer shadow-2xl bg-neutral-900"
                                            >
                                                <img
                                                    src={avatarUrl}
                                                    alt="Avatar"
                                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <div className="w-8 h-8 rounded-full bg-black/70 border border-white/80 flex items-center justify-center text-white">
                                                        <span className="material-symbols-outlined text-base">edit</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowAvatarPicker(true)}
                                                className="text-xs text-red-500 hover:text-red-400 font-semibold cursor-pointer"
                                            >
                                                Change Avatar
                                            </button>
                                        </div>

                                        {/* Name and Settings Column */}
                                        <div className="sm:col-span-3 space-y-4">
                                            <div>
                                                <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-bold">
                                                    Profile Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/15 focus:border-red-500 text-white px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                                                    placeholder="Profile Name"
                                                    maxLength={25}
                                                    required
                                                />
                                            </div>

                                            {/* Kids Mode Card */}
                                            <div className="p-4 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                                        <span>Kids Experience & Parental Control</span>
                                                        {isKids && (
                                                            <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                                                                KIDS
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-white/40 mt-0.5">
                                                        Filters rating to TV-Y7/PG and family friendly cinematic titles.
                                                    </p>
                                                </div>
                                                <ToggleSwitch
                                                    on={isKids}
                                                    onToggle={() => {
                                                        const next = !isKids;
                                                        setIsKids(next);
                                                        if (next && avatarUrl === DEFAULT_AVATAR) {
                                                            setAvatarUrl(DEFAULT_KIDS_AVATAR);
                                                        }
                                                    }}
                                                    label="Toggle Kids Mode"
                                                />
                                            </div>

                                            <div className="pt-2 flex items-center gap-3">
                                                <button
                                                    type="submit"
                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-red-600/30"
                                                >
                                                    Save Changes
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDisplayName(targetProfile.name || '');
                                                        setAvatarUrl(targetProfile.avatar || DEFAULT_AVATAR);
                                                        setIsKids(Boolean(targetProfile.isKids));
                                                    }}
                                                    className="border border-white/20 text-white/70 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* ═══════════════ TAB 2: ACCOUNT & SECURITY ═══════════════ */}
                        {activeTab === 'account' && (
                            <div className="space-y-6 animate-fade-in text-left">
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">Account & Security</h2>
                                    <p className="text-xs text-white/50 mt-1">
                                        Manage your cloud synchronization engine, user credentials, and storage.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-black/40 border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="text-xs uppercase tracking-wider text-white/40 font-bold">Cloud Account ID</div>
                                            <div className="text-sm font-mono font-bold text-white mt-1 flex items-center gap-2">
                                                <span>{user?.id || '9ec1f463-fb7f-44be-9593-1050e875e2a4'}</span>
                                                <span className="material-symbols-outlined text-green-400 text-base">verified</span>
                                            </div>
                                            <div className="text-xs text-white/40 mt-1">
                                                {user?.email ? `Linked Email: ${user.email}` : 'Synced with PostgreSQL & Supabase Cloud Engine'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                                                Connected
                                            </span>
                                        </div>
                                    </div>

                                    {/* Plan Specs Card */}
                                    <div className="p-5 bg-gradient-to-r from-red-950/30 via-neutral-900 to-black border border-red-900/40 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-11 h-11 rounded-xl bg-red-600/20 border border-red-600/40 flex items-center justify-center text-red-500">
                                                <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">NotFlix Cinema Edition</h4>
                                                <p className="text-xs text-white/50">4K Ultra HD • High Bitrate Stream Mirror • Bidirectional Cloud Sync</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-extrabold text-white bg-red-600 px-3 py-1 rounded-full shadow-md">
                                            Active
                                        </span>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="p-5 bg-red-950/15 border border-red-500/20 rounded-xl space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                                            Danger Zone
                                        </h4>
                                        <p className="text-xs text-white/60 leading-relaxed">
                                            Reset your watchlist, watch history, and local cached tokens.
                                        </p>
                                        <button
                                            onClick={() => setShowDeleteModal(true)}
                                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 hover:text-red-300 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-base">delete_forever</span>
                                            <span>Wipe User History & Reset Cloud Sync</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════ TAB 3: PLAYBACK & STREAMING ENGINE ═══════════════ */}
                        {activeTab === 'playback' && (
                            <div className="space-y-6 animate-fade-in text-left">
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">Playback & Streaming Engine</h2>
                                    <p className="text-xs text-white/50 mt-1">
                                        Configure streaming quality, autoplay behavior, audio preferences, and playback experience.
                                    </p>
                                </div>

                                {/* Active Backend Server Status Card */}
                                <div className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-lg">cloud_done</span>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-white">Unified Zero-Ad Streaming Engine</div>
                                                <div className="text-[11px] font-mono text-white/50">{HOSTED_BACKEND_URL}</div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                                            4K UHD Ready
                                        </span>
                                    </div>
                                </div>

                                {/* Streaming Engine Info Card */}
                                <div className="p-4 bg-gradient-to-r from-red-950/20 via-neutral-900 to-black border border-white/10 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-white font-bold text-xs">
                                        <span className="material-symbols-outlined text-red-500 text-base">auto_awesome</span>
                                        <span>Automatic Multi-Source Resolution</span>
                                    </div>
                                    <p className="text-[11px] text-white/50 leading-relaxed">
                                        NotFlix automatically discovers, prioritizes, and streams the highest available quality (4K UHD & 1080p BluRay Remux) with multi-channel Dolby 5.1 / Atmos audio. No manual server selection needed.
                                    </p>
                                </div>

                                {/* Stream Ad Shield (Anti-Popup Engine) */}
                                <div className="p-4 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                            adShield ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'
                                        }`}>
                                            <span className="material-symbols-outlined text-xl">shield</span>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-white">Stream Ad Shield (Anti-Trap & Popups)</h4>
                                            <p className="text-[11px] text-white/40 mt-0.5">
                                                Blocks third-party redirection traps and spam popups automatically.
                                            </p>
                                        </div>
                                    </div>
                                    <ToggleSwitch on={adShield} onToggle={toggleAdShield} label="Toggle Ad Shield" />
                                </div>

                                {/* Playback Toggles */}
                                <div className="space-y-3">
                                    <div className="p-4 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-bold text-white">Autoplay Next Episode</h4>
                                            <p className="text-[11px] text-white/40 mt-0.5">
                                                Automatically slides in the 10-second curtain prompt and loads next episode.
                                            </p>
                                        </div>
                                        <ToggleSwitch on={autoPlayNext} onToggle={handleAutoPlayNextToggle} label="Toggle Autoplay Next" />
                                    </div>

                                    <div className="p-4 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-bold text-white">Autoplay Video Previews</h4>
                                            <p className="text-[11px] text-white/40 mt-0.5">
                                                Plays previews and hero trailers while browsing media categories.
                                            </p>
                                        </div>
                                        <ToggleSwitch on={autoPlayPreviews} onToggle={handleAutoPlayPreviewsToggle} label="Toggle Previews" />
                                    </div>

                                    {/* Default Quality Selector */}
                                    <div className="p-4 bg-black/30 border border-white/10 rounded-xl space-y-2.5">
                                        <label className="text-xs font-bold text-white block">
                                            Default Playback Quality
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'auto', label: 'Auto (Best)' },
                                                { id: 'high', label: '1080p Ultra' },
                                                { id: 'medium', label: '720p HD' },
                                                { id: 'low', label: 'Data Saver' }
                                            ].map(q => (
                                                <button
                                                    key={q.id}
                                                    onClick={() => handleQualityChange(q.id)}
                                                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                        streamQuality === q.id
                                                            ? 'bg-red-600 text-white border-red-500 shadow-md'
                                                            : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'
                                                    }`}
                                                >
                                                    {q.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Theme Mode Switch */}
                                    <div className="p-4 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-bold text-white">Light Mode Theme</h4>
                                            <p className="text-[11px] text-white/40 mt-0.5">
                                                Switch between obsidian cinema dark and bright daylight style.
                                            </p>
                                        </div>
                                        <ToggleSwitch on={lightTheme} onToggle={handleThemeToggle} label="Toggle Light Theme" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════ TAB 4: AUDIO & SUBTITLES ═══════════════ */}
                        {activeTab === 'subtitles' && (
                            <div className="space-y-6 animate-fade-in text-left">
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">Audio & Subtitles</h2>
                                    <p className="text-xs text-white/50 mt-1">
                                        Customize subtitle typography, contrast backdrops, and preview cinema styling.
                                    </p>
                                </div>

                                {/* Live Subtitle Preview */}
                                <div className="relative h-44 rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 shadow-2xl flex items-center justify-center p-6 text-center">
                                    <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-xs" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1000&fit=crop')" }} />
                                    <div className="absolute inset-0 bg-black/50" />
                                    <div 
                                        className="relative z-10 px-4 py-2 rounded transition-all font-bold"
                                        style={{
                                            fontFamily: subtitleFont === 'serif' ? 'Georgia, serif' : subtitleFont === 'mono' ? 'monospace' : 'system-ui, sans-serif',
                                            fontSize: subtitleSize === 'small' ? '14px' : subtitleSize === 'large' ? '22px' : '18px',
                                            color: subtitleColor,
                                            backgroundColor: subtitleBg,
                                            textShadow: '0 2px 4px rgba(0,0,0,0.9)'
                                        }}
                                    >
                                        "The night is darkest just before the dawn."
                                    </div>
                                </div>

                                {/* Subtitle Controls */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1 font-semibold">Font Family</label>
                                        <select 
                                            value={subtitleFont} 
                                            onChange={(e) => setSubtitleFont(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500"
                                        >
                                            <option value="sans">Proportional Sans-Serif</option>
                                            <option value="serif">Classic Serif</option>
                                            <option value="mono">Monospace Terminal</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1 font-semibold">Text Size</label>
                                        <select 
                                            value={subtitleSize} 
                                            onChange={(e) => setSubtitleSize(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500"
                                        >
                                            <option value="small">Small (75%)</option>
                                            <option value="medium">Medium (100%)</option>
                                            <option value="large">Large (150%)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1 font-semibold">Font Color</label>
                                        <select 
                                            value={subtitleColor} 
                                            onChange={(e) => setSubtitleColor(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500"
                                        >
                                            <option value="#FFFFFF">White</option>
                                            <option value="#F5A623">Yellow (Netflix Classic)</option>
                                            <option value="#00FFFF">Cyan</option>
                                            <option value="#00FF00">Green</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1 font-semibold">Background</label>
                                        <select 
                                            value={subtitleBg} 
                                            onChange={(e) => setSubtitleBg(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500"
                                        >
                                            <option value="transparent">None (Transparent)</option>
                                            <option value="rgba(0,0,0,0.5)">Semi-Transparent</option>
                                            <option value="rgba(0,0,0,0.85)">Solid Black</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveSubtitles}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-red-600/30"
                                >
                                    Save Subtitle Preferences
                                </button>
                            </div>
                        )}

                        {/* ═══════════════ TAB 5: VIEWING ACTIVITY ═══════════════ */}
                        {activeTab === 'activity' && (
                            <div className="space-y-6 animate-fade-in text-left">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-tight">Viewing Activity</h2>
                                        <p className="text-xs text-white/50 mt-1">
                                            Continue watching history synced with Supabase Cloud DB.
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-white/50 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                        {continueWatching?.length || 0} Titles
                                    </span>
                                </div>

                                {continueWatching && continueWatching.length > 0 ? (
                                    <div className="space-y-3">
                                        {continueWatching.map((item) => {
                                            const pct = item.duration > 0 ? Math.min(100, Math.round((item.currentTime / item.duration) * 100)) : 0;
                                            return (
                                                <div
                                                    key={`${item.id}-${item.season || 1}-${item.episode || 1}`}
                                                    className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-4 group hover:border-white/20 transition-all"
                                                >
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-neutral-900 shrink-0 border border-white/10">
                                                            <img
                                                                src={item.poster || item.backdrop || 'https://via.placeholder.com/300x180'}
                                                                alt={item.title}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                                                <div className="h-full bg-red-600" style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                                                                {item.title}
                                                            </div>
                                                            <div className="text-[10px] text-white/40 mt-0.5">
                                                                {item.type === 'tv' ? `Season ${item.season || 1} • Episode ${item.episode || 1}` : 'Feature Film'}
                                                                {pct > 0 && ` • ${pct}% watched`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => playMedia({
                                                                ...item,
                                                                resumeTime: item.currentTime || 0
                                                            })}
                                                            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                                                            title="Resume Playback"
                                                        >
                                                            <span className="material-symbols-outlined text-base">play_arrow</span>
                                                            <span className="hidden sm:inline">Resume</span>
                                                        </button>
                                                        <button
                                                            onClick={() => removeFromHistory(item.id)}
                                                            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-red-400 transition-colors cursor-pointer"
                                                            title="Remove from history"
                                                        >
                                                            <span className="material-symbols-outlined text-base">close</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-16 text-center space-y-3 bg-black/20 border border-dashed border-white/10 rounded-2xl">
                                        <span className="material-symbols-outlined text-5xl text-white/30">movie_edit</span>
                                        <div className="text-sm font-bold text-white/80">No viewing history found</div>
                                        <p className="text-xs text-white/40 max-w-sm mx-auto">
                                            Titles you watch on Web or Desktop will automatically appear here with progress synced.
                                        </p>
                                        <button
                                            onClick={() => navigateTo('#/')}
                                            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-lg"
                                        >
                                            Explore Movies & Shows
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                    </main>
                </div>
            </div>

            {/* ═══════════════ ADD PROFILE MODAL ═══════════════ */}
            {showAddProfileModal && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-left">
                    <div className="bg-[#181818] border border-white/15 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-lg font-bold text-white">Add New Profile</h3>
                            <button
                                onClick={() => setShowAddProfileModal(false)}
                                className="text-white/50 hover:text-white"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-bold">
                                Profile Name
                            </label>
                            <input
                                type="text"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                className="w-full bg-black/50 border border-white/15 focus:border-red-500 text-white px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                                placeholder="e.g. Maya, Guest"
                                maxLength={25}
                                autoFocus
                            />
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-white">Kids Profile</div>
                                <div className="text-[10px] text-white/40">Only show titles rated for children.</div>
                            </div>
                            <ToggleSwitch
                                on={newProfileIsKids}
                                onToggle={() => setNewProfileIsKids(v => !v)}
                                label="Kids Profile Toggle"
                            />
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={handleCreateProfile}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                            >
                                Create Profile
                            </button>
                            <button
                                onClick={() => setShowAddProfileModal(false)}
                                className="border border-white/20 hover:border-white text-white/70 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ AVATAR SELECTOR MODAL ═══════════════ */}
            {showAvatarPicker && (
                <div className="fixed inset-0 z-70 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-fade-in text-left">
                    <div className="bg-[#181818] border border-white/15 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-white">Choose Profile Icon</h3>
                                <p className="text-xs text-white/40 mt-0.5">Select a classic Netflix icon, character, or upload your own.</p>
                            </div>
                            <button 
                                onClick={() => setShowAvatarPicker(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
                            >
                                <span className="material-symbols-outlined text-2xl">close</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 p-3 bg-white/5 border-b border-white/10 overflow-x-auto hide-scrollbar shrink-0">
                            {['classics', 'characters', 'kids', 'custom'].map(tabKey => (
                                <button
                                    key={tabKey}
                                    onClick={() => setActiveAvatarTab(tabKey)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
                                        activeAvatarTab === tabKey 
                                            ? 'bg-red-600 text-white shadow-md' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {tabKey}
                                </button>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {activeAvatarTab === 'classics' && (
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                                    {NETFLIX_CLASSIC_AVATARS.map(avatar => (
                                        <div 
                                            key={avatar.id}
                                            onClick={() => {
                                                setAvatarUrl(avatar.url);
                                                setShowAvatarPicker(false);
                                            }}
                                            className="group flex flex-col items-center gap-2 cursor-pointer"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-white transition-all group-hover:scale-105 shadow-md">
                                                <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[11px] text-gray-400 group-hover:text-white text-center truncate max-w-[80px]">
                                                {avatar.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeAvatarTab === 'characters' && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                    {NETFLIX_CHARACTER_AVATARS.map(avatar => (
                                        <div 
                                            key={avatar.id}
                                            onClick={() => {
                                                setAvatarUrl(avatar.url);
                                                setShowAvatarPicker(false);
                                            }}
                                            className="group flex flex-col items-center gap-2 cursor-pointer"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-white transition-all group-hover:scale-105 shadow-md bg-neutral-800">
                                                <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[11px] text-gray-400 group-hover:text-white text-center truncate max-w-[80px]">
                                                {avatar.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeAvatarTab === 'kids' && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                                    {NETFLIX_KIDS_AVATARS.map(avatar => (
                                        <div 
                                            key={avatar.id}
                                            onClick={() => {
                                                setAvatarUrl(avatar.url);
                                                setShowAvatarPicker(false);
                                            }}
                                            className="group flex flex-col items-center gap-2 cursor-pointer"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-white transition-all group-hover:scale-105 shadow-md">
                                                <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[11px] text-gray-400 group-hover:text-white text-center truncate max-w-[80px]">
                                                {avatar.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeAvatarTab === 'custom' && (
                                <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-white/20 rounded-xl bg-white/5 space-y-4 text-center">
                                    <span className="material-symbols-outlined text-5xl text-gray-400">upload_file</span>
                                    <div>
                                        <h4 className="text-base font-bold text-white">Upload Your Photo</h4>
                                        <p className="text-xs text-gray-400 mt-1 max-w-xs">Upload any JPEG, PNG, or WebP photo to use as your custom profile picture.</p>
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        accept="image/png, image/jpeg, image/webp" 
                                        onChange={handleFileUpload}
                                        className="hidden" 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors cursor-pointer shadow-lg"
                                    >
                                        Browse Device Photos
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ DELETE ACCOUNT MODAL ═══════════════ */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-left">
                    <div className="bg-[#181818] border border-red-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full space-y-4 shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">warning</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">Reset Account & Cloud Sync?</h3>
                        <p className="text-xs text-white/60 leading-relaxed">
                            This action will erase local continue watching history, custom avatar links, and cached profile preferences.
                        </p>
                        <div className="flex items-center gap-3 pt-3">
                            <button
                                onClick={confirmDeleteAccount}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                            >
                                Confirm & Reset Everything
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="border border-white/20 hover:border-white text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
