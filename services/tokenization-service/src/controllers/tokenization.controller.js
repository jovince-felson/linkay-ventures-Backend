import { TokenizationJob, ComplianceRule } from "../models/index.js";
import tokenizationQueue from "../queues/tokenization.queue.js";
import { writeAuditLog } from "../utils/audit.helper.js";
import { resolveIPFSGateway } from "../utils/ipfs.service.js";
import { RESPONSE_CODES, logger } from "linkay-shared-utils";
import axios from "axios";
import { SERVICES } from "../config/services.js";

// ── Helper: respond ───────────────────────────────────────────────────────────
const ok = (res, data, message = "Success", status = 200) =>
    res.status(status).json({ success: true, code: RESPONSE_CODES.OPERATION_SUCCESS, message, data });

const fail = (res, message, code = RESPONSE_CODES.OPERATION_FAILED, status = 400) =>
    res.status(status).json({ success: false, code, message });

// ── Helper: fetch asset from asset service ─────────────────────────────────
const getAsset = async (assetId) => {
    const { data } = await axios.get(`${SERVICES.asset_service}/assets/${assetId}/internal`);
    return data.data;
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tokenization/initiate
// Body: { assetId, totalFractions, pricePerFraction, jurisdictions, lockUpDays }
// Auth: MUSEUM_ADMIN / SUPER_ADMIN
// ────────────────────────────────────────────────────────────────────────────
export const initiateTokenization = async (req, res) => {
    try {
        const { assetId, totalFractions, pricePerFraction, jurisdictions, lockUpDays } = req.body;
        const userId = req.user?.userId || req.user?.id;

        // Validate required fields
        if (!assetId || !totalFractions || !pricePerFraction) {
            return fail(res, "assetId, totalFractions, pricePerFraction are required", RESPONSE_CODES.MISSING_FIELDS);
        }

        if (totalFractions < 100 || totalFractions > 10_000_000) {
            return fail(res, "totalFractions must be between 100 and 10,000,000");
        }

        if (parseFloat(pricePerFraction) <= 0) {
            return fail(res, "pricePerFraction must be greater than 0");
        }

        // Check no existing QUEUED/PROCESSING job for this asset
        const existingJob = await TokenizationJob.findOne({
            where: { asset_id: assetId, status: ["QUEUED", "PROCESSING", "COMPLETED"] },
        });

        if (existingJob) {
            if (existingJob.status === "COMPLETED") {
                return fail(res, "This asset has already been tokenized", "TOK_001", 409);
            }
            return fail(res, "A tokenization job is already active for this asset", "TOK_001", 409);
        }

        // Verify asset exists and is LIVE (call asset service)
        let asset;
        try {
            asset = await getAsset(assetId);
        } catch (err) {
            return fail(res, "Asset not found or asset service unavailable", RESPONSE_CODES.NOT_FOUND, 404);
        }

        if (asset.status !== "LIVE") {
            return fail(res, "Asset must be in LIVE status before tokenization", "TOK_002", 400);
        }

        // Validate fraction × price ≈ tokenized valuation (allow 1% drift)
        const tokenizedValue = parseFloat(asset.valuation) * (parseFloat(asset.tokenized_percent) / 100);
        const calculatedValue = parseInt(totalFractions) * parseFloat(pricePerFraction);
        const drift = Math.abs(tokenizedValue - calculatedValue) / tokenizedValue;
        if (drift > 0.01) {
            return fail(
                res,
                `Price mismatch: ${totalFractions} × ${pricePerFraction} = ${calculatedValue.toFixed(2)}, expected ~${tokenizedValue.toFixed(2)}`,
                "TOK_006"
            );
        }

        // Create job record in DB
        const dbJob = await TokenizationJob.create({
            asset_id: assetId,
            initiated_by: userId,
            status: "QUEUED",
            total_fractions: parseInt(totalFractions),
            price_per_fraction: parseFloat(pricePerFraction),
            jurisdictions: jurisdictions || ["US", "GB", "SG"],
            lock_up_days: parseInt(lockUpDays) || 0,
            current_step: 0,
            steps_completed: [],
        });

        // Enqueue Bull job
        await tokenizationQueue.add(
            { jobId: dbJob.id },
            { jobId: dbJob.id } // Bull job ID = DB job ID for easy lookup
        );

        await writeAuditLog({
            actorId: userId,
            actorRole: req.user?.role,
            action: "TOKENIZATION_INITIATED",
            targetType: "ASSET",
            targetId: assetId,
            newValue: { jobId: dbJob.id, totalFractions, pricePerFraction },
            ipAddress: req.ip,
        });

        logger.info(`Tokenization initiated — jobId: ${dbJob.id}, asset: ${assetId}`);

        return ok(res, { jobId: dbJob.id, status: "QUEUED" }, "Tokenization job queued", 202);
    } catch (error) {
        logger.error("initiateTokenization error:", error.message);
        return fail(res, "Internal server error", RESPONSE_CODES.SERVER_ERROR, 500);
    }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tokenization/status/:jobId
// ────────────────────────────────────────────────────────────────────────────
export const getJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;

        const dbJob = await TokenizationJob.findByPk(jobId);
        if (!dbJob) return fail(res, "Job not found", RESPONSE_CODES.NOT_FOUND, 404);

        // Get progress from Bull queue
        let bullProgress = null;
        const bullJob = await tokenizationQueue.getJob(jobId);
        if (bullJob) bullProgress = await bullJob.progress();

        const STEP_NAMES = [
            "Waiting",
            "Uploading IPFS Metadata",
            "Minting NFT",
            "Deploying ERC-3643 Contract",
            "Attaching Compliance Rules",
            "Issuing Fractional Tokens",
        ];

        return ok(res, {
            jobId: dbJob.id,
            assetId: dbJob.asset_id,
            status: dbJob.status,
            progress: bullProgress,
            currentStep: STEP_NAMES[dbJob.current_step] || "Unknown",
            stepsCompleted: dbJob.steps_completed,
            retryCount: dbJob.retry_count,
            error: dbJob.error_message || null,
            completedAt: dbJob.completed_at,
        });
    } catch (error) {
        logger.error("getJobStatus error:", error.message);
        return fail(res, "Internal server error", RESPONSE_CODES.SERVER_ERROR, 500);
    }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tokenization/:assetId
// Returns tokenization result for a specific asset
// ────────────────────────────────────────────────────────────────────────────
export const getTokenizationByAsset = async (req, res) => {
    try {
        const { assetId } = req.params;

        const job = await TokenizationJob.findOne({
            where: { asset_id: assetId, status: "COMPLETED" },
            order: [["created_at", "DESC"]],
        });

        if (!job) return fail(res, "No completed tokenization found for this asset", RESPONSE_CODES.NOT_FOUND, 404);

        return ok(res, {
            assetId: job.asset_id,
            jobId: job.id,
            nftTokenId: job.nft_token_id,
            nftContract: job.nft_contract_address,
            erc3643Contract: job.erc3643_contract_address,
            ipfsUri: job.ipfs_metadata_uri,
            ipfsGatewayUrl: resolveIPFSGateway(job.ipfs_metadata_uri),
            totalFractions: job.total_fractions,
            pricePerFraction: job.price_per_fraction,
            jurisdictions: job.jurisdictions,
            lockUpDays: job.lock_up_days,
            completedAt: job.completed_at,
        });
    } catch (error) {
        logger.error("getTokenizationByAsset error:", error.message);
        return fail(res, "Internal server error", RESPONSE_CODES.SERVER_ERROR, 500);
    }
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tokenization/:assetId/compliance
// Update compliance rules post-deploy
// Auth: SUPER_ADMIN / COMPLIANCE_OFFICER
// ────────────────────────────────────────────────────────────────────────────
export const updateComplianceRules = async (req, res) => {
    try {
        const { assetId } = req.params;
        const { jurisdictions, lockUpDays, eligibilityLevel } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!jurisdictions || !Array.isArray(jurisdictions) || jurisdictions.length === 0) {
            return fail(res, "jurisdictions array is required");
        }

        // Find completed tokenization job for this asset
        const job = await TokenizationJob.findOne({
            where: { asset_id: assetId, status: "COMPLETED" },
        });
        if (!job) return fail(res, "Asset not yet tokenized", RESPONSE_CODES.NOT_FOUND, 404);

        // Import and call blockchain service
        const { attachComplianceRules } = await import("../utils/blockchain.service.js");
        const result = await attachComplianceRules(
            job.erc3643_contract_address,
            jurisdictions,
            lockUpDays || 0,
            eligibilityLevel || "RETAIL"
        );

        // Save rule set to DB
        await ComplianceRule.create({
            asset_id: assetId,
            erc3643_contract: job.erc3643_contract_address,
            allowed_countries: jurisdictions,
            eligibility_level: eligibilityLevel || "RETAIL",
            lock_up_days: parseInt(lockUpDays) || 0,
            on_chain_tx_hash: result.txHash,
            set_by: userId,
        });

        await writeAuditLog({
            actorId: userId,
            actorRole: req.user?.role,
            action: "COMPLIANCE_RULES_UPDATED",
            targetType: "ASSET",
            targetId: assetId,
            newValue: { jurisdictions, lockUpDays, eligibilityLevel },
            txHash: result.txHash,
            ipAddress: req.ip,
        });

        return ok(res, { txHash: result.txHash, updatedAt: new Date() }, "Compliance rules updated");
    } catch (error) {
        logger.error("updateComplianceRules error:", error.message);
        return fail(res, error.message || "Compliance update failed", RESPONSE_CODES.SERVER_ERROR, 500);
    }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tokenization/jobs  (Admin — list all jobs)
// ────────────────────────────────────────────────────────────────────────────
export const listJobs = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;

        const { count, rows } = await TokenizationJob.findAndCountAll({
            where,
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset,
        });

        return ok(res, {
            jobs: rows,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (error) {
        logger.error("listJobs error:", error.message);
        return fail(res, "Internal server error", RESPONSE_CODES.SERVER_ERROR, 500);
    }
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tokenization/jobs/:jobId/retry  (Super Admin — manual retry)
// ────────────────────────────────────────────────────────────────────────────
export const retryJob = async (req, res) => {
    try {
        const { jobId } = req.params;

        const dbJob = await TokenizationJob.findByPk(jobId);
        if (!dbJob) return fail(res, "Job not found", RESPONSE_CODES.NOT_FOUND, 404);

        if (dbJob.status === "COMPLETED") {
            return fail(res, "Job already completed — cannot retry", "TOK_001", 409);
        }

        // Reset to QUEUED and re-enqueue
        await TokenizationJob.update({ status: "QUEUED", error_message: null }, { where: { id: jobId } });
        await tokenizationQueue.add({ jobId });

        logger.info(`Job ${jobId} manually re-queued`);

        return ok(res, { jobId, status: "QUEUED" }, "Job re-queued for retry");
    } catch (error) {
        logger.error("retryJob error:", error.message);
        return fail(res, "Internal server error", RESPONSE_CODES.SERVER_ERROR, 500);
    }
};
