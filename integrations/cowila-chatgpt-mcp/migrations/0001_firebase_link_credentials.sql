-- Stores only encrypted Firebase refresh-token envelopes.
-- Plaintext tokens, Google credentials, ID tokens and conversation content never belong here.
CREATE TABLE IF NOT EXISTS firebase_link_credentials (
  firebase_uid TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL CHECK (email = 'antonyopintor@gmail.com'),
  vault_version INTEGER NOT NULL CHECK (vault_version = 1),
  vault_algorithm TEXT NOT NULL CHECK (vault_algorithm = 'AES-GCM'),
  vault_nonce TEXT NOT NULL,
  vault_ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_firebase_link_credentials_active
  ON firebase_link_credentials(firebase_uid, revoked_at);
