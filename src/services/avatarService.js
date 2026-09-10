import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getAvatarPaths = (isLoggedIn = false) => {
  const folderName = isLoggedIn ? 'avatars' : 'guestAvatars';
  const baseDir = path.join(__dirname, `../../public/content/${folderName}`);

  if (!fs.existsSync(baseDir)) {
    return {};
  }

  const result = {};
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subFolder = entry.name;
      const subFolderPath = path.join(baseDir, subFolder);
      
      const files = fs.readdirSync(subFolderPath);
      
      result[subFolder] = files
        .filter(file => !file.startsWith('.'))
        .map(file => `/content/${folderName}/${subFolder}/${file}`);
    } else {
      // Eğer doğrudan ana klasörün altında fotolar varsa
      if (!result['default']) result['default'] = [];
      if (!entry.name.startsWith('.')) {
        result['default'].push(`/content/${folderName}/${entry.name}`);
      }
    }
  }

  return result;
};