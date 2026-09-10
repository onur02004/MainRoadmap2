// src/services/serviceService.js
import pool from '../config/db.js';

export const fetchVisibleServices = async (currentUser = null) => {
  // Tüm servisleri çek (is_active kontrolünü JS tarafında maintenance olarak işleyeceğiz)
  const query = `
    SELECT 
      id, service_key, tag, title, description, icon, route, 
      category, is_active, requires_auth, allowed_roles, allowed_user_ids, display_order
    FROM cluster_services
    ORDER BY display_order ASC;
  `;

  const { rows } = await pool.query(query);

  const isLoggedIn = Boolean(currentUser);
  
  // Rolü normalize et: 'normal' -> 'USER', yoksa mevcut rolü büyük harfe çevir
  let rawRole = (currentUser?.relation || currentUser?.role || (isLoggedIn ? 'USER' : 'GUEST')).trim().toUpperCase();
  if (rawRole === 'NORMAL' || rawRole === 'MEMBER') {
    rawRole = 'USER';
  }
  const userRole = rawRole;

  const userId = currentUser?.id ? String(currentUser.id) : null;
  const userName = currentUser?.user_name ? String(currentUser.user_name) : null;

  const coreServices = [];
  const privilegedServices = [];

  rows.forEach(item => {
    const allowedRoles = Array.isArray(item.allowed_roles) 
      ? item.allowed_roles.map(r => String(r).trim().toUpperCase()) 
      : [];

    const allowedUserIds = Array.isArray(item.allowed_user_ids)
      ? item.allowed_user_ids.map(u => String(u).trim())
      : [];

    // 1. Kullanıcı veya Rol yetkisi kontrolü
    const isExplicitUser = (userId && allowedUserIds.includes(userId)) || (userName && allowedUserIds.includes(userName));
    const isRoleMatched = allowedRoles.includes(userRole) || allowedRoles.includes('*');
    const isAdmin = (userRole === 'ADMIN');

    // Bu içeriği görme hakkı var mı?
    // Giriş yapmamışsa ve rolü GUEST listesinde varsa veya auth istiyorsa giriş yapıp görebileceği için listelenir
    const canView = isAdmin || isExplicitUser || isRoleMatched || (!isLoggedIn && (allowedRoles.includes('GUEST') || item.requires_auth));

    // Eğer rol listesinde yoksa ve kullanıcıya özel değilse HİÇ GÖNDERME (Gizle)
    if (!canView) {
      return;
    }

    // 2. Durum Belirleme:
    // - is_active = false -> Bakımda (Maintenance / Grayed Out)
    // - requires_auth = true ve Login değil -> Login İstiyor
    let status = 'active'; // 'active' | 'maintenance' | 'login_required'

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
      status: status, // active, maintenance, login_required
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
    userRole: isLoggedIn ? (currentUser.relation || userRole).toUpperCase() : 'GUEST',
    core: coreServices,
    privileged: privilegedServices
  };
};