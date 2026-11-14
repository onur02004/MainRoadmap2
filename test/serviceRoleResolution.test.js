import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisibleServices, resolveServiceRole } from '../src/services/serviceVisibility.js';

const services = [
  {
    service_key: 'songshare', tag: 'SOCIAL', title: 'SongShare', description: 'Music feed',
    icon: 'music', route: '/song-share', category: 'core', is_active: true,
    requires_auth: true, allowed_roles: ['USER', 'ADMIN'], allowed_user_ids: []
  },
  {
    service_key: 'games', tag: 'PLAY', title: 'Games', description: 'Game hub',
    icon: 'gamepad', route: '/games', category: 'core', is_active: true,
    requires_auth: true, allowed_roles: ['USER', 'ADMIN'], allowed_user_ids: []
  },
  {
    service_key: 'admin-tool', tag: 'ADMIN', title: 'Admin Tool', description: 'Scoped module',
    icon: 'shield', route: '/admin/tool', category: 'privileged', is_active: true,
    requires_auth: true, allowed_roles: ['ADMIN'], allowed_user_ids: []
  }
];

test('social relation does not override ADMIN authorization role', () => {
  assert.equal(resolveServiceRole({ role: 'admin', relation: 'friends' }), 'ADMIN');
  const result = buildVisibleServices(services, {
    id: 'admin-1', user_name: 'admin', role: 'admin', relation: 'friends'
  });
  assert.deepEqual(result.core.map(item => item.id), ['songshare', 'games']);
  assert.deepEqual(result.privileged.map(item => item.id), ['admin-tool']);
  assert.equal(result.userRole, 'ADMIN');
});

test('friends/family/acquaintance social relations remain ordinary USER authorization', () => {
  for (const relation of ['friends', 'family', 'acquaintance', 'normal']) {
    assert.equal(resolveServiceRole({ relation }), 'USER');
    const result = buildVisibleServices(services, { id: 'u-1', user_name: 'member', relation });
    assert.deepEqual(result.core.map(item => item.id), ['songshare', 'games']);
    assert.deepEqual(result.privileged, []);
  }
});

test('explicit role wins even when relation is present', () => {
  assert.equal(resolveServiceRole({ role: 'moderator', relation: 'family' }), 'MODERATOR');
});

test('guest sees login-required core services without receiving privileged modules', () => {
  const result = buildVisibleServices(services, null);
  assert.equal(result.userRole, 'GUEST');
  assert.deepEqual(result.core.map(item => item.status), ['login_required', 'login_required']);
  assert.deepEqual(result.privileged, []);
});
