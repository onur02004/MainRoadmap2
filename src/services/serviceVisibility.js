// src/services/serviceVisibility.js

/**
 * Resolve the authorization role independently from the social relation.
 * `users.relation` is an enum such as friends/family/acquaintance/normal;
 * it must never override `users.role` (USER/MODERATOR/ADMIN).
 */
export const resolveServiceRole = (currentUser = null) => {
  if (!currentUser) return 'GUEST';

  const rawRole = String(currentUser.role || 'USER').trim().toUpperCase();
  if (!rawRole || rawRole === 'NORMAL' || rawRole === 'MEMBER') return 'USER';
  return rawRole;
};

/** Pure service visibility mapper, exported for regression tests. */
export const buildVisibleServices = (rows = [], currentUser = null) => {
  const isLoggedIn = Boolean(currentUser);
  const userRole = resolveServiceRole(currentUser);
  const userId = currentUser?.id ? String(currentUser.id) : null;
  const userName = currentUser?.user_name ? String(currentUser.user_name) : null;

  const coreServices = [];
  const privilegedServices = [];

  rows.forEach(item => {
    const allowedRoles = Array.isArray(item.allowed_roles)
      ? item.allowed_roles.map(role => String(role).trim().toUpperCase())
      : [];

    const allowedUserIds = Array.isArray(item.allowed_user_ids)
      ? item.allowed_user_ids.map(id => String(id).trim())
      : [];

    const isExplicitUser = Boolean(
      (userId && allowedUserIds.includes(userId)) ||
      (userName && allowedUserIds.includes(userName))
    );
    const isRoleMatched = allowedRoles.includes(userRole) || allowedRoles.includes('*');
    const isAdmin = userRole === 'ADMIN';

    // Guests may see authenticated services as login-required cards.
    // Authenticated users must match a role or an explicit user assignment.
    const canView = isAdmin || isExplicitUser || isRoleMatched ||
      (!isLoggedIn && (allowedRoles.includes('GUEST') || item.requires_auth));

    if (!canView) return;

    let status = 'active';
    if (!item.is_active) {
      status = 'maintenance';
    } else if (item.requires_auth && !isLoggedIn) {
      status = 'login_required';
    }

    const serviceData = {
      id: item.service_key,
      tag: item.tag,
      title: item.title,
      desc: item.description,
      icon: item.icon,
      route: item.route,
      status,
      category: item.category
    };

    if (item.category === 'privileged') {
      if (isLoggedIn && (isAdmin || isExplicitUser || isRoleMatched)) {
        privilegedServices.push(serviceData);
      }
    } else {
      coreServices.push(serviceData);
    }
  });

  return {
    isLoggedIn,
    userRole,
    core: coreServices,
    privileged: privilegedServices
  };
};

