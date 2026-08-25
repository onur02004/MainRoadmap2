import jwt from 'jsonwebtoken';
import AppError from '../utils/appError.js';
import * as userService from '../services/userService.js';

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Bu işleme erişmek için giriş yapmalısınız.', 401));
    }

    // Token doğrulama
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kullanıcının güncel verisini DB'den çek
    const currentUser = await userService.findUserById(decoded.id); 
    if (!currentUser) {
      return next(new AppError('Bu tokena ait kullanıcı artık mevcut değil.', 401));
    }

    // Kullanıcı bilgisini request objesine ekle (Rol (relation) bilgisi de burada geliyor)
    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Geçersiz veya süresi dolmuş token.', 401));
  }
};


export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.relation)) {
      return next(new AppError('Bu işlemi gerçekleştirmek için yetkiniz bulunmuyor.', 403));
    }
    next();
  };
};