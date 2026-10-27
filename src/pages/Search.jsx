import React, { useState, useEffect, useMemo } from 'react';
import TMDBService from '../services/tmdb';
import { useApp } from '../context/AppContext';
import MediaCard from '../components/MediaCard';
import { MediaGridSkeleton } from '../components/Skeleton';
import { getMediaRoute } from './Home';

export const Search = () => {
  const { navigateTo, watchlist = [], toggleWatchlist, openDetails } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    genres: [],
    year: '',
    rating: 0,
  });

  // Load genres
  useEffect(() => {
    const loadGenres = async () => {
      try {
        const genres = await TMDBService.getGenres();
        setAvailableGenres(genres || []);
      } catch (err) {
        console.error('Failed to load genres:', err);
      }
    };
    loadGenres();
  }, []);

  const executeSearch = async (searchQuery, currentFilters) => {
    setLoading(true);
    try {
      const data = await TMDBService.searchMedia(searchQuery, currentFilters);
      setResults(data || []);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useMemo(
    () => debounce((q, f) => executeSearch(q, f), 400),
    []
  );

  useEffect(() => {
    if (!query.trim() && filters.type === 'all' && filters.genres.length === 0 && !filters.year && !filters.rating) {
      debouncedSearch.cancel();
      setResults([]);
      return;
    }
    debouncedSearch(query, filters);
    return () => debouncedSearch.cancel();
  }, [query, filters, debouncedSearch]);

  const handleGenreToggle = (genreId) => {
    setFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(genreId) ? [] : [genreId],
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      type: 'all',
      genres: [],
      year: '',
      rating: 0,
    });
    setQuery('');
    setIsFilterOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#08080a] text-white pt-24 pb-32 px-6 sm:px-14 select-none">
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row items-center gap-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Search Catalog</h1>

        <div className="flex-1 flex items-center gap-3 w-full md:ml-8">
          {/* Search Input Area */}
          <div className="relative flex-1 flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-white/50 text-xl">
              search
            </span>
            <input
              type="text"
              placeholder="Search movies, TV shows, actors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-10 text-white placeholder-white/40 focus:outline-none focus:border-[#E50914] transition shadow-lg text-sm sm:text-base"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 text-white/40 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`py-3.5 px-6 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer ${
              isFilterOpen || filters.genres.length > 0 || filters.year || filters.rating > 0 || filters.type !== 'all'
                ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-red-900/40'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {isFilterOpen && (
        <div className="max-w-7xl mx-auto mb-10 p-6 rounded-3xl bg-[#121216]/95 border border-white/10 shadow-2xl space-y-6 animate-fade-in">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Refine Discovery</h3>
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-white/50 hover:text-white cursor-pointer"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Content Type */}
            <div>
              <span className="text-xs font-bold text-white/60 block uppercase tracking-wider mb-2">
                Type
              </span>
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                {['all', 'movie', 'tv'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilters((prev) => ({ ...prev, type: t }))}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition cursor-pointer ${
                      filters.type === t ? 'bg-[#E50914] text-white shadow-md' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'tv' ? 'TV Shows' : 'Movies'}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Rating */}
            <div>
              <span className="text-xs font-bold text-white/60 block uppercase tracking-wider mb-2">
                Minimum Rating
              </span>
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                {[0, 6, 7, 8].map((r) => (
                  <button
                    key={r}
                    onClick={() => setFilters((prev) => ({ ...prev, rating: r }))}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      filters.rating === r
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {r === 0 ? 'Any' : `${r}+ ★`}
                  </button>
                ))}
              </div>
            </div>

            {/* Release Year */}
            <div>
              <span className="text-xs font-bold text-white/60 block uppercase tracking-wider mb-2">
                Release Year
              </span>
              <select
                value={filters.year}
                onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="">Any Year</option>
                {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Genres Chips */}
          {availableGenres.length > 0 && (
            <div>
              <span className="text-xs font-bold text-white/60 block uppercase tracking-wider mb-2">
                Genres
              </span>
              <div className="flex flex-wrap gap-2">
                {availableGenres.map((g) => {
                  const isSelected = filters.genres.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleGenreToggle(g.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-[#E50914] border-[#E50914] text-white shadow-md'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Results Grid */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <MediaGridSkeleton count={12} />
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {results.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                isInWatchlist={watchlist.some((w) => String(w.id) === String(item.id))}
                onSelect={() => openDetails(item)}
                onPlay={() => navigateTo(getMediaRoute(item, true))}
                onToggleWatchlist={() => toggleWatchlist(item)}
              />
            ))}
          </div>
        ) : query ? (
          <div className="py-24 text-center text-white/40">
            <span className="material-symbols-outlined text-5xl mb-2 text-white/20">search_off</span>
            <h3 className="text-lg font-bold text-white mb-1">No matching titles found</h3>
            <p className="text-xs text-white/50">Try adjusting your keyword or clearing filters.</p>
          </div>
        ) : (
          <div className="py-24 text-center text-white/30">
            <span className="material-symbols-outlined text-5xl mb-2 text-white/20">movie</span>
            <p className="text-sm font-medium">Search our entire movie and TV series library above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
