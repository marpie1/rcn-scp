/**
 * routes/identity.js
 *
 * Identity registration and access grant management.
 * In a real deployment, secret keys never leave the client.
 * For this prototype, identity is managed server-side so we
 * can demonstrate the full flow without a client crypto layer.
 */

const express = require('express');
const router = express.Router();
const crypto = require('../crypto/identity');

let registry;

function setRegistry(r) { registry = r; }

// Register a new identity (generates keypair, returns full identity including secret keys)
// In production: key generation happens client-side; only public keys are registered.
router.post('/generate', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName) return res.status(400).json({ error: 'displayName required' });
    const identity = await crypto.generateIdentity(displayName);
    registry.registerIdentity(identity);
    res.json({ identity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search identities by display name (must be before /:id to avoid param capture)
router.get('/search', (req, res) => {
  const { name } = req.query;
  if (!name || !name.trim()) return res.json({ identities: [] });
  res.json({ identities: registry.searchIdentities(name.trim()) });
});

// Look up a registered identity by id (public info only)
router.get('/:id', (req, res) => {
  const identity = registry.getIdentity(req.params.id);
  if (!identity) return res.status(404).json({ error: 'Not found' });
  // Never return private keys via API
  res.json({
    id: identity.id,
    display_name: identity.display_name,
    box_public_key: identity.box_public_key,
    signing_public_key: identity.signing_public_key,
  });
});

// Grant workspace access to another person
// Body: { workspaceId, grantorId, granteeId, workspaceKey (optional), permission, expiresAt }
// workspaceId defaults to grantorId (identity = their health record)
// workspaceKey looked up server-side if not provided
router.post('/grant', async (req, res) => {
  try {
    const { grantorId, granteeId, workspaceKey: providedKey, permission, expiresAt } = req.body;
    let { workspaceId } = req.body;
    if (!workspaceId) workspaceId = grantorId;

    const grantee = registry.getIdentity(granteeId);
    if (!grantee) return res.status(404).json({ error: 'Grantee identity not found' });

    const workspaceKey = providedKey || registry.getOrCreateWorkspaceKey(workspaceId);
    const encryptedKey = await crypto.grantAccess(workspaceKey, grantee.box_public_key);
    const grantId = registry.recordGrant(
      workspaceId, grantorId, granteeId,
      grantee.display_name, encryptedKey,
      permission || 'read',
      expiresAt || null
    );
    registry.logAccess(workspaceId, grantorId, `granted ${permission || 'read'} to ${grantee.display_name}`);
    res.json({ grantId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a grant's access level and hidden pages
router.put('/grants/:grantId', (req, res) => {
  try {
    const { permission, hiddenPages } = req.body;
    registry.updateGrant(req.params.grantId, permission || 'view', hiddenPages || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revoke a grant
router.post('/revoke/:grantId', (req, res) => {
  try {
    registry.revokeGrant(req.params.grantId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List active grants for a workspace
router.get('/grants/:workspaceId', (req, res) => {
  const grants = registry.getActiveGrants(req.params.workspaceId);
  res.json({ grants });
});

// Access log for a workspace (visible to person of record)
router.get('/log/:workspaceId', (req, res) => {
  const log = registry.getAccessLog(req.params.workspaceId);
  res.json({ log });
});

module.exports = { router, setRegistry };
