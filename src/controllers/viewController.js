import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../../public');

export const getHome = (req, res) => {
  logger.detail('VIEW', `Serving home page for user: ${req.user ? req.user.user_name : 'Guest'}`);
  res.sendFile(path.join(publicPath, 'index.html'));
};

export const getAccount = (req, res) => {
  logger.detail('VIEW', `Serving account page for user: ${req.user ? req.user.user_name : 'Guest'}`);
  res.sendFile(path.join(publicPath, 'account.html'));
};

export const getLogin = (req, res) => {
  logger.detail('VIEW', `Serving login page for user: ${req.user ? req.user.user_name : 'Guest'}`);
  res.sendFile(path.join(publicPath, 'login.html'));
};

export const getSongShare = (req, res) => {
  logger.detail('VIEW', `Serving song share page for user: ${req.user ? req.user.user_name : 'Guest'}`);
  res.sendFile(path.join(publicPath, '/songShare/songShare.html'));
};

export const getAdmin = (req, res) => {
  logger.detail('VIEW', `Serving admin page for user: ${req.user ? req.user.user_name : 'idk'}`);
  res.sendFile(path.join(publicPath, '/admin/admin.html'));
};