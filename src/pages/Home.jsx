import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import TMDBService from '../services/tmdb';
import HeroBanner from '../components/HeroBanner';
import MediaRow from '../components/MediaRow';
import { HomePageSkeleton } from '../components/Skeleton';

export const getMediaRoute = (item, play = false) => {
  if (!item) return '#/';
  const isAnime = Boolean(
    item.isAnime ||
    item.anime ||
    item.type === 'anime' ||
    item.category === 'anime' ||
    (typeof item.tag === 'string' && item.tag.toLowerCase().includes('anime')) ||
    (item.original_language === 'ja' && (
      (Array.isArray(item.genre_ids) && item.genre_ids.includes(16)) ||
      (Array.isArray(item.genres) && item.genres.some(g => (g.name || g).toString().toLowerCase().includes('animation')))
    ))
  );
  const isTv = item.media_type === 'tv' || item.type === 'tv' || Boolean(item.first_air_date) || Boolean(item.season) || Boolean(item.seasons);
  
  let path = '#/movie/' + item.id;
  if (isAnime) {
    path = '#/anime/' + item.id;
  } else if (isTv) {
    path = '#/tv/' + item.id;
  }
  return play ? `${path}?play=true` : path;
};

export const Home = () => {
  const { continueWatching = [], navigateTo, openDetails } = useApp();
  const [loading, setLoading] = useState(true);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [topRatedTV, setTopRatedTV] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const [trendingM, trendingT, topM, topT, nowP] = await Promise.allSettled([
          TMDBService.getTrendingMovies(),
          TMDBService.getTrendingTV(),
          TMDBService.getTopRatedMovies(),
          TMDBService.getTopRatedTV(),
          TMDBService.getNowPlayingMovies(),
        ]);

        if (!active) return;

        if (trendingM.status === 'fulfilled') setTrendingMovies(trendingM.value || []);
        if (trendingT.status === 'fulfilled') setTrendingTV(trendingT.value || []);
        if (topM.status === 'fulfilled') setTopRatedMovies(topM.value || []);
        if (topT.status === 'fulfilled') setTopRatedTV(topT.value || []);
        if (nowP.status === 'fulfilled') setNowPlaying(nowP.value || []);
      } catch (err) {
        console.error('Failed to load home catalog:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <HomePageSkeleton />;
  }

  const handleSelectMedia = (media) => {
    openDetails(media);
  };

  const handlePlayMedia = (media) => {
    navigateTo(getMediaRoute(media, true));
  };

  return (
    <div className="w-full pb-20 select-none">
      {/* Top Header Clearance / Spacer */}
      <div className="h-4 sm:h-6 w-full" />

      {/* Hero Banner Carousel */}
      {trendingMovies.length > 0 && (
        <HeroBanner
          items={trendingMovies.slice(0, 5)}
          onPlay={handlePlayMedia}
          onMoreInfo={handleSelectMedia}
        />
      )}

      {/* Media Rows */}
      <div className="relative z-20 -mt-8 sm:-mt-16 space-y-2">
        {/* Continue Watching Row */}
        {continueWatching.length > 0 && (
          <MediaRow
            title="Continue Watching"
            items={continueWatching}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Trending Movies */}
        {trendingMovies.length > 0 && (
          <MediaRow
            title="Trending Movies"
            items={trendingMovies}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Trending TV Series */}
        {trendingTV.length > 0 && (
          <MediaRow
            title="Trending TV Series"
            items={trendingTV}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Top Rated Movies */}
        {topRatedMovies.length > 0 && (
          <MediaRow
            title="Top Rated Blockbusters"
            items={topRatedMovies}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Top Rated TV Shows */}
        {topRatedTV.length > 0 && (
          <MediaRow
            title="Critically Acclaimed TV"
            items={topRatedTV}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}

        {/* Now Playing */}
        {nowPlaying.length > 0 && (
          <MediaRow
            title="Now In Theaters & Global Release"
            items={nowPlaying}
            onSelect={handleSelectMedia}
            onPlay={handlePlayMedia}
          />
        )}
      </div>
    </div>
  );
};

export default Home;
