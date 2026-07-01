const express = require('express');
const router = express.Router();
const { DiscussionDB } = require('../db/discussion');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { openDb } = require('../db/sqldb');

let _dataDir = './server/data';
let _registryDb = null;

function setDataDir(d) { _dataDir = d; }

function getRegistry() {
  if (!_registryDb) {
    _registryDb = openDb(path.join(_dataDir, 'discussions-registry.db'));
    _registryDb.exec(`
      CREATE TABLE IF NOT EXISTS discussions (
        id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT NOT NULL,
        created_by TEXT, created_at INTEGER NOT NULL
      );
    `);
  }
  return _registryDb;
}

router.post('/', (req, res) => {
  try {
    const { name, workspaceId, createdBy } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuidv4();
    getRegistry().run(
      `INSERT INTO discussions (id,workspace_id,name,created_by,created_at) VALUES (?,?,?,?,?)`,
      [id, workspaceId||null, name, createdBy||'anonymous', Date.now()]
    );
    new DiscussionDB(id, _dataDir); // create db file
    res.json({ discussionId: id, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', (req, res) => {
  const { workspaceId } = req.query;
  const discussions = workspaceId
    ? getRegistry().all('SELECT * FROM discussions WHERE workspace_id=? ORDER BY created_at DESC', [workspaceId])
    : getRegistry().all('SELECT * FROM discussions ORDER BY created_at DESC');
  res.json({ discussions });
});

router.get('/:id/messages', (req, res) => {
  try {
    const db = new DiscussionDB(req.params.id, _dataDir);
    res.json({ messages: db.getMessages() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/messages', (req, res) => {
  try {
    const { authorId, authorName, content, parentId, pageReferences, writtenByOther } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });
    const db = new DiscussionDB(req.params.id, _dataDir);
    const msgId = db.postMessage(authorId||'anonymous', authorName||'Anonymous', content, parentId||null, pageReferences||[], writtenByOther||false);
    res.json({ messageId: msgId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { router, setDataDir };
