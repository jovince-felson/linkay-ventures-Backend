/**
 * superAdmin.seeder.js
 * Seeds the initial SUPER_ADMIN account if one does not already exist.
 * Credentials are read from environment variables — never hardcoded.
 *
 * Required env vars:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD
 *   SEED_ADMIN_FIRST_NAME
 *   SEED_ADMIN_LAST_NAME
 *   SEED_ADMIN_COUNTRY (ISO 3166-1 alpha-2)
 */
import { User } from '../models/index.js';
import { hashPassword } from '../utils/crypto.util.js';
import logger from '../utils/logger.js';

export const seedSuperAdmin = async () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn('SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set — skipping super admin seed.');
    return;
  }

  const existing = await User.findOne({ where: { role: 'SUPER_ADMIN' } });
  if (existing) {
    logger.info(`Super admin already exists (${existing.email}) — skipping.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  await User.create({
    email,
    passwordHash,
    firstName: process.env.SEED_ADMIN_FIRST_NAME || 'Super',
    lastName: process.env.SEED_ADMIN_LAST_NAME || 'Admin',
    countryOfResidence: (process.env.SEED_ADMIN_COUNTRY || 'US').toUpperCase(),
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    emailVerified: true,
  });

  logger.info(`Super admin seeded: ${email}`);
};
