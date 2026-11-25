const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class SecretVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretVaultError";
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new SecretVaultError("Vault key is not valid base64.");
  }
}

async function importVaultKey(encodedKey: string): Promise<CryptoKey> {
  const raw = fromBase64(encodedKey);
  if (raw.byteLength !== 32) {
    throw new SecretVaultError("Vault key must contain exactly 32 bytes.");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export interface EncryptedSecret {
  version: 1;
  algorithm: "AES-GCM";
  nonce: string;
  ciphertext: string;
}

/** Encrypts a Firebase refresh token before it is persisted. */
export async function encryptRefreshToken(
  refreshToken: string,
  base64Key: string,
): Promise<EncryptedSecret> {
  if (!refreshToken) throw new SecretVaultError("Refresh token is empty.");
  const key = await importVaultKey(base64Key);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: encoder.encode("cowila-firebase-refresh:v1") },
    key,
    encoder.encode(refreshToken),
  );
  return {
    version: 1,
    algorithm: "AES-GCM",
    nonce: toBase64(nonce),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/** Decrypts only the versioned token envelope created by encryptRefreshToken. */
export async function decryptRefreshToken(
  envelope: EncryptedSecret,
  base64Key: string,
): Promise<string> {
  if (envelope.version !== 1 || envelope.algorithm !== "AES-GCM") {
    throw new SecretVaultError("Unsupported encrypted secret format.");
  }
  const key = await importVaultKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(envelope.nonce),
      additionalData: encoder.encode("cowila-firebase-refresh:v1"),
    },
    key,
    fromBase64(envelope.ciphertext),
  );
  return decoder.decode(plaintext);
}
