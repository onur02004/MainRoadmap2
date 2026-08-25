import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AVATARS_BASE_DIR = path.join(__dirname, '../../public/content/avatars');

export const getAllAvatarPaths = () => {
  if (!fs.existsSync(AVATARS_BASE_DIR)) {
    return {};
  }

  const result = {};
  const entries = fs.readdirSync(AVATARS_BASE_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const folderName = entry.name;
      const folderPath = path.join(AVATARS_BASE_DIR, folderName);
      
      const files = fs.readdirSync(folderPath);
      
      // Klasördeki tüm dosyaların web path'ini oluştur (örn: /content/avatars/bartu/1.jpg)
      result[folderName] = files
        .filter(file => !file.startsWith('.')) // Gizli/sistem dosyalarını atla
        .map(file => `/content/avatars/${folderName}/${file}`);
    }
  }

  return result;
};