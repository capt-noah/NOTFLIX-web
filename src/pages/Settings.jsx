import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import AvatarIcon, { SMILEY_COLORS } from '../components/AvatarIcon';

const SECTIONS = [
  { id: 'profile', label: 'Profile & Avatars', icon: 'account_circle' },
  { id: 'playback', label: 'Playback & Servers', icon: 'dns' },
  { id: 'subtitles', label: 'Audio & Subtitles', icon: 'subtitles' },
  { id: 'history', label: 'Viewing Activity', icon: 'history' },
];

export const Settings = () => {
  const {
    activeProfile,
    updateProfileData,
    continueWatching = [],
    removeFromContinueWatching,
    addNotification,
    navigateTo,
    openProfileGate,
  } = useApp();

  const [activeSection, setActiveSection] = useState('profile');

  // Profile Edit State
  const [profileName, setProfileName] = useState(activeProfile?.name || 'User');
  const [selectedAvatar, setSelectedAvatar] = useState(activeProfile?.avatar || 'classic-red');
  const [isKids, setIsKids] = useState(activeProfile?.isKids || false);
  const [pin, setPin] = useState(activeProfile?.pin || '');

  // Playback Settings State
  const [preferredServer, setPreferredServer] = useState(
    activeProfile?.defaultServer || 'Vidbing (Default)'
  );
  const [streamQuality, setStreamQuality] = useState('1080p (High)');
  const [autoPlayNext, setAutoPlayNext] = useState(true);

  // Subtitle Settings
  const [subtitleFont, setSubtitleFont] = useState('Sans-Serif');
  const [subtitleSize, setSubtitleSize] = useState('Medium');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    await updateProfileData(activeProfile?.id, {
      name: profileName.trim(),
      avatar: selectedAvatar,
      isKids,
      pin: pin.trim() || null,
      defaultServer: preferredServer,
    });

    addNotification('Settings Saved', 'Your profile preferences have been updated.', 'check_circle');
  };

  return (
    <div className="pt-24 pb-20 px-4 sm:px-12 max-w-7xl mx-auto select-none min-h-[85vh]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-white/10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Settings & Preferences
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Manage your profiles, streaming servers, audio preferences, and viewing history.
          </p>
        </div>
        <button
          onClick={() => navigateTo('#/')}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
        >
          Done
        </button>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Left Sidebar Navigation */}
        <aside className="md:col-span-1 space-y-2">
          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/20 shadow-lg shadow-black/40'
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${isActive ? 'text-[#E50914]' : 'text-white/60'}`}>
                  {sec.icon}
                </span>
                <span>{sec.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Detail Content Area */}
        <div className="md:col-span-3 bg-[#121216]/90 border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
          {/* 1. Profile & Avatars */}
          {activeSection === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-8">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Profile Customization</h3>
                  <p className="text-xs text-white/50">Personalize your avatar and access credentials.</p>
                </div>
                {openProfileGate && (
                  <button
                    type="button"
                    onClick={() => openProfileGate('select')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer border border-white/10 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">switch_account</span>
                    Switch Profile
                  </button>
                )}
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-3">
                  Select Classic Avatar
                </label>
                <div className="flex flex-wrap gap-3.5">
                  {Object.keys(SMILEY_COLORS).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedAvatar(key)}
                      className={`cursor-pointer rounded-2xl p-1 transition-transform duration-200 hover:scale-110 ${
                        selectedAvatar === key
                          ? 'ring-3 ring-[#E50914] scale-105 shadow-lg shadow-red-900/50'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <AvatarIcon avatarIdOrUrl={key} size={56} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="max-w-md">
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Profile Name
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#E50914] transition"
                />
              </div>

              {/* PIN Code */}
              <div className="max-w-xs">
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Lock PIN (4-Digits)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono tracking-widest text-center focus:outline-none focus:border-[#E50914] transition"
                />
              </div>

              {/* Save Button */}
              <button
                type="submit"
                className="px-8 py-3 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-red-900/40 transition cursor-pointer"
              >
                Save Changes
              </button>
            </form>
          )}

          {/* 2. Playback & Servers */}
          {activeSection === 'playback' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Streaming Servers & Engine</h3>
                <p className="text-xs text-white/50">Choose your default video server and playback defaults.</p>
              </div>

              {/* Server Options */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                  Preferred Video Server
                </label>
                {[
                  { id: 'Vidbing (Default)', desc: 'Direct ultra-fast multi-CDN stream embed (Primary).' },
                  { id: 'VidCore', desc: 'High-definition multi-source fallback mirror.' },
                  { id: 'VidFast', desc: 'Ultra-fast low-latency cloud stream.' },
                  { id: 'src.wtf', desc: 'High-speed cloud embed provider.' },
                  { id: 'VidSrc.to', desc: 'Stable multi-resolution streaming server.' },
                  { id: '2Embed', desc: 'Secondary multi-stream embed backup.' },
                ].map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => {
                      setPreferredServer(srv.id);
                      updateProfileData(activeProfile?.id, { defaultServer: srv.id });
                    }}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition cursor-pointer ${
                      preferredServer === srv.id
                        ? 'bg-[#E50914]/15 border-[#E50914] shadow-md'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white">{srv.id}</h4>
                      <p className="text-xs text-white/50 mt-0.5">{srv.desc}</p>
                    </div>
                    {preferredServer === srv.id && (
                      <span className="material-symbols-outlined text-[#E50914] text-xl font-bold">
                        check_circle
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Autoplay toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                <div>
                  <h4 className="text-sm font-semibold text-white">Autoplay Next Episode</h4>
                  <p className="text-xs text-white/50">Play the next episode automatically with the 10-second prompt.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="w-5 h-5 accent-[#E50914] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 3. Audio & Subtitles */}
          {activeSection === 'subtitles' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Subtitles & Audio Styling</h3>
                <p className="text-xs text-white/50">Customize appearance of on-screen closed captions.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                    Subtitle Font
                  </label>
                  <select
                    value={subtitleFont}
                    onChange={(e) => setSubtitleFont(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Sans-Serif">Sans-Serif (Standard)</option>
                    <option value="Monospace">Monospace</option>
                    <option value="Serif">Serif</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                    Text Size
                  </label>
                  <select
                    value={subtitleSize}
                    onChange={(e) => setSubtitleSize(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Small">Small (80%)</option>
                    <option value="Medium">Medium (100%)</option>
                    <option value="Large">Large (130%)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. Viewing Activity */}
          {activeSection === 'history' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Viewing History</h3>
                <p className="text-xs text-white/50">Your recently watched movies and TV series.</p>
              </div>

              {continueWatching.length === 0 ? (
                <div className="text-center py-12 text-white/40 text-xs">
                  No viewing history recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {continueWatching.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.poster || item.backdrop || '/notflix-logo.png'}
                          alt={item.title}
                          className="w-12 h-16 object-cover rounded-lg bg-black/40"
                        />
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-white">{item.title}</h4>
                          <span className="text-[11px] text-[#E50914] font-semibold block mt-0.5">
                            {item.percent}% completed
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromContinueWatching(item.id)}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition cursor-pointer"
                        title="Remove from history"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
