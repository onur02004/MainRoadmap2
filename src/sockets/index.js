import { Server } from 'socket.io';
import { corsOriginCallback } from '../config/origins.js';

import { socketAuth } from './socketAuth.js';
import {
  registerPresenceHandlers,
  startPresenceMonitor
} from './presence/presenceHandlers.js';
import { registerGameHandlers } from './games/gameHandlers.js';
import { registerHockeyHandlers } from './games/hockeyHandlers.js';
import { registerRoadtripHandlers } from './games/roadtripHandlers.js';
import { registerDeviceHandlers } from './devices/deviceHandlers.js';

let ioInstance = null;

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOriginCallback,
      credentials: true
    }
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(
      `[Socket] Connected: ${socket.user.user_name} (${socket.id})`
    );


    registerHockeyHandlers(io, socket);
    registerRoadtripHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerDeviceHandlers(io, socket);
  });

  startPresenceMonitor(io);
  ioInstance = io;

  console.log('[Socket] Socket.IO initialized');

  return io;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized.');
  }

  return ioInstance;
};