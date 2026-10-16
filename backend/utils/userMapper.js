// backend/utils/userMapper.js
//
// Converts a users table row (real snake_case columns in PostgreSQL) into
// the same camelCase shape the frontend used to read from db.json
// (hospitalId, jobTitle, dashboardLayout, isActive, mustChangePassword...)
// -- so no frontend screen needs any changes after the full move to
// PostgreSQL. One shared conversion point (instead of duplicating it in
// every route in authRoutes.js/usersRoutes.js) to guarantee a consistent
// shape everywhere -- the password column is never included in the
// result, so it's always safe to send directly in any HTTP response.
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    jobTitle: row.job_title,
    avatar: row.avatar,
    color: row.color,
    hospitalId: row.hospital_id,
    permissions: row.permissions || [],
    dashboardLayout: row.dashboard_layout || undefined,
    mustChangePassword: row.must_change_password,
    isActive: row.is_active,
    isPrimaryAdmin: row.is_primary_admin,
    createdAt: row.created_at,
  };
}

module.exports = { mapUserRow };
