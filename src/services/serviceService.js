// src/services/serviceService.js
import pool from '../config/db.js';
import { buildVisibleServices } from './serviceVisibility.js';

export { buildVisibleServices, resolveServiceRole } from './serviceVisibility.js';

export const fetchVisibleServices = async (currentUser = null) => {
  const query = `
    SELECT
      id, service_key, tag, title, description, icon, route,
      category, is_active, requires_auth, allowed_roles, allowed_user_ids, display_order
    FROM cluster_services
    ORDER BY display_order ASC;
  `;

  const { rows } = await pool.query(query);
  return buildVisibleServices(rows, currentUser);
};
