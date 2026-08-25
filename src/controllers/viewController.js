import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../../public');

export const getHome = (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
};

export const getAccount = (req, res) => {
  res.sendFile(path.join(publicPath, 'Account.html'));
};

export const getLogin = (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'));
};