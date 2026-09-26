import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import Hls from 'hls.js';
import { TMDBService } from '../services/api';

// Time formatting helper (e.g. 125 -> 2:05, 3665 -> 1:01:05)
const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const totalSecs = Math.floor(secs);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const remSecs = totalSecs % 60;
    const formattedSecs = remSecs < 10 ? `0${remSecs}` : remSecs;

    if (hours > 0) {
        const formattedMins = mins < 10 ? `0${mins}` : mins;
        return `${hours}:${formattedMins}:${formattedSecs}`;
    }
    return `${mins}:${formattedSecs}`;
};

export const VideoPlayer = () => {
    const { 
        currentMedia, 
        closePlayer, 
        playMedia,
        addNotification,
        saveProgress,
    } = useApp();

    // ─── Playback State (100% Volume & Audio ON by default) ───
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [bufferedEnd, setBufferedEnd] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // ─── Controls & Menus State ───
    const [showControls, setShowControls] = useState(true);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
    const [settingsView, setSettingsView] = useState('main'); // 'main' | 'quality' | 'subtitle' | 'speed' | 'audio'
    const [centerIndicator, setCenterIndicator] = useState(null);

    // ─── Scrubber hover & drag state ───
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverPos, setHoverPos] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // ─── Netflix-style Next Episode Prompt & Curtain Countdown ───
    const [showNextEpPrompt, setShowNextEpPrompt] = useState(false);
    const [nextEpDismissed, setNextEpDismissed] = useState(false);
    const [countdownProgress, setCountdownProgress] = useState(0);

    // ─── Stream & Audio State ───
    const [resolvedStream, setResolvedStream] = useState(null);
    const [availableQualities, setAvailableQualities] = useState({});
    const [selectedQuality, setSelectedQuality] = useState('1080p');
    const [subtitles, setSubtitles] = useState([]);
    const [selectedSubtitle, setSelectedSubtitle] = useState('off');
    const [availableAudioTracks, setAvailableAudioTracks] = useState([]);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
    const [isResolving, setIsResolving] = useState(true);
    const [isVideoBuffering, setIsVideoBuffering] = useState(true);
    const [resolutionError, setResolutionError] = useState(false);
    const [retryTrigger, setRetryTrigger] = useState(0);

    const hlsRef = useRef(null);
    const savedSeekTimeRef = useRef(0);

    // ─── Extended Metadata, Episodes & Similar Content State ───
    const [details, setDetails] = useState(null);
    const [similarTitles, setSimilarTitles] = useState([]);
    const [activeSeason, setActiveSeason] = useState(currentMedia?.season || 1);
    const [seasonEpisodes, setSeasonEpisodes] = useState([]);
    const [loadedSeasonKey, setLoadedSeasonKey] = useState(null);

    // Track active media key for reset
    const mediaKey = currentMedia ? `${currentMedia.type}-${currentMedia.id}-${currentMedia.season || 1}-${currentMedia.episode || 1}` : null;
    const [prevMediaKey, setPrevMediaKey] = useState(mediaKey);
    if (mediaKey !== prevMediaKey) {
        const prevShowOrSeasonKey = prevMediaKey ? prevMediaKey.split('-').slice(0, 3).join('-') : null;
        const currentShowOrSeasonKey = mediaKey ? mediaKey.split('-').slice(0, 3).join('-') : null;

        setPrevMediaKey(mediaKey);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);
        setBufferedEnd(0);
        setResolvedStream(null);
        setAvailableQualities({});
        setSelectedQuality('1080p');
        setSubtitles([]);
        setSelectedSubtitle('off');
        setAvailableAudioTracks([]);
        setSelectedAudioTrack(0);
        setIsResolving(true);
        setIsVideoBuffering(true);
        setResolutionError(false);
        setShowNextEpPrompt(false);
        setNextEpDismissed(false);
        setCountdownProgress(0);

        if (prevShowOrSeasonKey !== currentShowOrSeasonKey) {
            setActiveSeason(currentMedia?.season || 1);
            setLoadedSeasonKey(null);
            setSeasonEpisodes([]);
        }
    }

    const currentSeasonKey = currentMedia ? `${currentMedia.id}-${activeSeason}` : null;
    const loadingEpisodes = currentMedia?.type === 'tv' && loadedSeasonKey !== currentSeasonKey;

    const videoRef = useRef(null);
    const playerViewportRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const progressRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const centerIndicatorTimeoutRef = useRef(null);

    // Reset video currentTime & savedSeekTime to 0 (or resumeTime) when switching episode or media
    useEffect(() => {
        savedSeekTimeRef.current = 0;
        if (videoRef.current) {
            const targetTime = currentMedia?.resumeTime && currentMedia.resumeTime > 5 ? currentMedia.resumeTime : 0;
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    }, [mediaKey, currentMedia?.resumeTime]);

    // Lock background body & html scroll to eliminate double scrollbars
    useEffect(() => {
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, []);

    // Screen Wake Lock (prevents screen saver / sleep while playing)
    useEffect(() => {
        let wakeLock = null;

        const requestWakeLock = async () => {
            if ('wakeLock' in navigator && isPlaying && !resolutionError) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                } catch {
                    // Ignore background tab or battery restrictions
                }
            }
        };

        const handleVisibilityChange = () => {
            if (wakeLock !== null && document.visibilityState === 'visible' && isPlaying && !resolutionError) {
                requestWakeLock();
            }
        };

        if (isPlaying && !resolutionError) {
            requestWakeLock();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock) {
                wakeLock.release().catch(() => {});
                wakeLock = null;
            }
        };
    }, [isPlaying, resolutionError]);

    // Stream Loading Watchdog Timeout (Auto-cycle quality if buffering stalls > 8s)
    useEffect(() => {
        if (!isResolving && !isVideoBuffering) return;

        const timeout = setTimeout(() => {
            if (isResolving || isVideoBuffering) {
                console.warn('Playback buffering timeout: cycling to alternative stream...');
                const qualityKeys = Object.keys(availableQualities || {});
                const currentIndex = qualityKeys.indexOf(selectedQuality);
                if (currentIndex !== -1 && currentIndex < qualityKeys.length - 1) {
                    setSelectedQuality(qualityKeys[currentIndex + 1]);
                } else {
                    setIsResolving(false);
                    setIsVideoBuffering(false);
                }
            }
        }, 8000);

        return () => clearTimeout(timeout);
    }, [isResolving, isVideoBuffering, retryTrigger, mediaKey, availableQualities, selectedQuality]);

    // Trigger temporary center ripple icon
    const flashCenterIndicator = useCallback((iconName) => {
        setCenterIndicator(iconName);
        if (centerIndicatorTimeoutRef.current) clearTimeout(centerIndicatorTimeoutRef.current);
        centerIndicatorTimeoutRef.current = setTimeout(() => {
            setCenterIndicator(null);
        }, 650);
    }, []);

    // Stream Resolution Effect (Unified Zero-Ad Direct Stream Engine)
    const mediaId = currentMedia?.id;
    const mediaType = currentMedia?.type || 'movie';
    const mediaSeason = currentMedia?.season || 1;
    const mediaEpisode = currentMedia?.episode || 1;

    useEffect(() => {
        if (!mediaId) return;
        let active = true;

        TMDBService.getStreamSource(
            mediaId,
            mediaType,
            mediaSeason,
            mediaEpisode
        ).then(res => {
            if (!active) return;
            setIsResolving(false);

            if (res && res.stream && res.stream.url) {
                const qualMap = {};
                if (res.stream.qualities && typeof res.stream.qualities === 'object') {
                    for (const [qKey, rawUrl] of Object.entries(res.stream.qualities)) {
                        if (rawUrl) {
                            qualMap[qKey] = rawUrl;
                        }
                    }
                }

                const mainUrl = res.stream.url;
                if (Object.keys(qualMap).length === 0) {
                    qualMap[res.stream.quality || '1080p FHD'] = mainUrl;
                }

                // Choose initial quality (4K > 1080p > 720p)
                const order = ['4K UHD', '4k', '1080p FHD', '1080p', '720p HD', '720p'];
                const bestQuality = order.find(q => qualMap[q]) || Object.keys(qualMap)[0] || '1080p FHD';

                // Process subtitles
                const parsedSubs = (res.subtitles || []).map(s => ({
                    label: s.label || 'English',
                    srclang: s.srclang || 'en',
                    url: s.url,
                    vttUrl: TMDBService.getSubtitleProxyUrl(s.url),
                }));

                // Process audio tracks
                if (Array.isArray(res.stream.audioTracks) && res.stream.audioTracks.length > 0) {
                    setAvailableAudioTracks(res.stream.audioTracks);
                    setSelectedAudioTrack(0);
                } else if (res.stream.audio) {
                    setAvailableAudioTracks([{ id: 0, name: `${res.stream.audio} (English)`, lang: 'en' }]);
                    setSelectedAudioTrack(0);
                }

                setAvailableQualities(qualMap);
                setSelectedQuality(bestQuality);
                setSubtitles(parsedSubs);
                setResolvedStream({
                    ...res.stream,
                    playUrl: qualMap[bestQuality] || mainUrl,
                });
                addNotification('Ultra HD Stream', `Streaming ${bestQuality} cinema`, 'hd');
            } else {
                setIsResolving(false);
                setIsVideoBuffering(false);
            }
        }).catch(err => {
            if (!active) return;
            console.warn('Unified stream resolution warning:', err);
            setIsResolving(false);
            setIsVideoBuffering(false);
        });

        return () => { active = false; };
    }, [mediaId, mediaType, mediaSeason, mediaEpisode, retryTrigger, addNotification]);

    const activeStreamUrl = availableQualities[selectedQuality] || resolvedStream?.playUrl || resolvedStream?.url || '';

    const isEmbedStream = typeof activeStreamUrl === 'string' && (
        activeStreamUrl.includes('/embed') || 
        activeStreamUrl.includes('vidlink.pro') || 
        activeStreamUrl.includes('vidsrc.to') || 
        activeStreamUrl.includes('2embed.cc') || 
        activeStreamUrl.includes('autoembed.to')
    );

    // Hls.js or HTML5 Native Video Mounting (For direct MP4/HLS streams)
    useEffect(() => {
        if (!activeStreamUrl || isEmbedStream || !videoRef.current) {
            if (isEmbedStream) {
                setIsResolving(false);
                setIsVideoBuffering(false);
            }
            return;
        }
        const video = videoRef.current;
        let hls = null;

        // Ensure 100% volume and unmuted on mount
        video.volume = volume;
        video.muted = isMuted;

        const isHls = activeStreamUrl.includes('.m3u8') || 
                      activeStreamUrl.includes('/proxy') ||
                      resolvedStream?.type === 'hls';

        const savedPos = savedSeekTimeRef.current > 5 
            ? savedSeekTimeRef.current 
            : (currentMedia?.resumeTime && currentMedia.resumeTime > 5 ? currentMedia.resumeTime : 0);

        if (isHls && Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                autoStartLoad: true,
                startLevel: -1,
            });
            hlsRef.current = hls;
            hls.loadSource(activeStreamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.volume = 1;
                video.muted = false;

                if (hls.levels && hls.levels.length > 0) {
                    const qualMap = { 'Auto': -1 };
                    hls.levels.forEach((lvl, idx) => {
                        const h = lvl.height || 1080;
                        qualMap[`${h}p`] = idx;
                    });
                    setAvailableQualities(qualMap);
                }

                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    const tracks = hls.audioTracks.map((t, idx) => ({
                        id: idx,
                        name: t.name || t.lang || `Track ${idx + 1}`,
                        lang: t.lang || '',
                    }));
                    setAvailableAudioTracks(tracks);

                    const engIdx = hls.audioTracks.findIndex(t => 
                        (t.lang && t.lang.toLowerCase().startsWith('en')) || 
                        (t.name && t.name.toLowerCase().includes('eng'))
                    );
                    if (engIdx !== -1) {
                        hls.audioTrack = engIdx;
                        setSelectedAudioTrack(engIdx);
                    } else {
                        setSelectedAudioTrack(hls.audioTrack);
                    }
                }

                if (savedPos > 5) {
                    video.currentTime = savedPos;
                    savedSeekTimeRef.current = 0;
                } else {
                    video.currentTime = 0;
                }

                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        setIsVideoBuffering(false);
                    }).catch(() => {
                        setIsVideoBuffering(false);
                    });
                }
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    setIsVideoBuffering(false);
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
        } else {
            hlsRef.current = null;
            video.src = activeStreamUrl;
            video.volume = 1;
            video.muted = false;
            if (savedPos > 5) {
                video.currentTime = savedPos;
                savedSeekTimeRef.current = 0;
            } else {
                video.currentTime = 0;
            }
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setIsPlaying(true);
                    setIsVideoBuffering(false);
                }).catch(() => {
                    setIsVideoBuffering(false);
                });
            }
        }

        return () => {
            if (hls) {
                hls.destroy();
                hlsRef.current = null;
            }
        };
    }, [activeStreamUrl, currentMedia?.id, currentMedia?.season, currentMedia?.episode, currentMedia?.resumeTime, volume, isMuted, resolvedStream?.type]);

    // Subtitle selection
    const handleSelectSubtitle = useCallback((srclang) => {
        setSelectedSubtitle(srclang);
        if (!videoRef.current) return;

        const tracks = videoRef.current.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            if (srclang === 'off') {
                tracks[i].mode = 'disabled';
            } else if (tracks[i].language === srclang || tracks[i].label === srclang) {
                tracks[i].mode = 'showing';
            } else {
                tracks[i].mode = 'disabled';
            }
        }
        addNotification('Subtitles', srclang === 'off' ? 'Subtitles off' : `Subtitles: ${srclang}`, 'subtitles');
    }, [addNotification]);

    // Quality Switcher
    const handleSelectQuality = useCallback((qKey) => {
        if (qKey === selectedQuality) return;
        setSelectedQuality(qKey);

        if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
            if (qKey === 'Auto') {
                hlsRef.current.currentLevel = -1;
            } else {
                const targetHeight = parseInt(qKey, 10);
                let lvlIdx = -1;
                const levels = hlsRef.current.levels;
                for (let i = 0; i < levels.length; i++) {
                    if (levels[i].height === targetHeight) {
                        lvlIdx = i;
                        break;
                    }
                }
                if (lvlIdx !== -1) {
                    hlsRef.current.currentLevel = lvlIdx;
                }
            }
            addNotification('Quality', `Switched to ${qKey}`, 'hd');
        } else if (availableQualities[qKey] && videoRef.current) {
            const curTime = videoRef.current.currentTime;
            savedSeekTimeRef.current = curTime;
            setIsVideoBuffering(true);
            videoRef.current.src = availableQualities[qKey];
            videoRef.current.currentTime = curTime;
            videoRef.current.play().catch(() => {});
            addNotification('Quality', `Switched to ${qKey}`, 'hd');
        }
    }, [selectedQuality, availableQualities, addNotification]);

    // Stream auto-recovery on error
    const handleVideoError = useCallback(() => {
        console.warn('Video playback error on current stream.');
        const qualityKeys = Object.keys(availableQualities || {});
        const currentIndex = qualityKeys.indexOf(selectedQuality);

        if (currentIndex !== -1 && currentIndex < qualityKeys.length - 1) {
            const nextQuality = qualityKeys[currentIndex + 1];
            console.log(`Auto-switching to alternative quality: ${nextQuality}`);
            setSelectedQuality(nextQuality);
            const nextUrl = availableQualities[nextQuality];

            if (nextUrl && videoRef.current) {
                const curTime = videoRef.current.currentTime || 0;
                savedSeekTimeRef.current = curTime;
                setIsVideoBuffering(true);
                videoRef.current.src = nextUrl;
                videoRef.current.currentTime = curTime;
                videoRef.current.play().catch(() => {});
                return;
            }
        }

        const fallbackUrl = availableQualities['1080p FHD'] || availableQualities['720p HD'] || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        if (videoRef.current && videoRef.current.src !== fallbackUrl) {
            videoRef.current.src = fallbackUrl;
            videoRef.current.play().catch(() => {
                setIsResolving(false);
                setIsVideoBuffering(false);
            });
        } else {
            setIsResolving(false);
            setIsVideoBuffering(false);
        }
    }, [availableQualities, selectedQuality]);

    // Audio Track Switcher
    const handleSelectAudio = useCallback((trackId) => {
        setSelectedAudioTrack(trackId);
        if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks[trackId] !== undefined) {
            hlsRef.current.audioTrack = trackId;
            const track = hlsRef.current.audioTracks[trackId];
            addNotification('Audio Track', `Switched to ${track.name || track.lang || `Track ${trackId + 1}`}`, 'volume_up');
        }
    }, [addNotification]);

    // Playback Speed Switcher
    const handleSelectSpeed = useCallback((speed) => {
        setPlaybackSpeed(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
            addNotification('Speed', `${speed}x speed`, 'speed');
        }
    }, [addNotification]);

    // Auto-hide Controls on Inactivity
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
                setShowSettingsMenu(false);
                setShowSubtitleMenu(false);
            }, 3500);
        }
    }, [isPlaying]);

    useEffect(() => {
        if (!isPlaying) return;
        const timer = setTimeout(() => {
            setShowControls(false);
            setShowSettingsMenu(false);
            setShowSubtitleMenu(false);
        }, 3500);
        return () => clearTimeout(timer);
    }, [isPlaying]);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.player-settings-container') && !e.target.closest('.player-subtitles-container')) {
                setShowSettingsMenu(false);
                setShowSubtitleMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Detailed Metadata & Similar Media
    useEffect(() => {
        if (!currentMedia?.id) return;
        let active = true;

        Promise.all([
            TMDBService.getMediaDetails(currentMedia.id, currentMedia.type || 'movie').catch(() => null),
            TMDBService.getSimilarMedia(currentMedia.id, currentMedia.type || 'movie').catch(() => [])
        ]).then(([detailsData, similarData]) => {
            if (!active) return;
            if (detailsData) setDetails(detailsData);
            if (Array.isArray(similarData)) setSimilarTitles(similarData.slice(0, 18));
        });

        return () => { active = false; };
    }, [currentMedia?.id, currentMedia?.type]);

    // Fetch Season Episodes when activeSeason changes (for TV)
    useEffect(() => {
        if (currentMedia?.type !== 'tv' || !currentMedia?.id) return;
        let active = true;
        const targetSeasonKey = `${currentMedia.id}-${activeSeason}`;

        TMDBService.getSeasonDetails(currentMedia.id, activeSeason)
            .then(seasonData => {
                if (!active) return;
                if (seasonData && Array.isArray(seasonData.episodes)) {
                    setSeasonEpisodes(seasonData.episodes);
                } else {
                    setSeasonEpisodes([]);
                }
                setLoadedSeasonKey(targetSeasonKey);
            })
            .catch(err => {
                if (!active) return;
                console.warn('Error fetching season details:', err);
                setSeasonEpisodes([]);
                setLoadedSeasonKey(targetSeasonKey);
            });

        return () => { active = false; };
    }, [currentMedia?.id, currentMedia?.type, activeSeason]);

    // Periodic Watch Progress Saver (Profile-Isolated)
    useEffect(() => {
        if (!currentMedia || !videoRef.current) return;

        const interval = setInterval(() => {
            const video = videoRef.current;
            if (video && !video.paused && video.duration > 0) {
                const cur = video.currentTime;
                const dur = video.duration;
                const pct = Math.floor((cur / dur) * 100);
                const rem = `${formatTime(dur - cur)} remaining`;
                const isTv = currentMedia.type === 'tv';
                saveProgress(
                    currentMedia.id,
                    pct,
                    rem,
                    isTv && currentMedia.season ? currentMedia.season : null,
                    isTv && currentMedia.episode ? currentMedia.episode : null,
                    currentMedia.type || 'movie',
                    currentMedia.title || '',
                    currentMedia.poster || currentMedia.backdrop || '',
                    cur,
                    dur
                );
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [currentMedia, saveProgress]);

    // Playback Control Actions
    const togglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play().then(() => {
                setIsPlaying(true);
                flashCenterIndicator('play_arrow');
            }).catch(console.error);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            flashCenterIndicator('pause');
        }
    };

    const seekBy = (seconds) => {
        if (!videoRef.current) return;
        const newTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        flashCenterIndicator(seconds > 0 ? 'forward_10' : 'replay_10');
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && !isDragging) {
            const curTime = videoRef.current.currentTime;
            const dur = videoRef.current.duration || duration;
            setCurrentTime(curTime);
            if (videoRef.current.buffered.length > 0) {
                const end = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
                setBufferedEnd(end);
            }

            // Trigger Netflix-style Next Episode prompt near end (last 15s)
            if (currentMedia?.type === 'tv' && dur > 40 && !nextEpDismissed && !showNextEpPrompt) {
                if (dur - curTime <= 15) {
                    const curEp = currentMedia.episode || 1;
                    const curSeason = currentMedia.season || 1;
                    const totalSeasons = Math.max(1, details?.totalSeasons || details?.number_of_seasons || curSeason);
                    const hasMoreInSeason = seasonEpisodes.length > 0 ? curEp < seasonEpisodes.length : true;
                    const hasMoreSeasons = curSeason < totalSeasons;

                    if (hasMoreInSeason || hasMoreSeasons) {
                        setCountdownProgress(0);
                        setShowNextEpPrompt(true);
                    }
                }
            }
        }
    };

    const handleVideoEnded = () => {
        setIsPlaying(false);
        if (currentMedia?.type === 'tv' && !nextEpDismissed && !showNextEpPrompt) {
            const curEp = currentMedia.episode || 1;
            const curSeason = currentMedia.season || 1;
            const totalSeasons = Math.max(1, details?.totalSeasons || details?.number_of_seasons || curSeason);
            const hasMoreInSeason = seasonEpisodes.length > 0 ? curEp < seasonEpisodes.length : true;
            const hasMoreSeasons = curSeason < totalSeasons;

            if (hasMoreInSeason || hasMoreSeasons) {
                setCountdownProgress(0);
                setShowNextEpPrompt(true);
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
            if (savedSeekTimeRef.current > 5) {
                videoRef.current.currentTime = savedSeekTimeRef.current;
                savedSeekTimeRef.current = 0;
            } else if (currentMedia?.resumeTime && currentMedia.resumeTime > 5) {
                videoRef.current.currentTime = currentMedia.resumeTime;
                addNotification('Resumed Playback', `Resumed at ${formatTime(currentMedia.resumeTime)}`, 'play_circle');
            } else {
                videoRef.current.currentTime = 0;
            }
        }
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        setIsMuted(val === 0);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
        }
    };

    const toggleMute = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        if (videoRef.current) {
            videoRef.current.muted = nextMuted;
            videoRef.current.volume = nextMuted ? 0 : volume;
        }
    };

    const toggleFullscreen = () => {
        const el = playerViewportRef.current;
        if (!el) return;

        const isFs = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (!isFs) {
            if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    };

    // Sync Fullscreen State with Document
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            ));
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
        };
    }, []);

    // Scrubber Drag & Click Handling
    const handleProgressMouseDown = (e) => {
        if (!progressRef.current || duration <= 0) return;
        setIsDragging(true);
        const rect = progressRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = pct * duration;
        setCurrentTime(newTime);
        if (videoRef.current) videoRef.current.currentTime = newTime;

        const onMouseMove = (moveEvent) => {
            const moveX = moveEvent.clientX - rect.left;
            const movePct = Math.max(0, Math.min(1, moveX / rect.width));
            const scrubTime = movePct * duration;
            setCurrentTime(scrubTime);
            if (videoRef.current) videoRef.current.currentTime = scrubTime;
        };

        const onMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleProgressMouseMove = (e) => {
        if (!progressRef.current || duration <= 0) return;
        const rect = progressRef.current.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, hoverX / rect.width));
        setHoverPos(pct * 100);
        setHoverTime(pct * duration);
    };

    const handleProgressMouseLeave = () => {
        setHoverTime(null);
        setHoverPos(null);
    };

    // TV Show Episode Navigation
    const handleNextEpisode = useCallback(() => {
        if (currentMedia?.type !== 'tv') return;
        const curEp = currentMedia.episode || 1;
        const curSeason = currentMedia.season || 1;
        const totalSeasons = Math.max(1, details?.totalSeasons || details?.number_of_seasons || curSeason);

        let targetSeason = curSeason;
        let targetEp = curEp + 1;

        if (seasonEpisodes.length > 0 && curEp >= seasonEpisodes.length && curSeason < totalSeasons) {
            targetSeason = curSeason + 1;
            targetEp = 1;
            setActiveSeason(targetSeason);
        }

        setShowNextEpPrompt(false);
        setNextEpDismissed(false);
        setCountdownProgress(0);

        const cleanMedia = { ...currentMedia };
        delete cleanMedia.currentTime;
        delete cleanMedia.resumeTime;
        playMedia({
            ...cleanMedia,
            season: targetSeason,
            episode: targetEp,
            currentTime: 0,
            resumeTime: 0
        });
        addNotification('Next Episode', `Playing Season ${targetSeason} • Episode ${targetEp}`, 'skip_next');
    }, [currentMedia, details, seasonEpisodes, playMedia, addNotification]);

    // Netflix-style Next Episode Countdown Timer
    useEffect(() => {
        if (!showNextEpPrompt) return;

        const intervalMs = 100;
        const totalDurationMs = 10000;
        const step = (intervalMs / totalDurationMs) * 100;

        const timer = setInterval(() => {
            setCountdownProgress(prev => {
                if (prev + step >= 100) {
                    clearInterval(timer);
                    handleNextEpisode();
                    return 100;
                }
                return prev + step;
            });
        }, intervalMs);

        return () => clearInterval(timer);
    }, [showNextEpPrompt, handleNextEpisode]);

    const handlePrevEpisode = () => {
        if (currentMedia?.type === 'tv' && (currentMedia.episode || 1) > 1) {
            const prevEp = (currentMedia.episode || 1) - 1;
            const cleanMedia = { ...currentMedia };
            delete cleanMedia.currentTime;
            delete cleanMedia.resumeTime;
            playMedia({
                ...cleanMedia,
                episode: prevEp,
                currentTime: 0,
                resumeTime: 0
            });
            addNotification('Previous Episode', `Playing Season ${currentMedia.season || 1} • Episode ${prevEp}`, 'skip_previous');
        }
    };

    const handleEpisodeClick = (ep) => {
        const epNum = ep.episodeNumber || ep.episode_number || 1;
        const cleanMedia = { ...currentMedia };
        delete cleanMedia.currentTime;
        delete cleanMedia.resumeTime;
        playMedia({
            ...cleanMedia,
            season: activeSeason,
            episode: epNum,
            currentTime: 0,
            resumeTime: 0
        });
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        addNotification('Now Playing', `Season ${activeSeason} • Episode ${epNum}: ${ep.name || ep.title || `Episode ${epNum}`}`, 'play_circle');
    };

    const handleSeasonChange = (seasonNum) => {
        setActiveSeason(seasonNum);
    };

    const handleSimilarClick = (item) => {
        playMedia({
            id: item.id,
            type: item.type || (item.media_type === 'tv' ? 'tv' : 'movie'),
            title: item.title || item.name,
            poster: item.poster || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null),
            backdrop: item.backdrop || (item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null),
            overview: item.overview,
            rating: item.rating || item.vote_average,
            year: item.year,
            season: 1,
            episode: 1,
            currentTime: 0,
            resumeTime: 0
        });
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        addNotification('Now Playing', item.title || item.name, 'play_circle');
    };

    // Close Player & Save Progress
    const handleClose = () => {
        if (videoRef.current && duration > 0) {
            const cur = videoRef.current.currentTime;
            const pct = Math.floor((cur / duration) * 100);
            const isTv = currentMedia.type === 'tv';
            saveProgress(
                currentMedia.id,
                pct,
                `${formatTime(duration - cur)} remaining`,
                isTv && currentMedia.season ? currentMedia.season : null,
                isTv && currentMedia.episode ? currentMedia.episode : null,
                currentMedia.type || 'movie',
                currentMedia.title || '',
                currentMedia.poster || currentMedia.backdrop || '',
                cur,
                duration
            );
        }
        closePlayer();
    };

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            resetControlsTimeout();

            switch (e.key) {
                case ' ':
                case 'k':
                case 'K':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                case 'j':
                case 'J':
                    e.preventDefault();
                    seekBy(-10);
                    break;
                case 'ArrowRight':
                case 'l':
                case 'L':
                    e.preventDefault();
                    seekBy(10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(prev => {
                        const next = Math.min(1, prev + 0.1);
                        if (videoRef.current) videoRef.current.volume = next;
                        return next;
                    });
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(prev => {
                        const next = Math.max(0, prev - 0.1);
                        if (videoRef.current) videoRef.current.volume = next;
                        return next;
                    });
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'c':
                case 'C':
                    e.preventDefault();
                    if (subtitles.length > 0) {
                        const currentIndex = subtitles.findIndex(s => s.srclang === selectedSubtitle);
                        if (currentIndex === -1) {
                            handleSelectSubtitle(subtitles[0].srclang);
                        } else if (currentIndex < subtitles.length - 1) {
                            handleSelectSubtitle(subtitles[currentIndex + 1].srclang);
                        } else {
                            handleSelectSubtitle('off');
                        }
                    }
                    break;
                case 'Escape':
                    if (document.fullscreenElement || isFullscreen) {
                        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    } else {
                        e.preventDefault();
                        handleClose();
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    if (!currentMedia) return null;

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

    // Netflix-style Next Episode Data
    const curEp = currentMedia?.episode || 1;
    const curSeason = currentMedia?.season || 1;
    const totalSeasons = Math.max(1, details?.totalSeasons || details?.number_of_seasons || curSeason);
    const isCrossingSeason = seasonEpisodes.length > 0 && curEp >= seasonEpisodes.length && curSeason < totalSeasons;
    const nextSeasonNum = isCrossingSeason ? curSeason + 1 : curSeason;
    const nextEpNum = isCrossingSeason ? 1 : curEp + 1;
    const nextEpData = !isCrossingSeason 
        ? seasonEpisodes.find(e => (e.episodeNumber || e.episode_number) === nextEpNum) 
        : null;
    const nextEpTitle = nextEpData?.name || nextEpData?.title || `Episode ${nextEpNum}`;
    const nextEpOverview = nextEpData?.overview || '';
    const nextEpThumbnail = nextEpData?.still_path 
        ? `https://image.tmdb.org/t/p/w500${nextEpData.still_path}` 
        : (currentMedia?.backdrop || currentMedia?.poster || '');
    const remainingSecs = Math.max(1, Math.ceil(10 * (1 - countdownProgress / 100)));

    return (
        <div 
            ref={scrollContainerRef}
            className={`fixed inset-0 z-50 bg-neutral-950 text-white select-none ${
                isFullscreen ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'
            }`}
        >
            {/* ═══════════════ CINEMA VIDEO STAGE ═══════════════ */}
            <div 
                ref={playerViewportRef}
                onMouseMove={resetControlsTimeout}
                onClick={resetControlsTimeout}
                className={`relative transition-all duration-300 ${
                    isFullscreen 
                        ? 'fixed inset-0 w-screen h-screen z-50 bg-black flex items-center justify-center overflow-hidden' 
                        : 'w-full max-w-[1400px] aspect-video mx-auto bg-black shadow-2xl flex items-center justify-center overflow-hidden border-b border-white/10 sm:rounded-b-2xl'
                } ${!showControls && isPlaying ? 'cursor-none' : 'cursor-default'}`}
            >
                {/* ═══════════════ TOP HEADER OVERLAY (Clean & Minimalist: Zero Badges on Top Right) ═══════════════ */}
                <div 
                    className={`absolute top-0 left-0 right-0 z-40 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 pointer-events-auto ${
                        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                >
                    {/* Media Title & Season Info */}
                    <div className="flex items-center gap-3.5">
                        <button 
                            onClick={handleClose}
                            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition cursor-pointer active:scale-95"
                            title="Back / Close (Esc)"
                        >
                            <span className="material-symbols-outlined text-2xl">arrow_back</span>
                        </button>

                        <div>
                            <h2 className="text-white font-extrabold text-sm sm:text-base md:text-lg tracking-wide drop-shadow-md line-clamp-1">
                                {currentMedia.title}
                            </h2>
                            {currentMedia.type === 'tv' && (
                                <p className="text-white/60 text-xs font-semibold">
                                    Season {activeSeason} • Episode {currentMedia.episode || 1}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Top Right: Server & Quality Switcher Dropdown */}
                    <div className="flex items-center gap-2">
                        {Object.keys(availableQualities).length > 1 && (
                            <div className="relative group">
                                <button
                                    className="px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg active:scale-95"
                                    title="Switch Streaming Server"
                                >
                                    <span className="material-symbols-outlined text-base text-red-500">dns</span>
                                    <span className="max-w-[130px] truncate">{selectedQuality}</span>
                                    <span className="material-symbols-outlined text-sm text-white/60">expand_more</span>
                                </button>

                                {/* Dropdown Menu */}
                                <div className="absolute right-0 top-full mt-2 w-56 py-1.5 rounded-xl bg-neutral-900/95 border border-white/15 backdrop-blur-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                    <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider border-b border-white/10 mb-1">
                                        Select Server / Quality
                                    </div>
                                    {Object.keys(availableQualities).map(qKey => (
                                        <button
                                            key={qKey}
                                            onClick={() => {
                                                setSelectedQuality(qKey);
                                                setIsResolving(true);
                                                setIsVideoBuffering(true);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                                                selectedQuality === qKey 
                                                    ? 'bg-red-600/20 text-red-400 font-bold' 
                                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            <span>{qKey}</span>
                                            {selectedQuality === qKey && (
                                                <span className="material-symbols-outlined text-sm text-red-500">check</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════ VIDEO STAGE (Seamless Dual-Engine Cinema Player) ═══════════════ */}
                <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                    {isEmbedStream ? (
                        <iframe
                            key={activeStreamUrl}
                            src={activeStreamUrl}
                            title={currentMedia.title}
                            className="w-full h-full border-0 bg-black absolute inset-0 z-10"
                            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock"
                            onLoad={() => {
                                setIsResolving(false);
                                setIsVideoBuffering(false);
                                setResolutionError(false);
                            }}
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            playsInline
                            autoPlay
                            className="w-full h-full object-contain cursor-pointer absolute inset-0 z-10"
                            onClick={togglePlay}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={handleVideoEnded}
                            onError={handleVideoError}
                            onWaiting={() => setIsVideoBuffering(true)}
                            onPlaying={() => {
                                setIsPlaying(true);
                                setIsVideoBuffering(false);
                                setResolutionError(false);
                            }}
                        >
                            {/* Subtitle WebVTT Tracks */}
                            {subtitles.map((sub, idx) => (
                                <track
                                    key={`${sub.srclang}-${idx}`}
                                    kind="subtitles"
                                    label={sub.label}
                                    src={sub.vttUrl || sub.url}
                                    srcLang={sub.srclang}
                                    default={sub.srclang === selectedSubtitle}
                                />
                            ))}
                        </video>
                    )}

                    {/* Loading & Buffering Spinner */}
                    {(isResolving || isVideoBuffering) && !resolutionError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-30">
                            <div className="w-12 h-12 rounded-full border-3 border-white/20 border-t-red-600 animate-spin shadow-[0_0_20px_rgba(229,9,20,0.6)]" />
                            <span className="text-xs font-bold text-white/80 mt-3 tracking-wider uppercase">
                                {isResolving ? 'Resolving Ultra HD Stream...' : 'Buffering...'}
                            </span>
                        </div>
                    )}

                    {/* Center Action Ripple Indicator */}
                    {centerIndicator && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-scale-ripple">
                            <div className="w-20 h-20 rounded-full bg-black/70 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-2xl">
                                <span className="material-symbols-outlined text-4xl font-extrabold">
                                    {centerIndicator}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Stream Error / Offline Fallback Card */}
                    {resolutionError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 bg-black/85 backdrop-blur-md z-30">
                            <div className="w-14 h-14 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-3xl">play_disabled</span>
                            </div>
                            <div className="max-w-md">
                                <h3 className="text-white font-bold text-base sm:text-lg">Direct Stream Unavailable</h3>
                                <p className="text-white/60 text-xs mt-1.5 leading-relaxed">
                                    We could not resolve an active seed stream for this title at this moment.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsResolving(true);
                                    setIsVideoBuffering(true);
                                    setResolutionError(false);
                                    setRetryTrigger(prev => prev + 1);
                                }}
                                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-lg shadow-red-900/40 cursor-pointer active:scale-95 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-base">refresh</span>
                                <span>Retry Stream</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ═══════════════ BOTTOM CONTROLS HUD ═══════════════ */}
                <div 
                    className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-4 sm:px-8 pb-6 pt-12 transition-opacity duration-300 pointer-events-auto ${
                        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                >
                    {/* Progress Bar & Scrubber */}
                    <div 
                        ref={progressRef}
                        onMouseDown={handleProgressMouseDown}
                        onMouseMove={handleProgressMouseMove}
                        onMouseLeave={handleProgressMouseLeave}
                        className="relative w-full h-3 cursor-pointer group flex items-center mb-4"
                    >
                        <div className="w-full h-1.5 group-hover:h-2.5 bg-white/20 rounded-full overflow-hidden transition-all relative">
                            {/* Buffer bar */}
                            <div 
                                className="absolute top-0 bottom-0 left-0 bg-white/30 transition-all duration-300 rounded-full"
                                style={{ width: `${Math.min(100, bufferPct)}%` }}
                            />
                            {/* Progress bar in red */}
                            <div 
                                className="absolute top-0 bottom-0 left-0 bg-red-600 rounded-full"
                                style={{ width: `${Math.min(100, progressPct)}%` }}
                            />
                        </div>

                        {/* Scrubber Thumb Knob */}
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 border-2 border-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none"
                            style={{ left: `calc(${progressPct}% - 8px)` }}
                        />

                        {/* Hover Timestamp Tooltip */}
                        {hoverTime !== null && hoverPos !== null && (
                            <div 
                                className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white font-mono text-[11px] px-2 py-0.5 rounded border border-white/20 pointer-events-none shadow-xl"
                                style={{ left: `${hoverPos}%` }}
                            >
                                {formatTime(hoverTime)}
                            </div>
                        )}
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between gap-3 text-white">
                        {/* Left Controls: Play/Pause, Rewind, FastForward, Prev/Next Ep, Volume, Time */}
                        <div className="flex items-center gap-2 sm:gap-4">
                            {/* Prev Episode (TV series) */}
                            {currentMedia.type === 'tv' && (
                                <button
                                    onClick={handlePrevEpisode}
                                    disabled={(currentMedia.episode || 1) <= 1}
                                    className={`text-white hover:text-red-500 transition cursor-pointer flex items-center ${
                                        (currentMedia.episode || 1) <= 1 ? 'opacity-30 cursor-not-allowed' : ''
                                    }`}
                                    title="Previous Episode"
                                >
                                    <span className="material-symbols-outlined text-2xl sm:text-3xl">skip_previous</span>
                                </button>
                            )}

                            {/* Rewind 10s */}
                            <button
                                onClick={() => seekBy(-10)}
                                className="text-white hover:text-red-500 transition cursor-pointer flex items-center active:scale-90"
                                title="Rewind 10s (Left Arrow)"
                            >
                                <span className="material-symbols-outlined text-2xl sm:text-3xl">replay_10</span>
                            </button>

                            {/* Play / Pause Toggle */}
                            <button
                                onClick={togglePlay}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center transition shadow-lg shadow-white/20 cursor-pointer"
                                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                            >
                                <span className="material-symbols-outlined text-2xl sm:text-3xl font-extrabold fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {isPlaying ? 'pause' : 'play_arrow'}
                                </span>
                            </button>

                            {/* Forward 10s */}
                            <button
                                onClick={() => seekBy(10)}
                                className="text-white hover:text-red-500 transition cursor-pointer flex items-center active:scale-90"
                                title="Forward 10s (Right Arrow)"
                            >
                                <span className="material-symbols-outlined text-2xl sm:text-3xl">forward_10</span>
                            </button>

                            {/* Volume Control */}
                            <div className="flex items-center gap-1.5 group/vol">
                                <button
                                    onClick={toggleMute}
                                    className="text-white hover:text-red-500 transition cursor-pointer flex items-center"
                                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                                >
                                    <span className="material-symbols-outlined text-xl sm:text-2xl">
                                        {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                                    </span>
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="w-14 sm:w-20 h-1 bg-white/20 rounded-full accent-red-600 appearance-none cursor-pointer hidden group-hover/vol:inline-block sm:inline-block"
                                />
                            </div>

                            {/* Time Readout */}
                            <div className="font-mono text-xs sm:text-sm text-white/80 whitespace-nowrap ml-1 sm:ml-2">
                                <span>{formatTime(currentTime)}</span>
                                <span className="text-white/40 mx-1">/</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Right Controls: Exactly 3 Buttons (Subtitles, Settings, Fullscreen) */}
                        <div className="flex items-center gap-3 sm:gap-4 player-settings-container relative">
                            
                            {/* ── 1. SUBTITLE BUTTON ── */}
                            <div className="relative player-subtitles-container">
                                <button
                                    onClick={() => {
                                        setShowSubtitleMenu(prev => !prev);
                                        setShowSettingsMenu(false);
                                    }}
                                    className={`text-white hover:text-white/80 active:scale-95 transition cursor-pointer flex items-center justify-center p-1 ${
                                        selectedSubtitle !== 'off' ? 'text-red-500' : ''
                                    }`}
                                    title="Subtitles (C)"
                                >
                                    <span className="material-symbols-outlined text-2xl sm:text-3xl">
                                        subtitles
                                    </span>
                                </button>

                                {/* Quick Subtitle Popup Menu */}
                                {showSubtitleMenu && (
                                    <div className="absolute bottom-12 right-0 w-64 max-h-72 overflow-y-auto custom-scrollbar bg-[#141414]/95 border border-white/10 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95)] p-2 z-50 flex flex-col gap-1 backdrop-blur-2xl text-white ring-1 ring-white/5 animate-fade-in">
                                        <div className="px-3 py-2 border-b border-white/10 text-[11px] font-bold text-white/50 uppercase tracking-wider">
                                            Subtitles
                                        </div>
                                        <button
                                            onClick={() => {
                                                handleSelectSubtitle('off');
                                                setShowSubtitleMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                selectedSubtitle === 'off'
                                                    ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                            }`}
                                        >
                                            <span>Off</span>
                                            {selectedSubtitle === 'off' && (
                                                <span className="material-symbols-outlined text-base text-red-500">check</span>
                                            )}
                                        </button>
                                        {subtitles.map((sub, idx) => {
                                            const isSelected = selectedSubtitle === sub.srclang;
                                            return (
                                                <button
                                                    key={`${sub.srclang}-${idx}`}
                                                    onClick={() => {
                                                        handleSelectSubtitle(sub.srclang);
                                                        setShowSubtitleMenu(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                            : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                                    }`}
                                                >
                                                    <span className="truncate pr-2">{sub.label}</span>
                                                    {isSelected && (
                                                        <span className="material-symbols-outlined text-base text-red-500">check</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {subtitles.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-white/50 text-center">
                                                Auto English subtitles active
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── 2. SETTINGS BUTTON (Quality, Audio, Subtitles, Speed - NO SERVER) ── */}
                            <button
                                onClick={() => {
                                    setShowSettingsMenu(prev => !prev);
                                    setShowSubtitleMenu(false);
                                    setSettingsView('main');
                                }}
                                className={`text-white hover:text-white/80 active:scale-95 transition cursor-pointer flex items-center justify-center p-1 ${
                                    showSettingsMenu ? 'rotate-45' : ''
                                }`}
                                title="Settings"
                            >
                                <span className="material-symbols-outlined text-2xl sm:text-3xl">
                                    settings
                                </span>
                            </button>

                            {/* Settings Dropdown Menu */}
                            {showSettingsMenu && (
                                <div className="absolute bottom-12 right-0 w-72 max-h-[22rem] overflow-y-auto custom-scrollbar bg-[#141414]/95 border border-white/10 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95)] p-2 z-50 flex flex-col gap-1 backdrop-blur-2xl text-white ring-1 ring-white/5 animate-fade-in">
                                    {settingsView === 'main' && (
                                        <>
                                            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1">
                                                <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Playback Settings</span>
                                                <span className="material-symbols-outlined text-base text-red-500">tune</span>
                                            </div>

                                            {/* Quality Option */}
                                            <button
                                                onClick={() => setSettingsView('quality')}
                                                className="group w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="material-symbols-outlined text-lg text-white/70 group-hover:text-red-500 transition-colors">hd</span>
                                                    <span>Quality</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-white/50 text-[11px]">
                                                    <span className="uppercase font-bold text-white/90">{selectedQuality}</span>
                                                    <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                                                </div>
                                            </button>

                                            {/* Audio Track Option */}
                                            <button
                                                onClick={() => setSettingsView('audio')}
                                                className="group w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="material-symbols-outlined text-lg text-white/70 group-hover:text-red-500 transition-colors">volume_up</span>
                                                    <span>Audio Track</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-white/50 text-[11px]">
                                                    <span className="font-bold text-white/90 truncate max-w-[95px]">
                                                        {availableAudioTracks[selectedAudioTrack]?.name || 'English'}
                                                    </span>
                                                    <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                                                </div>
                                            </button>

                                            {/* Subtitles Option */}
                                            <button
                                                onClick={() => setSettingsView('subtitle')}
                                                className="group w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="material-symbols-outlined text-lg text-white/70 group-hover:text-red-500 transition-colors">subtitles</span>
                                                    <span>Subtitles</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-white/50 text-[11px]">
                                                    <span className="font-bold text-white/90 truncate max-w-[95px]">
                                                        {selectedSubtitle === 'off' ? 'Off' : (subtitles.find(s => s.srclang === selectedSubtitle)?.label || selectedSubtitle)}
                                                    </span>
                                                    <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                                                </div>
                                            </button>

                                            {/* Playback Speed Option */}
                                            <button
                                                onClick={() => setSettingsView('speed')}
                                                className="group w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="material-symbols-outlined text-lg text-white/70 group-hover:text-red-500 transition-colors">speed</span>
                                                    <span>Playback Speed</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-white/50 text-[11px]">
                                                    <span className="font-mono font-bold text-white/90">{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}</span>
                                                    <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                                                </div>
                                            </button>
                                        </>
                                    )}

                                    {settingsView === 'quality' && (
                                        <>
                                            <div className="flex items-center gap-2.5 px-2 py-2 border-b border-white/10 mb-1.5 sticky top-0 bg-[#141414]/95 backdrop-blur-md z-10">
                                                <button
                                                    onClick={() => setSettingsView('main')}
                                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer active:scale-95"
                                                    title="Back"
                                                >
                                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                                </button>
                                                <span className="text-xs font-bold text-white tracking-wide uppercase">Quality</span>
                                            </div>
                                            {Object.keys(availableQualities).length > 0 ? (
                                                Object.keys(availableQualities).map(quality => {
                                                    const isSelected = selectedQuality === quality;
                                                    return (
                                                        <button
                                                            key={quality}
                                                            onClick={() => {
                                                                handleSelectQuality(quality);
                                                                setShowSettingsMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                                    : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                                            }`}
                                                        >
                                                            <span>{quality} {quality === '4k' || quality === '2160p' ? '(4K Ultra HD)' : quality === '1080p' ? '(Full HD)' : quality === '720p' ? '(HD)' : ''}</span>
                                                            {isSelected && (
                                                                <span className="material-symbols-outlined text-base text-red-500">check</span>
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-3 py-2 text-xs text-white/50 text-center">
                                                    1080p Full HD (Automatic)
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {settingsView === 'audio' && (
                                        <>
                                            <div className="flex items-center gap-2.5 px-2 py-2 border-b border-white/10 mb-1.5 sticky top-0 bg-[#141414]/95 backdrop-blur-md z-10">
                                                <button
                                                    onClick={() => setSettingsView('main')}
                                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer active:scale-95"
                                                    title="Back"
                                                >
                                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                                </button>
                                                <span className="text-xs font-bold text-white tracking-wide uppercase">Audio Track</span>
                                            </div>
                                            {availableAudioTracks.length > 0 ? (
                                                availableAudioTracks.map(track => {
                                                    const isSelected = selectedAudioTrack === track.id;
                                                    return (
                                                        <button
                                                            key={track.id}
                                                            onClick={() => {
                                                                handleSelectAudio(track.id);
                                                                setShowSettingsMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                                    : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                                            }`}
                                                        >
                                                            <span>{track.name}</span>
                                                            {isSelected && (
                                                                <span className="material-symbols-outlined text-base text-red-500">check</span>
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-3 py-2 text-xs text-white/50 text-center">
                                                    Dolby Digital 5.1 / English
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {settingsView === 'subtitle' && (
                                        <>
                                            <div className="flex items-center gap-2.5 px-2 py-2 border-b border-white/10 mb-1.5 sticky top-0 bg-[#141414]/95 backdrop-blur-md z-10">
                                                <button
                                                    onClick={() => setSettingsView('main')}
                                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer active:scale-95"
                                                    title="Back"
                                                >
                                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                                </button>
                                                <span className="text-xs font-bold text-white tracking-wide uppercase">Subtitles</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    handleSelectSubtitle('off');
                                                    setShowSettingsMenu(false);
                                                }}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                    selectedSubtitle === 'off'
                                                        ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                        : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                                }`}
                                            >
                                                <span>Off</span>
                                                {selectedSubtitle === 'off' && (
                                                    <span className="material-symbols-outlined text-base text-red-500">check</span>
                                                )}
                                            </button>
                                            {subtitles.map((sub, idx) => {
                                                const isSelected = selectedSubtitle === sub.srclang;
                                                return (
                                                    <button
                                                        key={`${sub.srclang}-${idx}`}
                                                        onClick={() => {
                                                            handleSelectSubtitle(sub.srclang);
                                                            setShowSettingsMenu(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                                : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                                        }`}
                                                    >
                                                        <span className="truncate pr-2">{sub.label}</span>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined text-base text-red-500">check</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}

                                    {settingsView === 'speed' && (
                                        <>
                                            <div className="flex items-center gap-2.5 px-2 py-2 border-b border-white/10 mb-1.5 sticky top-0 bg-[#141414]/95 backdrop-blur-md z-10">
                                                <button
                                                    onClick={() => setSettingsView('main')}
                                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer active:scale-95"
                                                    title="Back"
                                                >
                                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                                </button>
                                                <span className="text-xs font-bold text-white tracking-wide uppercase">Playback Speed</span>
                                            </div>
                                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => {
                                                const isSelected = playbackSpeed === speed;
                                                return (
                                                    <button
                                                        key={speed}
                                                        onClick={() => {
                                                            handleSelectSpeed(speed);
                                                            setShowSettingsMenu(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-red-600/15 border border-red-500/30 text-white font-bold'
                                                                : 'text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent'
                                                        }`}
                                                    >
                                                        <span>{speed === 1 ? '1x (Normal)' : `${speed}x`}</span>
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined text-base text-red-500">check</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── 3. FULLSCREEN BUTTON ── */}
                            <button
                                onClick={toggleFullscreen}
                                className="text-white hover:text-white/80 active:scale-95 transition cursor-pointer flex items-center justify-center p-1"
                                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                            >
                                <span className="material-symbols-outlined text-2xl sm:text-3xl">
                                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ═══════════════ NETFLIX-STYLE NEXT EPISODE PROMPT ═══════════════ */}
                {showNextEpPrompt && currentMedia?.type === 'tv' && (
                    <div 
                        className="absolute bottom-24 sm:bottom-28 right-4 sm:right-8 z-50 w-[310px] sm:w-[370px] bg-[#141414]/95 border border-white/15 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl text-white ring-1 ring-white/10 animate-fade-in-up transition-all duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-500">
                                    Up Next
                                </span>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowNextEpPrompt(false);
                                    setNextEpDismissed(true);
                                }}
                                className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition cursor-pointer active:scale-90"
                                title="Dismiss / Stay on credits"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="flex gap-3 mb-3.5">
                            <div className="relative w-28 sm:w-32 aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                {nextEpThumbnail ? (
                                    <img 
                                        src={nextEpThumbnail} 
                                        alt={nextEpTitle} 
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/30">
                                        <span className="material-symbols-outlined text-2xl">movie</span>
                                    </div>
                                )}
                                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] font-mono font-bold text-white/90 border border-white/10">
                                    S{nextSeasonNum}:E{nextEpNum}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                                    {nextEpTitle}
                                </h4>
                                {nextEpOverview && (
                                    <p className="text-[11px] text-white/60 line-clamp-2 mt-1 leading-snug">
                                        {nextEpOverview}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleNextEpisode}
                            className="relative w-full overflow-hidden rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 p-2.5 sm:p-3 flex items-center justify-between text-white font-bold transition shadow-xl cursor-pointer group active:scale-[0.98]"
                        >
                            <div 
                                className="absolute inset-y-0 left-0 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.8)] transition-all duration-100 ease-linear pointer-events-none"
                                style={{ width: `${countdownProgress}%` }}
                            />

                            <div className="relative z-10 flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                    <span className="material-symbols-outlined text-lg fill" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        play_arrow
                                    </span>
                                </div>
                                <span className="text-xs sm:text-sm font-bold tracking-wide">Next Episode</span>
                            </div>

                            <div className="relative z-10 flex items-center gap-1 bg-black/50 backdrop-blur-md border border-white/15 px-2 py-0.5 rounded-lg">
                                <span className="text-xs font-mono font-bold text-white">{remainingSecs}s</span>
                                <span className="material-symbols-outlined text-xs text-red-400 animate-pulse">hourglass_bottom</span>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                setShowNextEpPrompt(false);
                                setNextEpDismissed(true);
                            }}
                            className="w-full text-center text-[11px] text-white/40 hover:text-white/80 font-medium pt-2 transition cursor-pointer"
                        >
                            Watch Credits
                        </button>
                    </div>
                )}
            </div>

            {/* ═══════════════ CINEMA DETAIL CONTENT (When not native browser fullscreen) ═══════════════ */}
            {!isFullscreen && (
                <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-8 space-y-10">
                    {/* ── 1. Title & Metadata Overview ── */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                                    {currentMedia.title}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs sm:text-sm text-white/70">
                                    {(details?.rating || currentMedia.rating) ? (
                                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                                            <span className="material-symbols-outlined text-base fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                            {Number(details?.rating || currentMedia.rating).toFixed(1)}
                                        </span>
                                    ) : null}

                                    {(details?.year || currentMedia.year) && (
                                        <span>{details?.year || currentMedia.year}</span>
                                    )}

                                    <span className="w-1 h-1 rounded-full bg-white/40"></span>

                                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 text-xs font-semibold uppercase tracking-wider">
                                        {currentMedia.type === 'tv' ? 'TV Series' : 'Movie'}
                                    </span>

                                    {currentMedia.type === 'tv' ? (
                                        <span>
                                            {(details?.totalSeasons || details?.number_of_seasons || 1)} Season{((details?.totalSeasons || details?.number_of_seasons || 1) > 1 ? 's' : '')}
                                        </span>
                                    ) : details?.duration ? (
                                        <span>{details.duration}</span>
                                    ) : null}

                                    {(details?.genres || currentMedia.genres || []).length > 0 && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-white/40"></span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(details?.genres || currentMedia.genres).slice(0, 3).map((g, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70">
                                                        {typeof g === 'string' ? g : g.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {(details?.overview || currentMedia.overview) && (
                            <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-4xl">
                                {details?.overview || currentMedia.overview}
                            </p>
                        )}
                    </div>

                    {/* ── 2. TV Episodes Section (if TV show) ── */}
                    {currentMedia.type === 'tv' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
                                        <h2 className="text-xl sm:text-2xl font-extrabold text-white">Episodes</h2>
                                    </div>

                                    {/* Season Dropdown */}
                                    <div className="relative">
                                        <select
                                            value={activeSeason}
                                            onChange={(e) => handleSeasonChange(Number(e.target.value))}
                                            className="appearance-none bg-neutral-900 border border-white/15 pr-10 pl-4 py-2 rounded-xl text-white font-bold text-sm cursor-pointer outline-none focus:border-red-600 transition"
                                        >
                                            {Array.from({ length: Math.max(1, details?.totalSeasons || details?.number_of_seasons || currentMedia.season || 1) }, (_, i) => i + 1).map(s => (
                                                <option key={s} value={s} className="bg-neutral-900 text-white">
                                                    Season {s}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 text-base">
                                            expand_more
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs text-white/50 font-medium">
                                    {seasonEpisodes.length > 0 && `${seasonEpisodes.length} Episodes available`}
                                </div>
                            </div>

                            {/* Episodes Grid */}
                            {loadingEpisodes ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : seasonEpisodes.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {seasonEpisodes.map((ep) => {
                                        const epNum = ep.episodeNumber || ep.episode_number || 1;
                                        const isCurrentEp = (currentMedia.season || 1) === activeSeason && (currentMedia.episode || 1) === epNum;
                                        const epTitle = ep.name || ep.title || `Episode ${epNum}`;
                                        const epStill = ep.still || ep.thumbnail || (ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null) || currentMedia.backdrop || currentMedia.poster;
                                        const epDuration = ep.runtime ? `${ep.runtime}m` : (ep.duration || null);

                                        return (
                                            <div
                                                key={epNum}
                                                onClick={() => handleEpisodeClick(ep)}
                                                className={`group rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col bg-neutral-900/80 border ${
                                                    isCurrentEp 
                                                        ? 'ring-2 ring-red-600 border-red-600/50 shadow-lg shadow-red-950/50' 
                                                        : 'border-white/10 hover:border-white/25 hover:bg-neutral-800/80'
                                                }`}
                                            >
                                                <div className="relative aspect-video bg-neutral-800 overflow-hidden">
                                                    {epStill ? (
                                                        <img
                                                            src={epStill}
                                                            alt={epTitle}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                                            <span className="material-symbols-outlined text-4xl">movie</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                                                            <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                                        </div>
                                                    </div>

                                                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-white">
                                                        E{epNum}
                                                    </div>

                                                    {isCurrentEp && (
                                                        <div className="absolute top-2 right-2 bg-red-600 px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 shadow-md">
                                                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                                                            Now Playing
                                                        </div>
                                                    )}

                                                    {epDuration && (
                                                        <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white/80 font-mono">
                                                            {epDuration}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-3.5 flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-white group-hover:text-red-500 transition line-clamp-1 mb-1">
                                                            {epNum}. {epTitle}
                                                        </h4>
                                                        {ep.overview && (
                                                            <p className="text-white/60 text-xs line-clamp-2 leading-relaxed">
                                                                {ep.overview}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-white/40 text-sm py-4">No episodes found for this season.</div>
                            )}
                        </div>
                    )}

                    {/* ── 3. More Like This Section ── */}
                    {similarTitles.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                                <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-white">More Like This</h2>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {similarTitles.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSimilarClick(item)}
                                        className="group cursor-pointer flex flex-col"
                                    >
                                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-900 border border-white/10 group-hover:border-white/30 group-hover:scale-[1.03] transition-all duration-300 shadow-lg">
                                            {item.poster ? (
                                                <img
                                                    src={item.poster}
                                                    alt={item.title || item.name}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-white/20">
                                                    <span className="material-symbols-outlined text-3xl">image</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                                                    <span className="material-symbols-outlined text-2xl fill" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                                </div>
                                            </div>

                                            {item.rating > 0 && (
                                                <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-[11px] fill" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                                    {Number(item.rating).toFixed(1)}
                                                </div>
                                            )}
                                        </div>

                                        <h4 className="mt-2 text-xs sm:text-sm font-bold text-white group-hover:text-red-500 transition truncate">
                                            {item.title || item.name}
                                        </h4>
                                        <p className="text-[11px] text-white/50">
                                            {item.year ? item.year : ''} {item.type === 'tv' || item.media_type === 'tv' ? '• Series' : '• Movie'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
