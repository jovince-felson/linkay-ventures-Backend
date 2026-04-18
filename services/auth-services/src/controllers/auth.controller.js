const authService      = require('../services/auth.service');
const { success, error } = require('../utils/response');

const register = async (req, res) => {
  try {
    const user = await authService.register(req.body);
    return success(res, { user }, 'Registration successful', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

const login = async (req, res) => {
  try {
    const meta = { ip: req.ip, userAgent: req.get('user-agent') };
    const data = await authService.login(req.body, meta);
    return success(res, data, 'Login successful');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refresh(refreshToken);
    return success(res, tokens, 'Token refreshed');
  } catch (err) {
    return error(res, err.message, err.status || 401);
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    return success(res, {}, 'Logged out successfully');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await authService.getProfile(req.user.id);
    return success(res, { user });
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

module.exports = { register, login, refresh, logout, getProfile };
