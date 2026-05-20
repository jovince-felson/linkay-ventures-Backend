import axios from 'axios';
import Asset  from '../models/Asset.js';

const PINATA_URL     = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';
export async function ipfsStep(job) {
  const { assetId, imageUrl } = job;

  const asset = await Asset.findByPk(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const metadata = {
    name:        asset.title,
    description: asset.description || '',
    image:       imageUrl || '',
    external_url:`${process.env.PLATFORM_URL || ''}/assets/${assetId}`,
    attributes: [
      { trait_type: 'Asset Type',        value: asset.assetType },
      { trait_type: 'Valuation (USD)',   value: asset.valuation },
      { trait_type: 'Certification Ref', value: asset.certificationRef || '' },
      { trait_type: 'Jurisdiction',      value: asset.jurisdiction || '' },
      { trait_type: 'Total Fractions',   value: asset.totalFractions || 0 },
      { trait_type: 'Tokenized Percent', value: asset.tokenizedPercent || 0 },
      { trait_type: 'Royalty Percent',   value: asset.royaltyPercent || 0 },
    ],
  };

  const response = await axios.post(
    PINATA_URL,
    {
      pinataContent:  metadata,
      pinataMetadata: { name: `asset-${assetId}` },
    },
    {
      headers: {
        'Content-Type':          'application/json',
        'pinata_api_key':         process.env.PINATA_API_KEY,
        'pinata_secret_api_key':  process.env.PINATA_SECRET_API_KEY,
      },
      timeout: 30000,
    },
  );

  const cid     = response.data.IpfsHash;
  const ipfsUri = `ipfs://${cid}`;
  const httpUri = `${PINATA_GATEWAY}/${cid}`;

  await asset.update({ ipfsMetadataUri: httpUri });

  return { cid, uri: ipfsUri, httpUri };
}
