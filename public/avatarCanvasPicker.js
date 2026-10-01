// avatarCanvasPicker.js

class InfiniteAvatarCanvas {
  constructor() {
    this.modal = document.getElementById('canvasVaultModal');
    this.viewport = document.getElementById('canvasViewport');
    this.world = document.getElementById('canvasWorld');
    this.container = document.getElementById('cardsClusterContainer');
    this.svgContainer = document.getElementById('canvasConnectionsSvg');

    // Sol Sabit Geçiş Kartları ve Rozetler
    this.btnSideList = document.getElementById('btnSideList');
    this.btnSideMap = document.getElementById('btnSideMap');
    this.indicatorSideList = document.getElementById('indicatorSideList');
    this.indicatorSideMap = document.getElementById('indicatorSideMap');
    this.hudActiveModeBadge = document.getElementById('hudActiveModeBadge');

    this.listView = document.getElementById('vaultListView');
    this.radarStack = document.getElementById('hudRadarStack');
    this.currentView = 'list';

    // Telemetri
    this.coordX = document.getElementById('hudCoordX');
    this.coordY = document.getElementById('hudCoordY');
    this.visiblePersonsList = document.getElementById('visiblePersonsList');
    this.searchInp = document.getElementById('vaultSearchInp');
    this.inspectorImg = document.getElementById('inspectorImg');
    this.inspectorPlaceholder = document.getElementById('inspectorPlaceholder');
    this.inspectorOwner = document.getElementById('inspectorOwner');
    this.inspectorAsset = document.getElementById('inspectorAsset');
    this.applyBtn = document.getElementById('btnApplyCanvasAvatar');
    this.zoomValLabel = document.getElementById('minimapZoomVal');
    this.totalFoldersLabel = document.getElementById('listTotalFolders');

    // Minimap
    this.minimapContainer = document.getElementById('minimapContainer');
    this.minimapBox = document.getElementById('minimapBox');
    this.minimapNodesContainer = document.getElementById('minimapNodesContainer');
    this.mindmapTree = document.getElementById('mindmapNodesTree');

    // State & Transform
    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.targetScale = 1;
    this.isGlideAnimating = false;

    this.scale = 1;
    this.minScale = 0.25;
    this.maxScale = 2.2;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;

    this.worldBounds = { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
    this.rawAvatars = {};
    this.cardElements = [];
    this.clusterPositions = {};
    this.selectedUrl = null;
    this.lastCulledTime = 0;

    this.initEvents();
    this.startPhysicsLoop();
  }

  initEvents() {
    document.getElementById('btnOpenAvatarVault')?.addEventListener('click', () => this.open());
    document.getElementById('btnCloseVault')?.addEventListener('click', () => this.close());

    window.addEventListener('keydown', (e) => {
      if (!this.modal.classList.contains('active')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') {
        e.preventDefault();
        this.switchView(this.currentView === 'list' ? 'canvas' : 'list');
      }
    });

    this.btnSideList?.addEventListener('click', () => this.switchView('list'));
    this.btnSideMap?.addEventListener('click', () => this.switchView('canvas'));

    // Harita Kontrol Butonları
    document.getElementById('btnToolCenter')?.addEventListener('click', () => this.centerToUniverse());
    document.getElementById('btnToolRandom')?.addEventListener('click', () => this.spawnAtRandomLocation());
    document.getElementById('btnToolZoomReset')?.addEventListener('click', () => this.resetZoomToCurrentCenter());

    this.searchInp?.addEventListener('input', (e) => this.handleSearch(e.target.value));

    // Drag İşlemleri
    this.viewport.addEventListener('pointerdown', (e) => {
      if (
        e.target.closest('.avatar-node-card') ||
        e.target.closest('.hud-integrated-radar') ||
        e.target.closest('.vault-mode-selector-panel') ||
        e.target.closest('.hud-inspector-card')
      ) return;

      this.isDragging = true;
      this.isGlideAnimating = false;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
      this.viewport.setPointerCapture(e.pointerId);
    });

    this.viewport.addEventListener('pointermove', (e) => {
      if (this.isDragging && this.currentView === 'canvas') {
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
      }
    });

    const stopDragging = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try { this.viewport.releasePointerCapture(e.pointerId); } catch (err) { }
      }
    };

