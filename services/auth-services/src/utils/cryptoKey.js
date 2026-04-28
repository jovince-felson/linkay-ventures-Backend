export const base64ToPemPublicKey = (base64Key) => {
  if (!base64Key || typeof base64Key !== "string") {
    throw new Error("Invalid public key");
  }

  const formatted = base64Key.match(/.{1,64}/g).join("\n");

  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
};
