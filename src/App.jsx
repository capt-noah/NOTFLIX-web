import { useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { AuthModal } from './components/AuthModal';
import { ProfileGate } from './components/ProfileGate';
import { CustomCursor } from './components/CustomCursor';

// Pages
import Home from './pages/Home';
const Movies = lazy(() => import('./pages/Movies'));
const Series = lazy(() => import('./pages/Series'));
const ForYou = lazy(() => import('./pages/ForYou'));
const Search = lazy(() => import('./pages/Search'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Details = lazy(() => import('./pages/Details'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/settings/About'));
const PrivacyPolicy = lazy(() => import('./pages/settings/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/settings/TermsOfService'));
const ViewingHistory = lazy(() => import('./pages/settings/ViewingHistory'));

// Route parser: matches #/path/:param patterns
function matchRoute(pattern, hash) {
    // Strip query string from hash before matching
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
    { pattern: '/',            Component: Home },
    { pattern: '/movies',      Component: Movies },
    { pattern: '/tv',          Component: Series },
    { pattern: '/for-you',     Component: ForYou },
    { pattern: '/search',      Component: Search },
    { pattern: '/watchlist',   Component: Watchlist },
    { pattern: '/profile',     Component: Profile },
    { pattern: '/settings',    Component: Settings },
    { pattern: '/settings/about', Component: About },
    { pattern: '/settings/privacy', Component: PrivacyPolicy },
    { pattern: '/settings/terms', Component: TermsOfService },
    { pattern: '/settings/history', Component: ViewingHistory },
    { pattern: '/details/:id', Component: Details },
    { pattern: '/movie/:id',   Component: Details },
    { pattern: '/tv/:id',      Component: Details },
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
        <div className="flex flex-col items-center justify-center min-h-screen text-white text-center px-4">
            <span className="material-symbols-outlined text-7xl text-primary mb-4">movie_filter</span>
            <h1 className="text-4xl font-black mb-2">Page Not Found</h1>
            <p className="text-white/50 mb-6">This scene seems to have been cut from the script.</p>
            <a href="#/" className="btn-primary px-6 py-3 rounded-xl font-bold text-sm">Go Home</a>
        </div>
    );
};

const AppShell = () => {
    const { currentMedia, closePlayer, settings } = useApp();

    // Apply theme class on settings change
    useEffect(() => {
        if (settings.lightMode) {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
    }, [settings.lightMode]);

    return (
        <div className="app-root min-h-screen bg-background text-white relative">
            <CustomCursor />
            <Navbar />
            <main className="pb-24 md:pb-0">
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                }>
                    <RouterView />
                </Suspense>
            </main>
            {currentMedia && (
                <VideoPlayer key="notflix-native-player" media={currentMedia} onClose={closePlayer} />
            )}
            <ProfileGate />
            <AuthModal />
        </div>
    );
};

function App() {
    return (
        <LanguageProvider>
            <AppProvider>
                <AppShell />
            </AppProvider>
        </LanguageProvider>
    );
}

export default App;
