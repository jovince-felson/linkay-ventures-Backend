import { body, query } from 'express-validator';

export const registerValidator = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters.')
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters with uppercase, number, and special character.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
    .withMessage('Password must be at least 8 characters with uppercase, number, and special character.'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required.')
    .isLength({ max: 100 })
    .withMessage('First name must not exceed 100 characters.'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required.')
    .isLength({ max: 100 })
    .withMessage('Last name must not exceed 100 characters.'),

  body('countryOfResidence')
    .isISO31661Alpha2()
    .withMessage('Please select a valid country.'),
];

export const loginValidator = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),

  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

export const walletNonceValidator = [
  query('address')
    .matches(/^0x[0-9a-fA-F]{40}$/)
    .withMessage('Invalid wallet address format.'),
];

export const walletBindValidator = [
  body('address')
    .matches(/^0x[0-9a-fA-F]{40}$/)
    .withMessage('Invalid wallet address format.'),

  body('signature')
    .notEmpty()
    .withMessage('Signature is required.'),

  body('nonce')
    .notEmpty()
    .withMessage('Nonce is required.'),
];

export const forgotPasswordValidator = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),
];

export const resetPasswordValidator = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required.'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters with uppercase, number, and special character.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
    .withMessage('Password must be at least 8 characters with uppercase, number, and special character.'),
];

export const updateWalletValidator = [
  body('walletAddress')
    .isLength({ min: 42, max: 42 })
    .withMessage('Wallet address must be exactly 42 characters.')
    .matches(/^0x[0-9a-fA-F]{40}$/)
    .withMessage('Invalid wallet address format.'),
];
