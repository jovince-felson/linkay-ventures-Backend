import tokenizationQueue from "../queues/tokenization.queue.js";
import { TokenizationJob } from "../models/index.js";
import {
    pinMetadataToIPFS,
    buildMetadataJson,
} from "../utils/ipfs.service.js";
import {
    mintAssetNFT,
    deployFractionalToken,
    attachComplianceRules,
    issueFractionalTokens,
} from "../utils/blockchain.service.js";
import { writeAuditLog } from "../utils/audit.helper.js";
import { publish, Topics, Keys, logger } from "linkay-shared-utils";
import axios from "axios";
import { SERVICES } from "../config/services.js";

// ── Step names for idempotency tracking ──────────────────────────────────────
const STEPS = {
    IPFS_METADATA: "IPFS_METADATA",
    MINT_NFT: "MINT_NFT",
    DEPLOY_ERC3643: "DEPLOY_ERC3643",
    ATTACH_COMPLIANCE: "ATTACH_COMPLIANCE",
    ISSUE_FRACTIONS: "ISSUE_FRACTIONS",
};

// ── Helper: update job record in DB ──────────────────────────────────────────
const updateJob = async (jobId, updates) => {
    await TokenizationJob.update(updates, { where: { id: jobId } });
};

// ── Helper: mark step as done ─────────────────────────────────────────────────
const markStepDone = async (dbJob, stepName) => {
    const completed = dbJob.steps_completed || [];
    if (!completed.includes(stepName)) completed.push(stepName);
    await updateJob(dbJob.id, { steps_completed: completed });
    dbJob.steps_completed = completed;
};

// ── Fetch asset details from Asset Service ────────────────────────────────────
const fetchAsset = async (assetId) => {
    try {
        const { data } = await axios.get(`${SERVICES.asset_service}/assets/${assetId}/internal`);
        return data.data;
    } catch (err) {
        throw new Error(`Failed to fetch asset ${assetId}: ${err.message}`);
    }
};

// ── Notify Asset Service of tokenization completion ───────────────────────────
const notifyAssetService = async (assetId, tokenizationData) => {
    try {
        await axios.patch(`${SERVICES.asset_service}/assets/${assetId}/tokenization`, tokenizationData);
        logger.info(`Asset service notified — asset ${assetId} tokenization complete`);
    } catch (err) {
        logger.warn("Asset service notification failed (non-critical):", err.message);
    }
};

