import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export const CustomCursor = () => {
    const { currentMedia, currentRoute } = useApp();
    const dotRef = useRef(null);
    const circleRef = useRef(null);
    const containerRef = useRef(null);
    const requestRef = useRef(null);
    
    // Store positions as refs to avoid React re-renders
    const mousePos = useRef({ x: -100, y: -100 });
    const circlePos = useRef({ x: -100, y: -100 });
    const [isHoveringPlayer, setIsHoveringPlayer] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Determine if we should hide the custom cursor entirely
    const isPlayerRoute = Boolean(
        currentRoute && (
            currentRoute.includes('#/anime') || 
            currentRoute.includes('#/details') || 
            currentRoute.includes('#/movie') || 
            currentRoute.includes('#/tv') ||
            currentRoute.includes('play=true')
        )
    );
    const isPlayerOpen = Boolean(currentMedia);
    const shouldHide = isPlayerRoute || isPlayerOpen || isHoveringPlayer;

    // Toggle body attribute so native OS hardware cursor is restored instantly on player/detail screens
    useEffect(() => {
        if (shouldHide) {
            document.body.setAttribute('data-default-cursor', 'true');
        } else {
            document.body.removeAttribute('data-default-cursor');
        }
        return () => document.body.removeAttribute('data-default-cursor');
    }, [shouldHide]);

    useEffect(() => {
        let isLoopRunning = false;

        const updateCursor = () => {
            const dx = mousePos.current.x - circlePos.current.x;
            const dy = mousePos.current.y - circlePos.current.y;

            circlePos.current.x += dx * 0.2;
            circlePos.current.y += dy * 0.2;

            if (dotRef.current) {
                dotRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
            }
            if (circleRef.current) {
                circleRef.current.style.transform = `translate3d(${circlePos.current.x}px, ${circlePos.current.y}px, 0)`;
            }

            // Sleep when converged to save CPU & GPU cycles
            if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                requestRef.current = requestAnimationFrame(updateCursor);
            } else {
                isLoopRunning = false;
            }
        };

        const startLoop = () => {
            if (!isLoopRunning) {
                isLoopRunning = true;
                requestRef.current = requestAnimationFrame(updateCursor);
            }
        };

        const onMouseMove = (e) => {
            setIsVisible(true);
            mousePos.current.x = e.clientX;
            mousePos.current.y = e.clientY;
            startLoop();
        };

        // Zero-render interactive element tracking via CSS classes
        const onMouseOver = (e) => {
            const target = e.target;
            if (!target) return;

            // 1. Detect if hovering over a video player, iframe, or player stage
            const overPlayer = Boolean(target.closest('iframe, video, .player-stage, [data-player="true"], .video-player'));
            setIsHoveringPlayer(prev => (prev !== overPlayer ? overPlayer : prev));

            // 2. Fast interactive hover toggle without React component re-renders
            const isInteractive = Boolean(target.closest('button, a, input, select, textarea, .group, .premium-hover, [role="button"], [role="link"], label'));
            if (containerRef.current) {
                containerRef.current.classList.toggle('cursor-hover', isInteractive);
            }
        };

        const onMouseLeave = () => setIsVisible(false);
        const onMouseEnter = () => {
            setIsVisible(true);
            startLoop();
        };

        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mouseover', onMouseOver, { passive: true });
        document.body.addEventListener('mouseleave', onMouseLeave);
        document.body.addEventListener('mouseenter', onMouseEnter);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseover', onMouseOver);
            document.body.removeEventListener('mouseleave', onMouseLeave);
            document.body.removeEventListener('mouseenter', onMouseEnter);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // Render nothing if on mobile/touch device
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
        return null;
    }

    return (
        <div 
            ref={containerRef}
            className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" 
            style={{ 
                opacity: isVisible && !shouldHide ? 1 : 0, 
                transition: 'opacity 0.25s ease' 
            }}
        >
            {/* Outer Circle - Hardware-accelerated transform */}
            <div ref={circleRef} className="absolute top-0 left-0 will-change-transform pointer-events-none">
                <div 
                    className="cursor-circle-inner -ml-[16px] -mt-[16px] w-8 h-8 rounded-full border-2 border-red-600/75 bg-transparent transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out flex items-center justify-center"
                />
            </div>
            
            {/* Inner Dot - Hardware-accelerated transform */}
            <div ref={dotRef} className="absolute top-0 left-0 will-change-transform pointer-events-none">
                <div 
                    className="cursor-dot-inner -ml-[4px] -mt-[4px] w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_rgba(229,9,20,0.8)] transition-[background-color,box-shadow,transform] duration-200"
                />
            </div>
        </div>
    );
};

export default CustomCursor;
