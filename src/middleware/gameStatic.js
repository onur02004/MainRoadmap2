import express from 'express';
import path from 'path';

/**
 * Serves playable game bundles, including directory index.html files.
 * The protected /games/games.html route must be registered before this mount.
 */
export function createGameStaticMiddleware(publicDirectory, options = {}) {
  return express.static(path.join(publicDirectory, 'games'), {
    etag: true,
    index: 'index.html',
    ...options
  });
}
