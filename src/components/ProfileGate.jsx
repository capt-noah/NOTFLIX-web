import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
    NETFLIX_CLASSIC_AVATARS, 
    NETFLIX_CHARACTER_AVATARS, 
    NETFLIX_KIDS_AVATARS,
    DEFAULT_AVATAR,
    DEFAULT_KIDS_AVATAR
} from '../data/netflixAvatars';

export const ProfileGate = () => {
    const { 
        profiles, 
        activeProfileId, 
        switchProfile, 
        createProfile, 
        updateProfileData, 
        deleteProfile,
        isProfileGateOpen,
        hasSelectedSessionProfile,
        closeProfileGate,
        profileGateMode
    } = useApp();

    const [isManaging, setIsManaging] = useState(profileGateMode === 'manage');
    
    // Edit Modal State
    const [editingProfile, setEditingProfile] = useState(null); // profile object being edited
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [editIsKids, setEditIsKids] = useState(false);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [activeAvatarTab, setActiveAvatarTab] = useState('classics'); // 'classics' | 'characters' | 'kids' | 'custom'

    // Add Profile Modal State
    const [isAddingProfile, setIsAddingProfile] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAvatar, setNewAvatar] = useState(DEFAULT_AVATAR);
    const [newIsKids, setNewIsKids] = useState(false);

    const fileInputRef = useRef(null);

    if (!isProfileGateOpen) return null;

    // Open Profile Editor
    const startEdit = (prof) => {
        setEditingProfile(prof);
        setEditName(prof.name);
        setEditAvatar(prof.avatar);
        setEditIsKids(Boolean(prof.isKids));
        setShowAvatarPicker(false);
    };

    // Save Profile Edit
    const handleSaveEdit = async () => {
        if (!editingProfile) return;
        const trimmed = editName.trim() || editingProfile.name;
        await updateProfileData(editingProfile.id, {
            name: trimmed,
            avatar: editAvatar || editingProfile.avatar,
            isKids: editIsKids
        });
        setEditingProfile(null);
    };

    // Delete Profile
    const handleDelete = (id) => {
        if (window.confirm("Are you sure you want to delete this profile? All its history and watchlist will be lost.")) {
            deleteProfile(id);
            setEditingProfile(null);
        }
    };

    // Create New Profile
    const handleCreateProfile = () => {
        if (!newName.trim()) return;
        createProfile({
            name: newName.trim(),
            avatar: newAvatar,
            isKids: newIsKids
        });
        setIsAddingProfile(false);
        setNewName('');
        setNewAvatar(DEFAULT_AVATAR);
        setNewIsKids(false);
    };

    // Handle Custom Image Upload (converts to base64 Data URL)
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
                if (editingProfile) {
                    setEditAvatar(dataUrl);
                } else if (isAddingProfile) {
                    setNewAvatar(dataUrl);
                }
                setShowAvatarPicker(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#141414] overflow-y-auto flex flex-col items-center justify-center p-4 md:p-8 animate-fade-in select-none">
            {/* Background subtle radial gradient */}
            <div className="absolute inset-0 bg-radial from-neutral-900/60 via-[#141414] to-[#141414] pointer-events-none" />

            {/* Top Close button only if user already chose a profile and opened gate via navbar */}
            {hasSelectedSessionProfile && (
                <button 
                    onClick={closeProfileGate}
                    className="absolute top-6 right-6 md:top-8 md:right-12 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
                    title="Close"
                >
                    <span className="material-symbols-outlined text-2xl md:text-3xl">close</span>
                </button>
            )}

            <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center py-8">
                {/* Netflix Iconic Header */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium text-white mb-8 md:mb-12 tracking-wide font-sans">
                    {isManaging ? 'Manage Profiles:' : "Who's watching?"}
                </h1>

                {/* Profiles Grid */}
                <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mb-10 md:mb-14">
                    {profiles.map((prof) => {
                        const isCurrentActive = prof.id === activeProfileId;
                        return (
                            <div 
                                key={prof.id} 
                                className="group flex flex-col items-center cursor-pointer"
                                onClick={() => {
                                    if (isManaging) {
                                        startEdit(prof);
                                    } else {
                                        switchProfile(prof.id);
                                    }
                                }}
                            >
                                <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-md md:rounded-lg overflow-hidden border-2 border-transparent group-hover:border-white transition-all duration-200 group-hover:scale-105 shadow-2xl bg-[#222]">
                                    <img 
                                        src={prof.avatar || DEFAULT_AVATAR} 
                                        alt={prof.name}
                                        className="w-full h-full object-cover" 
                                    />

                                    {/* Active profile border indicator */}
                                    {isCurrentActive && !isManaging && (
                                        <div className="absolute inset-0 border-2 border-red-600 rounded-md md:rounded-lg pointer-events-none" />
                                    )}

                                    {/* Kids Badge */}
                                    {prof.isKids && (
                                        <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded shadow-md tracking-wider">
                                            KIDS
                                        </div>
                                    )}

                                    {/* Manage Mode Overlay with Pencil */}
                                    {isManaging && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-white/80 flex items-center justify-center bg-black/50 text-white shadow-lg">
                                                <span className="material-symbols-outlined text-lg md:text-xl">edit</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <span className="text-gray-400 group-hover:text-white text-sm sm:text-base md:text-lg font-normal tracking-wide mt-3 text-center truncate max-w-[100px] md:max-w-[140px] transition-colors">
                                    {prof.name}
                                </span>
                            </div>
                        );
                    })}

                    {/* Add Profile Tile (If < 5 profiles) */}
                    {profiles.length < 5 && (
                        <div 
                            className="group flex flex-col items-center cursor-pointer"
                            onClick={() => {
                                setIsAddingProfile(true);
                                setNewName('');
                                setNewAvatar(DEFAULT_AVATAR);
                                setNewIsKids(false);
                            }}
                        >
                            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-md md:rounded-lg border-2 border-transparent group-hover:border-white/80 group-hover:bg-white/10 transition-all duration-200 group-hover:scale-105 flex items-center justify-center text-gray-400 group-hover:text-white bg-[#1e1e1e] shadow-xl">
                                <span className="material-symbols-outlined text-4xl md:text-5xl">add</span>
                            </div>
                            <span className="text-gray-400 group-hover:text-white text-sm sm:text-base md:text-lg font-normal tracking-wide mt-3 text-center transition-colors">
                                Add Profile
                            </span>
                        </div>
                    )}
                </div>

                {/* Manage Profiles / Done Button */}
                <button
                    onClick={() => setIsManaging(!isManaging)}
                    className="border border-gray-500 text-gray-400 hover:border-white hover:text-white px-6 md:px-8 py-2 md:py-2.5 text-xs md:text-sm font-semibold tracking-widest uppercase transition-all duration-200 cursor-pointer"
                >
                    {isManaging ? 'Done' : 'Manage Profiles'}
                </button>
            </div>

            {/* ═══════════════ EDIT PROFILE MODAL ═══════════════ */}
            {editingProfile && (
                <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#181818] border border-white/10 rounded-xl p-6 md:p-8 max-w-lg w-full text-left space-y-6 shadow-2xl relative">
                        <h2 className="text-2xl md:text-3xl font-bold text-white border-b border-white/10 pb-4">
                            Edit Profile
                        </h2>

                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            {/* Avatar Preview with Change Button */}
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <div 
                                    className="relative w-28 h-28 rounded-lg overflow-hidden border-2 border-white/20 group cursor-pointer shadow-lg"
                                    onClick={() => setShowAvatarPicker(true)}
                                >
                                    <img src={editAvatar || DEFAULT_AVATAR} alt="avatar" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <span className="material-symbols-outlined text-white text-2xl">edit</span>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowAvatarPicker(true)}
                                    className="text-xs text-red-500 hover:text-red-400 font-semibold"
                                >
                                    Change Avatar
                                </button>
                            </div>

                            {/* Name & Settings */}
                            <div className="flex-1 w-full space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1 font-semibold">
                                        Profile Name
                                    </label>
                                    <input 
                                        type="text" 
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-[#333] border border-transparent focus:border-white text-white px-3 py-2 rounded text-base outline-none transition-colors"
                                        placeholder="Name"
                                        maxLength={20}
                                    />
                                </div>

                                {/* Kids Toggle */}
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div>
                                        <span className="text-sm font-semibold text-white block">Kid?</span>
                                        <span className="text-xs text-gray-400">Content for children 12 and under</span>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={editIsKids}
                                        onChange={(e) => {
                                            setEditIsKids(e.target.checked);
                                            if (e.target.checked && editAvatar === DEFAULT_AVATAR) {
                                                setEditAvatar(DEFAULT_KIDS_AVATAR);
                                            }
                                        }}
                                        className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSaveEdit}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded text-sm transition-colors cursor-pointer shadow-md"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditingProfile(null)}
                                    className="border border-gray-600 text-gray-300 hover:border-white hover:text-white font-semibold px-5 py-2 rounded text-sm transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>

                            {profiles.length > 1 && (
                                <button
                                    onClick={() => handleDelete(editingProfile.id)}
                                    className="border border-red-900/50 hover:border-red-600 text-red-500 hover:text-red-400 px-4 py-2 rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Delete Profile
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════ ADD PROFILE MODAL ═══════════════ */}
            {isAddingProfile && (
                <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#181818] border border-white/10 rounded-xl p-6 md:p-8 max-w-lg w-full text-left space-y-6 shadow-2xl relative">
                        <h2 className="text-2xl md:text-3xl font-bold text-white border-b border-white/10 pb-4">
                            Add Profile
                        </h2>
                        <p className="text-xs md:text-sm text-gray-400">
                            Add a profile for another person watching NotFlix.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            {/* Avatar Preview */}
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <div 
                                    className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-white/20 group cursor-pointer shadow-lg"
                                    onClick={() => setShowAvatarPicker(true)}
                                >
                                    <img src={newAvatar} alt="avatar" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <span className="material-symbols-outlined text-white text-xl">edit</span>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowAvatarPicker(true)}
                                    className="text-xs text-red-500 hover:text-red-400 font-semibold"
                                >
                                    Choose Avatar
                                </button>
                            </div>

                            {/* Name & Kids Toggle */}
                            <div className="flex-1 w-full space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1 font-semibold">
                                        Name
                                    </label>
                                    <input 
                                        type="text" 
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full bg-[#333] border border-transparent focus:border-white text-white px-3 py-2 rounded text-base outline-none transition-colors"
                                        placeholder="Name"
                                        maxLength={20}
                                        autoFocus
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div>
                                        <span className="text-sm font-semibold text-white block">Kid?</span>
                                        <span className="text-xs text-gray-400">Content for children 12 and under</span>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={newIsKids}
                                        onChange={(e) => {
                                            setNewIsKids(e.target.checked);
                                            if (e.target.checked && newAvatar === DEFAULT_AVATAR) {
                                                setNewAvatar(DEFAULT_KIDS_AVATAR);
                                            }
                                        }}
                                        className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={handleCreateProfile}
                                disabled={!newName.trim()}
                                className={`font-bold px-6 py-2 rounded text-sm transition-colors shadow-md ${
                                    newName.trim() 
                                        ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' 
                                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                                }`}
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => setIsAddingProfile(false)}
                                className="border border-gray-600 text-gray-300 hover:border-white hover:text-white font-semibold px-5 py-2 rounded text-sm transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                            onClick={() => {
                                                if (editingProfile) setEditAvatar(avatar.url);
                                                if (isAddingProfile) setNewAvatar(avatar.url);
                                                setShowAvatarPicker(false);
                                            }}
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
                                            onClick={() => {
                                                if (editingProfile) setEditAvatar(avatar.url);
                                                if (isAddingProfile) setNewAvatar(avatar.url);
                                                setShowAvatarPicker(false);
                                            }}
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
                                            onClick={() => {
                                                if (editingProfile) setEditAvatar(avatar.url);
                                                if (isAddingProfile) setNewAvatar(avatar.url);
                                                setShowAvatarPicker(false);
                                            }}
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
