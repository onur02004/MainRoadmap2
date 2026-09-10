// src/controllers/serviceController.js
import * as serviceService from '../services/serviceService.js';

export const getServices = async (req, res, next) => {
  try {
    console.log(`[serviceController] Auth State: ${req.user ? `Logged In as ${req.user.user_name} (${req.user.relation || req.user.role})` : 'GUEST'}`);
    const services = await serviceService.fetchVisibleServices(req.user);

    res.status(200).json({
      status: 'success',
      data: services
    });
  } catch (error) {
    next(error);
  }
};