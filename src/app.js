import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { protect, restrictTo } from './middleware/authMiddleware.js';
import { securityHeaders, csrfOriginGuard } from './middleware/securityHeaders.js';
import { corsOriginCallback } from './config/origins.js';
import { createRateLimit } from './middleware/rateLimit.js';
import { createGameStaticMiddleware } from './middleware/gameStatic.js';
import logger from './utils/logger.js';


import avatarRoutes from './routes/avatarRoutes.js';
import viewRoutes from './routes/viewRoutes.js';
import userRoutes from './routes/userRoutes.js';
import spotifyRoutes from './routes/spotifyRoutes.js';
import themeRoutes from './routes/themeRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import songShareRoutes from './routes/songShareRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import adminGamesRoutes from './routes/adminGamesRoutes.js';
import adminPresenceRoutes from './routes/adminPresenceRoutes.js';

const app = express();

// ES Modülleri için __dirname tanımlama
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security and request middleware. Cookies must be parsed before protected routes/static pages.
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(securityHeaders);
app.use(cors({ origin: corsOriginCallback, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] }));
app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());
app.use(csrfOriginGuard);
app.use('/api', createRateLimit({ windowMs: 60_000, max: 180 }));

// Serve formerly exposed private HTML paths only after session authorization.
const privatePagePath = path.join(__dirname, '../public');
app.get('/songShare/songShare.html', protect, (req, res) => res.sendFile(path.join(privatePagePath, 'songShare/songShare.html')));
app.get('/account.html', protect, (req, res) => res.sendFile(path.join(privatePagePath, 'account.html')));
app.get('/spotifyStatus.html', protect, (req, res) => res.sendFile(path.join(privatePagePath, 'spotifyStatus.html')));
app.get('/admin/admin.html', protect, restrictTo('ADMIN'), (req, res) => res.sendFile(path.join(privatePagePath, 'admin/admin.html')));
app.get('/games/games.html', protect, (req, res) => res.sendFile(path.join(privatePagePath, 'games/games.html')));

// Playable game bundles are public static assets. The games catalogue above stays protected.
app.use('/games', createGameStaticMiddleware(privatePagePath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

app.use(express.static(privatePagePath, { etag: true, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0, index: false }));

// UI / Page Routes
app.use('/', viewRoutes);
// API Routes
app.use('/api/users', userRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/avatars', avatarRoutes);
app.use('/api/services', serviceRoutes);
if (process.env.NODE_ENV !== 'production') app.use('/api/debug', debugRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/songshare', songShareRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/admin/presence', adminPresenceRoutes);

// Public browser configuration for WeinGuesser. The key is read from the
// server environment at request time; never expose the .env file itself.
app.get('/api/config/weinguesser', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_EMBED_API_KEY || '';
  res.set('Cache-Control', 'no-store');
  if (!apiKey) {
    return res.status(503).json({
      status: 'error',
      message: 'Google Maps Embed API key is not configured on the server.'
    });
  }
  return res.json({ googleMapsEmbedApiKey: apiKey });
});
app.use('/api/admin/games', adminGamesRoutes);



// Global Error Handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const statusCode = Number(err.statusCode || err.status) || 500;
  const safeStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  logger.error('HTTP', 'Request failed', { method: req.method, path: req.path, status: safeStatus, name: err.name, code: err.code });
  res.status(safeStatus).json({
    status: 'error',
    message: safeStatus >= 500 && process.env.NODE_ENV === 'production'
      ? 'Sunucuda beklenmeyen bir hata oluştu.'
      : err.message || 'İstek tamamlanamadı.'
  });
});


function getAllRoutes(app) {
  const routes = [];

  function print(path, layer) {
    if (layer.route) {
      routes.push({
        method: Object.keys(layer.route.methods)[0].toUpperCase(),
        path: path + (layer.route.path === '/' ? '' : layer.route.path)
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      let routerPath = '';
      if (layer.regexp) {
        // Express regex'inden rota önekini (/api/users gibi) temizle
        const match = layer.regexp.source
          .replace('^\\', '')
          .replace('\\/?(?=\\/|$)', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/');
        if (match && match !== '^' && !match.startsWith('(?=')) {
          routerPath = '/' + match.replace(/^\^|\$$/g, '').replace(/^\//, '');
        }
      }
      layer.handle.stack.forEach((subLayer) => print(routerPath, subLayer));
    }
  }

  if (app._router && app._router.stack) {
    app._router.stack.forEach((layer) => print('', layer));
  }

  return routes;
}


if (process.env.NODE_ENV !== 'production') app.get('/api/routes-manifest', protect, restrictTo('ADMIN'), (req, res) => {
  const routes = getAllRoutes(app);
  res.json({ totalRoutes: routes.length, routes });
});

if (process.env.NODE_ENV !== 'production') app.get('/dev/routes', protect, restrictTo('ADMIN'), (req, res) => {
  const routes = getAllRoutes(app);
  const rows = routes.map(r => `
    <tr>
      <td><span class="badge ${r.method}">${r.method}</span></td>
      <td><code>${r.path}</code></td>
      <td><a href="${r.path}" target="_blank">Test Et</a></td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Manifest</title>
      <style>
        body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; padding: 30px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #334155; color: #94a3b8; font-size: 13px; text-transform: uppercase; }
        .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
        .GET { background: #0284c7; color: white; }
        .POST { background: #16a34a; color: white; }
        .PUT { background: #d97706; color: white; }
        .DELETE { background: #dc2626; color: white; }
        code { color: #38bdf8; font-size: 14px; }
        a { color: #a855f7; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h2>🚀 Kayıtlı API Endpoint Listesi (${routes.length})</h2>
      <table>
        <thead><tr><th>Metot</th><th>Endpoint Yolu</th><th>Erişim</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `);
});


export default app;