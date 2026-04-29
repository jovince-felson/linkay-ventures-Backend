import express from "express";
import { validate } from "../../middlewares/validate.js";
import * as AuthMiddleware from "../../middlewares/auth-middleware.js";
import * as AuthValidator from "../../validators/auth.validator.js";
import * as RegisterController from "../../controllers/register.controller.js";
import * as VerifyEmailController from "../../controllers/verify-email.controller.js";
import * as LoginController from "../../controllers/login.controller.js";
import * as PasswordController from "../../controllers/password.controller.js";
import * as AccessController from "../../controllers/access.controller.js";
import * as UserController from "../../controllers/user.controller.js";

const router = express.Router();

// Verifies JWT + checks session is not revoked
const protect = [AuthMiddleware.CheckUser, AuthMiddleware.CheckSession];

// ── Registration ──────────────────────────────────────────────────────────────
router.post(
  "/register",
  validate(AuthValidator.RegisterViaEmail),
  RegisterController.Register
);

// ── Email Verification ────────────────────────────────────────────────────────
// Public — token arrives via email link, no Authorization header available
router.get("/verifyemail", VerifyEmailController.VerifyEmail);

// ── Login / Logout ────────────────────────────────────────────────────────────
router.post(
  "/login",
  validate(AuthValidator.LoginViaEmail),
  LoginController.LoginWithEmail
);
router.post("/logout", protect, LoginController.Logout);

// ── Token Refresh ─────────────────────────────────────────────────────────────
// Public — reads httpOnly cookie, no Authorization header
router.post("/refresh", AccessController.RefreshAccessToken);

// ── Password Reset ────────────────────────────────────────────────────────────
router.post(
  "/forgot-password",
  validate(AuthValidator.ForgotPasswordValidator),
  PasswordController.ForgotPassword
);
// router.post(
//   "/reset-password",
//   validate(AuthValidator.ResetPasswordValidator),
//   PasswordController.ResetPassword
// );

// ── Authenticated User ────────────────────────────────────────────────────────
router.get("/me", protect, UserController.GetUserDetails);

export default router;






// import express from 'express';
// import { validate } from "../../middlewares/validate.js";
// import * as AuthMiddleware from "../../middlewares/auth-middleware.js";
// import * as AuthValidator from "../../validators/auth.validator.js";
// import * as RegisterController from "../../controllers/register.controller.js";
// import * as LoginController from "../../controllers/login.controller.js";
// import * as PasswordController from "../../controllers/password.controller.js";
// import * as AccessController from "../../controllers/access.controller.js";
// import * as UserController from "../../controllers/user.controller.js";

// const router = express.Router();
// const protect = [AuthMiddleware.CheckUser, AuthMiddleware.CheckSession];

// // ─── Registration ────────────────────────────────────────────────────────────
// router.post('/register', validate(AuthValidator.RegisterViaEmail), RegisterController.Register);

// // ─── Login / Logout ──────────────────────────────────────────────────────────
// router.post('/login/email', validate(AuthValidator.LoginViaEmail), LoginController.LoginWithEmail);
// router.post('/log-out', protect, LoginController.Logout);

// // ─── Token Management ────────────────────────────────────────────────────────
// router.post('/refresh', AccessController.RefreshAccessToken);
// router.post('/session-validation', AccessController.SessionValidation);

// // ─── Password Reset (unauthenticated) ────────────────────────────────────────
// router.post('/forgot-password', validate(AuthValidator.ForgotPasswordValidator), PasswordController.ForgotPassword);
// router.post('/verify-password-reset-token', validate(AuthValidator.VerifyPasswordResetTokenValidator), PasswordController.VerifyPasswordResetToken);
// router.post('/reset-password', validate(AuthValidator.ChangePasswordValidator), PasswordController.ChangePassword);

// // ─── Authenticated User ──────────────────────────────────────────────────────
// router.post('/me', protect, UserController.GetUserDetails);

// export default router;





// // import express from 'express';
// // import { validate } from "../../middlewares/validate.js";
// // import * as AuthMiddleware from "../../middlewares/auth-middleware.js";
// // import { SessionManage } from "../../middlewares/session-manage.js";
// // import { VerifyAdmin } from "../../middlewares/verifyadmin.js";
// // import * as AuthValidator  from "../../validators/auth.validator.js";
// // import * as PermissionValidator from "../../validators/permission.validator.js";
// // import * as RoleValidator from "../../validators/role.validator.js";
// // import * as RegisterController from "../../controllers/register.controller.js";
// // import * as LogController from "../../controllers/log.controller.js";
// // import * as LoginController from "../../controllers/login.controller.js";
// // import * as PasswordController from "../../controllers/password.controller.js";
// // import * as OTPController from "../../controllers/otp.controller.js";
// // import * as PasskeyController from "../../controllers/passkey.controller.js";
// // import * as AccessController from "../../controllers/access.controller.js";
// // import * as UserController from "../../controllers/user.controller.js";
// // import * as BioMetricController from "../../controllers/biometric.controller.js";
// // import * as RoleController from "../../controllers/role.controller.js";
// // import * as PermissionController from "../../controllers/permission.controller.js";


// // const router = express.Router();
// // const protect = [AuthMiddleware.CheckUser, AuthMiddleware.CheckSession];

