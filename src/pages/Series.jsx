import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import TMDBService from '../services/tmdb';
import HeroBanner from '../components/HeroBanner';
import MediaRow from '../components/MediaRow';
import { SeriesPageSkeleton } from '../components/Skeleton';
import { getMediaRoute } from './Home';

export const Series = () => {
  const { navigateTo, openDetails } = useApp();
  const [loading, setLoading] = useState(true);
  const [trendingTV, setTrendingTV] = useState([]);
  const [actionTV, setActionTV] = useState([]);
  const [popularTV, setPopularTV] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchTV = async () => {
      try {
        setLoading(true);
        const [trending, action, popular] = await Promise.allSettled([
          TMDBService.getTrendingTV(),
          TMDBService.getActionTV(),
          TMDBService.getPopularTV(),
        ]);

        if (!active) return;

        if (trending.status === 'fulfilled') setTrendingTV(trending.value || []);
        if (action.status === 'fulfilled') setActionTV(action.value || []);
        if (popular.status === 'fulfilled') setPopularTV(popular.value || []);
      } catch (err) {
        console.error('Error fetching TV shows:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchTV();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <SeriesPageSkeleton />;
  }

  const handleSelectMedia = (media) => {
    openDetails(media);
  };

  const handlePlayMedia = (media) => {
    navigateTo(getMediaRoute(media, true));
  };

  return (
    <div className="w-full pb-20 select-none">
      {trendingTV.length > 0 && (
        <HeroBanner
          items={trendingTV.slice(0, 5)}
          onPlay={handlePlayMedia}
          onMoreInfo={handleSelectMedia}
        />
      )}

      <div className="relative z-20 -mt-8 sm:-mt-16 space-y-2">
        {trendingTV.length > 0 && (
          <MediaRow
            title="Trending TV Series"
            items={trendingTV}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
        {actionTV.length > 0 && (
          <MediaRow
            title="Action & Sci-Fi Epics"
            items={actionTV}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
        {popularTV.length > 0 && (
          <MediaRow
            title="Binge-Worthy Popular TV"
            items={popularTV}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
      </div>
    </div>
  );
};

export default Series;
