/**
 * NotFlix Standalone Node.js Express Server
 * Serves the NotFlix API (TMDB proxy, HLS stream resolver, CORS proxy)
 * and hosts the production React frontend build if dist/ exists.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import notflixRouter from './router.js';

// Prevent unhandled errors or socket drops from crashing the Node.js process
process.on('unhandledRejection', (reason) => {
    console.error('! Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('! Uncaught Exception:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(['/api/', '/notflix/api/'], limiter);

// Top-level Health Checks
app.get(['/health', '/api/health', '/notflix/health', '/notflix/api/health'], (req, res) => {
    res.json({
        status: 'ok',
        app: 'NOTFLIX',
        timestamp: new Date().toISOString(),
        port: PORT,
        frontendMounted: fs.existsSync(path.join(distPath, 'index.html')),
    });
});

// Mount NotFlix Router on both /api and /notflix/api for seamless compatibility
app.use('/notflix/api', notflixRouter);
app.use('/api', notflixRouter);

// Dynamic Apple OTA manifest for iOS installation
app.get(['/ios/manifest.plist', '/notflix/ios/manifest.plist'], (req, res) => {
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3001';
    const proto = req.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const ipaUrl = `${proto}://${host}/ios/NOTFLIX-Enterprise.ipa`;
    const iconUrl = `${proto}://${host}/notflix-logo.png`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>${ipaUrl}</string>
                </dict>
                <dict>
                    <key>kind</key>
                    <string>display-image</string>
                    <key>needs-shine</key>
                    <true/>
                    <key>url</key>
                    <string>${iconUrl}</string>
                </dict>
                <dict>
                    <key>kind</key>
                    <string>full-size-image</string>
                    <key>needs-shine</key>
                    <true/>
                    <key>url</key>
                    <string>${iconUrl}</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>com.gto.supposetv.ent</string>
                <key>bundle-version</key>
                <string>1.0.0</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>NOTFLIX</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(xml);
});

// Serve public directory (including /ios) directly
const publicPath = path.resolve(__dirname, '../public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.use('/notflix', express.static(publicPath));
}

// ==============================================================================
// STATIC ASSETS & SPA ROUTING (When running bundled in production / Plesk)
// ==============================================================================
if (fs.existsSync(distPath)) {
    // Serve static dist at root and at /notflix
    app.use(express.static(distPath));
    app.use('/notflix', express.static(distPath));

    // Fallback for /notflix/* subpath
    app.get(['/notflix', '/notflix/*'], (req, res, next) => {
        if (req.path.startsWith('/notflix/api')) return next();
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
        res.status(404).send('NotFlix frontend not found.');
    });

    // Root SPA Fallback
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/notflix/api')) {
            return res.status(404).json({ error: 'API route not found' });
        }
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
        res.status(200).send('NotFlix API server is running.');
    });
}

// Start Server if run directly
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`✓ NotFlix Server running on http://localhost:${PORT}`);
        console.log(`  - API Base:     http://localhost:${PORT}/api`);
        console.log(`  - Plesk Path:   http://localhost:${PORT}/notflix/api`);
        console.log(`  - Stream Route: http://localhost:${PORT}/api/stream?tmdbId=550&type=movie`);
    });
}

export default app;