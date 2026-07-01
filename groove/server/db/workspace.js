const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { openDb } = require('./sqldb');

class WorkspaceDB {
  constructor(dataDir = './server/data') {
    this.db = openDb(path.join(dataDir, 'workspaces.db'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        owner_id TEXT NOT NULL, created_at INTEGER NOT NULL, archived_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, member_id TEXT NOT NULL,
        display_name TEXT NOT NULL, permission TEXT NOT NULL DEFAULT 'read',
        added_at INTEGER NOT NULL, removed_at INTEGER
      );
    `);
  }
  createWorkspace(name, description, ownerId) {
    const id = uuidv4();
    this.db.run(`INSERT INTO workspaces (id,name,description,owner_id,created_at) VALUES (?,?,?,?,?)`,
      [id, name, description||'', ownerId, Date.now()]);
    return id;
  }
  getWorkspace(id) { return this.db.get('SELECT * FROM workspaces WHERE id=? AND archived_at IS NULL', [id]); }
  addMember(workspaceId, memberId, displayName, permission='read') {
    const id = uuidv4();
    this.db.run(`INSERT INTO workspace_members (id,workspace_id,member_id,display_name,permission,added_at) VALUES (?,?,?,?,?,?)`,
      [id, workspaceId, memberId, displayName, permission, Date.now()]);
    return id;
  }
  getMembers(workspaceId) {
    return this.db.all('SELECT * FROM workspace_members WHERE workspace_id=? AND removed_at IS NULL', [workspaceId]);
  }
}

module.exports = { WorkspaceDB };
