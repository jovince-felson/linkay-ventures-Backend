import { ethers }    from 'ethers';
import { getSigner } from './provider.js';
import AssetNFTFactoryABI        from './abis/AssetNFTFactory.json'        assert { type: 'json' };
import FractionalTokenFactoryABI from './abis/FractionalTokenFactory.json' assert { type: 'json' };
import ComplianceModuleABI       from './abis/ComplianceModule.json'       assert { type: 'json' };

export function getAssetNFTFactory() {
  return new ethers.Contract(
    process.env.ASSET_NFT_FACTORY_ADDRESS,
    AssetNFTFactoryABI,
    getSigner(),
  );
}

export function getFractionalTokenFactory() {
  return new ethers.Contract(
    process.env.FRACTIONAL_TOKEN_FACTORY_ADDRESS,
    FractionalTokenFactoryABI,
    getSigner(),
  );
}

export function getComplianceModule() {
  return new ethers.Contract(
    process.env.COMPLIANCE_MODULE_ADDRESS,
    ComplianceModuleABI,
    getSigner(),
  );
}
