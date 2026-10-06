import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import listEndpoints from 'express-list-endpoints';


import avatarRoutes from './routes/avatarRoutes.js';
import viewRoutes from './routes/viewRoutes.js';
import userRoutes from './routes/userRoutes.js';
import spotifyRoutes from './routes/spotifyRoutes.js';
import themeRoutes from './routes/themeRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import songShareRoutes from './routes/songShareRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// ES Modülleri için __dirname tanımlama
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());

app.use(express.static('public'));

// UI / Page Routes
app.use('/', viewRoutes);
// API Routes
app.use('/api/users', userRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/avatars', avatarRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/songshare', songShareRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, '../public')));

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message,
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


app.get('/api/routes-manifest', (req, res) => {
  const routes = getAllRoutes(app);
  res.json({ totalRoutes: routes.length, routes });
});

app.get('/dev/routes', (req, res) => {
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