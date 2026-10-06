// src/controllers/serviceController.js
import * as serviceService from '../services/serviceService.js';
import logger from '../utils/logger.js';

export const getServices = async (req, res, next) => {
  try {
    const services = await serviceService.fetchVisibleServices(req.user);
    
    logger.detail(`SERVICES`, `Fetched services for ${req.user ? 'logged-in user' : 'guest'}`, req.user ? { user_name: req.user.user_name } : {});
    res.status(200).json({
      status: 'success',
      data: services
    });
  } catch (error) {
    logger.error(`SERVICES`, 'Error fetching services:', error);
    next(error);
  }
};