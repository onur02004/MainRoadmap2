import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next(new AppError('Not logged in.', 401));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Sadece ID'yi değil, kullanıcının güncel verisini DB'den çekip req.user'a atıyoruz
    // Bu sayede kullanıcının rolüne erişebiliriz
    const currentUser = await userService.findUserByIdentifier(decoded.id); 
    if (!currentUser) return next(new AppError('User doesnt exist.', 401));

    req.user = currentUser;
    next();
  } catch (error) {
    next(new AppError('Token invalid', 401));
  }
};