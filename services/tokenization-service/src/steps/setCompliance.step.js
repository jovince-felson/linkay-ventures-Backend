import Asset                  from '../models/Asset.js';
import { getComplianceModule } from '../blockchain/contracts.js';
import { toBytes32 }           from '../blockchain/provider.js';
import { ethers }              from 'ethers';

const MOCK = process.env.CONTRACTS_ENABLED !== 'true';

// EligibilityLevel enum from ComplianceModule.sol
const ELIGIBILITY = { RETAIL: 0, ACCREDITED: 1, PROFESSIONAL: 2 };

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

  // use asset jurisdiction; default to US if not set
  const rawJurisdictions  = asset.jurisdiction
    ? asset.jurisdiction.split(',').map((j) => j.trim())
    : ['US'];

  if (MOCK) {
    await asset.update({ complianceConfigured: true });
    return { txHash: `0x${'e'.repeat(64)}`, jurisdictions: rawJurisdictions, eligibilityLevel };
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
