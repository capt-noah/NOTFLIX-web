/**
 * Clean helper actions for downloading the mobile APK and finding subtitles
 * without ad redirects or popups.
 */

export const downloadApp = (apkUrl = '/Notflix_v1.0.1.APK', filename = 'Notflix_v1.0.1.apk') => {
    try {
        const link = document.createElement('a');
        link.href = apkUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.warn('App download error:', e);
        window.location.href = apkUrl;
    }
};

export const openSubtitles = (mediaTitle = '', year = '', season = null, episode = null) => {
    try {
        const query = season && episode
            ? `${mediaTitle} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
            : `${mediaTitle} ${year || ''}`;
        const subsUrl = `https://subdl.com/search?query=${encodeURIComponent(query.trim())}`;
        window.open(subsUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
        console.warn('Subtitles search error:', e);
    }
};
