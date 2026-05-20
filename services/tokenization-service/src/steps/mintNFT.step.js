import Asset               from '../models/Asset.js';
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
