const router                              = require('express').Router();
const authController                      = require('../controllers/auth.controller');
const { authenticate }                    = require('../middlewares/auth.middleware');
const validate                            = require('../middlewares/validate.middleware');
const { registerRules, loginRules, refreshRules } = require('../validators/auth.validator');

// ─── Public Routes ────────────────────────────────────────────────────────────
router.post('/register', registerRules, validate, authController.register);
router.post('/login',    loginRules,    validate, authController.login);
router.post('/refresh',  refreshRules,  validate, authController.refresh);
router.post('/logout',   refreshRules,  validate, authController.logout);

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.get('/me', authenticate, authController.getProfile);

module.exports = router;
