import { ethers } from 'ethers';

let _provider = null;
let _signer   = null;

export function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  }
  return _provider;
}

export function getSigner() {
  if (!_signer) {
    _signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, getProvider());
  }
  return _signer;
}

// convert platform UUID to bytes32 for smart contract
export function toBytes32(uuid) {
  return ethers.keccak256(ethers.toUtf8Bytes(uuid));
}
