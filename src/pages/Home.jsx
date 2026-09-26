import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../hooks/useLanguage';
import { TMDBService, normalizeListResponse } from '../services/tmdb';
import { HeroBanner } from '../components/HeroBanner';
import { MediaRow } from '../components/MediaRow';
import { HomePageSkeleton } from '../components/Skeleton';
import { downloadApp } from '../utils/mediaActions';

export const Home = () => {
    const { continueWatching } = useApp();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [heroIndex, setHeroIndex] = useState(0);
    const [trendingMovies, setTrendingMovies] = useState([]);
    const [trendingTV, setTrendingTV] = useState([]);
    const [topRatedMovies, setTopRatedMovies] = useState([]);
    const [topRatedTV, setTopRatedTV] = useState([]);
    const [nowPlaying, setNowPlaying] = useState([]);

    useEffect(() => {
        let active = true;
        const fetchAllData = async () => {
            try {
                setLoading(true);
                const results = await Promise.allSettled([
                    TMDBService.getTrendingMovies(),
                    TMDBService.getTrendingTV(),
                    TMDBService.getTopRatedMovies(),
                    TMDBService.getTopRatedTV(),
                    TMDBService.getNowPlayingMovies()
                ]);

                if (!active) return;

                if (results[0].status === 'fulfilled') setTrendingMovies(normalizeListResponse(results[0].value));
                if (results[1].status === 'fulfilled') setTrendingTV(normalizeListResponse(results[1].value));
                if (results[2].status === 'fulfilled') setTopRatedMovies(normalizeListResponse(results[2].value));
                if (results[3].status === 'fulfilled') setTopRatedTV(normalizeListResponse(results[3].value));
                if (results[4].status === 'fulfilled') setNowPlaying(normalizeListResponse(results[4].value));
            } catch (error) {
                console.error("Error fetching TMDB data for Home:", error);
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchAllData();
        return () => { active = false; };
    }, []);

    // Cycle the hero banner every 5 seconds
    useEffect(() => {
        if (trendingMovies.length === 0) return;
        const interval = setInterval(() => {
            setHeroIndex((prev) => (prev + 1) % Math.min(5, trendingMovies.length));
        }, 5000);
        return () => clearInterval(interval);
    }, [trendingMovies]);

    const heroMedia = trendingMovies.length > 0 
        ? { ...trendingMovies[heroIndex], tag: "Trending This Week" } 
        : null;

    if (loading) {
        return <HomePageSkeleton />;
    }

    return (
        <div className="w-full pb-16">
            {heroMedia && <HeroBanner media={heroMedia} />}

            <div className="space-y-section-gap relative z-20 -mt-10 md:-mt-20 px-4 md:px-edge-margin max-w-container-max mx-auto">
                {continueWatching.length > 0 && (
                    <MediaRow title={t.home.continueWatching} items={continueWatching} type="progress" showViewAll={false} />
                )}
                {trendingMovies.length > 0 && (
                    <MediaRow title={t.home.trendingMovies} items={trendingMovies} type="poster" />
                )}
                {trendingTV.length > 0 && (
                    <MediaRow title={t.home.trendingTV} items={trendingTV} type="poster" />
                )}
                {topRatedMovies.length > 0 && (
                    <MediaRow title={t.home.topRatedMovies} items={topRatedMovies} type="latest" />
                )}
                {topRatedTV.length > 0 && (
                    <MediaRow title={t.home.topRatedTV} items={topRatedTV} type="latest" />
                )}
                {nowPlaying.length > 0 && (
                    <MediaRow title={t.home.nowPlaying} items={nowPlaying} type="latest" />
                )}

                {/* ═══════════════ APP DOWNLOAD FEATURED BANNER ═══════════════ */}
                <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-br from-red-950/40 via-black/70 to-black shadow-2xl my-6">
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4 sm:gap-6 text-left w-full md:w-auto">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shrink-0 shadow-xl shadow-red-600/30 border border-red-500/40">
                                <span className="material-symbols-outlined text-3xl sm:text-4xl text-white">android</span>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg sm:text-xl font-extrabold text-white truncate">Get the Notflix Mobile App</h3>
                                    <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0">v1.0.1</span>
                                </div>
                                <p className="text-white/60 text-xs sm:text-sm mt-1 max-w-xl">
                                    Stream thousands of movies and TV shows directly on your Android phone or tablet with zero hassle.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                            <button 
                                onClick={() => downloadApp('/Notflix_v1.0.1.APK', 'Notflix_v1.0.1.apk')}
                                className="btn-primary flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all whitespace-nowrap cursor-pointer w-full sm:w-auto"
                                title="Download APK v1.0.1 (12.6 MB)"
                            >
                                <span className="material-symbols-outlined text-xl">download</span>
                                <span>Download APK (12.6 MB)</span>
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
export default Home;
