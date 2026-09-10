// src/routes/serviceRoutes.js
import express from 'express';
import * as serviceController from '../controllers/serviceController.js';
import { checkAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/services
router.get('/', checkAuth, serviceController.getServices);

export default router;