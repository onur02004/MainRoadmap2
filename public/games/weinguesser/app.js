(() => {
  'use strict';

  const STORAGE = {
    selectedIds: 'weinguesser.selectedCityPointIds.v4',
    radius: 'weinguesser.panoramaRadius',
    heading: 'weinguesser.initialHeading',
    gameSettings: 'weinguesser.gameSettings.v1'
  };

  const $ = (id) => document.getElementById(id);
  const valueOf = (id, fallback = '') => $(id)?.value ?? fallback;
  const textOf = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const SCREENS = ['homeScreen', 'gameScreen', 'summaryScreen'];
  let config = null;
  let googleMapsEmbedApiKey = ''; 
  let selectedIds = new Set();
  let selectedMode = 'classic';
  let guessMap = null;
  let guessTileLayer = null;
  let currentRound = null;
  let rounds = [];
  let activeSpots = [];
  let currentRoundIndex = 0;
  let selectedGuess = null;
  let previousGuessDistance = null;
  let guessMarker = null;
  let targetMarker = null;
  let resultLine = null;
  let totalScore = 0;
  let roundResults = [];
  let timerInterval = null;
  let timeRemaining = 0;
  let toastTimer = null;
  let renderSequence = 0;
  let panoramaReady = false;
  let initializationStarted = false;

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function setScreen(activeId) {
    SCREENS.forEach((id) => $(id)?.classList.toggle('hidden', id !== activeId));
    window.scrollTo(0, 0);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function distanceKm(a, b) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const earthRadius = 6371.0088;
    const dLat = radians(b.lat - a.lat);
    const dLng = radians(b.lng - a.lng);
    const lat1 = radians(a.lat);
    const lat2 = radians(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(h));
  }

  function getGoogleKey() {
    return googleMapsEmbedApiKey;
  }

  function getSelectedSpots() {
    return config.spots.filter((spot) => selectedIds.has(spot.id));
  }

  // City cards are generated only for cities represented in the user's coordinates.
  function getCityGroups() {
    const order = ['Weingarten', 'Ravensburg', 'Friedrichshafen', 'Konstanz', 'Ulm'];
    const icons = { Weingarten: '⌂', Ravensburg: '⌖', Friedrichshafen: '≈', Konstanz: '◉', Ulm: '△' };
    return order.map((name) => ({
      id: name.toLocaleLowerCase('tr'),
      name,
      icon: icons[name] || '⌖',
      spots: config.spots.filter((spot) => spot.city === name)
    })).filter((group) => group.spots.length > 0);
  }

  function selectedModeName() {
    return ({ classic: 'Klasik', timed: 'Zamana karşı', hotcold: 'Sıcak / soğuk', oneshot: 'Tek atış' })[selectedMode] || 'Klasik';
  }

  function selectedRoundCount() {
    const selectedCount = selectedIds.size;
    const value = valueOf('roundCount', '5');
    if (value === 'all') return selectedCount;
    return Math.min(Number(value) || 5, selectedCount);
  }

  function updateSelectionSummary() {
    const count = selectedIds.size;
    textOf('selectedCount', String(count));
    textOf('topSelectedCount', `${count} NOKTA`);
    textOf('heroSpotCount', String(config.spots.length));
    textOf('spotCount', String(config.spots.length));
    textOf('totalCount', String(config.spots.length));
    const chosenCities = getCityGroups().filter((group) => group.spots.length && group.spots.every((spot) => selectedIds.has(spot.id)));
    textOf('selectionFooterText', `${chosenCities.length} şehir · ${count} nokta seçili`);
    textOf('selectionSummary', `${chosenCities.length} şehir · ${count} koordinat seçili`);
    const startButton = $('startButton');
    if (startButton) startButton.disabled = count === 0;

    const roundsCount = selectedRoundCount();
    const roundWord = roundsCount === 1 ? 'tur' : 'tur';
    textOf('sessionSummaryTitle', `${roundsCount} ${roundWord} · ${selectedModeName()}`);
    textOf('sessionSummaryText', `${chosenCities.map((group) => group.name).join(', ') || 'Seçilen şehirler'} · ${roundsCount} tur oynanacak.`);
    textOf('sessionSummaryChip', count ? 'HAZIR' : 'ŞEHİR SEÇ');
    textOf('regionSummaryCount', `${count} NOKTA`);
    textOf('regionSummaryText', `${chosenCities.length} şehirdeki ${count} konum arasından oyun hazırlanacak.`);

    $('timeLimitField')?.classList.toggle('hidden', selectedMode !== 'timed');
    const selectedAll = valueOf('roundCount') === 'all';
    if (selectedAll) textOf('sessionSummaryText', `${chosenCities.map((group) => group.name).join(', ')} · seçilen tüm noktalar kullanılacak.`);
  }

  function renderLocationList() {
    const list = $('locationList');
    if (!list || !config) return;
    const groups = getCityGroups();
    list.innerHTML = groups.map((group) => {
      const ids = group.spots.map((spot) => spot.id);
      const checkedCount = ids.filter((id) => selectedIds.has(id)).length;
      const checked = ids.length > 0 && checkedCount === ids.length;
      const partial = checkedCount > 0 && checkedCount < ids.length;
      return `<label class="city-option ${checked ? 'is-selected' : ''} ${partial ? 'is-partial' : ''}">
        <input type="checkbox" data-city-id="${escapeHtml(group.id)}" ${checked ? 'checked' : ''}>
        <span class="city-option-icon">${group.icon}</span>
        <span class="city-option-copy"><b>${escapeHtml(group.name)}</b><small>${ids.length} konum</small></span>
        <span class="city-option-check">✓</span>
      </label>`;
    }).join('');
    const allSelected = groups.length > 0 && groups.every((group) => group.spots.every((spot) => selectedIds.has(spot.id)));
    const selectAll = $('selectVisibleButton');
    if (selectAll) selectAll.textContent = allSelected ? 'Tüm seçimleri kaldır' : 'Tüm şehirleri seç';
    updateSelectionSummary();
  }

  function persistSelection() {
    localStorage.setItem(STORAGE.selectedIds, JSON.stringify([...selectedIds]));
  }

  function expandToCityPools(ids) {
    const requested = new Set(ids);
    const expanded = new Set();
    getCityGroups().forEach((group) => {
      if (group.spots.some((spot) => requested.has(spot.id))) group.spots.forEach((spot) => expanded.add(spot.id));
    });
    return expanded;
  }

  function setSelection(ids) {
    const validIds = new Set(config.spots.map((spot) => spot.id));
    selectedIds = expandToCityPools(ids.filter((id) => validIds.has(id)));
    persistSelection();
    renderLocationList();
  }

  function chooseRandom(count) {
    const picked = shuffle(config.spots).slice(0, Math.min(count, config.spots.length));
    setSelection(picked.map((spot) => spot.id));
    showToast(`${picked.length} rastgele koordinat seçildi.`);
  }


  function setGameMode(mode) {
    selectedMode = mode;
    document.querySelectorAll('.mode-card').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateSelectionSummary();
    persistGameSettings();
  }

  function persistGameSettings() {
    const settings = {
      mode: selectedMode,
      timeLimit: valueOf('timeLimit', '60'),
      roundCount: valueOf('roundCount', '5'),
      scoreProfile: valueOf('scoreProfile', 'standard'),
      roundOrder: valueOf('roundOrder', 'random')
    };
    try { localStorage.setItem(STORAGE.gameSettings, JSON.stringify(settings)); } catch (error) { console.debug('Game settings could not be saved:', error); }
  }

  function restoreGameSettings() {
    let settings;
    try { settings = JSON.parse(localStorage.getItem(STORAGE.gameSettings) || 'null'); } catch { settings = null; }
    if (!settings || typeof settings !== 'object') return;
    if (['classic', 'timed', 'hotcold', 'oneshot'].includes(settings.mode)) selectedMode = settings.mode;
    if (['15', '30', '45', '60', '90', '120'].includes(String(settings.timeLimit))) $('timeLimit').value = String(settings.timeLimit);
    if (['3', '5', '10', '15', '20', '30', 'all'].includes(String(settings.roundCount))) $('roundCount').value = String(settings.roundCount);
    if (['relaxed', 'standard', 'precise'].includes(settings.scoreProfile)) $('scoreProfile').value = settings.scoreProfile;
    if (['random', 'listed'].includes(settings.roundOrder)) $('roundOrder').value = settings.roundOrder;
    document.querySelectorAll('.mode-card').forEach((button) => {
      const active = button.dataset.mode === selectedMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function showPlaceholder(title, description, canSkip = false) {
    $('placeholderTitle').textContent = title;
    $('placeholderDescription').textContent = description;
    $('placeholderLoader').classList.add('hidden');
    $('skipRoundButton').classList.toggle('hidden', !canSkip);
    $('scenePlaceholder').classList.remove('hidden');
  }

  function resetPlaceholder() {
    $('placeholderTitle').textContent = 'GOOGLE STREET VIEW YÜKLENİYOR';
    $('placeholderDescription').textContent = '360° panorama hazırlanıyor…';
    $('placeholderLoader').classList.remove('hidden');
    $('skipRoundButton').classList.add('hidden');
    $('scenePlaceholder').classList.remove('hidden');
  }

  function clearViewer() {
    renderSequence += 1;
    stopRoundTimer();
    panoramaReady = false;
    $('googleViewer').classList.add('hidden');
    $('googleViewer').innerHTML = '';
    resetPlaceholder();
  }

  function getGoogleMapsLink(spot) {
    const params = new URLSearchParams({ api: '1', map_action: 'pano', viewpoint: `${spot.lat},${spot.lng}` });
    return `https://www.google.com/maps/@?${params.toString()}`;
  }

  function buildStreetViewEmbedUrl(spot) {
    const key = getGoogleKey();
    const radius = Math.max(0, Math.min(5000, Number(localStorage.getItem(STORAGE.radius) || valueOf('panoramaRadius', '100')) || 100));
    const headingSetting = valueOf('initialHeading', localStorage.getItem(STORAGE.heading) || 'random');
    const heading = headingSetting === 'north' ? 0 : Math.floor(Math.random() * 360);
    const params = new URLSearchParams({
      key,
      location: `${Number(spot.lat)},${Number(spot.lng)}`,
      heading: String(heading),
      pitch: '0',
      fov: '90',
      radius: String(radius),
      source: 'outdoor',
      language: 'tr',
      region: 'DE'
    });
    return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
  }

  function renderGooglePanorama(round, sequence) {
    const viewer = $('googleViewer');
    viewer.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.title = 'Google Street View 360 derece panorama';
    iframe.src = buildStreetViewEmbedUrl(round);
    iframe.allow = 'fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.loading = 'eager';
    iframe.setAttribute('frameborder', '0');
    iframe.addEventListener('load', () => {
      if (currentRound !== round || sequence !== renderSequence) return;
      // The Embed API is cross-origin: its internal panorama status cannot be inspected.
      // The player is marked ready after its document loads; users can manually skip if no imagery exists.
      panoramaReady = true;
      $('scenePlaceholder').classList.add('hidden');
      $('sceneCredit').textContent = 'Google Street View';
      $('sceneHint').textContent = '360° SÜRÜKLEYEREK BAK · GOOGLE KONTROLLERİ';
      $('openSourceButton').disabled = false;
      $('skipCurrentButton')?.classList.remove('hidden');
      $('guessStatus').textContent = 'Haritada tahmin edeceğin yeri seç';
      startRoundTimer();
    }, { once: true });
    iframe.addEventListener('error', () => {
      if (currentRound !== round || sequence !== renderSequence) return;
      showPlaceholder('STREET VIEW YÜKLENEMEDİ', 'Bağlantıyı ve Maps Embed API anahtarını kontrol et. İstersen bu turu geçebilirsin.', true);
    }, { once: true });
    viewer.appendChild(iframe);
    viewer.classList.remove('hidden');
  }

  function getMapTiles() {
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    };
  }

  function applyMapTiles() {
    if (!guessMap) return;
    if (guessTileLayer) guessMap.removeLayer(guessTileLayer);
    const tileConfig = getMapTiles();
    guessTileLayer = L.tileLayer(tileConfig.url, { maxZoom: 19, attribution: tileConfig.attribution });
    guessTileLayer.addTo(guessMap);
  }

  function setMapViewport() {
    if (!guessMap || !activeSpots.length) return;
    if (activeSpots.length === 1) {
      guessMap.setView([activeSpots[0].lat, activeSpots[0].lng], 14, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(activeSpots.map((spot) => [spot.lat, spot.lng]));
    guessMap.fitBounds(bounds.pad(0.08), { maxZoom: 14, animate: false });
  }

  function initGuessMap() {
    if (guessMap) {
      applyMapTiles();
      setMapViewport();
      setTimeout(() => guessMap.invalidateSize(), 120);
      return;
    }
    guessMap = L.map('guessMap', { zoomControl: false, attributionControl: true, scrollWheelZoom: true, doubleClickZoom: true });
    applyMapTiles();
    L.control.zoom({ position: 'topright' }).addTo(guessMap);
    guessMap.on('click', (event) => {
      if (!currentRound || !$('resultPanel').classList.contains('hidden') || !panoramaReady) return;
      selectedGuess = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (guessMarker) guessMap.removeLayer(guessMarker);
      guessMarker = L.circleMarker(event.latlng, { radius: 8, color: '#f6f8f2', weight: 2, fillColor: '#9bd56d', fillOpacity: 1 }).addTo(guessMap);
      $('guessStatus').textContent = 'Konum seçildi';
      $('guessButton').disabled = false;
      updateHotColdHint(selectedGuess);
      if (selectedMode === 'oneshot') {
        $('guessButton').disabled = true;
        setTimeout(() => lockGuess(false), 220);
      }
    });
    setMapViewport();
  }

  function clearRoundMarkers() {
    [guessMarker, targetMarker, resultLine].forEach((layer) => {
      if (layer && guessMap?.hasLayer(layer)) guessMap.removeLayer(layer);
    });
    guessMarker = null;
    targetMarker = null;
    resultLine = null;
  }

  function renderRound(round) {
    currentRound = round;
    selectedGuess = null;
    previousGuessDistance = null;
    panoramaReady = false;
    clearViewer();
    const sequence = renderSequence;
    clearRoundMarkers();
    $('sceneCredit').textContent = 'Google Street View';
    $('sceneHint').textContent = '360° ETRAFINA BAK';
    $('sceneCounter').textContent = `${String(currentRoundIndex + 1).padStart(2, '0')} — ${String(rounds.length).padStart(2, '0')}`;
    $('guessStatus').textContent = 'Panorama açılınca haritada yerini seç';
    $('guessButton').disabled = true;
    $('guessButton').classList.remove('hidden');
    $('resultPanel').classList.add('hidden');
    $('targetLegend').classList.add('hidden');
    $('helperPanel').classList.toggle('hidden', selectedMode !== 'hotcold');
    $('helperHint').textContent = 'Haritaya tıkla ve sıcaklık ipucunu al';
    $('helperPulse').textContent = '—';
    $('openSourceButton').disabled = true;
    $('skipCurrentButton')?.classList.add('hidden');
    $('timerPanel').classList.add('hidden');
    updateProgress();
    if (!getGoogleKey()) {
      showPlaceholder('HARİTA YAPILANDIRMASI EKSİK', 'Sunucunun .env dosyasındaki Google Maps Embed API ayarını kontrol et.');
      return;
    }
    renderGooglePanorama(round, sequence);
  }

  function updateProgress() {
    $('roundLabel').textContent = `TUR ${String(currentRoundIndex + 1).padStart(2, '0')} / ${String(rounds.length).padStart(2, '0')}`;
    $('roundProgressBar').style.width = `${((currentRoundIndex + 1) / rounds.length) * 100}%`;
    $('totalScore').textContent = totalScore.toLocaleString('de-DE');
    $('scoreMax').textContent = (rounds.length * 5000).toLocaleString('de-DE');
  }

  function startRoundTimer() {
    stopRoundTimer();
    if (selectedMode !== 'timed') {
      $('timerPanel').classList.add('hidden');
      return;
    }
    timeRemaining = Number(valueOf('timeLimit', '60'));
    textOf('timerValue', String(timeRemaining));
    $('timerPanel').classList.remove('hidden', 'timer-danger');
    timerInterval = setInterval(() => {
      timeRemaining -= 1;
      textOf('timerValue', String(Math.max(0, timeRemaining)));
      if (timeRemaining <= 10) $('timerPanel').classList.add('timer-danger');
      if (timeRemaining <= 0) {
        stopRoundTimer();
        showToast(selectedGuess ? 'Süre doldu. Son tahminin kilitlendi.' : 'Süre doldu. Bu tur için tahmin yok.');
        lockGuess(true);
      }
    }, 1000);
  }

  function stopRoundTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateHotColdHint(guess) {
    if (selectedMode !== 'hotcold' || !currentRound) return;
    const distance = distanceKm(guess, currentRound);
    let label;
    let pulse;
    if (distance <= 0.1) { label = 'ÇOK SICAK'; pulse = '🔥🔥🔥'; }
    else if (distance <= 0.25) { label = 'SICAK'; pulse = '🔥🔥'; }
    else if (distance <= 0.6) { label = 'ILIK'; pulse = '🔥'; }
    else if (distance <= 1.2) { label = 'SERİN'; pulse = '◌'; }
    else if (distance <= 3) { label = 'SOĞUK'; pulse = '❄'; }
    else { label = 'BUZ GİBİ'; pulse = '❄❄'; }
    let trend = '';
    if (previousGuessDistance !== null) {
      if (distance < previousGuessDistance - 0.01) trend = ' · DAHA SICAK';
      else if (distance > previousGuessDistance + 0.01) trend = ' · DAHA SOĞUK';
      else trend = ' · AYNI';
    }
    $('helperHint').textContent = `${label}${trend}`;
    $('helperPulse').textContent = pulse;
    previousGuessDistance = distance;
  }

  function scoreForDistance(distance) {
    if (!Number.isFinite(distance)) return 0;
    const divisor = ({ relaxed: 1.8, standard: 0.72, precise: 0.38 })[valueOf('scoreProfile', 'standard')] || 0.72;
    return Math.max(0, Math.min(5000, Math.round(5000 * Math.exp(-distance / divisor))));
  }

  function lockGuess(timedOut = false) {
    if (!currentRound || !panoramaReady || (!$('resultPanel').classList.contains('hidden'))) return;
    if (!selectedGuess && !timedOut) return;
    stopRoundTimer();
    const hasGuess = Boolean(selectedGuess);
    const actualDistance = hasGuess ? distanceKm(selectedGuess, currentRound) : null;
    const score = hasGuess ? scoreForDistance(actualDistance) : 0;
    totalScore += score;
    roundResults.push({ name: currentRound.name, city: currentRound.city || '', lat: currentRound.lat, lng: currentRound.lng, distanceKm: actualDistance, score, skipped: false });

    targetMarker = L.circleMarker([currentRound.lat, currentRound.lng], { radius: 8, color: '#152013', weight: 2, fillColor: '#d2f38c', fillOpacity: 1 }).addTo(guessMap);
    if (hasGuess) {
      resultLine = L.polyline([selectedGuess, [currentRound.lat, currentRound.lng]], { color: '#d8f0a2', weight: 2.5, opacity: .9, dashArray: '5 7' }).addTo(guessMap);
      $('resultDistance').textContent = actualDistance < 1 ? `${Math.round(actualDistance * 1000)} m uzaktasın` : `${actualDistance.toFixed(2).replace('.', ',')} km uzaktasın`;
      guessMap.fitBounds(L.latLngBounds([selectedGuess, [currentRound.lat, currentRound.lng]]).pad(.42), { maxZoom: 16, animate: true });
    } else {
      $('resultDistance').textContent = 'Süre doldu · tahmin yok';
      guessMap.setView([currentRound.lat, currentRound.lng], 14, { animate: true });
    }
    $('targetLegend').classList.remove('hidden');
    $('resultPoints').textContent = `+${score.toLocaleString('de-DE')}`;
    $('resultLocation').textContent = `${currentRound.city || ''} · ${currentRound.name}`.replace(/^ · /, '');
    $('resultArea').textContent = `${currentRound.lat.toFixed(6)}, ${currentRound.lng.toFixed(6)}`;
    $('resultPanel').classList.remove('hidden');
    $('guessButton').classList.add('hidden');
    $('totalScore').textContent = totalScore.toLocaleString('de-DE');
    $('guessStatus').textContent = timedOut && !hasGuess ? 'Süre doldu · tahmin yapılmadı' : 'Tahmin tamamlandı';
    $('nextButton').querySelector('span').textContent = currentRoundIndex === rounds.length - 1 ? 'SONUÇLARI GÖR' : 'SONRAKİ TUR';
  }

  function skipCurrentRound() {
    if (!currentRound || !$('resultPanel').classList.contains('hidden')) return;
    stopRoundTimer();
    roundResults.push({ name: currentRound.name, city: currentRound.city || '', lat: currentRound.lat, lng: currentRound.lng, distanceKm: null, score: 0, skipped: true });
    showToast(`${currentRound.city || ''} ${currentRound.name} geçildi.`.trim());
    nextRound();
  }

  function skipMissingRound() {
    if (!currentRound || panoramaReady) return;
    stopRoundTimer();
    roundResults.push({ name: currentRound.name, city: currentRound.city || '', lat: currentRound.lat, lng: currentRound.lng, distanceKm: null, score: 0, skipped: true });
    totalScore += 0;
    showToast(`${currentRound.name} atlandı · bu koordinatta panorama yok.`);
    nextRound();
  }

  function nextRound() {
    if (currentRoundIndex >= rounds.length - 1) {
      showSummary();
      return;
    }
    currentRoundIndex += 1;
    renderRound(rounds[currentRoundIndex]);
  }

  function showSummary() {
    stopRoundTimer();
    const maxScore = rounds.length * 5000;
    textOf('finalScore', totalScore.toLocaleString('de-DE'));
    textOf('finalScoreMax', maxScore.toLocaleString('de-DE'));
    const completed = roundResults.filter((result) => !result.skipped).length;
    textOf('finalMessage', completed === 0
      ? 'Street View panoraması bulunmayan koordinatlar atlandı. Arama yarıçapını artırıp tekrar deneyebilirsin.'
      : totalScore / maxScore >= .8
        ? 'Harika bir tur. Koordinatları çok iyi buldun.'
        : totalScore / maxScore >= .5
          ? 'Gayet iyi. Birkaç tur daha oyna, mesafe tahminin gelişsin.'
          : 'Bir sonraki turda haritaya biraz daha dikkatli bak.');
    $('summaryRounds').innerHTML = roundResults.map((result, index) => {
      const distanceLabel = result.skipped ? 'panorama yok · atlandı' : result.distanceKm === null ? 'süre doldu' : result.distanceKm < 1 ? `${Math.round(result.distanceKm * 1000)} m` : `${result.distanceKm.toFixed(2)} km`;
      return `<div class="summary-round"><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(result.city ? `${result.city} · ${result.name}` : result.name)} <small>— ${escapeHtml(distanceLabel)}</small></span><strong>${result.score.toLocaleString('de-DE')} P</strong></div>`;
    }).join('');
    clearViewer();
    setScreen('summaryScreen');
  }

  async function startGame() {
    const chosen = getSelectedSpots();
    if (!chosen.length) return showToast('Oyuna başlamak için en az bir koordinat seç.');
    const startButton = $('startButton');
    startButton.disabled = true;
    startButton.querySelector('span').textContent = 'OYUN HAZIRLANIYOR…';
    try {
      const requestedCount = selectedRoundCount();
      const ordered = valueOf('roundOrder', 'random') === 'random' ? shuffle(chosen) : [...chosen];
      rounds = ordered.slice(0, Math.max(1, requestedCount));
      if (rounds.length < requestedCount) showToast('Tur sayısı seçili koordinat sayısına göre ayarlandı.');
      activeSpots = chosen;
      currentRoundIndex = 0;
      totalScore = 0;
      roundResults = [];
      selectedGuess = null;
      $('gameModeLabel').textContent = selectedModeName().toLocaleUpperCase('tr');
      setScreen('gameScreen');
      initGuessMap();
      setTimeout(() => guessMap?.invalidateSize(), 180);
      renderRound(rounds[0]);
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Oyun başlatılamadı.');
    } finally {
      startButton.disabled = selectedIds.size === 0;
      startButton.querySelector('span').textContent = 'OYUNA BAŞLA';
    }
  }

  function quitGame() {
    if (!window.confirm('Oyundan çıkıp şehir seçimine dönmek istiyor musun?')) return;
    clearViewer();
    currentRound = null;
    setScreen('homeScreen');
  }

  function openModal(name) {
    $(`${name}Modal`)?.classList.remove('hidden');
    if (name === 'settings') {
      $('panoramaRadius').value = localStorage.getItem(STORAGE.radius) || '100';
      $('initialHeading').value = localStorage.getItem(STORAGE.heading) || 'random';
      $('settingsFeedback').textContent = '';
    }
  }

  function closeModal(name) {
    $(`${name}Modal`)?.classList.add('hidden');
  }

  function saveSettings() {
    localStorage.setItem(STORAGE.radius, valueOf('panoramaRadius', '100'));
    localStorage.setItem(STORAGE.heading, valueOf('initialHeading', 'random'));
    $('settingsFeedback').textContent = 'Ayarlar kaydedildi.';
    showToast('Ayarlar kaydedildi.');
    if (currentRound && !panoramaReady && getGoogleKey()) renderRound(currentRound);
  }


  function openCurrentSource() {
    if (!currentRound) return;
    window.open(getGoogleMapsLink(currentRound), '_blank', 'noopener,noreferrer');
  }

  function bindEvents() {
    $('startButton').addEventListener('click', startGame);
    $('guessButton').addEventListener('click', () => lockGuess(false));
    $('nextButton').addEventListener('click', nextRound);
    $('skipRoundButton').addEventListener('click', skipMissingRound);
    $('skipCurrentButton')?.addEventListener('click', skipCurrentRound);
    $('quitButton').addEventListener('click', quitGame);
    $('settingsButton').addEventListener('click', () => openModal('settings'));
    $('creditsButton').addEventListener('click', () => openModal('credits'));
    $('brandHome').addEventListener('click', (event) => { event.preventDefault(); if (!$('gameScreen').classList.contains('hidden')) quitGame(); else setScreen('homeScreen'); });

    $('locationList').addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[data-city-id]');
      if (!checkbox) return;
      const group = getCityGroups().find((item) => item.id === checkbox.dataset.cityId);
      if (!group) return;
      group.spots.forEach((spot) => checkbox.checked ? selectedIds.add(spot.id) : selectedIds.delete(spot.id));
      persistSelection();
      renderLocationList();
    });
    $('selectVisibleButton').addEventListener('click', () => {
      const groups = getCityGroups();
      const allAlreadySelected = groups.length > 0 && groups.every((group) => group.spots.every((spot) => selectedIds.has(spot.id)));
      const ids = allAlreadySelected ? [] : groups.flatMap((group) => group.spots.map((spot) => spot.id));
      setSelection(ids);
    });
    $('clearSelectionButton').addEventListener('click', () => setSelection([]));

    document.querySelectorAll('.mode-card').forEach((button) => button.addEventListener('click', () => setGameMode(button.dataset.mode)));
    ['timeLimit', 'roundCount', 'roundOrder', 'scoreProfile'].forEach((id) => $(id).addEventListener('change', () => { updateSelectionSummary(); persistGameSettings(); }));

    $('saveSettings').addEventListener('click', saveSettings);
    $('openSourceButton').addEventListener('click', openCurrentSource);
    $('playAgainButton').addEventListener('click', () => { setScreen('homeScreen'); startGame(); });
    $('homeButton').addEventListener('click', () => setScreen('homeScreen'));
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { closeModal('settings'); closeModal('credits'); }
    });
  }

  function loadPersistedState() {
    const valid = new Set(config.spots.map((spot) => spot.id));
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.selectedIds) || 'null');
      if (Array.isArray(saved)) selectedIds = new Set(saved.filter((id) => valid.has(id)));
      else selectedIds = new Set(config.spots.map((spot) => spot.id));
    } catch {
      selectedIds = new Set(config.spots.map((spot) => spot.id));
    }
    selectedIds = expandToCityPools([...selectedIds]);
    persistSelection();
    renderLocationList();
  }

  async function init() {
    if (initializationStarted) return;
    initializationStarted = true;
    try {
      const apiConfigResponse = await fetch('/api/config/weinguesser', { cache: 'no-store' });
      if (!apiConfigResponse.ok) {
        const apiError = await apiConfigResponse.json().catch(() => ({}));
        throw new Error(apiError.message || `Harita yapılandırması alınamadı (${apiConfigResponse.status}).`);
      }
      const apiConfig = await apiConfigResponse.json();
      googleMapsEmbedApiKey = apiConfig.googleMapsEmbedApiKey || '';
      if (!googleMapsEmbedApiKey) throw new Error('Google Maps Embed API anahtarı sunucuda tanımlı değil.');

      const response = await fetch('/games/weinguesser/data/locations.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Konum dosyası yüklenemedi (${response.status}).`);
      config = await response.json();
      if (!config || !Array.isArray(config.spots) || !config.spots.length) throw new Error('Konum dosyasında koordinat bulunamadı.');
      config.spots = config.spots.filter((spot) => Number.isFinite(Number(spot.lat)) && Number.isFinite(Number(spot.lng)) && spot.id).map((spot, index) => ({
        id: String(spot.id),
        name: String(spot.name || `Konum ${String(index + 1).padStart(2, '0')}`),
        city: String(spot.city || 'Diğer'),
        lat: Number(spot.lat),
        lng: Number(spot.lng)
      }));
      if (!config.spots.length) throw new Error('Geçerli koordinat bulunamadı.');
      bindEvents();
      loadPersistedState();
      restoreGameSettings();
      updateSelectionSummary();
    } catch (error) {
      console.error(error);
      document.body.innerHTML = `<main class="fatal-error"><h1>WeinGuesser başlatılamadı</h1><p>${escapeHtml(error.message)}</p></main>`;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
