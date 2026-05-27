import { ethers }             from 'ethers';
import Asset                  from '../models/Asset.js';
import { getAssetNFTFactory } from '../blockchain/contracts.js';
import { toBytes32 }          from '../blockchain/provider.js';

const MOCK = process.env.CONTRACTS_ENABLED !== 'true';

export async function mintNFTStep(job) {
  const { assetId, ownerWallet, ipfsUri } = job;

  if (MOCK) {
    // mock mode — contracts not yet deployed
    const mockAddress = `0x${'a'.repeat(40)}`;
    await Asset.update(
      { nftContractAddress: mockAddress, nftTokenId: 1 },
      { where: { id: assetId } },
    );
    return { txHash: `0x${'b'.repeat(64)}`, nftContractAddress: mockAddress, tokenId: 1 };
  }

  const factory      = getAssetNFTFactory();
  const assetIdBytes = toBytes32(assetId);

  // ── Idempotency check: asset may have been tokenized in a previous run ─────
  const existingNFTContract = await factory.deployedNFT(assetIdBytes);
  if (existingNFTContract && existingNFTContract !== ethers.ZeroAddress) {
    // Already minted on-chain — sync DB and treat as success
    console.warn(`⚠️  mintNFTStep: asset ${assetId} already tokenized at ${existingNFTContract}, skipping mint`);
    const existing = await Asset.findByPk(assetId, { attributes: ['nftTokenId'] });
    const tokenId  = existing?.nftTokenId || 0;
    await Asset.update(
      { nftContractAddress: existingNFTContract },   // don't overwrite tokenId if already saved
      { where: { id: assetId } },
    );
    return { txHash: null, nftContractAddress: existingNFTContract, tokenId, alreadyTokenized: true };
  }

  const tx      = await factory.deployAssetNFT(assetIdBytes, ipfsUri, ownerWallet);
  const receipt = await tx.wait(1);

  // parse AssetNFTDeployed event from receipt
  const event           = receipt.logs.find((l) => l.fragment?.name === 'AssetNFTDeployed');
  const nftContractAddress = event?.args?.nftContract || '';
  const tokenId            = Number(event?.args?.tokenId || 0);

  await Asset.update(
    { nftContractAddress, nftTokenId: tokenId },
    { where: { id: assetId } },
  );

  return { txHash: receipt.hash, nftContractAddress, tokenId };
}
