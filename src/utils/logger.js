import path from 'node:path';

/**
 * ============================================================
 * CENTRAL LOGGER — KULLANIM KILAVUZU
 * ============================================================
 *
 * AMAÇ:
 * Projedeki console.log() çağrıları yerine merkezi logger
 * kullanarak konsol çıktılarının seviyesini kontrol etmek.
 *
 * SEVİYELER:
 *   low    -> Hatalar, uyarılar ve önemli olaylar.
 *   medium -> Normal geliştirme çıktıları ve işlem özetleri.
 *   high   -> Ayrıntılı debug bilgileri ve teknik detaylar.
 *
 * KULLANIM:
 *
 *   import logger from '../utils/logger.js';
 *
 *   logger.error('DATABASE', 'Bağlantı başarısız', error);
 *   logger.warn('AUTH', 'Şüpheli işlem algılandı');
 *   logger.info('SYSTEM', 'Sunucu başlatıldı');
 *   logger.detail('API', 'İstek tamamlandı', { duration: 25 });
 *   logger.debug('FEED', 'İşlem ayrıntıları', { userId });
 *
 * METOTLARIN ANLAMI:
 *   error()  -> Hatalar; her seviyede görünür.
 *   warn()   -> Önemli uyarılar; her seviyede görünür.
 *   info()   -> Temel olaylar; tüm modlarda görünür.
 *   detail() -> Normal işlem ayrıntıları; medium ve high.
 *   debug()  -> Ayrıntılı teknik bilgiler; yalnızca high.
 *
 * KURALLAR:
 *   1. Yeni kodlarda console.log() yerine logger kullan.
 *   2. Her log çağrısına anlamlı bir kategori ekle.
 *   3. Büyük nesneleri yalnızca gerçekten gerektiğinde yazdır.
 *   4. Şifre, token, cookie ve hassas kullanıcı verilerini loglama.
 *   5. Hataları yakaladığında hata nesnesini koru.
 *   6. Mevcut logları dönüştürürken önemli bilgileri kaybetme.
 *   7. Log seviyesi değiştiğinde uygulama yeniden başlatılmadan
 *      değişiklik yapılması destekleniyorsa setLevel() kullan.
 *
 * NOT:
 * Metotların gerçekten kullanılabilmesi için logger.js içindeki
 * export ve fonksiyon isimleri bu kılavuzla uyumlu olmalıdır.
 * ============================================================
 */



const LEVELS = {
    low: 1,
    medium: 2,
    high: 3
};

let currentLevel = LEVELS[
    (process.env.LOG_LEVEL || "medium").toLowerCase()
] || LEVELS.medium;


const LOG_BUFFER_LIMIT = 1000;
const logBuffer = [];
let nextLogId = 1;

function serializeLogData(data) {
    if (data === undefined) return '';

    if (data instanceof Error) {
        return JSON.stringify({
            name: data.name,
            message: data.message,
            stack: data.stack
        });
    }

    try {
        return typeof data === 'string'
            ? data
            : JSON.stringify(data);
    } catch {
        return '[Data could not be serialized]';
    }
}

function getRecentLogs({ after = 0, level = 'ALL', limit = 100 } = {}) {
    const normalizedLevel = String(level).toUpperCase();
    const safeLimit = Math.min(
        Math.max(Number(limit) || 100, 1),
        200
    );

    let logs = logBuffer.filter(log => log.id > after);

    if (normalizedLevel !== 'ALL') {
        logs = logs.filter(
            log => log.level === normalizedLevel
        );
    }

    // İlk istekte son kayıtları göster.
    if (Number(after) === 0) {
        logs = logs.slice(-safeLimit);
    } else {
        logs = logs.slice(0, safeLimit);
    }

    return logs;
}



function getCallerLocation() {
    const stack = new Error().stack;

    if (!stack) return 'unknown';

    const lines = stack.split('\n').slice(1);

    for (const line of lines) {
        // Stack satırındaki dosya yolu ve satır numarasını bul.
        const match = line.match(
            /(?:\(|at\s+)(file:\/\/\/.*?|[A-Za-z]:[\\/].*?|\/.*?):(\d+):\d+\)?$/
        );

        if (!match) continue;

        let filePath = match[1];
        const lineNumber = match[2];

        if (filePath.startsWith('file:///')) {
            try {
                filePath = decodeURIComponent(
                    new URL(filePath).pathname
                );

                // Windows sürücü yolundaki baştaki / işaretini kaldır.
                if (/^\/[A-Za-z]:\//.test(filePath)) {
                    filePath = filePath.slice(1);
                }
            } catch {
                // Çözümlenemezse orijinal yolu koru.
            }
        }

        filePath = filePath.replace(/\//g, path.sep);

        const relativePath = path.relative(
            process.cwd(),
            filePath
        );

        // Logger'ın kendi dosyasını gösterme.
        if (
            relativePath.endsWith(
                `utils${path.sep}logger.js`
            )
        ) {
            continue;
        }

        return `${relativePath}:${lineNumber}`;
    }

    return 'unknown';
}



function write(level, category, message, data) {
    const priorities = {
        error: 0,
        warn: 0,
        info: 1,
        detail: 2,
        debug: 3
    };

    const priority = priorities[level];
    if (priority === undefined) return;

    const time = new Date().toISOString();
    const location = getCallerLocation();

    const record = {
        id: nextLogId++,
        timestamp: time,
        level: level.toUpperCase(),
        category: String(category || 'GENERAL'),
        location,
        message: String(message ?? ''),
        data: serializeLogData(data)
    };

    // Console seviyesinden bağımsız olarak logu sakla.
    logBuffer.push(record);

    if (logBuffer.length > LOG_BUFFER_LIMIT) {
        logBuffer.splice(
            0,
            logBuffer.length - LOG_BUFFER_LIMIT
        );
    }

    // Terminale yazdırma filtresi.
    if (priority > currentLevel) return;

    const prefix = [
        `[${new Date(time).toLocaleTimeString('de-DE')}]`,
        `[${record.level}]`,
        `[${record.category}]`,
        `[${record.location}]`
    ].join(' ');

    if (data === undefined) {
        console.log(prefix, message);
    } else {
        console.log(prefix, message, data);
    }
}


const logger = {
    setLevel(level) {
        const normalized = String(level).toLowerCase();

        if (!Object.hasOwn(LEVELS, normalized)) {
            throw new Error(`Invalid log level: ${level}`);
        }

        currentLevel = LEVELS[normalized];
    },

    getLevel() {
        return Object.keys(LEVELS)
            .find(key => LEVELS[key] === currentLevel);
    },
    getRecentLogs,

    error: (category, message, data) =>
        write("error", category, message, data),

    warn: (category, message, data) =>
        write("warn", category, message, data),

    info: (category, message, data) =>
        write("info", category, message, data),

    detail: (category, message, data) =>
        write("detail", category, message, data),

    debug: (category, message, data) =>
        write("debug", category, message, data)
};


export default logger;
