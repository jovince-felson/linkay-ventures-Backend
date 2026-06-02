import { ethers } from 'ethers';

let _provider        = null;
let _signer          = null;
let _treasurySigner  = null;

export function getProvider() {
  if (!_provider) {
    const connection = new ethers.FetchRequest(process.env.RPC_URL);
    connection.timeout = 120000; // 2 minutes
    _provider = new ethers.JsonRpcProvider(connection, undefined, {
      polling: true,
      pollingInterval: 4000,
    });
  }
  return _provider;
}

export function getSigner() {
  if (!_signer) {
    _signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, getProvider());
  }
  return _signer;
}

export function getTreasurySigner() {
  if (!_treasurySigner) {
    _treasurySigner = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, getProvider());
  }
  return _treasurySigner;
}

// convert platform UUID to bytes32 for smart contract
export function toBytes32(uuid) {
  return ethers.keccak256(ethers.toUtf8Bytes(uuid));
}
