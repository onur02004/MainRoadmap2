const $ = (s) => document.querySelector(s);
const state = { page: 1, limit: 20, totalPages: 1, q: '', role: '', users: [] };
const serviceState = { services: [], search: '', status: '', loaded: false };
let searchTimer;

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function shortDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
}
function notice(message, type = '') {
  const el = $('#notice');
  if (!el) return;
  el.textContent = message;
  el.className = `notice ${type}`;
  el.hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => { el.hidden = true; }, 4500);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let body = {};
  try { body = await response.json(); } catch {}
  if (response.status === 401) {
    location.href = '/login';
    throw new Error('Oturum sona ermiş. Tekrar giriş yap.');
  }
  if (!response.ok || body.status === 'error') throw new Error(body.message || `İstek başarısız: ${response.status}`);
  return body.data || body;
}
function rolePill(role) {
  const r = ['user','moderator','admin'].includes(role) ? role : 'user';
  return `<span class="pill role-${r}">${r[0].toUpperCase()+r.slice(1)}</span>`;
}
function userCell(u) {
  const n = u.real_name || u.user_name || '?';
  const initials = n.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  return `<div class="user-cell"><span class="avatar">${esc(initials)}</span><div><strong>${esc(u.user_name)}</strong><small>${esc(n)}</small></div></div>`;
}
async function loadUsers() {
  const params = new URLSearchParams({page:state.page,limit:state.limit});
  if (state.q) params.set('q',state.q);
  if (state.role) params.set('role',state.role);
  const data = await api(`/api/admin/users?${params}`);
  state.users = data.users || [];
  state.totalPages = data.pagination?.totalPages || 1;
  $('#totalCount').textContent = (data.pagination?.total || 0).toLocaleString();
  $('#adminCount').textContent = state.users.filter(u=>u.role==='admin').length;
  $('#verifiedCount').textContent = state.users.filter(u=>u.email_verified).length;
  $('#pageInfo').textContent = `${(data.pagination?.total || 0).toLocaleString()} users · Page ${state.page} of ${state.totalPages}`;
  $('#prev').disabled = state.page <= 1;
  $('#next').disabled = state.page >= state.totalPages;
  $('#users').innerHTML = state.users.length ? state.users.map(u=>`
    <tr>
      <td>${userCell(u)}</td>
      <td>${esc(u.email || '—')}</td>
      <td>${rolePill(u.role)}</td>
      <td><span class="pill ${u.email_verified?'verified':'unverified'}">${u.email_verified?'Verified':'Unverified'}</span></td>
      <td>${esc(shortDate(u.join_date))}</td>
      <td><button class="edit-btn" data-edit="${esc(u.id)}" type="button">Edit user ↗</button></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty">No users found.</td></tr>';
}
function openCreate() {
  $('#userForm').reset();
  $('#userId').value = '';
  $('#modalEyebrow').textContent = 'NEW ACCOUNT';
  $('#modalTitle').textContent = 'Create user';
  $('#saveBtn').textContent = 'Create user';
  $('#password').required = true;
  $('#passwordHint').textContent = 'Required. At least 8 characters.';
  $('#userModal').showModal();
}
function openEdit(id) {
  const u = state.users.find(x=>String(x.id)===String(id));
  if (!u) return;
  $('#userForm').reset();
  $('#userId').value = u.id;
  $('#user_name').value = u.user_name || '';
  $('#email').value = u.email || '';
  $('#real_name').value = u.real_name || '';
  $('#tel_nr').value = u.tel_nr || '';
  $('#role').value = u.role || 'user';
  $('#relation').value = u.relation || 'normal';
  $('#email_verified').checked = Boolean(u.email_verified);
  $('#password').value = '';
  $('#password').required = false;
  $('#passwordHint').textContent = 'Leave blank to keep the current password.';
  $('#modalEyebrow').textContent = 'EDIT ACCOUNT';
  $('#modalTitle').textContent = `Edit ${u.user_name}`;
  $('#saveBtn').textContent = 'Save changes';
  $('#userModal').showModal();
}
function formPayload() {
  const payload = {
    user_name: $('#user_name').value.trim(),
    email: $('#email').value.trim(),
    real_name: $('#real_name').value.trim(),
    tel_nr: $('#tel_nr').value.trim(),
    role: $('#role').value,
    relation: $('#relation').value,
    email_verified: $('#email_verified').checked
  };
  if ($('#password').value) payload.password = $('#password').value;
  return payload;
}

/* ---------------- User management ---------------- */
$('#createBtn').addEventListener('click', () => {
  if (currentView === 'services') openCreateService();
  else openCreate();
});
$('#closeModal').addEventListener('click', () => $('#userModal').close());
$('#cancelBtn').addEventListener('click', () => $('#userModal').close());
$('#userForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#userId').value;
  const payload = formPayload();
  if (!id && !payload.password) { notice('Yeni kullanıcı için şifre zorunludur.', 'error'); return; }
  $('#saveBtn').disabled = true;
  $('#saveBtn').textContent = 'Saving…';
  try {
    if (id) {
      await api(`/api/admin/users/${encodeURIComponent(id)}`, {method:'PATCH',body:JSON.stringify(payload)});
      notice('User updated successfully.', 'success');
    } else {
      await api('/api/admin/users', {method:'POST',body:JSON.stringify(payload)});
      notice('User created successfully.', 'success');
    }
    $('#userModal').close();
    await loadUsers();
  } catch (error) {
    notice(error.message, 'error');
  } finally {
    $('#saveBtn').disabled = false;
    $('#saveBtn').textContent = $('#userId').value ? 'Save changes' : 'Create user';
  }
});
$('#users').addEventListener('click', event => {
  const btn = event.target.closest('[data-edit]');
  if (btn) openEdit(btn.dataset.edit);
});
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = $('#search').value.trim(); state.page = 1; loadUsers().catch(e=>notice(e.message,'error')); }, 250);
});
$('#roleFilter').addEventListener('change', () => {
  state.role = $('#roleFilter').value; state.page = 1;
  loadUsers().catch(e=>notice(e.message,'error'));
});
$('#prev').addEventListener('click', () => {
  if (state.page > 1) { state.page--; loadUsers().catch(e=>notice(e.message,'error')); }
});
$('#next').addEventListener('click', () => {
  if (state.page < state.totalPages) { state.page++; loadUsers().catch(e=>notice(e.message,'error')); }
});

/* ---------------- Service management ---------------- */
let currentView = 'users';

function setView(view) {
  currentView = view === 'services' ? 'services' : 'users';
  const showServices = currentView === 'services';
  $('#userView').hidden = showServices;
  $('#serviceView').hidden = !showServices;

  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === currentView);
  });

  // The IDs exist in this package's admin.html; guards prevent crashes if HTML is customized.
  const pageTitle = $('#pageTitle');
  const pageDescription = $('#pageDescription');
  if (pageTitle) pageTitle.textContent = showServices ? 'Service management' : 'User management';
  if (pageDescription) pageDescription.textContent = showServices
    ? 'Enable, disable, create and edit services.'
    : 'Create accounts and edit existing user details and permissions.';

  $('#createBtn').textContent = showServices ? '＋ Create service' : '＋ Create user';

  if (showServices && !serviceState.loaded) {
    loadAdminServices().catch(error => notice(error.message, 'error'));
  }
}
document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

async function loadAdminServices() {
  $('#services').innerHTML = '<tr><td colspan="6" class="empty">Loading services…</td></tr>';
  const data = await api('/api/admin/services');
  serviceState.services = Array.isArray(data.services) ? data.services : [];
  serviceState.loaded = true;
  renderAdminServices();
}

function renderAdminServices() {
  const services = serviceState.services;
  const filtered = services.filter(service => {
    const q = serviceState.search.toLowerCase();
    const haystack = [service.title, service.service_key, service.tag, service.route, service.description]
      .some(value => String(value || '').toLowerCase().includes(q));
    const statusMatch = !serviceState.status ||
      (serviceState.status === 'active' ? Boolean(service.is_active) : !service.is_active);
    return haystack && statusMatch;
  });

  $('#serviceNavCount').textContent = String(services.length);
  $('#serviceTotal').textContent = String(services.length);
  $('#serviceActive').textContent = String(services.filter(s => s.is_active).length);
  $('#serviceInactive').textContent = String(services.filter(s => !s.is_active).length);

  $('#services').innerHTML = filtered.length ? filtered.map(service => {
    const active = Boolean(service.is_active);
    const roles = Array.isArray(service.allowed_roles) ? service.allowed_roles.join(', ') : '';
    const users = Array.isArray(service.allowed_user_ids) ? service.allowed_user_ids.join(', ') : '';
    return `
      <tr>
        <td><div class="user-cell"><span class="avatar">${esc(service.icon || '▦')}</span><div><strong>${esc(service.title)}</strong><small>${esc(service.tag || '')}</small></div></div></td>
        <td><strong>${esc(service.service_key)}</strong><small class="route-cell">${esc(service.route || '')}</small></td>
        <td><span class="pill ${service.category === 'privileged' ? 'role-moderator' : 'role-user'}">${esc(service.category || 'core')}</span></td>
        <td><small>Login: ${service.requires_auth ? 'Yes' : 'No'}<br>Roles: ${esc(roles || 'None')}<br>Users: ${esc(users || 'None')}</small></td>
        <td><span class="pill ${active ? 'verified' : 'unverified'}">${active ? 'Active' : 'Maintenance'}</span></td>
        <td><div class="service-actions">
          <button class="edit-btn" type="button" data-toggle-service="${esc(service.id)}" data-active="${active ? 'true' : 'false'}">${active ? 'Turn off' : 'Activate'}</button>
          <button class="edit-btn" type="button" data-edit-service="${esc(service.id)}">Edit ↗</button>
        </div></td>
      </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">No services found.</td></tr>';
}

function splitList(value) {
  return value.split(/[,\n]/).map(item => item.trim()).filter(Boolean);
}
function openCreateService() {
  $('#serviceForm').reset();
  $('#serviceId').value = '';
  $('#service_active').checked = true;
  $('#service_auth').checked = false;
  $('#service_order').value = String(serviceState.services.length * 10);
  $('#serviceModalEyebrow').textContent = 'NEW SERVICE';
  $('#serviceModalTitle').textContent = 'Create service';
  $('#saveServiceBtn').textContent = 'Create service';
  $('#serviceModal').showModal();
}
function openEditService(id) {
  const service = serviceState.services.find(item => String(item.id) === String(id));
  if (!service) return;
  $('#serviceForm').reset();
  $('#serviceId').value = service.id;
  $('#service_key').value = service.service_key || '';
  $('#service_tag').value = service.tag || '';
  $('#service_title').value = service.title || '';
  $('#service_icon').value = service.icon || '';
  $('#service_description').value = service.description || '';
  $('#service_route').value = service.route || '';
  $('#service_category').value = service.category || 'core';
  $('#service_order').value = service.display_order ?? 0;
  $('#service_active').checked = Boolean(service.is_active);
  $('#service_auth').checked = Boolean(service.requires_auth);
  $('#service_roles').value = Array.isArray(service.allowed_roles) ? service.allowed_roles.join(', ') : '';
  $('#service_users').value = Array.isArray(service.allowed_user_ids) ? service.allowed_user_ids.join(', ') : '';
  $('#serviceModalEyebrow').textContent = 'EDIT SERVICE';
  $('#serviceModalTitle').textContent = `Edit ${service.title || service.service_key}`;
  $('#saveServiceBtn').textContent = 'Save changes';
  $('#serviceModal').showModal();
}
function servicePayload() {
  return {
    service_key: $('#service_key').value.trim(),
    tag: $('#service_tag').value.trim(),
    title: $('#service_title').value.trim(),
    description: $('#service_description').value.trim(),
    icon: $('#service_icon').value.trim(),
    route: $('#service_route').value.trim(),
    category: $('#service_category').value,
    is_active: $('#service_active').checked,
    requires_auth: $('#service_auth').checked,
    allowed_roles: splitList($('#service_roles').value),
    allowed_user_ids: splitList($('#service_users').value),
    display_order: Number($('#service_order').value)
  };
}

$('#serviceSearch').addEventListener('input', () => {
  serviceState.search = $('#serviceSearch').value.trim();
  renderAdminServices();
});
$('#serviceStatusFilter').addEventListener('change', () => {
  serviceState.status = $('#serviceStatusFilter').value;
  renderAdminServices();
});
$('#closeServiceModal').addEventListener('click', () => $('#serviceModal').close());
$('#cancelServiceBtn').addEventListener('click', () => $('#serviceModal').close());

$('#serviceForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('#serviceId').value;
  const button = $('#saveServiceBtn');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const payload = servicePayload();
    if (id) {
      await api(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      notice('Service updated successfully.', 'success');
    } else {
      await api('/api/admin/services', { method: 'POST', body: JSON.stringify(payload) });
      notice('Service created successfully.', 'success');
    }
    $('#serviceModal').close();
    serviceState.loaded = false;
    await loadAdminServices();
  } catch (error) {
    notice(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = $('#serviceId').value ? 'Save changes' : 'Create service';
  }
});

$('#services').addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit-service]');
  const toggleButton = event.target.closest('[data-toggle-service]');
  if (editButton) {
    openEditService(editButton.dataset.editService);
    return;
  }
  if (!toggleButton) return;

  const id = toggleButton.dataset.toggleService;
  const wasActive = toggleButton.dataset.active === 'true';
  toggleButton.disabled = true;
  try {
    await api(`/api/admin/services/${encodeURIComponent(id)}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !wasActive })
    });
    notice(wasActive ? 'Service disabled.' : 'Service activated.', 'success');
    serviceState.loaded = false;
    await loadAdminServices();
  } catch (error) {
    notice(error.message, 'error');
    toggleButton.disabled = false;
  }
});

loadUsers().catch(e => notice(e.message, 'error'));
