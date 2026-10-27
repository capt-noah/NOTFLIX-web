import React, { useEffect, useState, useRef } from 'react';

export default function SplashScreen({ onComplete }) {
  const [stage, setStage] = useState(0); // 0: init, 1: blooming, 2: sweeping, 3: dissipating
  const audioRef = useRef(null);
  const hasPlayedRef = useRef(false);

  const attemptPlayAudio = () => {
    if (hasPlayedRef.current) return;
    try {
      const audio = new Audio('/sounds/tndum.wav');
      audio.volume = 0.9;
      audioRef.current = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            hasPlayedRef.current = true;
          })
          .catch(() => {
            // Silently wait for user gesture
          });
      }
    } catch {
      // AudioContext / Audio not allowed yet
    }
  };

  useEffect(() => {
    // Attempt initial audio playback
    attemptPlayAudio();

    // Attach user gesture listener in case browser blocked autoplay
    const onUserInteraction = () => {
      attemptPlayAudio();
    };

    window.addEventListener('pointerdown', onUserInteraction, { once: true });
    window.addEventListener('keydown', onUserInteraction, { once: true });

    // Animation sequence matching macOS SplashScreenView
    const t1 = setTimeout(() => setStage(1), 100);
    const t2 = setTimeout(() => setStage(2), 350);
    const t3 = setTimeout(() => setStage(3), 2200);
    const t4 = setTimeout(() => onComplete?.(), 2800);

    const handleSkip = () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      onComplete?.();
    };

    const handleKeyDown = (e) => {
      if (['Space', 'Enter', 'Escape'].includes(e.code) || e.key === ' ') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  return (
    <div
      onClick={() => onComplete?.()}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0c] cursor-pointer select-none transition-opacity duration-600 ${
        stage === 3 ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Ambient Crimson Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(229,9,20,0.22)_0%,_transparent_70%)] pointer-events-none" />

      {/* Brand Logo Container */}
      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* 3D Radiant Ribbon "N" */}
        <div
          className={`relative transition-all duration-700 ease-out transform ${
            stage >= 1
              ? 'scale-100 opacity-100 filter drop-shadow-[0_0_40px_rgba(229,9,20,0.85)]'
              : 'scale-75 opacity-0 filter drop-shadow-[0_0_10px_rgba(229,9,20,0.2)]'
          }`}
          style={{ width: 140, height: 194 }}
        >
          <svg
            viewBox="0 0 100 140"
            className="w-full h-full overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Left Vertical Ribbon Stem */}
            <rect
              x="0"
              y="0"
              width="28"
              height="140"
              rx="2"
              fill="url(#leftStemGrad)"
            />

            {/* Right Vertical Ribbon Stem */}
            <rect
              x="72"
              y="0"
              width="28"
              height="140"
              rx="2"
              fill="url(#rightStemGrad)"
            />

            {/* Center Diagonal Ribbon (with 3D shadow depth) */}
            <path
              d="M 0 0 L 28 0 L 100 140 L 72 140 Z"
              fill="url(#diagonalGrad)"
              filter="url(#diagonalShadow)"
            />

            {/* Gradients & Filters */}
            <defs>
              <linearGradient id="leftStemGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E50914" />
                <stop offset="100%" stopColor="#99040A" />
              </linearGradient>
              <linearGradient id="rightStemGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E50914" />
                <stop offset="100%" stopColor="#99040A" />
              </linearGradient>
              <linearGradient id="diagonalGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FF242B" />
                <stop offset="100%" stopColor="#E50914" />
              </linearGradient>
              <filter id="diagonalShadow" x="-30%" y="-10%" width="160%" height="120%">
                <feDropShadow dx="-4" dy="0" stdDeviation="4" floodColor="#000000" floodOpacity="0.75" />
              </filter>
            </defs>
          </svg>

          {/* Light Sweep Effect */}
          <div
            className={`absolute inset-0 overflow-hidden pointer-events-none transition-transform duration-1000 ease-in-out ${
              stage >= 2 ? 'translate-x-[200px]' : '-translate-x-[200px]'
            }`}
          >
            <div className="w-16 h-[240px] -rotate-25 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-xs" />
          </div>
        </div>

        {/* Wordmark Logo */}
        <h1
          className={`text-4xl sm:text-5xl font-extrabold tracking-[0.18em] text-[#E50914] uppercase transition-all duration-700 delay-150 ${
            stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{
            fontFamily: "'Monoton', 'Outfit', sans-serif",
            textShadow: '0 0 24px rgba(229,9,20,0.85), 0 0 48px rgba(229,9,20,0.45)',
          }}
        >
          NotFlix
        </h1>
      </div>

      {/* Skip Hint */}
      <div className="absolute bottom-8 text-center">
        <span className="text-xs font-medium text-white/30 tracking-wider">
          Click or press any key to skip
        </span>
      </div>
    </div>
  );
}

export { SplashScreen };
