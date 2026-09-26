import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SupabaseDB } from '../services/db';
import { 
    NETFLIX_CLASSIC_AVATARS, 
    NETFLIX_CHARACTER_AVATARS, 
    NETFLIX_KIDS_AVATARS,
    DEFAULT_AVATAR,
    DEFAULT_KIDS_AVATAR
} from '../data/netflixAvatars';

export const Profile = () => {
    const { 
        profiles, 
        activeProfileId, 
        updateProfileData, 
        deleteProfile,
        createProfile,
        user, 
        addNotification, 
        navigateTo 
    } = useApp();

    // The profile currently selected for editing on this page
    const [selectedProfileId, setSelectedProfileId] = useState(activeProfileId || profiles[0]?.id);

    // Synchronize if activeProfileId changes externally during render
    const [prevActiveId, setPrevActiveId] = useState(activeProfileId);
    if (activeProfileId !== prevActiveId) {
        setPrevActiveId(activeProfileId);
        setSelectedProfileId(activeProfileId);
    }

    const targetProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0] || {
        id: 'p_main',
        name: 'User',
        avatar: DEFAULT_AVATAR,
        isKids: false
    };

    // Form fields for currently selected profile
    const [displayName, setDisplayName] = useState(targetProfile.name || '');
    const [avatarUrl, setAvatarUrl] = useState(targetProfile.avatar || DEFAULT_AVATAR);
    const [isKids, setIsKids] = useState(Boolean(targetProfile.isKids));
    const [language, setLanguage] = useState('English');
    const [autoPlayNext, setAutoPlayNext] = useState(true);
    const [autoPlayPreviews, setAutoPlayPreviews] = useState(true);

    // Sync form inputs when switching which profile is being edited during render
    const [prevProfileId, setPrevProfileId] = useState(selectedProfileId);
    if (selectedProfileId !== prevProfileId) {
        setPrevProfileId(selectedProfileId);
        setDisplayName(targetProfile.name || '');
        setAvatarUrl(targetProfile.avatar || DEFAULT_AVATAR);
        setIsKids(Boolean(targetProfile.isKids));
    }

    // Avatar Picker Modal State
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [activeAvatarTab, setActiveAvatarTab] = useState('classics');
    const fileInputRef = useRef(null);

    const handleSelectAvatar = (url) => {
        setAvatarUrl(url);
        setShowAvatarPicker(false);
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

    const handleSave = async (e) => {
        e.preventDefault();
        const name = displayName.trim();
        if (!name) return;

        try {
            await updateProfileData(targetProfile.id, {
                name,
                avatar: avatarUrl,
                isKids
            });
            addNotification("Profile Saved", `Profile "${name}" was updated successfully.`, "check_circle");
            navigateTo('#/');
        } catch(e) {
            console.error("Profile error", e);
            addNotification("Error", "Failed to update profile.", "error");
        }
    };

    const handleDelete = () => {
        if (profiles.length <= 1) {
            addNotification("Action Blocked", "You cannot delete the only remaining profile.", "warning");
            return;
        }

        if (window.confirm(`Delete profile "${targetProfile.name}"? All watch history and list items will be erased.`)) {
            deleteProfile(targetProfile.id);
            setSelectedProfileId(profiles[0].id);
        }
    };

    const handleSignOut = async () => {
        try {
            await SupabaseDB.signOut();
            addNotification("Signed Out", "You have successfully signed out.", "logout");
            navigateTo('#/');
        } catch(e) {
            console.error("Logout error", e);
        }
    };

    return (
        <div className="min-h-screen bg-background text-white pt-24 pb-28 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8 text-left">
                {/* Header */}
                <div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
                        Edit Profile
                    </h1>
                    <p className="text-white/50 text-xs md:text-sm mt-1">
                        Customize profile icon, identity, parental maturity rating, and autoplay preferences.
                    </p>
                </div>

                {/* Profile Tabs Bar (Select which profile to edit) */}
                <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-2 border-b border-white/10">
                    <span className="text-xs uppercase tracking-wider text-white/40 font-bold shrink-0 mr-1">
                        Editing:
                    </span>
                    {profiles.map(p => {
                        const isCurrentTab = p.id === targetProfile.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => setSelectedProfileId(p.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                                    isCurrentTab 
                                        ? 'bg-red-600/20 border-red-500 text-white font-bold' 
                                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30'
                                }`}
                            >
                                <img src={p.avatar} alt={p.name} className="w-5 h-5 rounded object-cover" />
                                <span className="text-xs">{p.name}</span>
                                {p.isKids && (
                                    <span className="text-[9px] bg-yellow-500/20 text-yellow-400 font-bold px-1 rounded">
                                        KIDS
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {profiles.length < 5 && (
                        <button
                            onClick={() => {
                                const newP = createProfile({ name: 'New Profile', avatar: DEFAULT_AVATAR });
                                if (newP) setSelectedProfileId(newP.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/30 text-white/60 hover:text-white hover:border-white text-xs transition-colors shrink-0 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>Add Profile</span>
                        </button>
                    )}
                </div>

                {/* Netflix 2-Column Edit Box */}
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-8 py-4">
                    {/* Left Column: Avatar */}
                    <div className="md:col-span-1 flex flex-col items-center md:items-start gap-3">
                        <div 
                            className="relative w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden border-2 border-white/20 group cursor-pointer shadow-2xl bg-[#222]"
                            onClick={() => setShowAvatarPicker(true)}
                        >
                            <img 
                                src={avatarUrl} 
                                alt="avatar" 
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" 
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <div className="w-10 h-10 rounded-full bg-black/60 border border-white/80 flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined text-xl">edit</span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAvatarPicker(true)}
                            className="text-xs text-red-500 hover:text-red-400 font-semibold cursor-pointer"
                        >
                            Choose New Icon
                        </button>
                    </div>

                    {/* Right Column: Profile Options */}
                    <div className="md:col-span-3 space-y-6">
                        {/* Name Input */}
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-bold">
                                Profile Name
                            </label>
                            <input 
                                type="text" 
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full bg-[#333] border border-white/10 focus:border-white text-white px-4 py-3 rounded-lg text-lg outline-none transition-colors"
                                placeholder="Your Name"
                                maxLength={25}
                                required
                            />
                        </div>

                        {/* Language Selector */}
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-bold">
                                Language
                            </label>
                            <select 
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full bg-[#333] border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-red-500"
                            >
                                <option value="English">English</option>
                                <option value="Amharic">Amharic (አማርኛ)</option>
                                <option value="Spanish">Español</option>
                                <option value="French">Français</option>
                            </select>
                        </div>

                        {/* Maturity & Parental Settings */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span>Kids Profile</span>
                                        {isKids && (
                                            <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                KIDS
                                            </span>
                                        )}
                                    </h4>
                                    <p className="text-xs text-white/50 mt-0.5">
                                        Show only movies and TV shows suitable for children ages 12 and under.
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={isKids}
                                    onChange={(e) => {
                                        setIsKids(e.target.checked);
                                        if (e.target.checked && avatarUrl === DEFAULT_AVATAR) {
                                            setAvatarUrl(DEFAULT_KIDS_AVATAR);
                                        }
                                    }}
                                    className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Autoplay Controls */}
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                            <h4 className="text-xs uppercase tracking-wider text-white/50 font-bold">
                                Autoplay controls
                            </h4>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={autoPlayNext} 
                                    onChange={(e) => setAutoPlayNext(e.target.checked)}
                                    className="w-4 h-4 accent-red-600 rounded" 
                                />
                                <span className="text-xs text-white/80">Autoplay next episode in a series on all devices.</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={autoPlayPreviews} 
                                    onChange={(e) => setAutoPlayPreviews(e.target.checked)}
                                    className="w-4 h-4 accent-red-600 rounded" 
                                />
                                <span className="text-xs text-white/80">Autoplay previews while browsing on all devices.</span>
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors cursor-pointer shadow-lg"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigateTo('#/')}
                                    className="border border-white/30 text-white hover:border-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>

                            {profiles.length > 1 && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="border border-red-500/30 text-red-400 hover:border-red-500 hover:text-red-300 font-semibold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Delete Profile
                                </button>
                            )}
                        </div>
                    </div>
                </form>

                {/* Sign Out Card */}
                {user && (
                    <div className="pt-6 border-t border-white/10 flex justify-between items-center text-xs">
                        <span className="text-white/40">Logged in as {user.email}</span>
                        <button 
                            type="button" 
                            onClick={handleSignOut} 
                            className="text-red-500 hover:underline font-semibold"
                        >
                            Sign Out of NotFlix
                        </button>
                    </div>
                )}
            </div>

            {/* ═══════════════ AVATAR SELECTOR MODAL ═══════════════ */}
            {showAvatarPicker && (
                <div className="fixed inset-0 z-70 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#181818] border border-white/15 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-left">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/10 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-white">Choose Profile Icon</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Select a classic Netflix icon, character, or upload your own.</p>
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
                            <button
                                onClick={() => setActiveAvatarTab('classics')}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                                    activeAvatarTab === 'classics' 
                                        ? 'bg-red-600 text-white' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                Classics
                            </button>
                            <button
                                onClick={() => setActiveAvatarTab('characters')}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                                    activeAvatarTab === 'characters' 
                                        ? 'bg-red-600 text-white' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                Characters
                            </button>
                            <button
                                onClick={() => setActiveAvatarTab('kids')}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                                    activeAvatarTab === 'kids' 
                                        ? 'bg-red-600 text-white' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                Kids
                            </button>
                            <button
                                onClick={() => setActiveAvatarTab('custom')}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                                    activeAvatarTab === 'custom' 
                                        ? 'bg-red-600 text-white' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                Custom Photo
                            </button>
                        </div>

                        {/* Avatars Grid Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {activeAvatarTab === 'classics' && (
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                                    {NETFLIX_CLASSIC_AVATARS.map(avatar => (
                                        <div 
                                            key={avatar.id}
                                            onClick={() => handleSelectAvatar(avatar.url)}
                                            className="group flex flex-col items-center gap-2 cursor-pointer"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 border-transparent hover:border-white transition-all group-hover:scale-105 shadow-md">
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
                                            onClick={() => handleSelectAvatar(avatar.url)}
                                            className="group flex flex-col items-center gap-2 cursor-pointer"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 border-transparent hover:border-white transition-all group-hover:scale-105 shadow-md bg-neutral-800">
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
                                            onClick={() => handleSelectAvatar(avatar.url)}
                                            className="group flex flex-col items-center gap-2 cursor-pointer"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 border-transparent hover:border-white transition-all group-hover:scale-105 shadow-md">
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
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors cursor-pointer shadow-lg"
                                    >
                                        Browse Device Photos
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
