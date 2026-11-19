(() => {
  'use strict';

  const canvas = document.getElementById('fsAsciiAmbient');
  const modal = document.getElementById('fullscreenPlayerModal');
  if (!canvas || !modal) return;

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  const coverImg = document.getElementById('fsCoverImg');
  const sceneGrid = document.getElementById('fsSceneGrid');
  const sceneCards = [...modal.querySelectorAll('[data-ascii-scene]')];
  const library = document.getElementById('fsSceneLibrary');
  const libraryBackdrop = document.getElementById('fsSceneLibraryBackdrop');
  const libraryToggle = document.getElementById('fsSceneLibraryToggle');
  const libraryClose = document.getElementById('fsSceneLibraryClose');
  const currentSceneLabel = document.getElementById('fsCurrentSceneLabel');
  const currentSceneGlyph = document.getElementById('fsCurrentSceneGlyph');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'songshare-ascii-scene-v2';

  const sceneLabels = {
    mountain: ['Mountain Dream', '/\\'],
    flowers: ['Bloom', '✳'],
    city: ['Night City', '▥'],
    music: ['Music Pulse', '♫'],
    disco: ['Disco', '◉'],
    aurora: ['Aurora', '~'],
    lilies: ['Lily Study', '✿'],
    bouquet: ['The Bouquet', '✾'],
    garden: ['Wildflower Field', '✳'],
    knight: ['The Knight', '♞'],
    starry: ['Starry Night', '✦'],
    ocean: ['Midnight Tide', '≈'],
    nightdrive: ['Night Drive', '⌁'],
    sunmoon: ['Sun & Moon', '☾'],
    butterflies: ['Butterfly Effect', '୨୧'],
    christmas: ['Evergreen', '✧'],
    artwork: ['Album ASCII', '▦'],
    album: ['Album Atmosphere', '◈'],
    chromatic: ['Chromatic Flow', '◌'],
    off: ['No ambience', '×']
  };
  const scenes = Object.keys(sceneLabels);

  let savedScene = 'mountain';
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && scenes.includes(stored)) savedScene = stored;
  } catch (_) { /* Storage can be disabled; the visualizer still works. */ }

  let scene = savedScene;
  let width = 0, height = 0, dpr = 1, cols = 0, rows = 0;
  let cellW = 8.35, cellH = 14.2;
  let raf = 0, running = false, elapsed = 0, lastTime = 0, lastRender = 0;
  let playing = false, tempoFactor = 1, lastPlaybackPoll = 0;
  let butterflies = [];
  let pointer = { x: .5, y: .5 };
  let artImage = null, artSamples = null, artCols = 0, artRows = 0;
  let artLoadToken = 0;
  let coverPalette = ['190,174,205', '132,164,188', '207,170,151'];

  const rand = n => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function clear() {
    if (width && height) ctx.clearRect(0, 0, width, height);
  }

  function glyph(x, y, char, alpha = .3, color = '225,231,240') {
    if (!char || alpha <= .012 || x < -cellW || x > width + cellW || y < -cellH || y > height + cellH) return;
    ctx.fillStyle = `rgba(${color},${Math.min(.92, alpha)})`;
    ctx.fillText(char, x, y);
  }

  function block(text, col, row, alpha = .75, color = '235,238,244') {
    text.split('\n').forEach((line, lineIndex) => {
      [...line].forEach((char, i) => glyph((col + i) * cellW, (row + lineIndex) * cellH, char, alpha, color));
    });
  }

  // Coordinates for this helper are expressed in character-grid units.
  function segment(x1, y1, x2, y2, char = '.', alpha = .3, color = '225,231,240', density = 1) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * density));
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      glyph((x1 + (x2 - x1) * p) * cellW, (y1 + (y2 - y1) * p) * cellH, char, alpha, color);
    }
  }

  function setLibraryOpen(open, restoreFocus = true) {
    if (!library || !libraryBackdrop || !libraryToggle) return;
    const wasOpen = !library.hidden;
    library.hidden = !open;
    libraryBackdrop.hidden = !open;
    libraryToggle.setAttribute('aria-expanded', String(open));
    libraryToggle.classList.toggle('is-open', open);
    document.body.classList.toggle('songshare-scene-library-open', open);
    if (open) libraryClose?.focus({ preventScroll: true });
    else if (restoreFocus && wasOpen) libraryToggle.focus({ preventScroll: true });
  }

  function setScene(next, restoreFocus = true) {
    if (!scenes.includes(next)) return;
    scene = next;
    try { localStorage.setItem(storageKey, scene); } catch (_) { /* Ignore storage errors. */ }

    sceneCards.forEach(card => {
      const active = card.dataset.asciiScene === scene;
      card.classList.toggle('is-selected', active);
      card.setAttribute('aria-pressed', String(active));
    });

    modal.dataset.asciiScene = scene;
    const [label, icon] = sceneLabels[scene];
    if (currentSceneLabel) currentSceneLabel.textContent = label;
    if (currentSceneGlyph) currentSceneGlyph.textContent = icon;

    // Album ambience and PS3 chromatic mode both depend on the latest cover.
    if (['artwork', 'album', 'chromatic'].includes(scene) && !artImage) {
      loadArtwork();
    }

    if (scene === 'off') clear();
    else if (modal.classList.contains('active')) render(elapsed, 0, true);
    setLibraryOpen(false, restoreFocus);
  }

  sceneCards.forEach(card => card.addEventListener('click', () => setScene(card.dataset.asciiScene)));
  libraryToggle?.addEventListener('click', () => setLibraryOpen(library?.hidden ?? true));
  libraryClose?.addEventListener('click', () => setLibraryOpen(false));
  libraryBackdrop?.addEventListener('click', () => setLibraryOpen(false));
  sceneGrid?.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const cards = sceneCards.filter(card => !card.disabled);
    const current = cards.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = (current + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
    cards[next].focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && library && !library.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setLibraryOpen(false);
    }
  }, true);

  function resize() {
    const rect = modal.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellW = width < 650 ? 7.25 : 8.4;
    cellH = width < 650 ? 12.4 : 14.25;
    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);
    ctx.font = `${width < 650 ? 9 : 10}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    clear();
    buildArtworkSamples();
  }

  /* ---------------- Original ambience scenes: preserved ---------------- */

  function mountain(t) {
    for (let i = 0; i < 110; i++) {
      const x = rand(i + 4) * cols;
      const y = rand(i + 170) * rows * .56;
      const twinkle = .12 + (Math.sin(t * .7 + i) + 1) * .09;
      glyph(x * cellW, y * cellH, i % 7 === 0 ? '+' : '.', twinkle);
    }
    for (let band = 0; band < 3; band++) {
      const y = rows * (.22 + band * .075) + Math.sin(t * .12 + band) * 1.2;
      for (let c = -8; c < cols + 8; c++) {
        const wave = Math.sin(c * .12 + t * (.13 + band * .025) + band) * 1.2;
        if (Math.sin(c * .08 + t * .18 + band * 2) > .42) glyph((c + (t * (1 + band) * .45) % 8) * cellW, (y + wave) * cellH, '~', .12 + band * .025);
      }
    }
    for (let layer = 0; layer < 3; layer++) {
      const base = rows * (.72 + layer * .075);
      const stride = width > 1450 ? 1 : 1;
      for (let c = 0; c < cols; c += stride) {
        const nx = c / cols;
        const peakA = Math.exp(-Math.pow((nx - (.27 + layer * .035)) * 4.1, 2));
        const peakB = Math.exp(-Math.pow((nx - (.73 - layer * .025)) * 4.7, 2));
        const ridge = base - (peakA * (.24 + layer * .035) + peakB * (.18 + layer * .03)) * rows;
        const jitter = Math.sin(c * .42 + layer * 3) * .65;
        for (let r = Math.max(0, Math.floor(ridge + jitter)); r < rows; r += 2) {
          const edge = r < ridge + 2;
          const char = edge ? (Math.sin(c * .2) > 0 ? '/' : '\\') : (rand(c * 8 + r * 13 + layer) > .5 ? ':' : '.');
          glyph(c * cellW, r * cellH, char, edge ? .24 - layer * .035 : .045 + layer * .018, layer === 0 ? '205,215,228' : '164,176,192');
        }
      }
    }
    const px = Math.floor(cols * .51), py = Math.floor(rows * .655);
    block('  o\n /|\\__\n / \\ ', px - 2, py, .8, '232,236,242');
    for (let c = 0; c < cols; c++) if (Math.abs(c - px) < 9) glyph(c * cellW, (py + 3) * cellH, c === px ? '_' : '.', .38);
  }

  function flowers(t) {
    for (let i = 0; i < 90; i++) glyph(rand(i + 81) * width, rand(i + 900) * height * .72, i % 9 ? '.' : '*', .08 + .08 * (Math.sin(t + i) + 1) / 2, '205,218,214');
    const count = Math.max(5, Math.floor(cols / 13));
    for (let i = 0; i < count; i++) {
      const baseX = (i + .5) * cols / count;
      const stemHeight = rows * (.26 + rand(i + 12) * .18);
      const sway = Math.sin(t * .55 + i * 1.7) * (1.2 + i % 3);
      const topX = baseX + sway;
      const topY = rows * .77 - stemHeight;
      for (let s = 0; s < stemHeight; s++) {
        const y = rows * .77 - s;
        const x = baseX + sway * (s / stemHeight);
        glyph(x * cellW, y * cellH, s % 4 === 0 ? '/' : '|', .23, '166,190,174');
        if (s % 5 === 2) glyph((x + (s % 2 ? 2 : -2)) * cellW, (y - 1) * cellH, s % 2 ? '<' : '>', .3, '177,197,177');
      }
      const flower = ['*', 'o', '+', '@'][i % 4];
      for (let p = 0; p < 8; p++) {
        const a = p * Math.PI / 4 + t * .08;
        glyph((topX + Math.cos(a) * 1.5) * cellW, (topY + Math.sin(a) * .85) * cellH, flower, .45, i % 2 ? '215,204,190' : '198,207,219');
      }
      glyph(topX * cellW, topY * cellH, 'o', .65, '240,231,210');
    }
    for (let i = 0; i < 20; i++) {
      const x = ((rand(i + 55) * cols + Math.sin(t * .22 + i) * 2) % cols) * cellW;
      const y = ((rand(i + 75) * rows + t * (1 + rand(i)) * 1.2) % rows) * cellH;
      glyph(x, y, i % 2 ? '.' : '*', .28, '222,218,204');
    }
  }

  function city(t) {
    for (let i = 0; i < 70; i++) glyph(rand(i + 800) * width, rand(i + 1000) * height * .55, '.', .1);
    let x = 0, building = 0;
    while (x < cols) {
      const bw = 5 + Math.floor(rand(building + 10) * 8);
      const bh = Math.floor(rows * (.2 + rand(building + 70) * .34));
      const top = rows - bh - 3;
      for (let c = x; c < Math.min(cols, x + bw); c++) {
        for (let r = top; r < rows - 2; r++) {
          const edge = c === x || c === x + bw - 1 || r === top;
          glyph(c * cellW, r * cellH, edge ? (r === top ? '_' : '|') : (rand(c * 44 + r * 5 + building) > .5 ? ':' : '.'), edge ? .26 : .11, '187,197,211');
          if (!edge && r % 3 !== 0 && rand(c * 31 + r * 9 + building * 3) > .52) {
            const flicker = .24 + .18 * (Math.sin(t * 1.7 + c * 2 + r) + 1) / 2;
            glyph(c * cellW, r * cellH, rand(c + r * 5) > .5 ? '#' : '+', flicker, '222,214,185');
          }
        }
      }
      x += bw + 1;
      building++;
    }
    for (let i = 0; i < Math.floor(cols * 1.6); i++) {
      const c = rand(i + 301) * cols;
      const r = (rand(i + 701) * rows + t * (5 + rand(i + 2) * 7)) % rows;
      glyph(c * cellW, r * cellH, i % 3 ? '|' : '/', .16, '172,190,207');
    }
    block('CITY / AFTER HOURS', 3, Math.max(2, Math.floor(rows * .12)), .34, '194,204,218');
  }

  function music(t) {
    const mid = rows * .52;
    for (let c = 0; c < cols; c++) {
      const x = c / cols;
      const wave = Math.sin(x * 17 - t * (playing ? 2.8 : 1.05) * tempoFactor) * .14 + Math.sin(x * 31 + t * .7) * .055;
      const y = mid + wave * rows;
      glyph(c * cellW, y * cellH, '~', .5, '210,220,235');
      glyph(c * cellW, (y + 1.2) * cellH, '.', .18, '164,180,205');
    }
    const gap = Math.max(2, Math.floor(cols / 46));
    for (let c = 1; c < cols; c += gap) {
      const envelope = .15 + .85 * Math.pow(Math.max(0, Math.sin(c * .27 + t * (playing ? 3.5 : .8) * tempoFactor) * Math.cos(c * .09 - t)), 2);
      const bar = Math.max(1, Math.floor(envelope * rows * .34));
      for (let r = 0; r < bar; r++) {
        const y = mid - r;
        const ch = r % 4 === 0 ? '#' : r % 2 ? ':' : '|';
        glyph(c * cellW, y * cellH, ch, .24 + envelope * .25, '220,226,238');
        glyph(c * cellW, (mid + r) * cellH, ch, .18 + envelope * .2, '177,190,211');
      }
    }
    const pulse = playing ? (Math.sin(t * 5.5 * tempoFactor) + 1) * .5 : .25;
    const label = 'S O U N D   I N   M O T I O N';
    block(label, Math.max(0, Math.floor((cols - label.length) / 2)), Math.floor(rows * .16), .22 + pulse * .18, '215,221,234');
  }

  function disco(t) {
    const cx = width * .5, cy = height * .47;
    const maxR = Math.min(width, height) * .44;
    const palette = ['214,207,235', '176,205,224', '226,190,211'];
    for (let ring = 0; ring < 7; ring++) {
      const radius = maxR * (.16 + ring * .115);
      const spin = t * (playing ? .22 : .07) * tempoFactor * (ring % 2 ? -1 : 1);
      const points = Math.floor(28 + ring * 9);
      for (let p = 0; p < points; p++) {
        const a = p / points * Math.PI * 2 + spin;
        const wobble = Math.sin(a * 5 + t * .7) * 3;
        const x = cx + Math.cos(a) * (radius + wobble);
        const y = cy + Math.sin(a) * (radius + wobble) * .52;
        glyph(x, y, ring % 2 ? '.' : '+', .22 + .16 * (Math.sin(a * 3 + t) + 1) / 2, palette[ring % palette.length]);
      }
    }
    for (let ray = 0; ray < 9; ray++) {
      const a = t * (playing ? .45 : .12) * tempoFactor + ray * Math.PI * 2 / 9;
      for (let step = 4; step < 17; step++) {
        const r = maxR * step / 17;
        glyph(cx + Math.cos(a) * r, cy + Math.sin(a) * r * .52, step % 2 ? '/' : '\\', .16, palette[ray % 3]);
      }
    }
    block('AFTER DARK  /  VISUAL FREQUENCY', 3, Math.floor(rows * .12), .3, '205,205,224');
  }

  function aurora(t) {
    for (let i = 0; i < 90; i++) glyph(rand(i + 400) * width, rand(i + 500) * height * .6, '.', .11 + .07 * (Math.sin(t + i) + 1) / 2, '205,218,225');
    for (let band = 0; band < 5; band++) {
      for (let c = 0; c < cols; c++) {
        const x = c / cols;
        const wave = Math.sin(x * (5 + band) + t * (.17 + band * .018) + band) * (rows * (.045 + band * .006));
        const wave2 = Math.sin(x * 11 - t * .11 + band * 1.7) * 2;
        const y = rows * (.22 + band * .065) + wave + wave2;
        const chars = ['~', ':', '/', '\\', '.'];
        glyph(c * cellW, y * cellH, chars[(c + band) % chars.length], .2 + band * .025, band % 2 ? '190,208,218' : '210,215,230');
        if (c % 2 === 0) glyph(c * cellW, (y + 1) * cellH, '.', .11, '169,193,207');
      }
    }
    for (let c = 0; c < cols; c++) {
      const ridge = rows * .76 - Math.abs(Math.sin(c * .035)) * rows * .2 - Math.abs(Math.sin(c * .081 + 1)) * rows * .1;
      for (let r = Math.floor(ridge); r < rows; r++) glyph(c * cellW, r * cellH, r === Math.floor(ridge) ? '^' : '.', r === Math.floor(ridge) ? .32 : .06, '177,190,205');
    }
  }

  /* ---------------- New scenes inspired by the uploaded reels ---------------- */

  function flowerHead(cx, cy, scale, t, variant = 0) {
    const petalColors = variant % 2 ? ['218,191,205', '206,178,197'] : ['221,222,231', '198,207,218'];
    const open = .72 + .28 * (Math.sin(t * .42 + variant) + 1) / 2;
    for (let p = 0; p < 6; p++) {
      const a = p * Math.PI / 3 + Math.sin(t * .18 + variant) * .025;
      const distance = 1.42 * scale * open;
      const px = cx + Math.cos(a) * distance;
      const py = cy + Math.sin(a) * distance * .72;
      for (let step = 1; step <= 4; step++) {
        const f = step / 4;
        const x = cx + (px - cx) * f;
        const y = cy + (py - cy) * f;
        glyph(x * cellW, y * cellH, step === 4 ? '*' : (step % 2 ? ':' : '.'), .28 + .06 * step, petalColors[(p + variant) % 2]);
        glyph((x + Math.cos(a + Math.PI / 2) * .45 * f) * cellW, (y + Math.sin(a + Math.PI / 2) * .45 * f) * cellH, '.', .22, petalColors[0]);
      }
    }
    glyph(cx * cellW, cy * cellH, 'o', .8, '231,213,171');
    glyph(cx * cellW, (cy + .45) * cellH, '.', .5, '236,219,181');
  }

  function lilies(t) {
    for (let i = 0; i < 54; i++) glyph(rand(i + 200) * width, rand(i + 500) * height * .72, i % 8 === 0 ? '*' : '.', .09 + .04 * Math.sin(t * .4 + i), '194,205,215');
    const stems = Math.max(3, Math.min(7, Math.floor(cols / 34)));
    for (let i = 0; i < stems; i++) {
      const baseX = cols * (.22 + i * (.56 / Math.max(1, stems - 1)));
      const heightFactor = .28 + rand(i + 72) * .20;
      const stemH = rows * heightFactor;
      const sway = Math.sin(t * .35 + i * 1.6) * (1.0 + i % 3);
      const topX = baseX + sway;
      const topY = rows * .80 - stemH;
      for (let s = 0; s < stemH; s++) {
        const f = s / stemH;
        const x = baseX + sway * f;
        const y = rows * .80 - s;
        glyph(x * cellW, y * cellH, s % 5 === 0 ? '/' : '|', .26, '128,165,143');
        if (s > 4 && s % 8 === 3) {
          const side = s % 2 ? -1 : 1;
          segment(x, y - .5, x + side * 2.1, y - 2.1, side < 0 ? '<' : '>', .25, '151,177,153', .8);
        }
      }
      flowerHead(topX, topY, .9 + rand(i + 14) * .5, t, i);
      if (i % 2 === 0) {
        glyph((topX - .65) * cellW, (topY + 1.05) * cellH, '.', .42, '215,202,209');
        glyph((topX + .7) * cellW, (topY + 1.1) * cellH, '.', .42, '215,202,209');
      }
    }
    block('L I L Y   S T U D Y', Math.max(2, Math.floor(cols * .04)), Math.floor(rows * .13), .21, '210,213,222');
  }

  function bouquet(t) {
    const center = cols * .5, ground = rows * .80;
    const blooms = Math.max(7, Math.min(11, Math.floor(cols / 21)));
    for (let i = 0; i < blooms; i++) {
      const spread = (i - (blooms - 1) / 2) / blooms;
      const baseX = center + spread * cols * .28;
      const peak = rows * (.22 + rand(i + 100) * .22);
      const sway = Math.sin(t * .42 + i) * 1.1;
      const topX = baseX + sway;
      const topY = ground - peak;
      const height = Math.max(4, ground - topY);
      for (let s = 0; s < height; s++) {
        const f = s / height;
        const x = baseX + sway * f;
        const y = ground - s;
        glyph(x * cellW, y * cellH, s % 4 ? '|' : '/', .25, '132,168,145');
        if (s % 7 === 2) {
          const side = i % 2 ? -1 : 1;
          glyph((x + side * 1.5) * cellW, (y - 1) * cellH, side > 0 ? '<' : '>', .24, '154,184,151');
        }
      }
      flowerHead(topX, topY, .75 + rand(i + 4) * .35, t, i + 1);
    }
    // Folded paper and a ribbon at the base of the arrangement.
    for (let c = -8; c <= 8; c++) {
      const spread = Math.abs(c) / 8;
      glyph((center + c) * cellW, (ground + 1.5 + spread * 2) * cellH, c % 2 ? '/' : '\\', .19, '173,180,190');
    }
    segment(center - 4, ground + 3, center + 4, ground + 3, '=', .32, '204,181,190');
    block('A SMALL ARRANGEMENT', Math.max(2, Math.floor((cols - 20) / 2)), Math.floor(rows * .12), .23, '215,212,220');
  }

  function garden(t) {
    const count = Math.max(12, Math.min(30, Math.floor(cols / 5.7)));
    for (let i = 0; i < count; i++) {
      const baseX = (i + .5) * cols / count;
      const growth = .38 + rand(i + 61) * .62;
      const stemH = rows * (.08 + growth * .25);
      const phase = (t * .14 + rand(i + 33) * 1.2) % 1;
      const sway = Math.sin(t * .55 + i * .8) * (.3 + growth * 1.7);
      const topX = baseX + sway;
      const topY = rows * .84 - stemH * Math.min(1, .18 + phase * 1.2);
      const height = Math.max(2, rows * .84 - topY);
      for (let s = 0; s < height; s++) {
        const f = s / height;
        const x = baseX + sway * f;
        const y = rows * .84 - s;
        glyph(x * cellW, y * cellH, s % 3 ? '|' : '/', .19 + growth * .06, '129,166,142');
        if (s > 3 && s % 6 === 2) glyph((x + (i % 2 ? 1.6 : -1.6)) * cellW, (y - 1) * cellH, i % 2 ? '<' : '>', .23, '149,177,148');
      }
      if (growth > .52 && phase > .12) {
        const size = .45 + growth * .52;
        flowerHead(topX, topY, size, t, i + 2);
      } else if (growth > .3) glyph(topX * cellW, topY * cellH, '.', .22, '199,207,186');
    }
    // Fine grass at the bottom edge.
    for (let c = 0; c < cols; c += 2) {
      const y = rows * .87 + Math.sin(c * .4 + t * .55) * .8;
      glyph(c * cellW, y * cellH, c % 4 ? '/' : '\\', .16, '127,159,137');
    }
    for (let i = 0; i < 26; i++) {
      const x = (rand(i + 17) * cols + Math.sin(t * .25 + i) * 1.1) % cols;
      const y = (rand(i + 53) * rows * .62 + t * (.4 + rand(i + 3) * .35)) % (rows * .82);
      glyph(x * cellW, y * cellH, i % 4 ? '.' : '*', .24, '216,211,196');
    }
  }

  function knight(t) {
    // Embers and a quiet field frame the central figure.
    for (let i = 0; i < 90; i++) {
      const x = rand(i + 92) * cols;
      const y = rows * (.45 + rand(i + 22) * .48);
      glyph(x * cellW, (y - ((t * (1 + rand(i)) * 1.2) % 4)) * cellH, i % 8 ? '.' : '*', .08 + .08 * Math.sin(t + i), i % 4 ? '174,168,163' : '173,108,106');
    }
    for (let i = 0; i < Math.max(10, cols * .18); i++) {
      const x = rand(i + 310) * cols;
      const y = rows * (.78 + rand(i + 90) * .1);
      glyph(x * cellW, y * cellH, i % 2 ? '*' : '.', .23, '157,94,93');
    }
    const x = cols * .52 + Math.sin(t * .24) * .35;
    const base = rows * .79;
    const top = rows * .29;
    const breathe = Math.sin(t * .8) * .25;
    // Helmet, plume, visor and shoulders.
    block('    .-^^-.', x - 5, top, .62, '205,210,218');
    block('   /______\\', x - 5, top + 1, .7, '205,210,218');
    block('   | .--. |', x - 5, top + 2, .7, '198,205,216');
    block('   |  __  |', x - 5, top + 3, .65, '190,198,211');
    // Torso and cape.
    segment(x - 4, top + 5, x - 6, top + 11, '/', .65, '178,188,204');
    segment(x + 4, top + 5, x + 5, top + 11, '\\', .65, '178,188,204');
    segment(x - 4, top + 5, x + 4, top + 5, '_', .72, '202,207,218');
    segment(x - 4, top + 6, x + 4, top + 6, '|', .58, '184,194,209');
    segment(x - 3, top + 7 + breathe, x + 3, top + 7 + breathe, '=', .48, '198,202,211');
    segment(x, top + 5, x, top + 12, '|', .6, '196,201,213');
    segment(x - 5, top + 9, x - 8, base - 1, '/', .45, '140,149,166');
    segment(x + 5, top + 9, x + 8, base - 1, '\\', .45, '140,149,166');
    // Arms and legs.
    segment(x - 4, top + 6, x - 8, top + 12, '\\', .68, '192,200,211');
    segment(x + 4, top + 6, x + 7, top + 12, '/', .68, '192,200,211');
    segment(x - 1, top + 12, x - 3, base, '/', .68, '190,198,210');
    segment(x + 1, top + 12, x + 4, base, '\\', .68, '190,198,210');
    segment(x - 4, base, x - 1, base, '_', .55, '190,198,210');
    segment(x + 2, base, x + 5, base, '_', .55, '190,198,210');
    // Sword raised at the right side.
    const swordX = x + 10;
    segment(swordX, top + 3, swordX + 2, base - 5, '/', .7, '211,219,230');
    segment(swordX - 2, top + 8, swordX + 4, top + 8, '-', .68, '205,211,220');
    glyph(swordX * cellW, (top + 2) * cellH, '+', .7, '229,232,236');
    // Red flowers along the ground.
    for (let i = 0; i < 12; i++) {
      const fx = (i + .5) * cols / 12;
      const fy = rows * (.84 + rand(i + 5) * .05);
      glyph(fx * cellW, fy * cellH, i % 3 ? '*' : '+', .38, '170,102,106');
      glyph((fx + .8) * cellW, (fy - .5) * cellH, '.', .23, '198,142,135');
    }
    block('THE LAST WATCH', 3, Math.floor(rows * .12), .25, '191,197,208');
  }

  function starry(t) {
    const cx = cols * .57, cy = rows * .34;
    for (let i = 0; i < 150; i++) {
      const a = rand(i + 9) * Math.PI * 2 + t * (.025 + rand(i + 5) * .012);
      const radius = 2 + rand(i + 90) * Math.min(cols, rows) * .33;
      const x = cx + Math.cos(a) * radius * 1.5;
      const y = cy + Math.sin(a) * radius * .7;
      const sparkle = .14 + .19 * (Math.sin(t * .75 + i) + 1) / 2;
      glyph(x * cellW, y * cellH, i % 11 === 0 ? '*' : '.', sparkle, i % 5 ? '205,213,231' : '216,196,177');
    }
    // Spiral wind bands that roll across the night sky.
    for (let band = 0; band < 5; band++) {
      for (let c = 0; c < cols; c++) {
        const x = c / cols;
        const wave = Math.sin(x * (8 + band * 1.4) - t * (.28 + band * .025) + band) * (rows * (.035 + band * .006));
        const y = rows * (.16 + band * .07) + wave;
        const char = ['~', '∿', ':', '.', '*'][band];
        glyph(c * cellW, y * cellH, char, .2 + .06 * Math.sin(t * .4 + c * .1 + band), band % 2 ? '188,201,220' : '205,190,190');
      }
    }
    const swirlR = Math.min(cols, rows) * .12;
    for (let i = 0; i < 100; i++) {
      const a = i * .29 + t * .12;
      const r = swirlR * (i / 100);
      const x = cx + Math.cos(a) * r * 1.4;
      const y = cy + Math.sin(a) * r * .7;
      glyph(x * cellW, y * cellH, i % 7 ? '.' : '*', .18 + (i / 100) * .22, '214,204,211');
    }
    // Quiet rolling hills.
    for (let c = 0; c < cols; c++) {
      const ridge = rows * .75 - Math.sin(c * .035 + .7) * rows * .07 - Math.sin(c * .092) * rows * .045;
      glyph(c * cellW, ridge * cellH, c % 3 ? '_' : '/', .25, '169,180,196');
      for (let r = Math.floor(ridge + 1); r < rows; r++) if (rand(c * 21 + r * 4) > .46) glyph(c * cellW, r * cellH, '.', .055, '148,160,178');
    }
    // Small village lights.
    for (let i = 0; i < 7; i++) {
      const vx = cols * (.12 + i * .12);
      const vy = rows * (.77 + rand(i + 4) * .04);
      block(i % 2 ? ' /\\\n|_|' : ' /\\\n|_|', vx, vy, .21, '174,184,198');
      glyph((vx + 1) * cellW, (vy + 1) * cellH, '+', .3, '223,194,154');
    }
  }

  function ocean(t) {
    const horizon = rows * .42;
    for (let i = 0; i < 85; i++) {
      const x = rand(i + 300) * cols;
      const y = rand(i + 501) * rows * .32;
      glyph(x * cellW, y * cellH, i % 9 ? '.' : '*', .12, '196,208,223');
    }
    const moonX = cols * .73, moonY = rows * .2;
    for (let ring = 0; ring < 3; ring++) {
      const radius = 2 + ring * 1.8;
      for (let p = 0; p < 24; p++) {
        const a = p / 24 * Math.PI * 2;
        glyph((moonX + Math.cos(a) * radius) * cellW, (moonY + Math.sin(a) * radius * .6) * cellH, '.', .22 - ring * .035, '211,216,224');
      }
    }
    glyph(moonX * cellW, moonY * cellH, 'o', .68, '231,225,208');
    for (let r = Math.floor(horizon); r < rows; r++) {
      const depth = (r - horizon) / (rows - horizon);
      const amp = .6 + depth * 1.8;
      const step = Math.max(1, Math.floor(1 + depth * .4));
      for (let c = 0; c < cols; c += step) {
        const wave = Math.sin(c * (.19 + depth * .08) + t * (.45 + depth * .32)) * amp;
        const wave2 = Math.sin(c * .07 - t * .28 + r * .13) * amp * .45;
        const y = r + wave + wave2;
        const reflection = Math.abs(c - moonX) < 2 + depth * 8;
        const ch = reflection ? (r % 3 ? ':' : '|') : (r % 4 === 0 ? '~' : (c % 2 ? '-' : '.'));
        glyph(c * cellW, y * cellH, ch, .12 + depth * .2 + (reflection ? .08 : 0), reflection ? '209,210,216' : '154,176,198');
      }
    }
    block('MIDNIGHT TIDE', 3, Math.floor(rows * .12), .24, '201,211,223');
  }

  function nightdrive(t) {
    const horizon = rows * .43;
    const center = cols * (.5 + Math.sin(t * .07) * .015);
    for (let i = 0; i < 100; i++) {
      const x = rand(i + 19) * cols;
      const y = rand(i + 71) * rows * .4;
      glyph(x * cellW, y * cellH, i % 13 ? '.' : '*', .1, '183,198,213');
    }
    // Distant lights and a low skyline.
    for (let i = 0; i < 10; i++) {
      const x = cols * (.12 + i * .085);
      const y = horizon + Math.sin(i * 2.1) * 1.4;
      glyph(x * cellW, y * cellH, i % 3 ? '.' : '+', .24, '200,185,159');
    }
    // Perspective road sides.
    const roadHalf = cols * .48;
    segment(center, horizon, center - roadHalf, rows * 1.03, '/', .4, '176,189,204', .72);
    segment(center, horizon, center + roadHalf, rows * 1.03, '\\', .4, '176,189,204', .72);
    // A broken center line expands toward the viewer.
    for (let i = 0; i < 10; i++) {
      const f = (i + ((t * 1.5) % 1)) / 10;
      const y = horizon + Math.pow(f, 1.55) * (rows - horizon);
      const half = Math.pow(f, 1.4) * 1.9;
      segment(center - half, y, center + half, y, '-', .3 + f * .22, '214,216,218', 1.2);
    }
    // Passing roadside reflectors.
    for (let i = 0; i < 18; i++) {
      const f = (rand(i + 7) + (t * (.18 + rand(i + 50) * .06)) % 1) % 1;
      const y = horizon + Math.pow(f, 1.45) * (rows - horizon);
      const spread = Math.pow(f, 1.15) * roadHalf * .94;
      const side = i % 2 ? -1 : 1;
      glyph((center + side * spread) * cellW, y * cellH, i % 3 ? '.' : '|', .12 + f * .4, i % 2 ? '190,207,222' : '218,193,161');
    }
    // Very subtle dashboard silhouette.
    const dash = rows * .94;
    segment(cols * .12, dash, cols * .88, dash - 1, '_', .22, '112,123,139');
    block('N I G H T   D R I V E', Math.max(2, Math.floor(cols * .04)), Math.floor(rows * .12), .22, '202,211,222');
  }

  function sunmoon(t) {
    const cx = cols * .5, cy = rows * .46;
    const orbitX = cols * .27, orbitY = rows * .25;
    // Fine elliptical orbit.
    for (let i = 0; i < 110; i++) {
      const a = i / 110 * Math.PI * 2;
      const x = cx + Math.cos(a) * orbitX;
      const y = cy + Math.sin(a) * orbitY;
      if (i % 2 === 0) glyph(x * cellW, y * cellH, '.', .14, '176,186,204');
    }
    const angle = t * .12;
    const sunX = cx + Math.cos(angle) * orbitX;
    const sunY = cy + Math.sin(angle) * orbitY;
    const moonX = cx + Math.cos(angle + Math.PI) * orbitX;
    const moonY = cy + Math.sin(angle + Math.PI) * orbitY;
    const pulse = .6 + .4 * (Math.sin(t * .7) + 1) / 2;
    for (let p = 0; p < 16; p++) {
      const a = p / 16 * Math.PI * 2;
      const r = 4.2 + pulse;
      segment(sunX + Math.cos(a) * r * .72, sunY + Math.sin(a) * r * .72, sunX + Math.cos(a) * (r + 1.2), sunY + Math.sin(a) * (r + 1.2), p % 2 ? '.' : '-', .25 + pulse * .12, '221,208,179');
    }
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) glyph((sunX + x) * cellW, (sunY + y) * cellH, rand(x * 7 + y * 13) > .5 ? ':' : '.', .32 + pulse * .22, '224,211,184');
    // Crescent: draw a pale rim, then mask a sliver with dark space.
    for (let p = 0; p < 26; p++) {
      const a = p / 26 * Math.PI * 2;
      const x = moonX + Math.cos(a) * 3.2;
      const y = moonY + Math.sin(a) * 2.6;
      glyph(x * cellW, y * cellH, '.', .28, '193,206,224');
    }
    block('SOL / LUNA', 3, Math.floor(rows * .12), .22, '199,205,218');
  }

  function makeButterfly(x, y, vx, vy, life = 8) {
    return { x, y, vx, vy, life, maxLife: life, phase: rand(x * 11 + y * 17) * Math.PI * 2, size: .7 + rand(x * 3 + y) * .55 };
  }

  function spawnButterflies(clientX, clientY, amount = 18) {
    const rect = modal.getBoundingClientRect();
    const x = (clientX - rect.left) / Math.max(1, rect.width) * cols;
    const y = (clientY - rect.top) / Math.max(1, rect.height) * rows;
    for (let i = 0; i < amount; i++) {
      const a = rand(i + elapsed * 70) * Math.PI * 2;
      const speed = .5 + rand(i + 19) * 1.6;
      butterflies.push(makeButterfly(x, y, Math.cos(a) * speed, Math.sin(a) * speed - .25, 5 + rand(i + 50) * 5));
    }
    if (butterflies.length > 110) butterflies.splice(0, butterflies.length - 110);
  }

  function drawButterfly(x, y, phase, alpha, scale = 1) {
    const flap = Math.sin(phase) > 0 ? 1 : 0;
    const spread = 1.4 * scale;
    glyph((x - spread) * cellW, y * cellH, flap ? '<' : '(', alpha, '205,211,226');
    glyph((x + spread) * cellW, y * cellH, flap ? '>' : ')', alpha, '205,211,226');
    glyph(x * cellW, y * cellH, '*', alpha * .8, '224,211,190');
    glyph(x * cellW, (y + .8 * scale) * cellH, '|', alpha * .72, '196,204,216');
  }

  function butterfliesScene(t, dt) {
    for (let i = 0; i < 48; i++) {
      const x = (rand(i + 22) * cols + Math.sin(t * .16 + i) * 1.6 + cols) % cols;
      const y = (rand(i + 82) * rows * .8 + Math.sin(t * .45 + i * .7) * 1.4) % (rows * .86);
      drawButterfly(x, y, t * 2 + i, .12 + .08 * (Math.sin(t + i) + 1) / 2, .55 + rand(i + 6) * .4);
    }
    butterflies = butterflies.filter(b => b.life > 0);
    for (const b of butterflies) {
      b.life -= dt;
      b.phase += dt * 11;
      b.x += (b.vx + Math.sin(b.phase * .35) * .12) * dt * 3.2;
      b.y += (b.vy + Math.cos(b.phase * .3) * .1) * dt * 3.2;
      b.vx *= .995; b.vy -= dt * .04;
      const fade = clamp(b.life / b.maxLife, 0, 1);
      drawButterfly(b.x, b.y, b.phase, .1 + fade * .58, b.size);
    }
    block('TOUCH THE NIGHT', 3, Math.floor(rows * .12), .22, '201,208,221');
  }

  function christmas(t) {
    for (let i = 0; i < 115; i++) {
      const x = rand(i + 8) * cols;
      const y = (rand(i + 120) * rows + t * (1.1 + rand(i + 2) * 1.6)) % rows;
      glyph(x * cellW, y * cellH, i % 11 ? '.' : '*', .15 + .1 * Math.sin(t * .6 + i), '201,211,224');
    }
    const center = cols * .5, top = rows * .17, base = rows * .78;
    const height = base - top;
    for (let r = 0; r < height; r++) {
      const half = (r / height) * Math.min(cols * .22, height * .56);
      for (let c = Math.floor(center - half); c <= center + half; c++) {
        if (c < 0 || c >= cols) continue;
        const edge = Math.abs(c - center) > half - 1.4;
        const sparkle = Math.sin(c * 1.8 + r * 2.4 + t * 1.6);
        const ornament = rand(c * 7 + r * 11) > .978;
        const ch = ornament ? (sparkle > 0 ? '*' : 'o') : (edge ? '/' : (sparkle > .65 ? '+' : '.'));
        glyph(c * cellW, (top + r) * cellH, ch, ornament ? .58 : (edge ? .35 : .11), ornament ? '212,194,166' : '155,180,168');
      }
    }
    block('   *', Math.floor(center - 1), Math.max(1, Math.floor(top) - 2), .85, '223,211,183');
    for (let c = 0; c < 7; c++) glyph((center - 3 + c) * cellW, (base + 2) * cellH, c % 2 ? '|' : '_', .28, '157,166,177');
    block('WINTER / QUIET HOURS', 3, Math.floor(rows * .12), .2, '201,210,222');
  }

  /* Album artwork -> live ASCII luminance map, inspired by the image-based reels. */
  function loadArtwork() {
    if (!coverImg) return;
    const src = coverImg.currentSrc || coverImg.src;
    if (!src) return;
    const token = ++artLoadToken;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (token !== artLoadToken) return;
      artImage = image;
      buildArtworkSamples();
    };
    image.onerror = () => {
      if (token !== artLoadToken) return;
      artImage = null;
      artSamples = null;
      coverPalette = ['190,174,205', '132,164,188', '207,170,151'];
      modal.style.setProperty('--fs-cover-color-1', `rgb(${coverPalette[0]})`);
      modal.style.setProperty('--fs-cover-color-2', `rgb(${coverPalette[1]})`);
      modal.style.setProperty('--fs-cover-color-3', `rgb(${coverPalette[2]})`);
    };
    image.src = src;
  }

  function updateCoverPalette(samples) {
    if (!samples?.length) return;
    const buckets = new Map();
    const stride = Math.max(1, Math.floor(samples.length / 900));
    for (let i = 0; i < samples.length; i += stride) {
      const sample = samples[i];
      if (!sample || sample.lum < 24) continue;
      const saturation = Math.max(sample.r, sample.g, sample.b) - Math.min(sample.r, sample.g, sample.b);
      const weight = .55 + saturation / 255 + Math.abs(sample.lum - 128) / 510;
      const key = [Math.round(sample.r / 24), Math.round(sample.g / 24), Math.round(sample.b / 24)].join(',');
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0 };
      bucket.r += sample.r * weight;
      bucket.g += sample.g * weight;
      bucket.b += sample.b * weight;
      bucket.weight += weight;
      buckets.set(key, bucket);
    }
    const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight);
    const selected = [];
    for (const item of ranked) {
      const color = [Math.round(item.r / item.weight), Math.round(item.g / item.weight), Math.round(item.b / item.weight)];
      if (selected.every(other => Math.hypot(color[0] - other[0], color[1] - other[1], color[2] - other[2]) > 48)) selected.push(color);
      if (selected.length === 3) break;
    }
    while (selected.length < 3) selected.push(selected[selected.length - 1] || [160, 170, 190]);
    coverPalette = selected.map(rgb => rgb.join(','));
    modal.style.setProperty('--fs-cover-color-1', `rgb(${coverPalette[0]})`);
    modal.style.setProperty('--fs-cover-color-2', `rgb(${coverPalette[1]})`);
    modal.style.setProperty('--fs-cover-color-3', `rgb(${coverPalette[2]})`);
  }

  function buildArtworkSamples() {
    if (!artImage || !cols || !rows) return;
    artCols = Math.max(24, Math.floor(cols * .86));
    artRows = Math.max(14, Math.floor(rows * .86));
    const off = document.createElement('canvas');
    off.width = artCols; off.height = artRows;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return;
    const scale = Math.max(artCols / artImage.width, artRows / artImage.height);
    const sw = artCols / scale, sh = artRows / scale;
    const sx = (artImage.width - sw) / 2, sy = (artImage.height - sh) / 2;
    octx.drawImage(artImage, sx, sy, sw, sh, 0, 0, artCols, artRows);
    try {
      const pixels = octx.getImageData(0, 0, artCols, artRows).data;
      const samples = new Array(artCols * artRows);
      for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const lum = .2126 * r + .7152 * g + .0722 * b;
        samples[p] = { lum, r, g, b };
      }
      artSamples = samples;
      updateCoverPalette(samples);
    } catch (_) {
      // Cross-origin hosts can deny pixel reads. The rest of the scenes remain available.
      artSamples = null;
    }
  }

  function artwork(t) {
    if (!artSamples) {
      const label = 'ALBUM ART / ASCII';
      block(label, Math.max(1, Math.floor((cols - label.length) / 2)), Math.floor(rows * .48), .48, '212,220,231');
      block('IMAGE SOURCE NOT AVAILABLE', Math.max(1, Math.floor((cols - 25) / 2)), Math.floor(rows * .53), .22, '165,178,197');
      return;
    }
    const chars = '  .,:;-=+*#%@';
    const ox = Math.floor((cols - artCols) / 2), oy = Math.floor((rows - artRows) / 2);
    for (let y = 0; y < artRows; y++) {
      for (let x = 0; x < artCols; x++) {
        const sample = artSamples[y * artCols + x];
        if (!sample || sample.lum < 18) continue;
        const shimmer = .94 + .06 * Math.sin(t * 1.3 + x * .08 + y * .12);
        const index = clamp(Math.floor(sample.lum / 255 * (chars.length - 1)), 0, chars.length - 1);
        const ch = chars[index];
        const grey = sample.lum * .48 + 100;
        const r = Math.round(sample.r * .36 + grey * .64);
        const g = Math.round(sample.g * .36 + grey * .64);
        const b = Math.round(sample.b * .36 + grey * .64);
        glyph((ox + x) * cellW, (oy + y) * cellH, ch, (.16 + sample.lum / 255 * .65) * shimmer, `${r},${g},${b}`);
      }
    }
    block('CURRENT ARTWORK / GLYPH STUDY', 3, Math.floor(rows * .1), .26, '204,211,222');
  }

  function chromaticFlow(t) {
    const palette = coverPalette;
    const bands = 7;
    for (let band = 0; band < bands; band++) {
      const base = rows * (.2 + band * .095);
      const amp = rows * (.025 + (band % 3) * .012);
      for (let c = 0; c < cols; c++) {
        const x = c / Math.max(1, cols - 1);
        const y = base + Math.sin(x * (5.2 + band * .7) - t * (.22 + band * .025) + band) * amp
          + Math.sin(x * 13 - t * .13 + band * .8) * amp * .38;
        const char = ['~', ':', '.', '∿', '-', '+', '*'][band];
        const alpha = .12 + .085 * (Math.sin(t * .45 + x * 6 + band) + 1) / 2;
        glyph(c * cellW, y * cellH, char, alpha, palette[band % palette.length]);
      }
    }
    for (let i = 0; i < 125; i++) {
      const x = (rand(i + 61) * cols + Math.sin(t * .1 + i) * 1.3 + cols) % cols;
      const y = (rand(i + 161) * rows + t * (.15 + rand(i + 2) * .25)) % rows;
      glyph(x * cellW, y * cellH, i % 13 === 0 ? '*' : '.', .12 + .12 * Math.sin(t * .6 + i), palette[i % palette.length]);
    }
    block('CHROMATIC / DRIFT', 3, Math.floor(rows * .12), .22, palette[0]);
  }

  const renderers = {
    mountain: mountain,
    flowers: flowers,
    city: city,
    music: music,
    disco: disco,
    aurora: aurora,
    lilies: lilies,
    bouquet: bouquet,
    garden: garden,
    knight: knight,
    starry: starry,
    ocean: ocean,
    nightdrive: nightdrive,
    sunmoon: sunmoon,
    butterflies: butterfliesScene,
    christmas: christmas,
    artwork: artwork,
    album: artwork,
    chromatic: chromaticFlow
  };

  function render(t, dt = 0, force = false) {
    if (!width || !height || scene === 'off') { clear(); return; }
    ctx.clearRect(0, 0, width, height);
    const renderer = renderers[scene];
    if (renderer) renderer(t, dt);
    if (force) return;
  }

  function pollPlayback(now) {
    if (now - lastPlaybackPoll < 650) return;
    lastPlaybackPoll = now;
    const track = window.__songShareLastNowPlaying || {};
    playing = Boolean(track.isPlaying || track.is_playing);
    const tempo = Number(track.tempo || track.audioFeatures?.tempo || track.audio_features?.tempo);
    tempoFactor = Number.isFinite(tempo) && tempo > 30 ? clamp(tempo / 120, .72, 1.55) : 1;
  }

  function frame(timestamp) {
    if (!running) return;
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, .05);
    lastTime = timestamp;
    if (timestamp - lastRender >= 34) {
      lastRender = timestamp;
      pollPlayback(timestamp);
      elapsed += dt * (playing ? tempoFactor : .42);
      if (scene !== 'off') render(elapsed, dt);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    lastRender = 0;
    if (reducedMotion.matches) {
      render(elapsed, 0, true);
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTime = 0;
  }

  function sync() {
    if (modal.classList.contains('active')) {
      resize();
      if (['artwork', 'album', 'chromatic'].includes(scene) && !artImage) loadArtwork();
      start();
    } else {
      stop();
      setLibraryOpen(false, false);
    }
  }

  // Click/tap on the empty background to release a flock of ASCII butterflies.
  modal.addEventListener('pointerdown', event => {
    if (scene !== 'butterflies') return;
    if (event.target.closest('button, a, input, .fs-lyrics-column, .fullscreen-bottom-dock, .fs-art-column, .fullscreen-top-nav, .fs-scene-library')) return;
    spawnButterflies(event.clientX, event.clientY, 22);
  });
  modal.addEventListener('pointermove', event => {
    const rect = modal.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
    pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
  }, { passive: true });

  const observer = new MutationObserver(sync);
  observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  if (coverImg) {
    const refreshArtwork = () => {
      artImage = null;
      artSamples = null;
      loadArtwork();
    };
    const coverObserver = new MutationObserver(refreshArtwork);
    coverObserver.observe(coverImg, { attributes: true, attributeFilter: ['src'] });

    // src can change before the browser has updated currentSrc. Reload once
    // the new image is decoded so palette extraction never stays on old art.
    coverImg.addEventListener('load', refreshArtwork);
    if (coverImg.complete && coverImg.naturalWidth) refreshArtwork();
  }
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : sync());
  reducedMotion.addEventListener?.('change', () => { stop(); sync(); });

  setScene(savedScene, false);
  sync();
})();