// ── Main job processor ────────────────────────────────────────────────────────
tokenizationQueue.process(async (job) => {
    const { jobId } = job.data;

    // Load DB job record
    const dbJob = await TokenizationJob.findByPk(jobId);
    if (!dbJob) throw new Error(`TokenizationJob ${jobId} not found`);

    if (dbJob.status === "COMPLETED") {
        logger.info(`Job ${jobId} already completed — skipping`);
        return { skipped: true };
    }

    await updateJob(jobId, { status: "PROCESSING" });

    const completed = dbJob.steps_completed || [];

    try {
        // Fetch asset details
        const asset = await fetchAsset(dbJob.asset_id);

        // ── STEP 1: Upload metadata to IPFS ──────────────────────────────────
        let ipfsUri = dbJob.ipfs_metadata_uri;

        if (!completed.includes(STEPS.IPFS_METADATA)) {
            logger.info(`[Job ${jobId}] Step 1: Uploading metadata to IPFS`);
            await job.progress(10);

            const metadata = buildMetadataJson(asset, {
                totalFractions: dbJob.total_fractions,
                pricePerFraction: dbJob.price_per_fraction,
                jurisdictions: dbJob.jurisdictions,
            });

            ipfsUri = await pinMetadataToIPFS(metadata, `linkay-asset-${asset.id}`);
            await updateJob(jobId, { ipfs_metadata_uri: ipfsUri, current_step: 1 });
            await markStepDone(dbJob, STEPS.IPFS_METADATA);
            logger.info(`[Job ${jobId}] IPFS URI: ${ipfsUri}`);
        }

        // ── STEP 2: Mint ERC-721 NFT ──────────────────────────────────────────
        let nftTokenId = dbJob.nft_token_id;
        let nftContractAddress = dbJob.nft_contract_address;

        if (!completed.includes(STEPS.MINT_NFT)) {
            logger.info(`[Job ${jobId}] Step 2: Minting ERC-721 NFT`);
            await job.progress(30);

            const nftResult = await mintAssetNFT(asset.id, ipfsUri, null);
            nftTokenId = nftResult.tokenId;
            nftContractAddress = nftResult.contractAddress;

            await updateJob(jobId, {
                nft_token_id: nftTokenId,
                nft_contract_address: nftContractAddress,
                nft_mint_tx_hash: nftResult.txHash,
                current_step: 2,
            });
            await markStepDone(dbJob, STEPS.MINT_NFT);

            await writeAuditLog({
                actorId: dbJob.initiated_by,
                actorRole: "MUSEUM_ADMIN",
                action: "ASSET_NFT_MINTED",
                targetType: "ASSET",
                targetId: asset.id,
                txHash: nftResult.txHash,
                metadata: { tokenId: nftTokenId, contract: nftContractAddress },
            });
        }

        // ── STEP 3: Deploy ERC-3643 Fractional Token ─────────────────────────
        let erc3643ContractAddress = dbJob.erc3643_contract_address;

        if (!completed.includes(STEPS.DEPLOY_ERC3643)) {
            logger.info(`[Job ${jobId}] Step 3: Deploying ERC-3643 contract`);
            await job.progress(50);

            const erc3643Result = await deployFractionalToken(
                asset.title,
                asset.id,
                dbJob.total_fractions
            );
            erc3643ContractAddress = erc3643Result.contractAddress;

            await updateJob(jobId, {
                erc3643_contract_address: erc3643ContractAddress,
                erc3643_deploy_tx_hash: erc3643Result.txHash,
                current_step: 3,
            });
            await markStepDone(dbJob, STEPS.DEPLOY_ERC3643);
        }

        // ── STEP 4: Attach Compliance Rules ───────────────────────────────────
        if (!completed.includes(STEPS.ATTACH_COMPLIANCE)) {
            logger.info(`[Job ${jobId}] Step 4: Attaching compliance rules`);
            await job.progress(70);

            const complianceResult = await attachComplianceRules(
                erc3643ContractAddress,
                dbJob.jurisdictions,
                dbJob.lock_up_days,
                "RETAIL"
            );

            await updateJob(jobId, {
                compliance_tx_hash: complianceResult.txHash,
                current_step: 4,
            });
            await markStepDone(dbJob, STEPS.ATTACH_COMPLIANCE);
        }

        // ── STEP 5: Issue Fractions to Platform Treasury ──────────────────────
        if (!completed.includes(STEPS.ISSUE_FRACTIONS)) {
            logger.info(`[Job ${jobId}] Step 5: Issuing fractional tokens`);
            await job.progress(90);

            const issueResult = await issueFractionalTokens(
                erc3643ContractAddress,
                dbJob.total_fractions
            );

            await updateJob(jobId, {
                issue_tx_hash: issueResult.txHash,
                current_step: 5,
            });
            await markStepDone(dbJob, STEPS.ISSUE_FRACTIONS);
        }

        // ── Mark job COMPLETED ────────────────────────────────────────────────
        await updateJob(jobId, {
            status: "COMPLETED",
            completed_at: new Date(),
        });

        await job.progress(100);

        // Notify Asset Service to update its records
        await notifyAssetService(asset.id, {
            nft_token_id: nftTokenId,
            nft_contract_address: nftContractAddress,
            erc3643_contract_address: erc3643ContractAddress,
            ipfs_metadata_uri: ipfsUri,
            total_fractions: dbJob.total_fractions,
            price_per_fraction: dbJob.price_per_fraction,
        });

        // Publish Kafka event — TOKENIZATION_COMPLETE
        await publish(
            "tokenization-events",
            [{
                key: "tokenization-complete",
                value: JSON.stringify({
                    jobId,
                    assetId: asset.id,
                    initiatedBy: dbJob.initiated_by,
                    nftTokenId,
                    nftContractAddress,
                    erc3643ContractAddress,
                    ipfsUri,
                    totalFractions: dbJob.total_fractions,
                    completedAt: new Date().toISOString(),
                }),
            }]
        );

        await writeAuditLog({
            actorId: null,
            actorRole: "SYSTEM",
            action: "TOKENIZATION_COMPLETE",
            targetType: "ASSET",
            targetId: asset.id,
            newValue: { jobId, erc3643ContractAddress, nftTokenId },
        });

        logger.info(`[Job ${jobId}] Tokenization completed successfully`);
        return { success: true, jobId };

    } catch (error) {
        logger.error(`[Job ${jobId}] Tokenization step failed:`, error.message);

        await updateJob(jobId, {
            status: "FAILED",
            error_message: error.message,
            retry_count: (dbJob.retry_count || 0) + 1,
        });

        // Publish failure event
        await publish(
            "tokenization-events",
            [{
                key: "tokenization-failed",
                value: JSON.stringify({
                    jobId,
                    assetId: dbJob.asset_id,
                    error: error.message,
                }),
            }]
        ).catch(() => {});

        throw error; // Re-throw so Bull retries
    }
});

logger.info("Tokenization job processor registered");
