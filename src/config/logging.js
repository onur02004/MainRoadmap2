
/**
 * Merkezi log sistemi yapılandırması.
 *
 * LOG_LEVEL:
 *   low    = Hatalar, uyarılar ve önemli olaylar
 *   medium = Temel olaylar + normal işlem bilgileri
 *   high   = Tüm seviyeler, ayrıntılı debug çıktıları
 *
 * Ortam değişkeni örnekleri:
 *   LOG_LEVEL=low
 *   LOG_LEVEL=medium
 *   LOG_LEVEL=high
 *
 * Diğer ayarlar:
 *   timestamp   = Çıktılara saat ekle
 *   showCategory = Logun hangi modülden geldiğini göster
 *
 * Bu dosya yalnızca ayarları tutar.
 * Loglama ve filtreleme işlemleri utils/logger.js içindedir.
 */

import 'dotenv/config';

export const LOG_LEVELS = Object.freeze({
    low: 1,
    medium: 2,
    high: 3
});

const requestedLevel = (
    process.env.LOG_LEVEL || 'medium'
).toLowerCase();

export const loggingConfig = Object.freeze({
    level: Object.hasOwn(LOG_LEVELS, requestedLevel)
        ? requestedLevel
        : 'medium',

    timestamp: true,
    showCategory: true
});
