import { useApp } from '../../context/AppContext';

export const About = () => {
    return (
        <div className="max-w-2xl mx-auto px-4 py-16 min-h-screen text-white animate-fade-in text-left">
            <button 
                onClick={() => window.history.back()} 
                className="mb-8 glass-surface w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
            >
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            
            <h1 className="text-3xl font-black mb-6">About NOTFLIX</h1>
            
            <div className="glass-surface rounded-2xl p-6 md:p-8 space-y-6 border border-white/10 shadow-2xl">
                <div>
                    <h2 className="text-xl font-bold mb-2 text-white flex items-center gap-2.5">
                        <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
                        Obsidian Cinema Platform
                    </h2>
                    <p className="text-white/80 leading-relaxed text-sm md:text-base">
                        NOTFLIX is an ultra-premium, ad-free cinema streaming platform engineered for pristine visual fidelity, instant multi-stream resolution, and seamless cross-platform synchronization between macOS and Web.
                    </p>
                </div>

                <div className="pt-4 border-t border-white/10">
                    <h3 className="text-base font-bold mb-3 text-red-400 uppercase tracking-wider text-xs">Features & Engine</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <p className="font-bold text-white flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-red-500 text-base">high_quality</span>
                                4K UHD Direct Engine
                            </p>
                            <p className="text-white/60 text-xs mt-1">Multi-indexer torrent progressive streaming & high-speed direct resolution.</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <p className="font-bold text-white flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-emerald-400 text-base">verified_user</span>
                                Zero Ads & Popups
                            </p>
                            <p className="text-white/60 text-xs mt-1">Pure ad-free playback with native HTML5 & WebVTT subtitle controls.</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <p className="font-bold text-white flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-cyan-400 text-base">cloud_sync</span>
                                Cross-Device Sync
                            </p>
                            <p className="text-white/60 text-xs mt-1">Real-time Supabase cloud sync for watch progress, watchlists, and profiles.</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <p className="font-bold text-white flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-purple-400 text-base">palette</span>
                                Obsidian Glass UI
                            </p>
                            <p className="text-white/60 text-xs mt-1">Deep obsidian glassmorphism design with precision Netflix-style controls.</p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex justify-between items-center text-xs text-white/40 font-semibold uppercase tracking-wider">
                    <span>NOTFLIX Web • Obsidian Edition v2.0</span>
                    <span className="flex items-center gap-1">
                        Engineered with <span className="text-red-500 material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default About;
