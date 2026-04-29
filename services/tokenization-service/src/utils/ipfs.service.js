import axios from "axios";
import FormData from "form-data";
import { PINATA } from "../config/services.js";
import { logger } from "linkay-shared-utils";

const PINATA_BASE = "https://api.pinata.cloud";

/**
 * Uploads metadata JSON to IPFS via Pinata
 * Returns the IPFS URI: ipfs://<CID>
 */
export const pinMetadataToIPFS = async (metadata, name) => {
    try {
        const response = await axios.post(
            `${PINATA_BASE}/pinning/pinJSONToIPFS`,
            {
                pinataContent: metadata,
                pinataMetadata: { name: name || "asset-metadata" },
                pinataOptions: { cidVersion: 1 },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    pinata_api_key: PINATA.apiKey,
                    pinata_secret_api_key: PINATA.secretKey,
                },
                timeout: 30000,
            }
        );

        const cid = response.data.IpfsHash;
        logger.info(`IPFS metadata pinned: ${cid}`);
        return `ipfs://${cid}`;
    } catch (error) {
        logger.error("Pinata metadata upload failed:", error?.response?.data || error.message);
        throw new Error("IPFS_PIN_FAILED: " + (error?.response?.data?.error || error.message));
    }
};

/**
 * Builds ERC-721 compatible metadata JSON from asset data
 */
export const buildMetadataJson = (asset, tokenizationParams) => {
    return {
        name: asset.title,
        description: asset.description,
        image: asset.primary_image_url || "",
        external_url: `${process.env.PLATFORM_URL || "https://linkay.io"}/assets/${asset.id}`,
        animation_url: asset.model_ipfs_uri || null,
        attributes: [
            { trait_type: "Asset Type", value: asset.asset_type },
            { trait_type: "Valuation (USD)", value: asset.valuation },
            { trait_type: "Total Fractions", value: tokenizationParams.totalFractions },
            { trait_type: "Price Per Fraction", value: tokenizationParams.pricePerFraction },
            { trait_type: "Compliance Standard", value: "ERC-3643" },
            { trait_type: "Retained Percent", value: asset.retained_percent },
            { trait_type: "Tokenized Percent", value: asset.tokenized_percent },
        ],
        properties: {
            assetId: asset.id,
            valuation: asset.valuation,
            retainedPercent: asset.retained_percent,
            tokenizedPercent: asset.tokenized_percent,
            totalFractions: tokenizationParams.totalFractions,
            complianceStandard: "ERC-3643",
            jurisdiction: tokenizationParams.jurisdictions || [],
        },
    };
};

/**
 * Resolves ipfs:// URI to HTTPS gateway URL for display
 */
export const resolveIPFSGateway = (ipfsUri) => {
    if (!ipfsUri) return null;
    const cid = ipfsUri.replace("ipfs://", "");
    return `${PINATA.gateway}/ipfs/${cid}`;
};
