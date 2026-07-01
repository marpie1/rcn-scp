const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { openDb } = require('./sqldb');

class DiscussionDB {
  constructor(discussionId, dataDir = './server/data') {
    this.db = openDb(path.join(dataDir, `discussion-${discussionId}.db`));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, parent_id TEXT, author_id TEXT NOT NULL,
        author_name TEXT NOT NULL, content TEXT NOT NULL,
        written_by_other INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL, edited_at INTEGER, deleted_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS page_references (
        id TEXT PRIMARY KEY, message_id TEXT NOT NULL,
        page_id TEXT NOT NULL, page_title TEXT,
        item_id TEXT, item_text TEXT,
        created_at INTEGER NOT NULL
      );
    `);
    // Migrate existing DBs that predate item_id/item_text columns
    try { this.db.run('ALTER TABLE page_references ADD COLUMN item_id TEXT'); } catch(e) {}
    try { this.db.run('ALTER TABLE page_references ADD COLUMN item_text TEXT'); } catch(e) {}
  }

  postMessage(authorId, authorName, content, parentId=null, pageReferences=[], writtenByOther=false) {
    const id = uuidv4();
    const now = Date.now();
    this.db.run(
      `INSERT INTO messages (id,parent_id,author_id,author_name,content,written_by_other,created_at) VALUES (?,?,?,?,?,?,?)`,
      [id, parentId, authorId, authorName, content, writtenByOther?1:0, now]
    );
    for (const ref of pageReferences) {
      this.db.run(
        `INSERT INTO page_references (id,message_id,page_id,page_title,item_id,item_text,created_at) VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), id, ref.pageId, ref.pageTitle||'', ref.itemId||null, ref.itemText||null, now]
      );
    }
    return id;
  }

  getMessages() {
    const messages = this.db.all(`SELECT * FROM messages WHERE deleted_at IS NULL ORDER BY created_at ASC`);
    const refs = this.db.all('SELECT * FROM page_references');
    const refsByMsg = {};
    for (const r of refs) {
      if (!refsByMsg[r.message_id]) refsByMsg[r.message_id] = [];
      refsByMsg[r.message_id].push(r);
    }
    return messages.map(m => ({ ...m, written_by_other: !!m.written_by_other, pageReferences: refsByMsg[m.id]||[] }));
  }
}

module.exports = { DiscussionDB };
