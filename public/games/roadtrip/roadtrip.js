(() => {
  const $ = s => document.querySelector(s);
  const socket = window.mainSocket;
  const state = { code: null, room: null, myId: null, roles: [], latest: null, pressed: new Set(), tracks: [], cars: [], isHost: false };
  const roleInfo = { gas: ['GAS', '↑', 'Accelerate'], brake: ['BRAKE / REVERSE', '↓', 'Brake, then reverse'], left: ['LEFT', '←', 'Turn left'], right: ['RIGHT', '→', 'Turn right'] };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600); }
  function send(event, payload = {}) { if (!socket?.connected) return toast('Connecting to the game server…'); socket.emit(event, payload); }
  function showRoom(room, isHost = false) {
    if (!room) return;
    state.room = room;
    state.isHost = isHost;
    state.code = room.code;
    const setText = (selector, value) => { const el = $(selector); if (el) el.textContent = value ?? ''; };
    const setHidden = (selector, value) => { const el = $(selector); if (el) el.hidden = !!value; };
    setHidden('#yourRoom', false);
    setText('#roomCode', room.code);
    const players = $('#players');
    if (players) players.innerHTML = (room.players || []).map((player, i) =>
      `<div class="player ${player.connected === false ? 'disconnected' : ''}"><span class="player-index">0${i + 1}</span><strong>${esc(player.name)}</strong><span class="connection-state">${player.connected === false ? 'RECONNECTING…' : 'ONLINE'}</span><span class="player-role">${player.roles?.length ? player.roles.map(r => roleInfo[r]?.[0] || r).join(' + ') : 'UNASSIGNED'}</span></div>`
    ).join('');
    setText('#hostHint', isHost ? 'You are the host. Configure the car and track, assign every control, then start.' : 'You are in the crew. The host controls the setup.');
    const start = $('#startBtn');
    if (start) start.disabled = !isHost || room.playerCount < 2 || room.status !== 'waiting';
    setHidden('#roomSetup', room.status !== 'waiting');
    const trackSelect = $('#roomTrackSelect');
    const carSelect = $('#roomCarSelect');
    const colorSelect = $('#carColorSelect');
    const timeSelect = $('#timeLimitSelect');
    const modeSelect = $('#gameModeSelect');
    if (trackSelect && room.trackId) trackSelect.value = room.trackId;
    if (carSelect && room.carId) carSelect.value = room.carId;
    if (colorSelect) colorSelect.value = room.carColor || (room.carId === 'opel-astra-j' ? '#111111' : '#ffffff');
    if (timeSelect) timeSelect.value = String(room.timeLimitSeconds || 180);
    if (modeSelect) modeSelect.value = room.mode || 'rally';
    [trackSelect, carSelect, colorSelect, timeSelect, modeSelect].filter(Boolean).forEach(el => { el.disabled = !isHost || room.status !== 'waiting'; });
    const preview = $('#roomTrackPreview');
    if (preview && room.track) drawTrackPreview(preview, room.track);
    setHidden('#roleAssign', room.status !== 'waiting');
    const roleHead = $('#roleAssign .role-assign-head span');
    if (roleHead) roleHead.textContent = isHost ? 'HOST ONLY · EVERY CONTROL MUST BE ASSIGNED' : 'LIVE CONTROL ASSIGNMENTS';
    if (isHost && room.status === 'waiting') renderRoleAssignments(room);
    else renderRoleAssignmentsReadOnly(room);
    const save = $('#saveRolesBtn');
    if (save) save.hidden = !isHost || room.status !== 'waiting';
    const setupInfo = $('#roomSetupInfo');
    if (setupInfo) setupInfo.textContent = `${room.mode === 'pursuit' ? 'PURSUIT · CATCH THE RUNNER' : 'RALLY · REACH THE FINISH'} · ${room.trackName || room.track?.name || 'Track'} · ${room.carName || 'Car'} · ${room.timeLimitSeconds || 180}s`;
  }
  function renderRoleAssignments(room) {
    const grid = $('#roleAssignmentGrid');
    grid.innerHTML = room.players.map(player => `<div class="role-player"><strong>${esc(player.name)}</strong>${Object.entries(roleInfo).map(([role, info]) => `<label class="role-check"><input type="checkbox" data-player="${esc(player.id)}" data-role="${role}" ${(player.roles || []).includes(role) ? 'checked' : ''}>${info[0]}</label>`).join('')}</div>`).join('');
  }
  function renderRoleAssignmentsReadOnly(room) {
    const grid = $('#roleAssignmentGrid');
    if (!grid) return;
    grid.innerHTML = (room.players || []).map(player =>
      `<div class="role-player"><strong>${esc(player.name)}</strong><div class="role-readonly">${Object.entries(roleInfo).map(([role, info]) =>
        `<span class="role-chip ${player.roles?.includes(role) ? 'assigned' : ''}">${info[0]}${player.roles?.includes(role) ? ' ✓' : ''}</span>`
      ).join('')}</div></div>`
    ).join('');
  }
  function renderRooms(rooms = []) {
    $('#roomCount').textContent = `${rooms.length} ROOMS`;
    $('#roomsList').innerHTML = rooms.length ? rooms.map(r => `<div class="room-row"><div><strong>${esc(r.code)}</strong><span>${r.playerCount}/${r.maxPlayers} PLAYERS · ${esc(r.trackName || 'Track')} · ${r.mode === 'pursuit' ? 'PURSUIT' : 'RALLY'} · ${r.status.toUpperCase()}</span></div><button class="secondary" data-join="${esc(r.code)}">JOIN ↗</button></div>`).join('') : '<div class="empty">No open rooms. Be the first to create one.</div>';
  }
  function enterRace(data) {
    state.code = data.room.code; state.room = data.room; state.myId = data.myId; state.latest = data.state;
    const me = data.room.players.find(p => p.id === data.myId); state.roles = me?.roles || [];
    $('#lobby').hidden = true; $('#game').hidden = false; $('#finish').hidden = true;
    draw();
    $('#crew').innerHTML = data.room.players.map((p, i) => `<div class="crew-member"><span>0${i + 1}</span><strong>${esc(p.name)}</strong><small>${(p.roles || []).map(r => roleInfo[r][0]).join(' + ')}</small></div>`).join('');
    $('#controls').innerHTML = state.roles.map(role => `<button class="control control-${role}" data-role="${role}"><span>${roleInfo[role][1]}</span><strong>${roleInfo[role][0]}</strong><small>${roleInfo[role][2]}</small></button>`).join('');
    $('#controlHint').textContent = `Keyboard: ${state.roles.map(r => ({gas:'W / ↑',brake:'S / ↓',left:'A / ←',right:'D / →'}[r])).join(' · ')}. You can also hold the buttons.`;
    $('#raceStatus').textContent = 'ALL CONTROLS ARE LIVE';
    draw();
  }
  function setControl(role, pressed) {
    if (!state.roles.includes(role)) return;
    if (pressed) state.pressed.add(role); else state.pressed.delete(role);
    send('roadtrip:input', { role, pressed });
    $(`[data-role="${role}"]`)?.classList.toggle('active', pressed);
  }
  function bindControls() {
    $('#controls').addEventListener('pointerdown', e => { const b = e.target.closest('[data-role]'); if (!b) return; e.preventDefault(); b.setPointerCapture?.(e.pointerId); setControl(b.dataset.role, true); });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => $('#controls').addEventListener(type, e => { const b = e.target.closest('[data-role]'); if (b) setControl(b.dataset.role, false); }));
    const keyMap = { w:'gas', ArrowUp:'gas', s:'brake', ArrowDown:'brake', a:'left', ArrowLeft:'left', d:'right', ArrowRight:'right' };
    window.addEventListener('keydown', e => { const role = keyMap[e.key]; if (role && state.roles.includes(role)) { e.preventDefault(); setControl(role, true); } });
    window.addEventListener('keyup', e => { const role = keyMap[e.key]; if (role) setControl(role, false); });
    window.addEventListener('blur', () => [...state.pressed].forEach(role => setControl(role, false)));
  }
  function drawTrack(ctx, track) {
    const W=track?.width||1200,H=track?.height||720;
    ctx.fillStyle='#252d2b';ctx.fillRect(0,0,W,H);
    // City ground: asphalt-stained concrete and subtle block grid.
    ctx.fillStyle='#303a36';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(196,190,164,.035)';ctx.lineWidth=2;
    for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // District zones sit beneath the street network.
    for(const z of (track?.districts||[])){
      ctx.fillStyle=z.color||'#39443d';ctx.fillRect(z.x,z.y,z.w,z.h);
      ctx.fillStyle='rgba(8,13,12,.13)';ctx.fillRect(z.x,z.y,z.w,z.h);
      if(z.name){ctx.save();ctx.translate(z.x+z.w/2,z.y+z.h/2);ctx.fillStyle=z.labelColor||'rgba(220,222,202,.30)';ctx.font='700 42px monospace';ctx.textAlign='center';ctx.fillText(z.name.toUpperCase(),0,0);ctx.restore();}
    }
    // Waterfront geometry.
    if(track?.theme==='harbour'){
      for(const water of (track.waterAreas||[])){ctx.fillStyle='#183b48';ctx.fillRect(water.x,water.y,water.w,water.h);ctx.strokeStyle='rgba(139,199,207,.17)';ctx.lineWidth=3;for(let y=water.y+24;y<water.y+water.h;y+=42){ctx.beginPath();ctx.moveTo(water.x+12,y);ctx.lineTo(water.x+water.w-12,y+8*Math.sin(y));ctx.stroke();}}
      for(const pier of (track.piers||[])){ctx.fillStyle='#766f5c';ctx.fillRect(pier.x,pier.y,pier.w,pier.h);ctx.strokeStyle='#b4a98b';ctx.lineWidth=7;ctx.strokeRect(pier.x+8,pier.y+8,pier.w-16,pier.h-16);}
    }
    // Parks and green spaces.
    for(const park of (track.parks||[])){
      ctx.fillStyle='#304b3c';ctx.fillRect(park.x,park.y,park.w,park.h);
      ctx.fillStyle='rgba(149,174,124,.14)';ctx.fillRect(park.x+12,park.y+12,park.w-24,park.h-24);
      ctx.strokeStyle='rgba(197,190,145,.55)';ctx.lineWidth=8;ctx.strokeRect(park.x+18,park.y+18,park.w-36,park.h-36);
      for(const tree of (park.trees||[])){ctx.fillStyle='rgba(8,17,13,.35)';ctx.beginPath();ctx.arc(tree.x+7,tree.y+9,tree.r+4,0,Math.PI*2);ctx.fill();ctx.fillStyle=tree.color||'#587b57';ctx.beginPath();ctx.arc(tree.x,tree.y,tree.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(195,205,151,.16)';ctx.beginPath();ctx.arc(tree.x-4,tree.y-5,tree.r*.48,0,Math.PI*2);ctx.fill();}
    }
    // Sidewalk blocks, parcels, architecture. Keep every block visually distinct.
    for(let i=0;i<(track?.blocks||[]).length;i++){
      const b=track.blocks[i],{x,y,w,h}=b;
      ctx.fillStyle='rgba(0,0,0,.30)';ctx.fillRect(x+18,y+22,w,h);
      ctx.fillStyle=b.base||'#8b887a';ctx.fillRect(x-8,y-8,w+16,h+16);
      ctx.fillStyle=b.color||['#59635b','#6b675c','#555f60','#746b5c','#4e5a54'][i%5];ctx.fillRect(x,y,w,h);
      ctx.strokeStyle='rgba(229,216,183,.35)';ctx.lineWidth=5;ctx.strokeRect(x+3,y+3,w-6,h-6);
      // Rooftop geometry varies by building type.
      if(b.type==='warehouse'||b.type==='industrial'){
        ctx.fillStyle='rgba(13,20,18,.24)';ctx.fillRect(x+18,y+18,w-36,h-36);
        ctx.strokeStyle='rgba(225,218,191,.2)';ctx.lineWidth=5;
        for(let xx=x+30;xx<x+w-20;xx+=38){ctx.beginPath();ctx.moveTo(xx,y+18);ctx.lineTo(xx,y+h-18);ctx.stroke();}
        ctx.fillStyle='rgba(219,177,111,.22)';ctx.fillRect(x+w*.15,y+h*.2,w*.22,h*.18);
      } else {
        const pad=18,cols=Math.max(2,Math.floor(w/42)),rows=Math.max(2,Math.floor(h/38));
        for(let cx=0;cx<cols;cx++)for(let cy=0;cy<rows;cy++){
          const wx=x+pad+cx*((w-pad*2)/cols),wy=y+pad+cy*((h-pad*2)/rows);
          ctx.fillStyle=(cx*3+cy+i)%5===0?'rgba(255,197,116,.68)':'rgba(18,29,28,.52)';
          ctx.fillRect(wx,wy,Math.min(15,w/cols-5),Math.min(10,h/rows-5));
        }
        ctx.fillStyle='rgba(12,19,18,.24)';ctx.fillRect(x+w*.32,y+h*.32,w*.36,h*.36);
        // rooftop stairwell / HVAC
        ctx.fillStyle='rgba(205,197,169,.20)';ctx.fillRect(x+w*.12,y+h*.12,Math.min(34,w*.2),Math.min(26,h*.2));
      }
      if(b.label){ctx.fillStyle='rgba(245,228,187,.58)';ctx.font='600 18px monospace';ctx.fillText(b.label,x+14,y+h-14);}
    }
    const roads=[...(track?.streetPaths||[]),...(track?.alleys||[])].filter(Boolean).map(d=>new Path2D(d));
    const main=track?.path?new Path2D(track.path):null;
    const roadLayer=(p,w,primary=false)=>{
      ctx.lineCap='square';ctx.lineJoin='round';
      ctx.strokeStyle='#85847a';ctx.lineWidth=w+34;ctx.stroke(p);
      ctx.strokeStyle='#b5ad98';ctx.lineWidth=w+16;ctx.stroke(p);
      ctx.strokeStyle='#343c3a';ctx.lineWidth=w;ctx.stroke(p);
      ctx.strokeStyle='rgba(232,224,198,.62)';ctx.lineWidth=3;ctx.setLineDash(primary?[22,28]:[12,24]);ctx.stroke(p);ctx.setLineDash([]);
      if(primary){ctx.strokeStyle='rgba(232,177,91,.8)';ctx.lineWidth=4;ctx.setLineDash([26,28]);ctx.stroke(p);ctx.setLineDash([]);}
    };
    roads.forEach((p,i)=>roadLayer(p,track?.roadWidths?.[i]||132,false));
    if(main)roadLayer(main,track?.mainRoadWidth||174,true);
    // Trees along boulevards, lamp posts, traffic signals.
    for(const t of (track?.trees||[])){ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.arc(t.x+7,t.y+9,t.r+3,0,Math.PI*2);ctx.fill();ctx.fillStyle=t.color||'#4f7654';ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(194,209,151,.2)';ctx.beginPath();ctx.arc(t.x-4,t.y-4,t.r*.45,0,Math.PI*2);ctx.fill();}
    for(const lamp of (track?.lamps||[])){ctx.fillStyle='rgba(255,208,128,.14)';ctx.beginPath();ctx.arc(lamp.x,lamp.y,34,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e4c98b';ctx.beginPath();ctx.arc(lamp.x,lamp.y,5,0,Math.PI*2);ctx.fill();}
    for(const c of (track?.containers||[])){ctx.fillStyle=c.color||'#a65f48';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=4;ctx.strokeRect(c.x+5,c.y+5,c.w-10,c.h-10);for(let xx=c.x+15;xx<c.x+c.w-8;xx+=24){ctx.beginPath();ctx.moveTo(xx,c.y+8);ctx.lineTo(xx,c.y+c.h-8);ctx.stroke();}}
    for(const lot of (track?.parkingLots||[])){ctx.fillStyle='#242d2a';ctx.fillRect(lot.x,lot.y,lot.w,lot.h);ctx.strokeStyle='rgba(225,225,205,.45)';ctx.lineWidth=3;for(let x=lot.x+18;x<lot.x+lot.w-10;x+=34){ctx.beginPath();ctx.moveTo(x,lot.y+8);ctx.lineTo(x,lot.y+lot.h-8);ctx.stroke();}}
    const start=track?.start||{x:230,y:360,angle:0},finish=track?.checkpoints?.[track.checkpoints.length-1]||{x:900,y:145};
    ctx.save();ctx.translate(start.x,start.y);ctx.rotate((start.angle||0)+Math.PI/2);ctx.strokeStyle='#f0ead5';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(0,-65);ctx.lineTo(0,65);ctx.stroke();ctx.restore();
    ctx.fillStyle='#a4e5b8';ctx.font='700 24px monospace';ctx.fillText('START',start.x-48,start.y-76);
    ctx.fillStyle='#f0c879';ctx.fillText('FINISH',finish.x-48,finish.y-48);
  }
  function drawTrackPreview(canvas, track) {
    const ctx=canvas.getContext('2d'), w=track.width||1200, h=track.height||720;
    const scale=Math.min(canvas.width/w,canvas.height/h), ox=(canvas.width-w*scale)/2, oy=(canvas.height-h*scale)/2;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);drawTrack(ctx,track);ctx.restore();
  }
  function drawCar(ctx, x, y, angle, carId, color) {
    const isOpel = carId === 'opel-astra-j';
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.shadowColor = 'rgba(116,238,166,.35)'; ctx.shadowBlur = 24;
    ctx.fillStyle = color || (isOpel ? '#111111' : '#ffffff');
    ctx.beginPath();
    if (isOpel) ctx.roundRect(-31,-15,62,30,7); else ctx.roundRect(-32,-14,64,28,10);
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#182a30'; ctx.beginPath(); ctx.roundRect(-9,-11,24,22,5); ctx.fill();
    ctx.fillStyle = '#f7fff8'; ctx.fillRect(23,-9,5,5); ctx.fillRect(23,4,5,5);
    ctx.fillStyle = '#18201b'; ctx.fillRect(-20,-18,13,5); ctx.fillRect(12,-18,13,5); ctx.fillRect(-20,13,13,5); ctx.fillRect(12,13,13,5);
    if (isOpel) { ctx.strokeStyle='#64727a'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(27,0); ctx.lineTo(31,0); ctx.stroke(); }
    else { ctx.fillStyle='#dceaf5'; ctx.fillRect(29,-5,3,10); }
    ctx.restore();
  }
  const WORLD_SCALE = 3.2;
  function draw() {
    const canvas=$('#track'),ctx=canvas.getContext('2d');
    const s=state.latest||{x:230*WORLD_SCALE,y:360*WORLD_SCALE,angle:0,speed:0,progress:0,checkpoint:0};
    const track=s.track||state.room?.track, carX=s.x, carY=s.y;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.translate(canvas.width/2-carX,canvas.height/2-carY);ctx.scale(WORLD_SCALE,WORLD_SCALE);
    drawTrack(ctx,track);
    const marks=s.skidMarks||[];
    ctx.lineCap='round';ctx.lineWidth=5/WORLD_SCALE;ctx.strokeStyle='rgba(12,13,12,.82)';
    for(const mark of marks){ctx.beginPath();ctx.moveTo(mark.x1/WORLD_SCALE,mark.y1/WORLD_SCALE);ctx.lineTo(mark.x2/WORLD_SCALE,mark.y2/WORLD_SCALE);ctx.stroke();}
    const targets=track?.checkpoints||[];
    let target=state.room?.mode==='pursuit'&&s.runner?{x:s.runner.x/WORLD_SCALE,y:s.runner.y/WORLD_SCALE}:targets[Math.min(s.checkpoint||0,targets.length-1)];
    if(state.room?.mode==='escape'&&s.police){const dx=carX-s.police.x,dy=carY-s.police.y,len=Math.max(1,Math.hypot(dx,dy));target={x:(carX+dx/len*900)/WORLD_SCALE,y:(carY+dy/len*900)/WORLD_SCALE};}
    if(target){ctx.strokeStyle='rgba(242,199,120,.9)';ctx.lineWidth=3/WORLD_SCALE;ctx.beginPath();ctx.arc(target.x,target.y,30,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    drawCar(ctx,canvas.width/2,canvas.height/2,s.angle,state.room?.carId||'bmw-318i-2018',state.room?.carColor);
    if (s.runner) { const rx=canvas.width/2+(s.runner.x-carX), ry=canvas.height/2+(s.runner.y-carY); drawCar(ctx,rx,ry,s.runner.angle,'runner-car',state.room?.mode==='escape'?'#315fca':'#e34e42'); }
    if (s.police) { const px=canvas.width/2+(s.police.x-carX), py=canvas.height/2+(s.police.y-carY); drawCar(ctx,px,py,s.police.angle,'police-car','#e7e9ef'); ctx.fillStyle='#e34e42';ctx.fillRect(px-7,py-22,14,5);ctx.fillStyle='#4d83ee';ctx.fillRect(px+7,py-22,14,5); }
    if(target){const dx=target.x*WORLD_SCALE-carX,dy=target.y*WORLD_SCALE-carY,a=Math.atan2(dy,dx),edge=Math.min(canvas.width,canvas.height)*.39,ax=canvas.width/2+Math.cos(a)*edge,ay=canvas.height/2+Math.sin(a)*edge;const arrow=$('#waypointArrow');arrow.style.left=`${ax/canvas.width*100}%`;arrow.style.top=`${ay/canvas.height*100}%`;arrow.style.transform=`translate(-50%,-50%) rotate(${a+Math.PI/4}rad)`;arrow.hidden=Math.hypot(dx,dy)<130;}
    $('#speed').textContent=String(Math.round(Math.abs(s.speed||0)*22)).padStart(2,'0');
    $('#raceStatus').textContent=state.room?.mode==='pursuit'?'PURSUIT · CATCH THE RED CAR':state.room?.mode==='escape'?'ESCAPE · LOSE THE POLICE':(s.speed<-.1?'REVERSE GEAR':s.speed>.1?'FORWARD':'STANDING BY');
    $('#progressLabel').textContent=`${s.progress||0}% COMPLETE`;$('#progressBar').style.width=`${s.progress||0}%`;
    const rem=Math.max(0,Math.ceil(s.timeRemaining??state.room?.timeLimitSeconds??90));$('#timerLabel').textContent=`${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')} LEFT`;$('#timerLabel').classList.toggle('urgent',rem<=15);
    if(s.finished||s.timeExpired){$('#finish').hidden=false;$('#finish').querySelector('strong').textContent=s.timeExpired?(state.room?.mode==='escape'?'YOU GOT AWAY!':'TIME IS UP.'):(state.room?.mode==='pursuit'?'RUNNER CAUGHT!':state.room?.mode==='escape'?(s.caught?'POLICE CAUGHT YOU':'YOU GOT AWAY!'):'YOU MADE IT.');$('#finish').querySelector('span').textContent=s.timeExpired?(state.room?.mode==='escape'?'POLICE LOST YOU':'OUT OF TIME'):(state.room?.mode==='pursuit'?'SUSPECT APPREHENDED':state.room?.mode==='escape'?(s.caught?'POLICE INTERCEPTED':'ESCAPED THE CITY'):'DESTINATION REACHED');$('#raceStatus').textContent=s.timeExpired?'TIME EXPIRED':(state.room?.mode==='pursuit'?'TARGET CAPTURED':'DESTINATION REACHED');}
  }
  $('#createBtn').addEventListener('click', () => send('roadtrip:room:create'));
  $('#roomTrackSelect').addEventListener('change', () => { send('roadtrip:room:track', { trackId: $('#roomTrackSelect').value }); const t=state.tracks.find(x=>x.id===$('#roomTrackSelect').value); if(t) drawTrackPreview($('#roomTrackPreview'),t); });
  $('#roomCarSelect').addEventListener('change', () => { const car = state.cars.find(c => c.id === $('#roomCarSelect').value); $('#carColorSelect').value = car?.defaultColor || (car?.id === 'opel-astra-j' ? '#111111' : '#ffffff'); send('roadtrip:room:car', { carId: $('#roomCarSelect').value, color: $('#carColorSelect').value }); });
  $('#carColorSelect').addEventListener('change', () => send('roadtrip:room:car', { carId: $('#roomCarSelect').value, color: $('#carColorSelect').value }));
  $('#timeLimitSelect').addEventListener('change', () => send('roadtrip:room:timer', { seconds: Number($('#timeLimitSelect').value) }));
  $('#gameModeSelect').addEventListener('change', () => send('roadtrip:room:mode', { mode: $('#gameModeSelect').value }));
  $('#joinBtn').addEventListener('click', () => send('roadtrip:room:join', { code: $('#codeInput').value }));
  $('#roomsList').addEventListener('click', e => { const b = e.target.closest('[data-join]'); if (b) send('roadtrip:room:join', { code: b.dataset.join }); });
  $('#startBtn').addEventListener('click', () => send('roadtrip:room:start'));
  $('#saveRolesBtn').addEventListener('click', () => { const assignments = state.room.players.map(p => ({ playerId: p.id, roles: [...document.querySelectorAll(`[data-player="${CSS.escape(p.id)}"]:checked`)].map(el => el.dataset.role) })); send('roadtrip:roles:update', { assignments }); toast('Control assignment saved.'); });
  $('#copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.code); toast('Room code copied.'); } catch { toast(`Room code: ${ state.code }`); } });
  $('#leaveBtn').addEventListener('click', () => { send('roadtrip:room:leave'); location.reload(); });
  $('#backBtn').addEventListener('click', () => location.reload());
  bindControls();
  async function loadTracks() {
    try {
      const res=await fetch('/api/games/roadtrip',{credentials:'same-origin'}),body=await res.json();
      if(!res.ok)throw new Error(body.message||'Could not load game catalogue');
      const game=body.data?.game||body.game;state.tracks=game?.config?.tracks||[];state.cars=game?.config?.cars||[];
      $('#roomTrackSelect').innerHTML=state.tracks.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${esc(t.difficulty)}</option>`).join('');
      $('#roomCarSelect').innerHTML=state.cars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      if (state.room) showRoom(state.room, state.isHost);
    } catch(e){toast(e.message);}
  }
  loadTracks();
  if (!socket) { $('#status').textContent = 'Socket.IO is unavailable. Please sign in and reload.'; }
  else {
    socket.on('connect', () => { $('#status').textContent = 'Connected. Create a room or join a friend.'; send('roadtrip:room:resume'); });
    socket.on('roadtrip:rooms:list', renderRooms);
    socket.on('roadtrip:room:created', d => { state.code = d.code; toast(`Room ${d.code} created.`); });
    socket.on('roadtrip:room:joined', d => { state.code = d.code; toast(`Joined room ${d.code}.`); });
    socket.on('roadtrip:room:update', d => { state.room = d.room; if (d.state) state.latest = d.state; showRoom(d.room, d.isHost); });
    socket.on('roadtrip:match:started', enterRace);
    socket.on('roadtrip:state', s => { state.latest = s; draw(); });
    socket.on('roadtrip:finished', s => { state.latest = s; draw(); });
    socket.on('roadtrip:error', d => toast(d.message || 'Something went wrong.'));
    socket.on('roadtrip:player:left', () => toast('A player left. The room was closed.'));
    const inviteCode = new URLSearchParams(location.search).get('room');
    if (inviteCode) { $('#codeInput').value = inviteCode.toUpperCase(); socket.once('connect', () => send('roadtrip:room:join', { code: inviteCode })); if (socket.connected) send('roadtrip:room:join', { code: inviteCode }); }
  }
})();
