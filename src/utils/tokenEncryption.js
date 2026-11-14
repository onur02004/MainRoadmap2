import crypto from 'node:crypto';

const PREFIX = 'enc:v1:';
let warnedAboutDevelopmentPlaintext = false;

function getKey() {
  const raw = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    const key = /^[a-f0-9]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptSpotifyToken(value) {
  if (!value) return null;
  const text = String(value);
  if (text.startsWith(PREFIX)) return text;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SPOTIFY_TOKEN_ENCRYPTION_KEY must be configured as a 32-byte base64 or 64-character hex key in production.');
    }
    if (!warnedAboutDevelopmentPlaintext) {
      console.warn('[SECURITY] Spotify token encryption key is unset; development tokens will remain plaintext.');
      warnedAboutDevelopmentPlaintext = true;
    }
    return text;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSpotifyToken(value) {
  if (!value) return null;
  const text = String(value);
  // Backward compatibility: previously stored plaintext tokens are returned as-is;
  // the next successful refresh/reconnect rewrites them encrypted.
  if (!text.startsWith(PREFIX)) return text;
  const key = getKey();
  if (!key) throw new Error('SPOTIFY_TOKEN_ENCRYPTION_KEY is required to decrypt stored Spotify tokens.');
  const parts = text.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Stored Spotify token has an invalid encrypted format.');
  const [iv, tag, data] = parts.map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
