import express from "express";
import * as AuthMiddleware from "../../middlewares/auth-middleware.js";
import * as AuthController from "../../controllers/auth.controller.js";
import * as LogController from "../../controllers/log.controller.js";
import * as AuthValidator  from "../../validators/auth.validator.js";
import { validate } from "../../middlewares/validate.js";
import { SessionManage } from "../../middlewares/session-manage.js";
import * as RoleController from "../../controllers/role.controller.js";
import * as PermissionController from "../../controllers/permission.controller.js";
import * as PermissionValidator from "../../validators/permission.validator.js";
import * as RoleValidator from "../../validators/role.validator.js";
import { VerifyAdmin } from "../../middlewares/verifyadmin.js";

const router = express.Router();

router.post('/logs',LogController.GetLogs);

router.post('/register/email', validate(AuthValidator.RegisterViaEmail), AuthController.RegisterWithEmail);
router.post('/register/mobile', validate(AuthValidator.RegisterViaPhone), AuthController.RegisterWithMobile);
router.post('/authenticate/google', validate(AuthValidator.RegisterViaGoogle), AuthController.AuthenticateWithGoogle);
router.post('/authenticate/apple', validate(AuthValidator.RegisterViaApple), AuthController.AuthenticateWithApple);

router.post('/login/email', validate(AuthValidator.LoginViaEmail),AuthController.LoginWithEmail);
router.post('/login/mobile', validate(AuthValidator.LoginViaMobile),AuthController.LoginWithMobile);

router.post('/forgot-password',AuthController.ForgotPassword);
router.post('/change-password', AuthController.ChangePassword);
router.post('/verify-password-reset-token',  AuthController.VerifyPasswordResetToken);

// OTP verification
router.post('/two-factor-authentication', validate(AuthValidator.OTPVerifyValidator), SessionManage, AuthController.VerifyOTP);

// Resend OTP
router.post('/resend-otp/mobile', validate(AuthValidator.MobileOTPValidator), AuthController.ReSendMobileOTP);
router.post('/resend-otp/email', validate(AuthValidator.EmailOTPValidator), AuthController.ReSendEmailOTP);

const protect = [AuthMiddleware.CheckUser, AuthMiddleware.CheckSession];

// Logout
router.post('/log-out', protect, AuthController.Logout);

// Delete Account
router.post('/delete-account',protect,AuthController.DeleteAccount);

// Passkey
router.post('/add-passkey', validate(AuthValidator.AddPasskeyValidator), protect, AuthController.AddPassKey);
router.post('/login/pass-key', validate(AuthValidator.PasskeyAuthValidator), protect, AuthController.AuthenticateByPassKey);

// Forgot passkey flow
router.post('/forgot/pass-key', validate(AuthValidator.ForgotPasskeyValidator), protect, AuthController.ForgotPassKey);
router.post('/otp-verify/general', protect, AuthController.GeneralOTPVerification);

// Change password while logged in
router.post('/forgot-password/session', protect, AuthController.ForgotPasswordWithSession);


router.post('/refresh', AuthController.RefreshAccessToken);

router.post('/session-validation',AuthController.SessionValidation);

router.post('/login/admin',AuthController.LoginWithAdmin);

router.post('/get-details',AuthController.GetUserDetails);

// Bio Metric Routes
router.post("/biometric/register/challenge",AuthController.registerBiometricChallenge);
router.post("/biometric/register/verify", AuthController.registerBiometricVerify);

router.post("/biometric/login/challenge", AuthController.loginBiometricChallenge);
router.post("/biometric/login/verify",protect,AuthController.loginBiometricVerify);


// Roles and Permissions Route
router.post("/roles/list",VerifyAdmin,validate(RoleValidator.RoleIndexValidator), RoleController.Index);
router.post("/roles/add",VerifyAdmin,validate(RoleValidator.RoleAddValidator),RoleController.Add);
router.post("/roles/edit",VerifyAdmin,validate(RoleValidator.RoleUpdateValidator),RoleController.Update);
router.post("/roles/unique-check",VerifyAdmin,validate(RoleValidator.RoleUniqueValidator),RoleController.UniqueCheck);
router.post("/roles/status-change",VerifyAdmin,validate(RoleValidator.RoleStatusChangeValidator),RoleController.StatusChange);
router.post("/roles/delete",VerifyAdmin,validate(RoleValidator.RoleDeleteValidator),RoleController.Delete);
router.post("/roles/drop-down",VerifyAdmin,validate(RoleValidator.RoleListValidator),RoleController.RoleList);

// Permissions Route
router.post("/permissions/drop-down",validate(PermissionValidator.PermissionListValidator),PermissionController.PermissionList);
router.post("/assign-permissions",VerifyAdmin,validate(PermissionValidator.AssignPermissionValidator),PermissionController.AssignPermissions);
router.post("/get-permissions",validate(PermissionValidator.GetPermissionValidator),PermissionController.GetPermissions);

// Biometric

router.post("/bio-metric-status",protect,validate(AuthValidator.BioMetricValidator),AuthController.BioMetricPermission);
export default router;
