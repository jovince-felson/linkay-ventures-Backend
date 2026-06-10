import { ethers } from 'ethers';

let _provider     = null;
let _issuerSigner = null;

export function getProvider() {
  if (!_provider) {
    const connection    = new ethers.FetchRequest(process.env.RPC_URL);
    connection.timeout  = 120000;
    _provider = new ethers.JsonRpcProvider(connection, undefined, {
      polling:         true,
      pollingInterval: 4000,
    });
  }
  return _provider;
}

export function getIssuerSigner() {
  if (!_issuerSigner) {
    const key = process.env.TRUSTED_ISSUER_PRIVATE_KEY;
    if (!key) throw new Error('TRUSTED_ISSUER_PRIVATE_KEY is not set');
    _issuerSigner = new ethers.Wallet(key, getProvider());
  }
  return _issuerSigner;
}
