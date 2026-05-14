import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';

// PATCH /api/v1/users/wallet
export const updateWallet = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    const userId = req.user.userId;

    const existing = await User.findOne({ where: { walletAddress } });
    if (existing && existing.id !== userId) {
      throw new AppError('This wallet address is already linked to a different account.', 409);
    }

    const user = await User.findByPk(userId);
    if (!user) throw new AppError('User not found.', 404);

    await user.update({ walletAddress });

    return res.json({ success: true, walletAddress });
  } catch (error) {
    next(error);
  }
};
