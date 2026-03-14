import { createPublicKey, verify } from "node:crypto";

export interface VerifyDiscordSignatureInput {
  publicKeyHex: string;
  signatureHex: string;
  timestamp: string;
  rawBody: string;
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[\da-fA-F]+$/.test(value) || value.length % 2 !== 0) {
    return new Uint8Array();
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
  }
  return bytes;
}

function ed25519SpkiFromRawPublicKey(rawPublicKey: Uint8Array): Buffer {
  // ASN.1 SPKI header for Ed25519 public key (RFC 8410), followed by 32 raw key bytes.
  const header = Buffer.from("302a300506032b6570032100", "hex");
  return Buffer.concat([header, Buffer.from(rawPublicKey)]);
}

export function verifyDiscordSignature(
  input: VerifyDiscordSignatureInput
): boolean {
  const publicKey = hexToBytes(input.publicKeyHex);
  const signature = hexToBytes(input.signatureHex);
  if (publicKey.length !== 32 || signature.length !== 64) {
    return false;
  }

  const signedMessage = Buffer.from(`${input.timestamp}${input.rawBody}`, "utf8");
  const publicKeyObject = createPublicKey({
    key: ed25519SpkiFromRawPublicKey(publicKey),
    format: "der",
    type: "spki"
  });

  return verify(
    null,
    signedMessage,
    publicKeyObject,
    Buffer.from(signature)
  );
}
