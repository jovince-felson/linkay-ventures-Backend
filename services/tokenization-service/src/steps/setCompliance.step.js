import Asset                  from '../models/Asset.js';
import { getComplianceModule } from '../blockchain/contracts.js';
import { toBytes32 }           from '../blockchain/provider.js';
import { ethers }              from 'ethers';

const MOCK = process.env.CONTRACTS_ENABLED !== 'true';

// EligibilityLevel enum from ComplianceModule.sol
const ELIGIBILITY = { RETAIL: 0, ACCREDITED: 1, PROFESSIONAL: 2 };

// All jurisdictions supported by the platform — any KYC-verified investor from
// these countries can participate in auctions and marketplace listings.
const ALL_PLATFORM_JURISDICTIONS = [
  'US', 'GB', 'EU', 'SG', 'AE', 'CH', 'DE', 'FR', 'JP', 'CA', 'AU', 'IN',
];

// ISO 3166-1 alpha-2 → bytes2
function toBytes2(isoCode) {
  return ethers.toBeHex(
    ethers.toBigInt(ethers.toUtf8Bytes(isoCode.slice(0, 2).toUpperCase())),
    2,
  );
}

export async function setComplianceStep(job) {
  const { assetId }        = job;
  const eligibilityLevel   = job.eligibilityLevel || 'RETAIL';

  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  // Allow all platform-supported investor jurisdictions so any KYC-verified user
  // can bid and win regardless of where the asset originates.
  const rawJurisdictions = [...ALL_PLATFORM_JURISDICTIONS];

  if (MOCK) {
    await asset.update({ complianceConfigured: true });
    return { txHash: `0x${'e'.repeat(64)}`, jurisdictions: rawJurisdictions, eligibilityLevel };
  }

  // ── Idempotency check: compliance may have been set in a previous run ───────
  if (asset.complianceConfigured) {
    console.warn(`⚠️  setComplianceStep: asset ${assetId} compliance already configured, skipping`);
    return { txHash: null, jurisdictions: rawJurisdictions, eligibilityLevel, alreadyConfigured: true };
  }

  const complianceModule = getComplianceModule();
  const assetIdBytes     = toBytes32(assetId);
  const jurisdictionBytes = rawJurisdictions.map(toBytes2);
  const eligibilityEnum   = ELIGIBILITY[eligibilityLevel] ?? 0;

  const tx      = await complianceModule.setJurisdictionRules(assetIdBytes, jurisdictionBytes, eligibilityEnum);
  const receipt = await tx.wait(1);

  await asset.update({ complianceConfigured: true });

  return { txHash: receipt.hash, jurisdictions: rawJurisdictions, eligibilityLevel };
}
