// src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import AppError from '../utils/appError.js';
import * as userService from '../services/userService.js';

export const protect = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader?.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    } else if (authHeader) {
      token = authHeader;
    }

    if (!token || token === 'null' || token === 'undefined') {
      return next(new AppError('Bu işleme erişmek için giriş yapmalısınız.', 401));
    }

    token = token.replace(/^["']|["']$/g, '').trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id || decoded.user_id;

    const currentUser = await userService.findUserById(userId); 
    if (!currentUser) {
      return next(new AppError('Bu tokena ait kullanıcı artık mevcut değil.', 401));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Geçersiz veya süresi dolmuş token.', 401));
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    const userRole = (req.user?.role || '').toUpperCase();
    const allowed = roles.map(r => r.toUpperCase());
    if (!allowed.includes(userRole)) {
      return next(new AppError('Bu işlemi gerçekleştirmek için yetkiniz bulunmuyor.', 403));
    }
    next();
  };
};

export const checkAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (authHeader.startsWith('Bearer')) {
        token = authHeader.substring(6);
      } else {
        token = authHeader;
      }
    }

    if (token && token !== 'null' && token !== 'undefined') {
      // Baştaki/sondaki olası tırnakları ve boşlukları temizle
      token = token.replace(/^["']|["']$/g, '').trim();
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded.userId || decoded._id || decoded.user_id;

      if (userId) {
        const currentUser = await userService.findUserById(userId);
        if (currentUser) {
          req.user = currentUser;
          return next();
        }
      }
    }
  } catch (error) {
    console.warn('[checkAuth] Token validation warning:', error.message);
  }

  req.user = null;
  next();
};