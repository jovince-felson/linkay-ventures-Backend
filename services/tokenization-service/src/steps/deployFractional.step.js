import Asset                       from '../models/Asset.js';
import { getFractionalTokenFactory } from '../blockchain/contracts.js';
import { toBytes32 }                 from '../blockchain/provider.js';

const MOCK = process.env.CONTRACTS_ENABLED !== 'true';

function deriveSymbol(title = '') {
  return title
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 6) || 'LKY';
}

export async function deployFractionalStep(job) {
  const { assetId, ownerWallet } = job;

  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const totalSupply    = BigInt(asset.totalFractions || 1000000);
  const tokenizedBps   = Math.round((parseFloat(asset.tokenizedPercent) || 49) * 100);
  const treasuryWallet = process.env.TREASURY_WALLET;
  const tokenName      = `${asset.title} Token`;
  const tokenSymbol    = deriveSymbol(asset.title);
  const assetOwner     = asset.royaltyWallet || ownerWallet;

  if (MOCK) {
    const mockAddress = `0x${'c'.repeat(40)}`;
    await asset.update({ erc3643ContractAddress: mockAddress });
    return {
      txHash:             `0x${'d'.repeat(64)}`,
      tokenContractAddress: mockAddress,
      totalSupply:        totalSupply.toString(),
      tokenizedBps,
    };
  }

  const factory      = getFractionalTokenFactory();
  const assetIdBytes = toBytes32(assetId);

  const tx = await factory.deployFractionalToken(
    tokenName,
    tokenSymbol,
    totalSupply,
    assetIdBytes,
    treasuryWallet,
    assetOwner,
    tokenizedBps,
  );
  const receipt = await tx.wait(1);

  const event              = receipt.logs.find((l) => l.fragment?.name === 'FractionalTokenDeployed');
  const tokenContractAddress = event?.args?.tokenContract || '';

  await asset.update({ erc3643ContractAddress: tokenContractAddress });

  return {
    txHash: receipt.hash,
    tokenContractAddress,
    totalSupply: totalSupply.toString(),
    tokenizedBps,
  };
}
