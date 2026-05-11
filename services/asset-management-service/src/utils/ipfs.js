import axios from 'axios';

const PINATA_API_URL  = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_GATEWAY  = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

export async function uploadMetadataToIPFS(metadata) {
  const response = await axios.post(
    PINATA_API_URL,
    {
      pinataContent: metadata,
      pinataMetadata: {
        name: `asset-${metadata.name || Date.now()}`,
      },
    },
    {
      headers: {
        'Content-Type':     'application/json',
        'pinata_api_key':    process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY,
      },
    },
  );

  const cid = response.data.IpfsHash;
  return {
    ipfsCid:     cid,
    metadataUrl: `${PINATA_GATEWAY}/${cid}`,
  };
}

export function buildAssetMetadata(asset, ownershipSplit, mediaUrl) {
  const attributes = (asset.dynamicFields || []).map((f) => ({
    trait_type: f.fieldLabel,
    value:      f.fieldValue,
  }));

  return {
    name:        asset.title,
    description: asset.description,
    image:       mediaUrl,
    external_url: `${process.env.PLATFORM_URL || ''}/assets/${asset.id}`,
    attributes,
    ownershipSplit: {
      museum:    ownershipSplit.museum    ?? 0,
      investors: ownershipSplit.investors ?? 0,
    },
    assetType:   asset.assetType,
    createdAt:   asset.createdAt,
  };
}
