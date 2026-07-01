/**
 * identity.js — libsodium identity and encryption, sql.js for registry
 */
const sodium = require('libsodium-wrappers');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { openDb } = require('../db/sqldb');

let _ready = false;
async function ensureReady() {
  if (!_ready) { await sodium.ready; _ready = true; }
}

async function generateIdentity(displayName) {
  await ensureReady();
  const signingKeys = sodium.crypto_sign_keypair();
  const boxKeys = sodium.crypto_box_keypair();
  return {
    id: sodium.to_hex(sodium.crypto_generichash(16, signingKeys.publicKey)),
    displayName,
    signing: { publicKey: sodium.to_hex(signingKeys.publicKey), secretKey: sodium.to_hex(signingKeys.privateKey) },
    box: { publicKey: sodium.to_hex(boxKeys.publicKey), secretKey: sodium.to_hex(boxKeys.privateKey) },
  };
}

async function generateWorkspaceKey() {
  await ensureReady();
  return sodium.to_hex(sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES));
}

async function sign(message, secretKeyHex) {
  await ensureReady();
  const msgBytes = typeof message === 'string' ? sodium.from_string(message) : message;
  return sodium.to_hex(sodium.crypto_sign_detached(msgBytes, sodium.from_hex(secretKeyHex)));
}

async function verify(message, signatureHex, publicKeyHex) {
  await ensureReady();
  const msgBytes = typeof message === 'string' ? sodium.from_string(message) : message;
  return sodium.crypto_sign_verify_detached(sodium.from_hex(signatureHex), msgBytes, sodium.from_hex(publicKeyHex));
}

async function grantAccess(workspaceKeyHex, recipientBoxPublicKeyHex) {
  await ensureReady();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ephemeral = sodium.crypto_box_keypair();
  const ciphertext = sodium.crypto_box_easy(
    sodium.from_hex(workspaceKeyHex), nonce,
    sodium.from_hex(recipientBoxPublicKeyHex), ephemeral.privateKey
  );
  return { nonce: sodium.to_hex(nonce), ephemeralPublicKey: sodium.to_hex(ephemeral.publicKey), ciphertext: sodium.to_hex(ciphertext) };
}

async function openGrant(grant, recipientBoxSecretKeyHex) {
  await ensureReady();
  const wsKey = sodium.crypto_box_open_easy(
    sodium.from_hex(grant.ciphertext), sodium.from_hex(grant.nonce),
    sodium.from_hex(grant.ephemeralPublicKey), sodium.from_hex(recipientBoxSecretKeyHex)
  );
  if (!wsKey) throw new Error('Failed to open grant');
  return sodium.to_hex(wsKey);
}

async function encryptData(plaintext, workspaceKeyHex) {
  await ensureReady();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const msg = typeof plaintext === 'string' ? sodium.from_string(plaintext) : plaintext;
  return { nonce: sodium.to_hex(nonce), ciphertext: sodium.to_hex(sodium.crypto_secretbox_easy(msg, nonce, sodium.from_hex(workspaceKeyHex))) };
}

async function decryptData(encrypted, workspaceKeyHex) {
  await ensureReady();
  const plaintext = sodium.crypto_secretbox_open_easy(
    sodium.from_hex(encrypted.ciphertext), sodium.from_hex(encrypted.nonce), sodium.from_hex(workspaceKeyHex)
  );
  if (!plaintext) throw new Error('Decryption failed');
  return sodium.to_string(plaintext);
}

class AccessRegistry {
  constructor(dataDir = './server/data') {
    this.db = openDb(path.join(dataDir, 'access-registry.db'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS grants (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, grantor_id TEXT NOT NULL,
        grantee_id TEXT NOT NULL, grantee_display_name TEXT NOT NULL,
        encrypted_key TEXT NOT NULL, permission TEXT NOT NULL DEFAULT 'read',
        granted_at INTEGER NOT NULL, expires_at INTEGER, revoked_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS identities (
        id TEXT PRIMARY KEY, display_name TEXT NOT NULL,
        box_public_key TEXT NOT NULL, signing_public_key TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS access_log (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
        accessor_id TEXT NOT NULL, action TEXT NOT NULL, timestamp INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_keys (
        identity_id TEXT PRIMARY KEY, key_hex TEXT NOT NULL, created_at INTEGER NOT NULL
      );
    `);
    // Migrations for older DBs
    try { this.db.run('ALTER TABLE grants ADD COLUMN hidden_pages TEXT DEFAULT "[]"'); } catch(e) {}
  }
  registerIdentity(identity) {
    this.db.run(
      `INSERT OR REPLACE INTO identities (id,display_name,box_public_key,signing_public_key,created_at) VALUES (?,?,?,?,?)`,
      [identity.id, identity.displayName, identity.box.publicKey, identity.signing.publicKey, Date.now()]
    );
  }
  getIdentity(id) { return this.db.get('SELECT * FROM identities WHERE id=?', [id]); }
  searchIdentities(name) {
    return this.db.all(
      `SELECT id, display_name FROM identities WHERE display_name LIKE ? LIMIT 10`,
      [`%${name}%`]
    );
  }
  getOrCreateWorkspaceKey(identityId) {
    let row = this.db.get('SELECT key_hex FROM workspace_keys WHERE identity_id=?', [identityId]);
    if (!row) {
      const nodeCrypto = require('crypto');
      const key = nodeCrypto.randomBytes(32).toString('hex');
      this.db.run('INSERT INTO workspace_keys (identity_id,key_hex,created_at) VALUES (?,?,?)', [identityId, key, Date.now()]);
      row = { key_hex: key };
    }
    return row.key_hex;
  }
  recordGrant(workspaceId, grantorId, granteeId, granteeDisplayName, encryptedKey, permission, expiresAt) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO grants (id,workspace_id,grantor_id,grantee_id,grantee_display_name,encrypted_key,permission,granted_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, workspaceId, grantorId, granteeId, granteeDisplayName, JSON.stringify(encryptedKey), permission, Date.now(), expiresAt||null]
    );
    return id;
  }
  revokeGrant(grantId) { this.db.run('UPDATE grants SET revoked_at=? WHERE id=?', [Date.now(), grantId]); }
  updateGrant(grantId, permission, hiddenPages) {
    this.db.run(
      'UPDATE grants SET permission=?, hidden_pages=? WHERE id=?',
      [permission, JSON.stringify(hiddenPages || []), grantId]
    );
  }
  getActiveGrants(workspaceId) {
    return this.db.all(`SELECT * FROM grants WHERE workspace_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)`, [workspaceId, Date.now()]);
  }
  logAccess(workspaceId, accessorId, action) {
    this.db.run(`INSERT INTO access_log (id,workspace_id,accessor_id,action,timestamp) VALUES (?,?,?,?,?)`, [uuidv4(), workspaceId, accessorId, action, Date.now()]);
  }
  getAccessLog(workspaceId) {
    return this.db.all(`SELECT l.*,i.display_name FROM access_log l LEFT JOIN identities i ON l.accessor_id=i.id WHERE l.workspace_id=? ORDER BY l.timestamp DESC`, [workspaceId]);
  }
}

module.exports = { generateIdentity, generateWorkspaceKey, sign, verify, grantAccess, openGrant, encryptData, decryptData, AccessRegistry };
