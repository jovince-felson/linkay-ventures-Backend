import { ethers }         from 'ethers';
import { getIssuerSigner } from './provider.js';
import IdentityRegistryABI from './abis/IdentityRegistry.json' with { type: 'json' };

export function getIdentityRegistry() {
  const address = process.env.IDENTITY_REGISTRY_ADDRESS;
  if (!address) throw new Error('IDENTITY_REGISTRY_ADDRESS is not set');
  return new ethers.Contract(address, IdentityRegistryABI, getIssuerSigner());
}
