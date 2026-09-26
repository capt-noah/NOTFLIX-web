import { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { TMDBService, normalizeListResponse } from '../services/tmdb';
import { HeroBanner } from '../components/HeroBanner';
import { MediaRow } from '../components/MediaRow';
import { MoviesPageSkeleton } from '../components/Skeleton';

export const Movies = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [heroIndex, setHeroIndex] = useState(0);
    const [trendingMovies, setTrendingMovies] = useState([]);
    const [actionMovies, setActionMovies] = useState([]);
    const [comedyMovies, setComedyMovies] = useState([]);
    const [popularMovies, setPopularMovies] = useState([]);

    useEffect(() => {
        let active = true;
        const fetchAllData = async () => {
            try {
                setLoading(true);
                const results = await Promise.allSettled([
                    TMDBService.getTrendingMovies(),
                    TMDBService.getActionMovies(),
                    TMDBService.getComedyMovies(),
                    TMDBService.getPopularMovies()
                ]);

                if (!active) return;

                if (results[0].status === 'fulfilled') setTrendingMovies(normalizeListResponse(results[0].value));
                if (results[1].status === 'fulfilled') setActionMovies(normalizeListResponse(results[1].value));
                if (results[2].status === 'fulfilled') setComedyMovies(normalizeListResponse(results[2].value));
                if (results[3].status === 'fulfilled') setPopularMovies(normalizeListResponse(results[3].value));
            } catch (error) {
                console.error("Error fetching TMDB data for Movies:", error);
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchAllData();
        return () => { active = false; };
    }, []);

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
        return <MoviesPageSkeleton />;
    }

    return (
        <div className="w-full pb-16">
            {heroMedia && <HeroBanner media={heroMedia} />}
            <div className="space-y-section-gap relative z-20 -mt-10 md:-mt-20 px-4 md:px-edge-margin max-w-container-max mx-auto">
                {trendingMovies.length > 0 && (
                    <MediaRow title={t.movies.trending} items={trendingMovies} type="poster" />
                )}
                {actionMovies.length > 0 && (
                    <MediaRow title={t.movies.action} items={actionMovies} type="poster" />
                )}
                {comedyMovies.length > 0 && (
                    <MediaRow title={t.movies.comedy} items={comedyMovies} type="poster" />
                )}
                {popularMovies.length > 0 && (
                    <MediaRow title={t.movies.popular} items={popularMovies} type="latest" />
                )}
            </div>
        </div>
    );
};
export default Movies;
