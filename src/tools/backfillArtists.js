//song_artist_cover_url eksik varsa onlari ekliyo guncelliyo duzeltiyo snrm


import dotenv from 'dotenv';
dotenv.config();

import db from './config/db.js'; //[cite: 4, 5]
import { getArtistDetailsByName } from './services/spotifyService.js';

async function backfillArtistImages() {
  console.log('Sanatçı fotoğrafları taranıyor...');

  // Sanatçı fotoğrafı boş olan satırları bul
  const { rows } = await db.query(`
    SELECT id, song_artist 
    FROM song_suggestions 
    WHERE song_artist_cover_url IS NULL
  `);

  console.log(`Güncellenecek ${rows.length} kayıt bulundu.`);

  for (const row of rows) {
    console.log(`Aranıyor: ${row.song_artist}...`);
    const artistMeta = await getArtistDetailsByName(row.song_artist);

    if (artistMeta && artistMeta.artist_cover) {
      await db.query(`
        UPDATE song_suggestions
        SET 
          song_artist_cover_url = $1,
          song_artist_cover_url_backup = $2,
          song_artist_genre = $3
        WHERE id = $4
      `, [
        artistMeta.artist_cover,
        artistMeta.artist_cover_backup,
        artistMeta.genres,
        row.id
      ]);

      console.log(`✓ ${row.song_artist} güncellendi.`);
    } else {
      console.log(`✗ ${row.song_artist} için görsel bulunamadı.`);
    }

    // Spotify rate limit'e takılmamak için kısa bekleme
    await new Promise(r => setTimeout(r, 250));
  }

  console.log('İşlem tamamlandı.');
  process.exit(0);
}

backfillArtistImages();