import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import TMDBService from '../services/tmdb';
import HeroBanner from '../components/HeroBanner';
import MediaRow from '../components/MediaRow';
import { MoviesPageSkeleton } from '../components/Skeleton';
import { getMediaRoute } from './Home';

export const Movies = () => {
  const { navigateTo, openDetails } = useApp();
  const [loading, setLoading] = useState(true);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [actionMovies, setActionMovies] = useState([]);
  const [comedyMovies, setComedyMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchMovies = async () => {
      try {
        setLoading(true);
        const [trending, action, comedy, popular] = await Promise.allSettled([
          TMDBService.getTrendingMovies(),
          TMDBService.getActionMovies(),
          TMDBService.getComedyMovies(),
          TMDBService.getPopularMovies(),
        ]);

        if (!active) return;

        if (trending.status === 'fulfilled') setTrendingMovies(trending.value || []);
        if (action.status === 'fulfilled') setActionMovies(action.value || []);
        if (comedy.status === 'fulfilled') setComedyMovies(comedy.value || []);
        if (popular.status === 'fulfilled') setPopularMovies(popular.value || []);
      } catch (err) {
        console.error('Error fetching movies:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMovies();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <MoviesPageSkeleton />;
  }

  const handleSelectMedia = (media) => {
    openDetails(media);
  };

  const handlePlayMedia = (media) => {
    navigateTo(getMediaRoute(media, true));
  };

  return (
    <div className="w-full pb-20 select-none">
      {trendingMovies.length > 0 && (
        <HeroBanner
          items={trendingMovies.slice(0, 5)}
          onPlay={handlePlayMedia}
          onMoreInfo={handleSelectMedia}
        />
      )}

      <div className="relative z-20 -mt-8 sm:-mt-16 space-y-2">
        {trendingMovies.length > 0 && (
          <MediaRow
            title="Trending Movies"
            items={trendingMovies}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
        {actionMovies.length > 0 && (
          <MediaRow
            title="Adrenaline & Action Blockbusters"
            items={actionMovies}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
        {comedyMovies.length > 0 && (
          <MediaRow
            title="Comedies & Feel-Good Hits"
            items={comedyMovies}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
        {popularMovies.length > 0 && (
          <MediaRow
            title="Fan Favorites & Popular Hits"
            items={popularMovies}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
      </div>
    </div>
  );
};

export default Movies;
