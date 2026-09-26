/**
 * Iconic Netflix Profile Avatars & Collections
 * Includes Classic Netflix Smileys (as crisp embedded SVGs), Character sets, and Kids avatars.
 */

// Helper to generate crisp, offline-ready Classic Netflix Smiley SVGs
function createSmileyDataUrl(bgColor, faceColor = '#FFFFFF', mouthColor = '#FFFFFF') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <rect width="120" height="120" rx="16" fill="${bgColor}"/>
        <!-- Left eye -->
        <circle cx="42" cy="48" r="8" fill="${faceColor}"/>
        <!-- Right eye -->
        <circle cx="78" cy="48" r="8" fill="${faceColor}"/>
        <!-- Smile -->
        <path d="M 38 72 Q 60 96 82 72" fill="none" stroke="${mouthColor}" stroke-width="7" stroke-linecap="round"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const NETFLIX_CLASSIC_AVATARS = [
    {
        id: 'classic-red',
        name: 'Classic Red',
        category: 'Classics',
        url: createSmileyDataUrl('#E50914'),
    },
    {
        id: 'classic-blue',
        name: 'Classic Blue',
        category: 'Classics',
        url: createSmileyDataUrl('#0071EB'),
    },
    {
        id: 'classic-yellow',
        name: 'Classic Yellow',
        category: 'Classics',
        url: createSmileyDataUrl('#F5A623', '#111111', '#111111'),
    },
    {
        id: 'classic-green',
        name: 'Classic Green',
        category: 'Classics',
        url: createSmileyDataUrl('#2ECC71'),
    },
    {
        id: 'classic-purple',
        name: 'Classic Purple',
        category: 'Classics',
        url: createSmileyDataUrl('#9B59B6'),
    },
];

export const NETFLIX_CHARACTER_AVATARS = [
    {
        id: 'stranger-things-eleven',
        name: 'Eleven',
        category: 'Stranger Things',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces',
    },
    {
        id: 'squid-game-frontman',
        name: 'Front Man',
        category: 'Squid Game',
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    },
    {
        id: 'arcane-jinx',
        name: 'Jinx',
        category: 'Arcane',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=faces',
    },
    {
        id: 'cyberpunk-edgerunner',
        name: 'Cyberpunk',
        category: 'Cyberpunk',
        url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces',
    },
    {
        id: 'money-heist-tokyo',
        name: 'Tokyo',
        category: 'Money Heist',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces',
    },
    {
        id: 'wednesday-addams',
        name: 'Wednesday',
        category: 'Wednesday',
        url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&crop=faces',
    },
];

export const NETFLIX_KIDS_AVATARS = [
    {
        id: 'kids-star',
        name: 'Star Buddy',
        category: 'Kids',
        url: createSmileyDataUrl('#FF4081', '#FFFFFF', '#FFFFFF'),
    },
    {
        id: 'kids-dino',
        name: 'Dino',
        category: 'Kids',
        url: createSmileyDataUrl('#00E676', '#111111', '#111111'),
    },
    {
        id: 'kids-sunny',
        name: 'Sunny',
        category: 'Kids',
        url: createSmileyDataUrl('#FFD600', '#111111', '#111111'),
    }
];

export const ALL_NETFLIX_AVATARS = [
    ...NETFLIX_CLASSIC_AVATARS,
    ...NETFLIX_CHARACTER_AVATARS,
    ...NETFLIX_KIDS_AVATARS,
];

export const DEFAULT_AVATAR = NETFLIX_CLASSIC_AVATARS[0].url;
export const DEFAULT_KIDS_AVATAR = NETFLIX_KIDS_AVATARS[0].url;
