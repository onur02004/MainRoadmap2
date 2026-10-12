const $ = (s) => document.querySelector(s);
const state = { page: 1, limit: 20, totalPages: 1, q: '', role: '', users: [] };
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
  state.users = data.users;
  state.totalPages = data.pagination.totalPages;
  $('#totalCount').textContent = data.pagination.total.toLocaleString();
  $('#adminCount').textContent = data.users.filter(u=>u.role==='admin').length;
  $('#verifiedCount').textContent = data.users.filter(u=>u.email_verified).length;
  $('#pageInfo').textContent = `${data.pagination.total.toLocaleString()} users · Page ${state.page} of ${state.totalPages}`;
  $('#prev').disabled = state.page <= 1;
  $('#next').disabled = state.page >= state.totalPages;
  $('#users').innerHTML = data.users.length ? data.users.map(u=>`
    <tr>
      <td>${userCell(u)}</td>
      <td>${esc(u.email || '—')}</td>
      <td>${rolePill(u.role)}</td>
      <td><span class="pill ${u.email_verified?'verified':'unverified'}">${u.email_verified?'Verified':'Unverified'}</span></td>
      <td>${esc(shortDate(u.join_date))}</td>
      <td><button class="edit-btn" data-edit="${esc(u.id)}">Edit user ↗</button></td>
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
  const u = state.users.find(x=>x.id===id);
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
$('#createBtn').addEventListener('click', openCreate);
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
    $('#saveBtn').textContent = id ? 'Save changes' : 'Create user';
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
loadUsers().catch(e=>notice(e.message,'error'));
