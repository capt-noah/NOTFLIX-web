import React, { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { AnimeService } from '../services/animeService';
import HeroBanner from '../components/HeroBanner';
import MediaRow from '../components/MediaRow';
import { SeriesPageSkeleton } from '../components/Skeleton';
import { useApp } from '../context/AppContext';

export const Anime = () => {
    const { t = {} } = useLanguage();
    const { navigateTo, openDetails } = useApp();
    const [loading, setLoading] = useState(true);

    const [spotlightAnime, setSpotlightAnime] = useState([]);
    const [trendingAnime, setTrendingAnime] = useState([]);
    const [topAiringAnime, setTopAiringAnime] = useState([]);
    const [popularAnime, setPopularAnime] = useState([]);
    const [topRatedAnime, setTopRatedAnime] = useState([]);
    const [upcomingAnime, setUpcomingAnime] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [genreResults, setGenreResults] = useState([]);
    const [loadingGenre, setLoadingGenre] = useState(false);

    const GENRES = [
        'Action',
        'Adventure',
        'Comedy',
        'Drama',
        'Fantasy',
        'Horror',
        'Mystery',
        'Romance',
        'Sci-Fi',
        'Supernatural'
    ];

    useEffect(() => {
        let active = true;
        const fetchAllData = async () => {
            try {
                setLoading(true);
                const [homeData, topRatedData, upcomingData] = await Promise.all([
                    AnimeService.getHome().catch(() => ({})),
                    AnimeService.getList('top-rated', 1).catch(() => []),
                    AnimeService.getList('upcoming', 1).catch(() => [])
                ]);

                if (!active) return;

                if (homeData) {
                    setSpotlightAnime(homeData.spotlight || []);
                    setTrendingAnime(homeData.trending || []);
                    setTopAiringAnime(homeData.topAiring || []);
                    setPopularAnime(homeData.mostPopular || []);
                    setTopRatedAnime(topRatedData?.length ? topRatedData : (homeData.topRated || []));
                    setUpcomingAnime(upcomingData?.length ? upcomingData : (homeData.upcoming || []));
                } else {
                    setTopRatedAnime(topRatedData || []);
                    setUpcomingAnime(upcomingData || []);
                }
            } catch (error) {
                console.error('Error fetching anime data:', error);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchAllData();
        return () => { active = false; };
    }, []);

    // Handle genre filter chip click
    const handleGenreClick = async (genre) => {
        if (selectedGenre === genre) {
            setSelectedGenre(null);
            setGenreResults([]);
            return;
        }

        setSelectedGenre(genre);
        setLoadingGenre(true);
        try {
            const results = await AnimeService.search('', 1, genre);
            setGenreResults(results || []);
        } catch (e) {
            console.error('Genre search failed:', e);
        } finally {
            setLoadingGenre(false);
        }
    };

    const heroList = spotlightAnime.length > 0 ? spotlightAnime : trendingAnime;

    if (loading) {
        return <SeriesPageSkeleton />;
    }

    const handleSelectMedia = (media) => {
        openDetails({ ...media, isAnime: true, type: 'anime' });
    };

    const handlePlayMedia = (media) => {
        navigateTo(`#/anime/${media.id}?play=true`);
    };

    return (
        <div className="w-full pb-20 text-left select-none">
            {/* Top Header Clearance / Spacer */}
            <div className="h-4 sm:h-6 w-full" />

            {/* Hero Carousel */}
            {heroList.length > 0 && (
                <HeroBanner
                    items={heroList.slice(0, 5)}
                    onPlay={handlePlayMedia}
                    onMoreInfo={handleSelectMedia}
                />
            )}

            {/* Main Content Stack */}
            <div className="space-y-2 relative z-20 -mt-8 sm:-mt-16">
                {/* Genre Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar px-6 sm:px-14 py-2">
                    <span className="text-white/40 text-xs uppercase font-bold mr-2 tracking-wider flex items-center gap-1 shrink-0">
                        <span className="material-symbols-outlined text-sm">filter_alt</span>
                        Genres:
                    </span>
                    <button
                        onClick={() => { setSelectedGenre(null); setGenreResults([]); }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            selectedGenre === null
                                ? 'bg-[#E50914] text-white shadow-lg shadow-red-600/30'
                                : 'bg-[#141418] text-white/70 hover:text-white border border-white/10'
                        }`}
                    >
                        All Anime
                    </button>
                    {GENRES.map((genre) => (
                        <button
                            key={genre}
                            onClick={() => handleGenreClick(genre)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                selectedGenre === genre
                                    ? 'bg-[#E50914] text-white shadow-lg shadow-red-600/30'
                                    : 'bg-[#141418] text-white/70 hover:text-white border border-white/10'
                            }`}
                        >
                            {genre}
                        </button>
                    ))}
                </div>

                {/* Filtered Genre Results (if any selected) */}
                {selectedGenre && (
                    <div className="space-y-4">
                        {loadingGenre ? (
                            <div className="flex justify-center py-12">
                                <div className="w-10 h-10 border-4 border-white/20 border-t-[#E50914] rounded-full animate-spin"></div>
                            </div>
                        ) : genreResults.length > 0 ? (
                            <MediaRow
                                title={`${selectedGenre} Hits`}
                                items={genreResults}
                                onSelect={handleSelectMedia}
                                onPlay={handlePlayMedia}
                            />
                        ) : (
                            <p className="text-white/50 text-sm py-8 text-center">No {selectedGenre} anime found.</p>
                        )}
                    </div>
                )}

                {/* Trending Anime Row */}
                {trendingAnime.length > 0 && (
                    <MediaRow
                        title="Trending Anime This Week"
                        items={trendingAnime}
                        onSelect={handleSelectMedia}
                        onPlay={handlePlayMedia}
                    />
                )}

                {/* Top Airing Anime Row */}
                {topAiringAnime.length > 0 && (
                    <MediaRow
                        title="Top Airing Right Now"
                        items={topAiringAnime}
                        onSelect={handleSelectMedia}
                        onPlay={handlePlayMedia}
                    />
                )}

                {/* Most Popular Anime Row */}
                {popularAnime.length > 0 && (
                    <MediaRow
                        title="Most Popular All Time"
                        items={popularAnime}
                        onSelect={handleSelectMedia}
                        onPlay={handlePlayMedia}
                    />
                )}

                {/* Top Rated Anime Row */}
                {topRatedAnime.length > 0 && (
                    <MediaRow
                        title="Top Rated Masterpieces"
                        items={topRatedAnime}
                        onSelect={handleSelectMedia}
                        onPlay={handlePlayMedia}
                    />
                )}

                {/* Upcoming Anime Row */}
                {upcomingAnime.length > 0 && (
                    <MediaRow
                        title="Anticipated Upcoming Releases"
                        items={upcomingAnime}
                        onSelect={handleSelectMedia}
                        onPlay={handlePlayMedia}
                    />
                )}
            </div>
        </div>
    );
};

export default Anime;
