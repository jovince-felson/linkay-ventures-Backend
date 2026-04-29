import { Router } from "express";
import {
    initiateTokenization,
    getJobStatus,
    getTokenizationByAsset,
    updateComplianceRules,
    listJobs,
    retryJob,
} from "../../controllers/tokenization.controller.js";
import {
    VerifyToken,
    VerifyMuseumAdmin,
    VerifySuperAdmin,
    VerifyAdminRole,
} from "../../middlewares/auth.js";

const router = Router();

// ── All tokenization routes require a valid JWT ───────────────────────────────

/**
 * @route   POST /api/v1/tokenization/initiate
 * @desc    Initiate tokenization for a LIVE asset (async — returns jobId)
 * @access  MUSEUM_ADMIN, SUPER_ADMIN
 * @body    { assetId, totalFractions, pricePerFraction, jurisdictions, lockUpDays }
 * @postman POST http://localhost:4005/api/v1/tokenization/initiate
 */
router.post("/initiate", VerifyToken, VerifyMuseumAdmin, initiateTokenization);

/**
 * @route   GET /api/v1/tokenization/jobs
 * @desc    List all tokenization jobs (admin view)
 * @access  SUPER_ADMIN
 * @query   ?status=QUEUED|PROCESSING|COMPLETED|FAILED&page=1&limit=10
 * @postman GET http://localhost:4005/api/v1/tokenization/jobs?status=COMPLETED
 */
router.get("/jobs", VerifyToken, VerifySuperAdmin, listJobs);

/**
 * @route   GET /api/v1/tokenization/status/:jobId
 * @desc    Poll tokenization job progress by jobId
 * @access  Any authenticated user
 * @postman GET http://localhost:4005/api/v1/tokenization/status/:jobId
 */
router.get("/status/:jobId", VerifyToken, getJobStatus);

/**
 * @route   POST /api/v1/tokenization/jobs/:jobId/retry
 * @desc    Manually retry a FAILED tokenization job
 * @access  SUPER_ADMIN
 * @postman POST http://localhost:4005/api/v1/tokenization/jobs/:jobId/retry
 */
router.post("/jobs/:jobId/retry", VerifyToken, VerifySuperAdmin, retryJob);

/**
 * @route   GET /api/v1/tokenization/:assetId
 * @desc    Get tokenization result for a specific asset
 * @access  Any authenticated user
 * @postman GET http://localhost:4005/api/v1/tokenization/:assetId
 */
router.get("/:assetId", VerifyToken, getTokenizationByAsset);

/**
 * @route   POST /api/v1/tokenization/:assetId/compliance
 * @desc    Update compliance rules on deployed ERC-3643 contract
 * @access  SUPER_ADMIN, COMPLIANCE_OFFICER
 * @body    { jurisdictions, lockUpDays, eligibilityLevel }
 * @postman POST http://localhost:4005/api/v1/tokenization/:assetId/compliance
 */
router.post("/:assetId/compliance", VerifyToken, VerifyAdminRole, updateComplianceRules);

export default router;
