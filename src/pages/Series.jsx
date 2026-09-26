import { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { TMDBService, normalizeListResponse } from '../services/tmdb';
import { HeroBanner } from '../components/HeroBanner';
import { MediaRow } from '../components/MediaRow';
import { SeriesPageSkeleton } from '../components/Skeleton';

export const Series = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [heroIndex, setHeroIndex] = useState(0);
    const [trendingTV, setTrendingTV] = useState([]);
    const [actionTV, setActionTV] = useState([]);
    const [popularTV, setPopularTV] = useState([]);

    useEffect(() => {
        let active = true;
        const fetchAllData = async () => {
            try {
                setLoading(true);
                
                const results = await Promise.allSettled([
                    TMDBService.getTrendingTV(),
                    TMDBService.getActionTV(),
                    TMDBService.getPopularTV()
                ]);

                if (!active) return;

                if (results[0].status === 'fulfilled') setTrendingTV(normalizeListResponse(results[0].value));
                if (results[1].status === 'fulfilled') setActionTV(normalizeListResponse(results[1].value));
                if (results[2].status === 'fulfilled') setPopularTV(normalizeListResponse(results[2].value));

            } catch (error) {
                console.error("Error fetching TMDB data for Series:", error);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchAllData();
        return () => { active = false; };
    }, []);

    // Cycle the hero banner every 5 seconds
    useEffect(() => {
        if (trendingTV.length === 0) return;
        const interval = setInterval(() => {
            setHeroIndex((prev) => (prev + 1) % Math.min(5, trendingTV.length));
        }, 5000);
        return () => clearInterval(interval);
    }, [trendingTV]);

    const heroMedia = trendingTV.length > 0 
        ? { ...trendingTV[heroIndex], tag: "Trending Series" } 
        : null;

    if (loading) {
        return <SeriesPageSkeleton />;
    }

    return (
        <div className="w-full pb-16">
            {/* Cinematic Hero Banner */}
            {heroMedia && <HeroBanner media={heroMedia} />}

            {/* Content Lists Container */}
            <div className="space-y-section-gap relative z-20 -mt-10 md:-mt-20 px-4 md:px-edge-margin max-w-container-max mx-auto">
                
                {/* Trending TV Now */}
                {trendingTV.length > 0 && (
                    <MediaRow 
                        title={t.tv.trending} 
                        items={trendingTV} 
                        type="poster" 
                    />
                )}

                {/* Action and Adventure */}
                {actionTV.length > 0 && (
                    <MediaRow 
                        title={t.movies.action} 
                        items={actionTV} 
                        type="poster" 
                    />
                )}

                {/* Popular Series */}
                {popularTV.length > 0 && (
                    <MediaRow 
                        title={t.tv.topRated} 
                        items={popularTV} 
                        type="latest" 
                    />
                )}
            </div>
        </div>
    );
};
export default Series;
