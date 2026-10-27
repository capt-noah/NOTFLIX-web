import React from 'react';
import { useApp } from '../context/AppContext';
import MediaCard from '../components/MediaCard';
import { getMediaRoute } from './Home';

export const Watchlist = () => {
  const { watchlist = [], toggleWatchlist, navigateTo, openDetails } = useApp();

  const handleSelectMedia = (item) => {
    openDetails(item);
  };

  const handlePlayMedia = (item) => {
    navigateTo(getMediaRoute(item, true));
  };

  return (
    <div className="px-6 sm:px-14 py-28 max-w-7xl mx-auto min-h-[80vh] select-none text-left space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          My Watchlist
        </h1>
        <p className="text-white/50 text-xs sm:text-sm mt-1">
          You have <strong className="text-[#E50914]">{watchlist.length}</strong> title{watchlist.length === 1 ? '' : 's'} saved.
        </p>
      </div>

      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-white/40">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
            <span className="material-symbols-outlined text-3xl text-white/30">bookmark_border</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Your Watchlist is empty</h3>
          <p className="text-xs sm:text-sm text-white/50 max-w-xs mb-6">
            Explore movies and TV series and click the plus button to add them here.
          </p>
          <a
            href="#/"
            className="px-6 py-2.5 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs font-bold rounded-xl shadow-lg shadow-red-900/40 transition cursor-pointer"
          >
            Explore Catalog
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {watchlist.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              isInWatchlist={true}
              onSelect={() => handleSelectMedia(item)}
              onPlay={() => handlePlayMedia(item)}
              onToggleWatchlist={() => toggleWatchlist(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
