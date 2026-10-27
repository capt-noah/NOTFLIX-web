import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import AvatarIcon, { ALL_AVATARS } from './AvatarIcon';

export default function ProfileGate({ isEnforced = false, onClose }) {
  const {
    profiles = [],
    activeProfile,
    switchProfile,
    updateProfileData,
    createProfile,
    deleteProfile,
    closeProfileGate,
  } = useApp();

  const [isManaging, setIsManaging] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [pinChallengeProfile, setPinChallengeProfile] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Form State for Editing/Creating
  const [formName, setFormName] = useState('');
  const [formAvatar, setFormAvatar] = useState('classic-red');
  const [formPin, setFormPin] = useState('');
  const [formIsKids, setFormIsKids] = useState(false);

  const handleProfileClick = (profile) => {
    if (isManaging) {
      openEditModal(profile, false);
      return;
    }

    if (profile.pin) {
      setPinChallengeProfile(profile);
      setEnteredPin('');
      setPinError(false);
    } else {
      // Switch profile and close gate
      switchProfile(profile.id);
      if (closeProfileGate) closeProfileGate();
      if (onClose) onClose();
    }
  };

  const openEditModal = (profile, isNew = false) => {
    setIsCreatingNew(isNew);
    setEditingProfile(profile);
    setFormName(profile?.name || '');
    setFormAvatar(profile?.avatar || 'classic-blue');
    setFormPin(profile?.pin || '');
    setFormIsKids(profile?.isKids || false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const payload = {
      name: formName.trim(),
      avatar: formAvatar,
      pin: formPin.trim() || null,
      isKids: formIsKids,
    };

    if (isCreatingNew) {
      createProfile(payload);
    } else if (editingProfile?.id) {
      await updateProfileData(editingProfile.id, payload);
    }

    setEditingProfile(null);
  };

  const handleDeleteProfile = async () => {
    if (editingProfile?.id && profiles.length > 1) {
      deleteProfile(editingProfile.id);
      setEditingProfile(null);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (enteredPin === pinChallengeProfile?.pin) {
      switchProfile(pinChallengeProfile.id);
      setPinChallengeProfile(null);
      if (closeProfileGate) closeProfileGate();
      if (onClose) onClose();
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-[#0e0e11] select-none animate-fade-in px-4">
      {/* Close button if not enforced (top right) */}
      {!isEnforced && (
        <div className="absolute top-6 right-8">
          <button
            onClick={() => {
              if (closeProfileGate) closeProfileGate();
              if (onClose) onClose();
            }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex flex-col items-center max-w-4xl w-full text-center space-y-9">
        {/* Header Title */}
        <h1 className="text-3xl sm:text-[42px] font-semibold text-white tracking-normal font-sans">
          {isManaging ? 'Manage Profiles' : "Who's Watching?"}
        </h1>

        {/* Profiles Grid */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10">
          {profiles.map((profile) => {
            return (
              <div
                key={profile.id}
                onClick={() => handleProfileClick(profile)}
                className="group flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <div className="relative w-[120px] h-[120px]">
                  {/* Squircle Avatar with Continuous Curve */}
                  <AvatarIcon
                    avatarIdOrUrl={profile.avatar}
                    size={120}
                    className="transition-all duration-200 group-hover:ring-3 group-hover:ring-white group-hover:shadow-[0_0_20px_rgba(255,255,255,0.35)]"
                  />

                  {/* Lock Indicator */}
                  {profile.pin && !isManaging && (
                    <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white shadow-md">
                      <span className="material-symbols-outlined text-xs">lock</span>
                    </div>
                  )}

                  {/* Edit Pencil Overlay in Manage Mode */}
                  {isManaging && (
                    <div className="absolute inset-0 bg-black/60 rounded-[14px] flex items-center justify-center text-white border border-white/30 backdrop-blur-xs">
                      <span className="material-symbols-outlined text-3xl font-bold">edit</span>
                    </div>
                  )}
                </div>

                <span className="text-sm sm:text-[15px] font-medium text-white/70 group-hover:text-white transition">
                  {profile.name}
                </span>
              </div>
            );
          })}

          {/* Add Profile Button (if fewer than 5 and in manage mode) */}
          {isManaging && profiles.length < 5 && (
            <div
              onClick={() => openEditModal({ name: 'New Profile', avatar: 'classic-blue', isKids: false }, true)}
              className="group flex flex-col items-center gap-3 cursor-pointer transition-transform duration-200 hover:scale-105"
            >
              <div className="w-[120px] h-[120px] rounded-[14px] bg-white/5 border border-white/20 border-dashed group-hover:border-white/60 flex items-center justify-center text-white/50 group-hover:text-white transition">
                <span className="material-symbols-outlined text-4xl font-light">add</span>
              </div>
              <span className="text-sm sm:text-[15px] font-medium text-white/50 group-hover:text-white transition">
                Add Profile
              </span>
            </div>
          )}
        </div>

        {/* Manage Profiles / Done Button */}
        <div className="pt-4">
          <button
            onClick={() => setIsManaging(!isManaging)}
            className={`px-7 py-2.5 text-xs sm:text-sm font-semibold tracking-[1.5px] uppercase transition-all duration-200 cursor-pointer ${
              isManaging
                ? 'bg-white text-black hover:bg-white/90 shadow-lg'
                : 'border border-white/40 text-white/60 hover:text-white hover:border-white'
            }`}
          >
            {isManaging ? 'Done' : 'Manage Profiles'}
          </button>
        </div>
      </div>

      {/* Edit / Create Profile Modal Sheet */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-[#141418] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-left">
            <h2 className="text-2xl font-bold text-white mb-6">
              {isCreatingNew ? 'Add Profile' : 'Edit Profile'}
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Profile Avatar Selection (Images & Smileys) */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-3">
                  Choose Avatar
                </label>
                <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {ALL_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setFormAvatar(av.id)}
                      className={`cursor-pointer rounded-xl p-0.5 transition-transform hover:scale-110 ${
                        formAvatar === av.id ? 'ring-3 ring-[#E50914] scale-105' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <AvatarIcon avatarIdOrUrl={av.id} size={50} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Name */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#E50914] transition"
                  placeholder="Enter name"
                />
              </div>

              {/* Kids Mode Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-white">Kid-Safe Mode</h4>
                  <p className="text-xs text-white/50 mt-0.5">Show only titles rated for children and teens</p>
                </div>
                <input
                  type="checkbox"
                  checked={formIsKids}
                  onChange={(e) => setFormIsKids(e.target.checked)}
                  className="w-5 h-5 accent-[#E50914] cursor-pointer"
                />
              </div>

              {/* 4-digit PIN Protection */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Profile Lock PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white tracking-widest text-center font-mono text-lg focus:outline-none focus:border-[#E50914] transition"
                  placeholder="••••"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {!isCreatingNew && profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteProfile}
                    className="text-xs font-bold text-red-500 hover:text-red-400 transition cursor-pointer"
                  >
                    Delete Profile
                  </button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    className="px-5 py-2.5 text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs font-bold rounded-xl shadow-lg shadow-red-900/40 transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Challenge Modal */}
      {pinChallengeProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#141418] border border-white/10 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
            <AvatarIcon avatarIdOrUrl={pinChallengeProfile.avatar} size={72} className="mx-auto mb-4" />
            <h3 className="text-base font-semibold text-white mb-1">
              Enter 4-Digit PIN
            </h3>
            <p className="text-xs text-white/50 mb-6">
              Access to {pinChallengeProfile.name} is locked with a PIN.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                autoFocus
                maxLength={4}
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value.replace(/\D/g, ''));
                  setPinError(false);
                }}
                className={`w-36 px-4 py-3 mx-auto text-center font-mono text-2xl tracking-[0.4em] bg-white/5 border rounded-xl text-white focus:outline-none transition ${
                  pinError ? 'border-red-500 ring-2 ring-red-500/50' : 'border-white/20 focus:border-[#E50914]'
                }`}
                placeholder="••••"
              />

              {pinError && (
                <p className="text-xs font-medium text-red-500 animate-shake">
                  Incorrect PIN. Please try again.
                </p>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPinChallengeProfile(null)}
                  className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { ProfileGate };