// // router.post('/logs',LogController.GetLogs);

// // // Register Controller Routes
// // router.post('/register', validate(AuthValidator.RegisterViaEmail), RegisterController.Register);
// // // router.post('/register/mobile', validate(AuthValidator.RegisterViaPhone), RegisterController.RegisterWithMobile);
// // router.post('/authenticate/google', validate(AuthValidator.RegisterViaGoogle), RegisterController.AuthenticateWithGoogle);
// // router.post('/authenticate/apple', validate(AuthValidator.RegisterViaApple), RegisterController.AuthenticateWithApple);

// // // Login Controller Routes
// // router.post('/login/email', validate(AuthValidator.LoginViaEmail),LoginController.LoginWithEmail);
// // router.post('/login/mobile', validate(AuthValidator.LoginViaMobile),LoginController.LoginWithMobile);
// // router.post('/log-out', protect, LoginController.Logout);

// // // Password Controller Routes
// // router.post('/forgot-password', validate(AuthValidator.ForgotPasswordValidator), PasswordController.ForgotPassword);
// // router.post('/change-password', validate(AuthValidator.ChangePasswordValidator), PasswordController.ChangePassword);
// // router.post('/verify-password-reset-token', validate(AuthValidator.VerifyPasswordResetTokenValidator), PasswordController.VerifyPasswordResetToken);
// // router.post('/forgot-password/session', protect, PasswordController.ForgotPasswordWithSession);

// // // Otp Controller Routes
// // router.post('/two-factor-authentication', validate(AuthValidator.OTPVerifyValidator), SessionManage, OTPController.VerifyOTP);
// // // router.post('/resend-otp/mobile', validate(AuthValidator.MobileOTPValidator), OTPController.ReSendMobileOTP);
// // // router.post('/resend-otp/email', validate(AuthValidator.EmailOTPValidator), OTPController.ReSendEmailOTP);
// // router.post('/otp-verify/general', protect, OTPController.GeneralOTPVerification);

// // // Passkey Controller Routes
// // router.post('/add-passkey', validate(AuthValidator.AddPasskeyValidator), protect, PasskeyController.AddPassKey);
// // router.post('/login/pass-key', validate(AuthValidator.PasskeyAuthValidator), protect, PasskeyController.AuthenticateByPassKey);
// // router.post('/forgot/pass-key', validate(AuthValidator.ForgotPasskeyValidator), protect, PasskeyController.ForgotPassKey);
// // router.post('/reset-passkey',validate(AuthValidator.ResetPasskeyValidator), protect, PasskeyController.ResetPasskey);

// // // Access Controller Routes
// // router.post('/refresh', AccessController.RefreshAccessToken);
// // router.post('/session-validation',AccessController.SessionValidation);

// // // User Controller Routes
// // router.post('/get-details',UserController.GetUserDetails);
// // router.post('/delete-account',protect,UserController.DeleteAccount);
// // router.post('/role-based-users',UserController.GetUserList);

// // // BioMetric Controller Routes
// // router.post("/biometric/register/challenge",BioMetricController.registerBiometricChallenge);
// // router.post("/biometric/register/verify", BioMetricController.registerBiometricVerify);
// // router.post("/biometric/login/challenge", BioMetricController.loginBiometricChallenge);
// // router.post("/biometric/login/verify",protect,BioMetricController.loginBiometricVerify);
// // router.post("/bio-metric-status",protect,validate(AuthValidator.BioMetricValidator),BioMetricController.BioMetricPermission);

// // // Roles Routes
// // router.post("/roles/list",VerifyAdmin,validate(RoleValidator.RoleIndexValidator), RoleController.Index);
// // router.post("/roles/add",VerifyAdmin,validate(RoleValidator.RoleAddValidator),RoleController.Add);
// // router.post("/roles/edit",VerifyAdmin,validate(RoleValidator.RoleUpdateValidator),RoleController.Update);
// // router.post("/roles/unique-check",VerifyAdmin,validate(RoleValidator.RoleUniqueValidator),RoleController.UniqueCheck);
// // router.post("/roles/status-change",VerifyAdmin,validate(RoleValidator.RoleStatusChangeValidator),RoleController.StatusChange);
// // router.post("/roles/delete",VerifyAdmin,validate(RoleValidator.RoleDeleteValidator),RoleController.Delete);
// // router.post("/roles/drop-down",VerifyAdmin,RoleController.RoleList);


// // // Permissions Route
// // router.post("/permissions/drop-down",PermissionController.PermissionList);
// // router.post("/assign-permissions",VerifyAdmin,validate(PermissionValidator.AssignPermissionValidator),PermissionController.AssignPermissions);
// // router.post("/get-permissions",validate(PermissionValidator.GetPermissionValidator),PermissionController.GetPermissions);

// // // BioMetric APIS
// // router.post("/check-biometric",protect,UserController.CheckBioMetric);

// // // Device List and SignOut APIS
// // router.post("/get-device-lists",protect, validate(AuthValidator.DeviceListValidator),UserController.DeviceLists);
// // router.post("/sign-out-from-all",protect,validate(AuthValidator.DeviceListValidator),UserController.SignOutFromAll);
// // router.post("/sign-out-from-device",protect,validate(AuthValidator.SignOutValidator),UserController.SignoutParticular);
// // export default router;