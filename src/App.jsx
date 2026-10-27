import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import ProfileGate from './components/ProfileGate';
import { AuthModal } from './components/AuthModal';
import { CustomCursor } from './components/CustomCursor';
import { getMediaRoute } from './components/MediaCard';

// Pages
import Home from './pages/Home';
const Movies = lazy(() => import('./pages/Movies'));
const Series = lazy(() => import('./pages/Series'));
const Anime = lazy(() => import('./pages/Anime'));
const ForYou = lazy(() => import('./pages/ForYou'));
const Search = lazy(() => import('./pages/Search'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/settings/About'));
const PrivacyPolicy = lazy(() => import('./pages/settings/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/settings/TermsOfService'));
const ViewingHistory = lazy(() => import('./pages/settings/ViewingHistory'));
import Details from './pages/Details';
import AnimeDetails from './pages/AnimeDetails';

function matchRoute(pattern, hash) {
  const cleanHash = (hash || '#/').replace(/^#/, '').split('?')[0];
  const patternParts = pattern.split('/').filter(Boolean);
  const hashParts = cleanHash.split('/').filter(Boolean);

  if (patternParts.length !== hashParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(hashParts[i]);
    } else if (patternParts[i] !== hashParts[i]) {
      return null;
    }
  }
  return params;
}

const ROUTES = [
  { pattern: '/', Component: Home },
  { pattern: '/movies', Component: Movies },
  { pattern: '/tv', Component: Series },
  { pattern: '/anime', Component: Anime },
  { pattern: '/for-you', Component: ForYou },
  { pattern: '/search', Component: Search },
  { pattern: '/watchlist', Component: Watchlist },
  { pattern: '/profile', Component: Profile },
  { pattern: '/settings', Component: Settings },
  { pattern: '/settings/about', Component: About },
  { pattern: '/settings/privacy', Component: PrivacyPolicy },
  { pattern: '/settings/terms', Component: TermsOfService },
  { pattern: '/settings/history', Component: ViewingHistory },
  { pattern: '/details/:id', Component: Details },
  { pattern: '/movie/:id', Component: Details },
  { pattern: '/tv/:id', Component: Details },
  { pattern: '/anime/:id', Component: AnimeDetails },
];

const RouterView = () => {
  const { currentRoute } = useApp();

  for (const { pattern, Component } of ROUTES) {
    const params = matchRoute(pattern, currentRoute);
    if (params !== null) {
      return <Component {...params} />;
    }
  }

  // 404 fallback
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-white text-center px-4">
      <span className="material-symbols-outlined text-7xl text-[#E50914] mb-4">movie_filter</span>
      <h1 className="text-3xl sm:text-4xl font-black mb-2">Page Not Found</h1>
      <p className="text-white/50 mb-6 text-sm">This scene seems to have been cut from the script.</p>
      <a href="#/" className="px-6 py-3 bg-[#E50914] rounded-xl font-bold text-sm shadow-lg shadow-red-900/40 hover:bg-[#b8070f] transition">
        Back to Home
      </a>
    </div>
  );
};

const AppShell = () => {
  const {
    currentMedia,
    closePlayer,
    playMedia,
    isProfileGateOpen,
    closeProfileGate,
    hasSelectedSessionProfile,
    selectedDetail,
    setSelectedDetail,
    closeDetails,
    navigateTo,
  } = useApp();

  return (
    <div className="app-root min-h-screen bg-[#08080a] text-white relative font-sans">
      <CustomCursor />

      {/* Main Navbar */}
      <Navbar />

      {/* Main Content Router */}
      <main className="pt-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-10 h-10 border-3 border-white/20 border-t-[#E50914] rounded-full animate-spin" />
            </div>
          }
        >
          <RouterView />
        </Suspense>
      </main>

      {/* Media Details Modal */}
      {selectedDetail && (
        Boolean(
          selectedDetail.isAnime ||
          selectedDetail.type === 'anime' ||
          selectedDetail.category === 'anime' ||
          (selectedDetail.original_language === 'ja' && Array.isArray(selectedDetail.genre_ids) && selectedDetail.genre_ids.includes(16))
        ) ? (
          <AnimeDetails
            id={selectedDetail.id}
            anime={selectedDetail}
            onClose={closeDetails || (() => setSelectedDetail(null))}
            onPlay={(item) => {
              if (closeDetails) closeDetails();
              else setSelectedDetail(null);
              navigateTo(getMediaRoute(item || selectedDetail, true));
            }}
          />
        ) : (
          <Details
            media={selectedDetail}
            onClose={closeDetails || (() => setSelectedDetail(null))}
            onPlay={(item) => {
              if (closeDetails) closeDetails();
              else setSelectedDetail(null);
              navigateTo(getMediaRoute(item || selectedDetail, true));
            }}
          />
        )
      )}

      {/* Cinema Video Player Stage */}
      {currentMedia && (
        <VideoPlayer
          media={currentMedia}
          onClose={closePlayer}
          onNextEpisode={(nextEp) => {
            playMedia({
              ...currentMedia,
              episode: nextEp.episode_number,
              episodeTitle: nextEp.name,
              currentTime: 0,
            });
          }}
        />
      )}

      {/* Mandatory / Switcher Profile Gate */}
      {isProfileGateOpen && (
        <ProfileGate
          isEnforced={!hasSelectedSessionProfile}
          onClose={hasSelectedSessionProfile ? closeProfileGate : undefined}
        />
      )}

      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </LanguageProvider>
  );
}
