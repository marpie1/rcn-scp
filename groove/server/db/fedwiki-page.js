const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { openDb } = require('./sqldb');

class FedWikiPageDB {
  constructor(dataDir = './server/data') {
    this.db = openDb(path.join(dataDir, 'fedwiki-pages.db'));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source_url TEXT,
        slug TEXT, raw_json TEXT NOT NULL, imported_at INTEGER NOT NULL, updated_at INTEGER
      );
    `);
    // Migrate: add journal_additions column if not present
    try { this.db.run("ALTER TABLE pages ADD COLUMN journal_additions TEXT DEFAULT '[]'"); } catch(e) {}
  }

  upsertPage(sourceUrl, title, slug, rawJson) {
    const existing = this.db.get('SELECT id FROM pages WHERE source_url=?', [sourceUrl]);
    if (existing) {
      this.db.run(`UPDATE pages SET title=?,raw_json=?,updated_at=? WHERE id=?`,
        [title, JSON.stringify(rawJson), Date.now(), existing.id]);
      return existing.id;
    } else {
      const id = uuidv4();
      this.db.run(`INSERT INTO pages (id,title,source_url,slug,raw_json,journal_additions,imported_at) VALUES (?,?,?,?,?,?,?)`,
        [id, title, sourceUrl, slug, JSON.stringify(rawJson), '[]', Date.now()]);
      return id;
    }
  }

  getPage(id) {
    const row = this.db.get('SELECT * FROM pages WHERE id=?', [id]);
    if (!row) return null;
    return {
      ...row,
      raw_json: JSON.parse(row.raw_json),
      journal_additions: JSON.parse(row.journal_additions || '[]'),
    };
  }

  listPages() {
    return this.db.all('SELECT id,title,source_url,slug,imported_at,updated_at FROM pages ORDER BY imported_at DESC');
  }

  deletePage(id) { this.db.run('DELETE FROM pages WHERE id=?', [id]); }

  // Import a SCP template as a personal copy — never overwrites an existing copy
  importTemplate(slug, pageJson) {
    const sourceUrl = `scp-template://${slug}`;
    const existing = this.db.get('SELECT id, title FROM pages WHERE source_url=?', [sourceUrl]);
    if (existing) return { pageId: existing.id, title: existing.title, existed: true };
    const id = uuidv4();
    this.db.run(
      `INSERT INTO pages (id,title,source_url,slug,raw_json,journal_additions,imported_at) VALUES (?,?,?,?,?,?,?)`,
      [id, pageJson.title, sourceUrl, slug, JSON.stringify(pageJson), '[]', Date.now()]
    );
    return { pageId: id, title: pageJson.title, existed: false };
  }

  // ── Editing ──────────────────────────────────────────────────────────────

  updateItem(pageId, itemId, newText, authorName) {
    const page = this.getPage(pageId);
    if (!page) return false;
    const json = page.raw_json;
    const item = json.story.find(i => i.id === itemId);
    if (!item) return false;
    item.text = newText;
    const entry = { type: 'edit', id: itemId, item: { ...item }, date: Date.now(), author: authorName || 'anonymous' };
    const additions = [...page.journal_additions, entry];
    this.db.run('UPDATE pages SET raw_json=?, journal_additions=?, updated_at=? WHERE id=?',
      [JSON.stringify(json), JSON.stringify(additions), Date.now(), pageId]);
    return true;
  }

  addItem(pageId, text, afterItemId, authorName) {
    const page = this.getPage(pageId);
    if (!page) return null;
    const json = page.raw_json;
    // FedWiki item ids are 16 hex chars
    const newItem = { type: 'paragraph', id: uuidv4().replace(/-/g, '').slice(0, 16), text };
    if (afterItemId) {
      const idx = json.story.findIndex(i => i.id === afterItemId);
      json.story.splice(idx >= 0 ? idx + 1 : json.story.length, 0, newItem);
    } else {
      json.story.push(newItem);
    }
    const entry = { type: 'add', id: newItem.id, after: afterItemId || null, item: { ...newItem }, date: Date.now(), author: authorName || 'anonymous' };
    const additions = [...page.journal_additions, entry];
    this.db.run('UPDATE pages SET raw_json=?, journal_additions=?, updated_at=? WHERE id=?',
      [JSON.stringify(json), JSON.stringify(additions), Date.now(), pageId]);
    return newItem.id;
  }

  // ── Export ───────────────────────────────────────────────────────────────

  buildExportJson(pageId) {
    const page = this.getPage(pageId);
    if (!page) return null;
    const json = { ...page.raw_json };
    if (page.journal_additions.length > 0) {
      json.journal = [...(json.journal || []), ...page.journal_additions];
    }
    return json;
  }
}

module.exports = { FedWikiPageDB };
