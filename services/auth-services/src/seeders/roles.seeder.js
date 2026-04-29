/**
 * Role definitions seeder — documents available roles.
 * In this implementation roles are an ENUM in the User model,
 * so no separate roles table is needed. This file serves as reference.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MUSEUM_ADMIN: 'MUSEUM_ADMIN',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  CMS_EDITOR: 'CMS_EDITOR',
  INVESTOR: 'INVESTOR',
};

export default ROLES;
