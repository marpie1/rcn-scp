/**
 * server/index.js — Groove Workspace
 * sql.js must be initialised before any DB modules are used.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const { initDb } = require('./db/sqldb');

// Boot: initialise sql.js WASM, then start everything
initDb().then(() => {
  const { AccessRegistry } = require('./crypto/identity');
  const { WorkspaceDB } = require('./db/workspace');
  const identityRoutes = require('./routes/identity');
  const discussionRoutes = require('./routes/discussions');
  const pageRoutes = require('./routes/pages');

  const registry = new AccessRegistry(DATA_DIR);
  const workspaceDb = new WorkspaceDB(DATA_DIR);

  identityRoutes.setRegistry(registry);
  discussionRoutes.setDataDir(DATA_DIR);
  pageRoutes.setDataDir(DATA_DIR);

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  app.use('/api/identity', identityRoutes.router);
  app.use('/api/discussions', discussionRoutes.router);
  app.use('/api/pages', pageRoutes.router);

  app.post('/api/workspaces', (req, res) => {
    try {
      const { name, description, ownerId, ownerName } = req.body;
      if (!name || !ownerId) return res.status(400).json({ error: 'name and ownerId required' });
      const id = workspaceDb.createWorkspace(name, description, ownerId);
      workspaceDb.addMember(id, ownerId, ownerName||'Owner', 'owner');
      res.json({ workspaceId: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/workspaces/:id', (req, res) => {
    const ws = workspaceDb.getWorkspace(req.params.id);
    if (!ws) return res.status(404).json({ error: 'Not found' });
    res.json({ workspace: ws, members: workspaceDb.getMembers(req.params.id) });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Groove Workspace running at http://localhost:${PORT}`);
    console.log(`Data: ${DATA_DIR}`);
  });
}).catch(err => {
  console.error('Failed to initialise sql.js:', err);
  process.exit(1);
});
