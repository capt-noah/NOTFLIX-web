/**
 * NotFlix Torrent Streaming Engine
 * High-performance, sequential progressive HTTP range streaming powered by WebTorrent.
 * Delivers instant playback start (1-3s) with full seek support for <video> and AVPlayer.
 */

import WebTorrent from 'webtorrent';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Temporary torrent storage directory
const TORRENT_CACHE_DIR = path.join(os.tmpdir(), 'notflix-torrent-cache');
if (!fs.existsSync(TORRENT_CACHE_DIR)) {
    try {
        fs.mkdirSync(TORRENT_CACHE_DIR, { recursive: true });
    } catch {
        // Fallback to default
    }
}

// Global WebTorrent Client Singleton
let clientInstance = null;

function getTorrentClient() {
    if (!clientInstance || clientInstance.destroyed) {
        clientInstance = new WebTorrent({
            maxConns: 55,
            dht: true,
            tracker: true,
            webSeeds: true,
        });

        clientInstance.on('error', (err) => {
            console.warn('[TorrentEngine] WebTorrent global warning:', err.message);
        });
    }
    return clientInstance;
}

// In-memory torrent metadata & access tracking
const activeTorrents = new Map(); // infoHash -> { torrent, lastAccess: number, fileIdx: number }

// Video extension check
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.ts']);

function isVideoFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return VIDEO_EXTENSIONS.has(ext);
}

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.mp4':
        case '.m4v':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.mkv':
            return 'video/x-matroska';
        case '.avi':
            return 'video/x-msvideo';
        case '.mov':
            return 'video/quicktime';
        case '.ts':
            return 'video/mp2t';
        default:
            return 'video/mp4';
    }
}

/**
 * Adds or retrieves a torrent by infoHash / magnet link and waits until metadata is ready.
 */
export async function getOrAddTorrent(torrentSource) {
    const client = getTorrentClient();
    const sourceStr = String(torrentSource || '').trim();

    if (!sourceStr) {
        throw new Error('Missing torrent source or infoHash');
    }

    // Check if torrent already exists in client
    const existing = client.torrents.find(t => 
        t.infoHash.toLowerCase() === sourceStr.toLowerCase() ||
        t.magnetURI.includes(sourceStr)
    );

    if (existing) {
        if (existing.ready) {
            activeTorrents.set(existing.infoHash, {
                torrent: existing,
                lastAccess: Date.now(),
            });
            return existing;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(existing);
            }, 8000);

            existing.once('ready', () => {
                clearTimeout(timeout);
                activeTorrents.set(existing.infoHash, {
                    torrent: existing,
                    lastAccess: Date.now(),
                });
                resolve(existing);
            });

            existing.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    // Build magnet URI if raw 40-char infoHash was passed
    let magnetOrHash = sourceStr;
    if (/^[a-fA-F0-9]{40}$/.test(sourceStr) || /^[a-zA-Z2-7]{32}$/.test(sourceStr)) {
        magnetOrHash = `magnet:?xt=urn:btih:${sourceStr}&tr=${encodeURIComponent('udp://tracker.opentrackr.org:1337/announce')}&tr=${encodeURIComponent('udp://open.demonii.com:1337/announce')}&tr=${encodeURIComponent('udp://tracker.coppersurfer.tk:6969/announce')}&tr=${encodeURIComponent('udp://glotorrents.pw:6969/announce')}&tr=${encodeURIComponent('udp://tracker.openbittorrent.com:80/announce')}`;
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const addedTorrent = client.get(magnetOrHash);
            if (addedTorrent) {
                resolve(addedTorrent);
            } else {
                reject(new Error('Torrent metadata resolve timeout (10s)'));
            }
        }, 10000);

        try {
            const torrent = client.add(magnetOrHash, {
                path: TORRENT_CACHE_DIR,
                destroyStoreOnDestroy: true,
            });

            torrent.on('ready', () => {
                clearTimeout(timeout);
                activeTorrents.set(torrent.infoHash, {
                    torrent,
                    lastAccess: Date.now(),
                });
                resolve(torrent);
            });

            torrent.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        } catch (err) {
            clearTimeout(timeout);
            reject(err);
        }
    });
}

/**
 * Selects the best primary video file within a torrent.
 */
export function getPrimaryVideoFile(torrent, requestedFileIdx = null) {
    if (!torrent || !torrent.files || torrent.files.length === 0) {
        return null;
    }

    // If a specific file index was requested
    if (requestedFileIdx !== null && requestedFileIdx !== undefined) {
        const idx = parseInt(requestedFileIdx, 10);
        if (!isNaN(idx) && torrent.files[idx]) {
            return torrent.files[idx];
        }
    }

    // Filter candidate video files
    const videoFiles = torrent.files.filter(f => isVideoFile(f.name));

    if (videoFiles.length > 0) {
        // Sort by file length descending to get full movie / episode (filters out samples)
        videoFiles.sort((a, b) => b.length - a.length);
        return videoFiles[0];
    }

    // Fallback to largest file in torrent
    const sorted = [...torrent.files].sort((a, b) => b.length - a.length);
    return sorted[0];
}

/**
 * Express Route Handler: /api/stream/torrent
 * Streams progressive HTTP 206 partial content from sequential torrent pieces.
 */
export async function handleTorrentStreamRequest(req, res) {
    const infoHash = req.query.infoHash || req.query.hash || req.query.torrent;
    const fileIdx = req.query.fileIdx;

    if (!infoHash) {
        return res.status(400).json({ error: 'Missing infoHash query parameter' });
    }

    try {
        const torrent = await getOrAddTorrent(infoHash);
        const file = getPrimaryVideoFile(torrent, fileIdx);

        if (!file) {
            return res.status(404).json({ error: 'No playable video file found in torrent' });
        }

        // Update access timestamp
        activeTorrents.set(torrent.infoHash, {
            torrent,
            lastAccess: Date.now(),
        });

        const totalSize = file.length;
        const range = req.headers.range;
        const mimeType = getMimeType(file.name);

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

            if (start >= totalSize || end >= totalSize) {
                res.setHeader('Content-Range', `bytes */${totalSize}`);
                return res.status(416).end();
            }

            const chunkSize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
                'Cache-Control': 'no-cache, no-store',
            });

            const stream = file.createReadStream({ start, end });

            req.on('close', () => {
                if (stream && typeof stream.destroy === 'function') {
                    stream.destroy();
                }
            });

            stream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': totalSize,
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            });

            const stream = file.createReadStream();

            req.on('close', () => {
                if (stream && typeof stream.destroy === 'function') {
                    stream.destroy();
                }
            });

            stream.pipe(res);
        }
    } catch (err) {
        console.error('[TorrentEngine] Streaming error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Torrent stream error', details: err.message });
        }
    }
}

// Garbage collector for inactive torrents every 5 minutes
setInterval(() => {
    const now = Date.now();
    const MAX_IDLE_MS = 15 * 60 * 1000; // 15 minutes

    for (const [hash, data] of activeTorrents.entries()) {
        if (now - data.lastAccess > MAX_IDLE_MS) {
            console.log(`[TorrentEngine] Cleaning up idle torrent: ${hash}`);
            try {
                if (data.torrent && typeof data.torrent.destroy === 'function') {
                    data.torrent.destroy({ destroyStore: true });
                }
            } catch {
                // Ignore cleanup error
            }
            activeTorrents.delete(hash);
        }
    }
}, 5 * 60 * 1000);
