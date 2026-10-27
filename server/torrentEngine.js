/**
 * NotFlix Torrent Streaming Engine
 * High-performance, sequential progressive HTTP range streaming powered by WebTorrent.
 * Delivers instant playback start (1-3s) with full seek support for <video> and AVPlayer.
 */

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

// Global WebTorrent Client Singleton & Dynamic Loader
let WebTorrentClass = null;
let clientInstance = null;

async function getTorrentClient() {
    if (!WebTorrentClass) {
        try {
            const mod = await import('webtorrent');
            WebTorrentClass = mod.default || mod;
        } catch (_) {
            console.warn('[TorrentEngine] Notice: webtorrent package is not installed. Torrent streaming will be unavailable until installed.');
            return null;
        }
    }

    if (!clientInstance || clientInstance.destroyed) {
        try {
            clientInstance = new WebTorrentClass({
                maxConns: 45,
                dht: false, // Prevents raw UDP socket bind failures on constrained hosts like Plesk
                tracker: true,
                webSeeds: true,
            });

            clientInstance.on('error', (err) => {
                console.warn('[TorrentEngine] WebTorrent global warning:', err.message);
            });
        } catch (err) {
            console.warn('[TorrentEngine] Failed to initialize WebTorrent:', err.message);
            return null;
        }
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
    const client = await getTorrentClient();
    if (!client) {
        throw new Error('WebTorrent client is not available on this server');
    }
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
                if (existing.ready) {
                    resolve(existing);
                } else {
                    reject(new Error('Torrent metadata resolve timeout (25s)'));
                }
            }, 25000);

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
        magnetOrHash = `magnet:?xt=urn:btih:${sourceStr}&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=http%3A%2F%2Ftracker.renfei.net%3A8080%2Fannounce&tr=http%3A%2F%2Ftracker2.dler.org%3A80%2Fannounce&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss%3A%2F%2Ftracker.btorrent.xyz`;
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const addedTorrent = client.get(magnetOrHash);
            if (addedTorrent && addedTorrent.ready) {
                resolve(addedTorrent);
            } else {
                reject(new Error('Torrent metadata resolve timeout (25s)'));
            }
        }, 25000);

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

        if (typeof file.select === 'function') {
            file.select();
        }

        // Update access timestamp
        activeTorrents.set(torrent.infoHash, {
            torrent,
            lastAccess: Date.now(),
        });

        const totalSize = file.length;
        const range = req.headers.range;
        const mimeType = file.name.endsWith('.webm') ? 'video/webm' : 'video/mp4';

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
            stream.on('error', (err) => {
                if (err.code === 'ERR_STREAM_PREMATURE_CLOSE' || err.code === 'PREMATURE_CLOSE' || err.message.includes('closed')) {
                    return; // Client disconnected, safely ignore
                }
                console.error('[TorrentEngine] read stream error:', err.message);
            });

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
            stream.on('error', (err) => {
                if (err.code === 'ERR_STREAM_PREMATURE_CLOSE' || err.code === 'PREMATURE_CLOSE' || err.message.includes('closed')) {
                    return;
                }
                console.error('[TorrentEngine] read stream error:', err.message);
            });

            req.on('close', () => {
                if (stream && typeof stream.destroy === 'function') {
                    stream.destroy();
                }
            });

            stream.pipe(res);
        }
    } catch (err) {
        console.warn('[TorrentEngine] Streaming fallback triggered:', err.message);
        if (!res.headersSent) {
            return res.status(503).json({ error: 'Stream temporarily unavailable' });
        }
    }
}

// Garbage collector for inactive torrents every 5 minutes
const cleanupTimer = setInterval(() => {
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
if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
}
