import { sendForbidden } from '../utils/response.js';

// Role name strings — must match what the auth service puts in the JWT payload
export const ROLE = {
  NORMAL_USER:        'NORMAL_USER',
  ADMIN:              'ADMIN',
  MUSEUM_ADMIN:       'MUSEUM_ADMIN',
  SUPER_ADMIN:        'SUPER_ADMIN',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  CMS_EDITOR:         'CMS_EDITOR',
  INVESTOR:           'INVESTOR',
};

export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    // JWT payload contains { role: "MUSEUM_ADMIN" } as a string
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return sendForbidden(res, 'Insufficient permissions for this action');
    }
    next();
  };
}

export const requireMuseumAdmin = requireRoles(ROLE.MUSEUM_ADMIN, ROLE.SUPER_ADMIN);
export const requireSuperAdmin  = requireRoles(ROLE.SUPER_ADMIN);
export const requireInvestor    = requireRoles(ROLE.INVESTOR, ROLE.SUPER_ADMIN);
export const requireAnyAdmin    = requireRoles(ROLE.ADMIN, ROLE.MUSEUM_ADMIN, ROLE.SUPER_ADMIN);
