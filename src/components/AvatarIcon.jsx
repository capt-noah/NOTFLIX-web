import React from 'react';
import { NETFLIX_CLASSIC_AVATARS, NETFLIX_CHARACTER_AVATARS, NETFLIX_KIDS_AVATARS } from '../data/netflixAvatars';

const SMILEY_COLORS = {
  'classic-red': '#E50914',
  'classic-blue': '#0070EB',
  'classic-yellow': '#F5A623',
  'classic-green': '#2ECC71',
  'classic-purple': '#9B59B6',
  'kids-star': '#FF4081',
  'kids-dino': '#00E676',
  'kids-sunny': '#FFD600',
};

const ALL_AVATARS = [
  ...NETFLIX_CLASSIC_AVATARS,
  ...NETFLIX_CHARACTER_AVATARS,
  ...NETFLIX_KIDS_AVATARS
];

const DARK_FEATURE_IDS = ['classic-yellow', 'kids-dino', 'kids-sunny'];

export default function AvatarIcon({
  avatarIdOrUrl = 'classic-red',
  size = 44,
  className = '',
  style = {}
}) {
  // Check if avatar is matching an item in our catalog
  const catalogMatch = ALL_AVATARS.find(a => a.id === avatarIdOrUrl);
  const resolvedUrl = catalogMatch?.url || avatarIdOrUrl;

  const isImage = 
    resolvedUrl?.startsWith('http') || 
    resolvedUrl?.startsWith('data:') || 
    resolvedUrl?.startsWith('/assets') ||
    resolvedUrl?.startsWith('/') ||
    resolvedUrl?.includes('.jpg') ||
    resolvedUrl?.includes('.png') ||
    resolvedUrl?.includes('.webp');

  if (isImage) {
    return (
      <img
        src={resolvedUrl}
        alt="Profile Avatar"
        className={`object-cover select-none shrink-0 shadow-md ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: `${Math.round(size * 0.12)}px`,
          ...style
        }}
        onError={(e) => {
          e.target.src = '/notflix-logo.png';
        }}
      />
    );
  }

  const smileyBg = SMILEY_COLORS[avatarIdOrUrl];
  if (smileyBg) {
    const isDarkFeature = DARK_FEATURE_IDS.includes(avatarIdOrUrl);
    const featureColor = isDarkFeature ? '#141414' : '#FFFFFF';

    return (
      <div
        className={`relative inline-flex items-center justify-center overflow-hidden select-none shrink-0 shadow-md ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: `${Math.round(size * 0.12)}px`,
          backgroundColor: smileyBg,
          ...style
        }}
      >
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Eyes */}
          <circle cx="42" cy="48" r="8" fill={featureColor} />
          <circle cx="78" cy="48" r="8" fill={featureColor} />
          {/* Smile Path */}
          <path
            d="M 38 72 Q 60 96 82 72"
            stroke={featureColor}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    );
  }

  // Fallback
  return (
    <div
      className={`inline-flex items-center justify-center bg-[#E50914] text-white select-none shrink-0 shadow-md ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.12)}px`,
        ...style
      }}
    >
      <span className="material-symbols-outlined text-xl">person</span>
    </div>
  );
}

export { SMILEY_COLORS, ALL_AVATARS };