    this.viewport.addEventListener('pointerup', stopDragging);
    this.viewport.addEventListener('pointercancel', stopDragging);

    // Zoom (Tekerlek)
    this.viewport.addEventListener('wheel', (e) => {
      if (this.currentView !== 'canvas') return;
      e.preventDefault();
      this.isGlideAnimating = false;
      const zoomFactor = 1.14;
      const direction = e.deltaY < 0 ? 1 : -1;
      const oldScale = this.scale;

      let newScale = direction > 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
      newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
      if (newScale === oldScale) return;

      const mouseX = e.clientX;
      const mouseY = e.clientY;

      this.panX = mouseX - (mouseX - this.panX) * (newScale / oldScale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / oldScale);
      this.scale = newScale;
      this.targetScale = newScale;

      if (this.zoomValLabel) this.zoomValLabel.textContent = `${this.scale.toFixed(1)}x`;
    }, { passive: false });

    // Minimap Tıklamasıyla Odaklanma
    this.minimapContainer.addEventListener('click', (e) => {
      const rect = this.minimapContainer.getBoundingClientRect();
      const clickXRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const clickYRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const targetWorldX = clickXRatio * (this.worldBounds.maxX - this.worldBounds.minX);
      const targetWorldY = clickYRatio * (this.worldBounds.maxY - this.worldBounds.minY);

      const destX = -(targetWorldX * this.scale - window.innerWidth / 2);
      const destY = -(targetWorldY * this.scale - window.innerHeight / 2);

      this.smoothGlideTo(destX, destY);
    });

    this.applyBtn?.addEventListener('click', () => this.applyAvatar());
  }

  // TÜM AVATAR DÜNYASININ GERÇEK AĞIRLIK MERKEZİ
  calculateWorldCenter() {
    const keys = Object.keys(this.clusterPositions);
    if (keys.length === 0) return { x: 1000, y: 1000 };

    let sumX = 0, sumY = 0;
    keys.forEach(k => {
      sumX += this.clusterPositions[k].x;
      sumY += this.clusterPositions[k].y;
    });

    return {
      x: sumX / keys.length,
      y: sumY / keys.length
    };
  }

  centerToUniverse() {
    const center = this.calculateWorldCenter();
    const destX = -(center.x * this.scale - window.innerWidth / 2);
    const destY = -(center.y * this.scale - window.innerHeight / 2);
    this.smoothGlideTo(destX, destY);
  }

  resetZoomToCurrentCenter() {
    const currentWorldCenterX = (-this.panX + window.innerWidth / 2) / this.scale;
    const currentWorldCenterY = (-this.panY + window.innerHeight / 2) / this.scale;

    this.targetScale = 1.0;
    const destX = -(currentWorldCenterX * 1.0 - window.innerWidth / 2);
    const destY = -(currentWorldCenterY * 1.0 - window.innerHeight / 2);

    this.smoothGlideTo(destX, destY, 1.0);
    if (this.zoomValLabel) this.zoomValLabel.textContent = '1.0x';
  }

  switchView(viewMode) {
    this.currentView = viewMode;

    if (viewMode === 'list') {
      this.listView.style.display = 'flex';
      this.viewport.style.display = 'none';
      this.radarStack.style.display = 'none';

      this.btnSideList.classList.add('active');
      this.btnSideMap.classList.remove('active');

      if (this.hudActiveModeBadge) this.hudActiveModeBadge.textContent = 'VIEW: LIST';
      if (this.indicatorSideList) this.indicatorSideList.textContent = 'ACTIVE';
      if (this.indicatorSideMap) this.indicatorSideMap.textContent = 'EXPLORE →';
    } else {
      this.listView.style.display = 'none';
      this.viewport.style.display = 'block';
      this.radarStack.style.display = 'flex';

      this.btnSideMap.classList.add('active');
      this.btnSideList.classList.remove('active');

      if (this.hudActiveModeBadge) this.hudActiveModeBadge.textContent = 'VIEW: 2D MAP';
      if (this.indicatorSideList) this.indicatorSideList.textContent = 'SWITCH →';
      if (this.indicatorSideMap) this.indicatorSideMap.textContent = 'ACTIVE';

      // Siyah ekranı önleme: Haritaya geçildiğinde hemen rastgele birine odaklan
      if (this.panX === 0 && this.panY === 0) {
        this.spawnAtRandomLocation();
      }
    }
  }

  startPhysicsLoop() {
    const loop = (timestamp) => {
      if (this.currentView === 'canvas') {
        if (this.isGlideAnimating) {
          const lerpFactor = 0.1;
          this.panX += (this.targetPanX - this.panX) * lerpFactor;
          this.panY += (this.targetPanY - this.panY) * lerpFactor;
          this.scale += (this.targetScale - this.scale) * lerpFactor;

          if (
            Math.hypot(this.targetPanX - this.panX, this.targetPanY - this.panY) < 1 &&
            Math.abs(this.targetScale - this.scale) < 0.01
          ) {
            this.panX = this.targetPanX;
            this.panY = this.targetPanY;
            this.scale = this.targetScale;
            this.isGlideAnimating = false;
          }
        }

        this.updateTransform();

        // Performans için Culling ve Minimap render'ı saniyede 20 defa çalıştırılır
        if (timestamp - this.lastCulledTime > 45) {
          this.checkViewportCulling();
          this.updateMinimapViewport();
          this.lastCulledTime = timestamp;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  smoothGlideTo(x, y, targetScale = null) {
    this.targetPanX = x;
    this.targetPanY = y;
    if (targetScale !== null) this.targetScale = targetScale;
    this.isGlideAnimating = true;
  }

  async open() {
    this.modal.classList.add('active');
    if (Object.keys(this.rawAvatars).length === 0) {
      await this.loadAvatarData();
    }
    this.switchView('list');
  }

  close() {
    this.modal.classList.remove('active');
  }

  async loadAvatarData() {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/avatars', { headers });
      const json = await res.json();
      if (json.status === 'success') {
        this.rawAvatars = json.data.avatars;
        this.buildCanvasGalaxy();
        this.buildMinimapNodes();
        this.buildMindmapTree();

        const count = Object.keys(this.rawAvatars).length;
        if (this.totalFoldersLabel) this.totalFoldersLabel.textContent = `${count} folders loaded`;
      }
    } catch (e) {
      console.error('Failed to load avatars', e);
    }
  }

  spawnAtRandomLocation() {
    const keys = Object.keys(this.clusterPositions);
    if (keys.length === 0) return;
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    this.jumpToCluster(randomKey);
  }

  getConvexHull(points) {
    const cross = (a, b, o) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

    const lower = [];
    for (let p of points) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }

    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  getSmoothBlobPath(hullPoints, padding = 40) {
    if (hullPoints.length < 3) return '';
    let cx = 0, cy = 0;
    hullPoints.forEach(p => { cx += p.x; cy += p.y; });
    cx /= hullPoints.length;
    cy /= hullPoints.length;

    const expanded = hullPoints.map(p => {
      const angle = Math.atan2(p.y - cy, p.x - cx);
      return {
        x: p.x + Math.cos(angle) * padding,
        y: p.y + Math.sin(angle) * padding
      };
    });

    let d = `M ${(expanded[0].x + expanded[expanded.length - 1].x) / 2} ${(expanded[0].y + expanded[expanded.length - 1].y) / 2}`;
    for (let i = 0; i < expanded.length; i++) {
      const next = expanded[(i + 1) % expanded.length];
      const midX = (expanded[i].x + next.x) / 2;
      const midY = (expanded[i].y + next.y) / 2;
      d += ` Q ${expanded[i].x} ${expanded[i].y}, ${midX} ${midY}`;
    }
    return d + ' Z';
  }

  buildCanvasGalaxy() {
    this.container.innerHTML = '';
    this.svgContainer.innerHTML = '';
    this.cardElements = [];
    this.clusterPositions = {};

    const categories = Object.keys(this.rawAvatars);
    const cols = Math.ceil(Math.sqrt(categories.length));

    const cardWidth = 220;
    const cardHeight = 300;

    const calculateRadius = (count) => {
      if (count <= 1) return 190;
      if (count <= 4) return 250;
      if (count <= 8) return 320;
      return 350 + (Math.floor((count - 1) / 8) * 110);
    };

    const clusterRadii = categories.map(p => calculateRadius(this.rawAvatars[p]?.length || 1));
    const maxRadius = Math.max(...clusterRadii, 280);
    const clusterCellSize = (maxRadius * 2) + 320;

    let maxX = 0;
    let maxY = 0;

    categories.forEach((person, idx) => {
      const avatarList = this.rawAvatars[person] || [];
      const count = avatarList.length;
      const radius = calculateRadius(count);

      const cRow = Math.floor(idx / cols);
      const cCol = idx % cols;

      const centerX = cCol * clusterCellSize + (clusterCellSize / 2) + 200;
      const centerY = cRow * clusterCellSize + (clusterCellSize / 2) + 200;

      this.clusterPositions[person] = { x: centerX, y: centerY, radius };

      const coreNode = document.createElement('div');
      coreNode.className = 'cluster-core-node';
      coreNode.style.left = `${centerX}px`;
      coreNode.style.top = `${centerY}px`;
      coreNode.innerHTML = `<span class="core-title">${person}</span>`;
      this.container.appendChild(coreNode);

      const cornerPoints = [];
      const safePersonClass = person.replace(/\s+/g, '-');

      avatarList.forEach((url, pIdx) => {
        const card = document.createElement('div');
        card.className = 'avatar-node-card';

        const ring = Math.floor(pIdx / 8);
        const ringIdx = pIdx % 8;
        const currentRingRadius = radius + (ring * 150);
        const ringTotal = Math.min(count - (ring * 8), 8);
        const angle = (ringIdx * (2 * Math.PI / ringTotal)) + (ring * 0.45);

        const posX = centerX + Math.cos(angle) * currentRingRadius - (cardWidth / 2);
        const posY = centerY + Math.sin(angle) * currentRingRadius - (cardHeight / 2);

        maxX = Math.max(maxX, posX + cardWidth + 200);
        maxY = Math.max(maxY, posY + cardHeight + 200);

        card.style.left = `${posX}px`;
        card.style.top = `${posY}px`;
        card.style.width = `${cardWidth}px`;

        const filename = url.split('/').pop();

        card.innerHTML = `
          <div class="card-media-box">
            <img class="card-media-img" data-src="${encodeURI(url)}" alt="${person}" />
          </div>
          <div class="card-meta-line">
            <strong>${person}</strong>
            <span>${filename}</span>
          </div>
        `;

        card.addEventListener('click', () => this.selectAvatar(url, person, filename, card));
        this.container.appendChild(card);

        cornerPoints.push(
          { x: posX, y: posY },
          { x: posX + cardWidth, y: posY },
          { x: posX + cardWidth, y: posY + cardHeight },
          { x: posX, y: posY + cardHeight }
        );

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', centerX);
        line.setAttribute('y1', centerY);
        line.setAttribute('x2', posX + (cardWidth / 2));
        line.setAttribute('y2', posY + (cardHeight / 2));
        line.setAttribute('class', `cluster-branch-line line-${safePersonClass}`);
        this.svgContainer.appendChild(line);

        this.cardElements.push({
          el: card,
          img: card.querySelector('img'),
          x: posX,
          y: posY,
          width: cardWidth,
          height: cardHeight,
          person: person
        });
      });

      if (cornerPoints.length >= 4) {
        const hull = this.getConvexHull(cornerPoints);
        const pathData = this.getSmoothBlobPath(hull, 45);

        const boundaryPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        boundaryPath.setAttribute('d', pathData);
        boundaryPath.setAttribute('class', `cluster-boundary-path boundary-${safePersonClass}`);
        this.svgContainer.insertBefore(boundaryPath, this.svgContainer.firstChild);

        const minY = Math.min(...hull.map(p => p.y)) - 45;
        const textTag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textTag.setAttribute('x', centerX);
        textTag.setAttribute('y', minY);
        textTag.setAttribute('text-anchor', 'middle');
        textTag.setAttribute('class', 'cluster-boundary-label');
        textTag.textContent = `[ ${person.toUpperCase()} // ${count} ASSETS ]`;
        this.svgContainer.appendChild(textTag);
      }
    });

    this.worldBounds.maxX = Math.max(maxX + 300, 3000);
    this.worldBounds.maxY = Math.max(maxY + 300, 3000);

    this.svgContainer.setAttribute('viewBox', `0 0 ${this.worldBounds.maxX} ${this.worldBounds.maxY}`);
    this.svgContainer.style.width = `${this.worldBounds.maxX}px`;
    this.svgContainer.style.height = `${this.worldBounds.maxY}px`;
  }

  buildMinimapNodes() {
    this.minimapNodesContainer.innerHTML = '';

    Object.keys(this.clusterPositions).forEach(person => {
      const pos = this.clusterPositions[person];
      const tag = document.createElement('div');
      tag.className = 'minimap-node-tag';
      tag.textContent = person;

      const pctX = (pos.x / this.worldBounds.maxX) * 100;
      const pctY = (pos.y / this.worldBounds.maxY) * 100;

      tag.style.left = `${pctX}%`;
      tag.style.top = `${pctY}%`;

      tag.onclick = (e) => {
        e.stopPropagation();
        this.jumpToCluster(person);
      };

      this.minimapNodesContainer.appendChild(tag);
    });
  }

  updateMinimapViewport() {
    if (!this.minimapBox) return;
    const rect = this.minimapContainer.getBoundingClientRect();
    const mWidth = rect.width || 230;
    const mHeight = rect.height || 130;

    const vW = window.innerWidth;
    const vH = window.innerHeight;

    const boxW = (vW / (this.worldBounds.maxX * this.scale)) * mWidth;
    const boxH = (vH / (this.worldBounds.maxY * this.scale)) * mHeight;
    const boxX = (-this.panX / (this.worldBounds.maxX * this.scale)) * mWidth;
    const boxY = (-this.panY / (this.worldBounds.maxY * this.scale)) * mHeight;

    this.minimapBox.style.width = `${Math.min(boxW, mWidth)}px`;
    this.minimapBox.style.height = `${Math.min(boxH, mHeight)}px`;
    this.minimapBox.style.left = `${Math.max(0, Math.min(boxX, mWidth - boxW))}px`;
    this.minimapBox.style.top = `${Math.max(0, Math.min(boxY, mHeight - boxH))}px`;
  }

  buildMindmapTree() {
    this.mindmapTree.innerHTML = '';

    Object.keys(this.rawAvatars).forEach(person => {
      const branch = document.createElement('div');
      branch.className = 'mindmap-branch';
      branch.dataset.person = person.toLowerCase();

      const root = document.createElement('div');
      root.className = 'branch-root';
      root.innerHTML = `<span>📁 ${person}</span>`;

      const leaves = document.createElement('div');
      leaves.className = 'branch-leaves-scroll';

      this.rawAvatars[person].forEach(url => {
        const leaf = document.createElement('div');
        leaf.className = 'mindmap-leaf-card';
        const filename = url.split('/').pop();

        leaf.innerHTML = `
          <img src="${encodeURI(url)}" loading="lazy" alt="${person}" />
          <span class="leaf-caption">${filename}</span>
        `;

        leaf.onclick = () => {
          this.selectAvatar(url, person, filename);
          document.querySelectorAll('.mindmap-leaf-card').forEach(l => l.classList.remove('selected'));
          leaf.classList.add('selected');
        };

        leaves.appendChild(leaf);
      });

      branch.appendChild(root);
      branch.appendChild(leaves);
      this.mindmapTree.appendChild(branch);
    });
  }

  selectAvatar(url, person, filename, cardEl = null) {
    this.selectedUrl = url;

    this.inspectorImg.src = encodeURI(url);
    this.inspectorImg.style.display = 'block';
    this.inspectorPlaceholder.style.display = 'none';
    this.inspectorOwner.textContent = person.toUpperCase();
    this.inspectorAsset.textContent = filename;
    this.applyBtn.removeAttribute('disabled');

    document.querySelectorAll('.avatar-node-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.cluster-branch-line').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.cluster-boundary-path').forEach(p => p.classList.remove('active'));

    const safePersonClass = person.replace(/\s+/g, '-');
    document.querySelectorAll(`.line-${safePersonClass}`).forEach(l => l.classList.add('active'));
    document.querySelectorAll(`.boundary-${safePersonClass}`).forEach(p => p.classList.add('active'));

    if (cardEl) {
      cardEl.classList.add('selected');
    } else {
      const match = this.cardElements.find(c => c.img.dataset.src === encodeURI(url));
      if (match) match.el.classList.add('selected');
    }
  }

  checkViewportCulling() {
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const buffer = 200;
    const visibleSet = new Set();

    for (let i = 0; i < this.cardElements.length; i++) {
      const item = this.cardElements[i];
      const screenX = item.x * this.scale + this.panX;
      const screenY = item.y * this.scale + this.panY;
      const itemW = item.width * this.scale;
      const itemH = item.height * this.scale;

      const isVisible = (
        screenX + itemW >= -buffer &&
        screenX <= vW + buffer &&
        screenY + itemH >= -buffer &&
        screenY <= vH + buffer
      );

      if (isVisible) {
        visibleSet.add(item.person.toUpperCase());
        if (!item.img.src && item.img.dataset.src) {
          item.img.src = item.img.dataset.src;
          item.img.onload = () => item.img.classList.add('loaded');
        }
      }
    }

    if (this.visiblePersonsList) {
      const names = Array.from(visibleSet);
      this.visiblePersonsList.textContent = names.length > 0 ? names.join(', ') : 'NONE';
    }
  }

  updateTransform() {
    this.world.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.scale})`;
    if (this.coordX && this.coordY) {
      this.coordX.textContent = Math.round(-this.panX / this.scale);
      this.coordY.textContent = Math.round(-this.panY / this.scale);
    }
  }

  jumpToCluster(person) {
    const target = this.clusterPositions[person];
    if (!target) return;
    const destX = -(target.x * this.scale - window.innerWidth / 2);
    const destY = -(target.y * this.scale - window.innerHeight / 2);
    this.smoothGlideTo(destX, destY);
  }

  handleSearch(query) {
    const q = query.toLowerCase().trim();

    document.querySelectorAll('.mindmap-branch').forEach(b => {
      b.style.display = (!q || b.dataset.person.includes(q)) ? 'flex' : 'none';
    });

    this.cardElements.forEach(c => {
      c.el.style.display = (!q || c.person.toLowerCase().includes(q)) ? 'flex' : 'none';
    });

    if (q && this.currentView === 'canvas') {
      const match = Object.keys(this.clusterPositions).find(p => p.toLowerCase().includes(q));
      if (match) this.jumpToCluster(match);
    }
  }


  async applyAvatar() {
    if (!this.selectedUrl) return;

    const btn = this.applyBtn;
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');

      const res = await fetch('/api/users/profile/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          avatar_type: 'builtin',
          avatar_data: {},
          profile_pic_path: this.selectedUrl
        })
      });


      const result = await res.json();

      if (res.ok && result.status === 'success') {
        // Sayfadaki ana avatar görselini güncelle
        const userImg = document.getElementById('userAvatar');
        if (userImg) userImg.src = result.data.user.profile_pic_path;

        // Toast Bildirimi Göster
        this.showFeedbackToast(result.message, 'success');
        this.close();
      } else {
        throw new Error(result.message || 'Avatar güncellenemedi.');
      }
    } catch (err) {
      this.showFeedbackToast(err.message, 'error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  showFeedbackToast(msg, type = 'success') {
    let container = document.querySelector('.theme-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'theme-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `theme-toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '⚠'}</span>
    <span>${msg}</span>
  `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new InfiniteAvatarCanvas();
});