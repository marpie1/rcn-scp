/**
 * routes/pages.js
 * Import, view, edit, and export FedWiki pages.
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { FedWikiPageDB } = require('../db/fedwiki-page');

// SCP template pages live at ../../scp-pages/ relative to this file
const SCP_PAGES_DIR = path.resolve(__dirname, '../../..', 'scp-pages');

let _dataDir = './server/data';
function setDataDir(d) { _dataDir = d; }
function getDb() { return new FedWikiPageDB(_dataDir); }

// List available SCP template pages
router.get('/templates', (req, res) => {
  try {
    if (!fs.existsSync(SCP_PAGES_DIR)) return res.json({ templates: [] });
    const files = fs.readdirSync(SCP_PAGES_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      const slug = f.replace('.json', '');
      try {
        const json = JSON.parse(fs.readFileSync(path.join(SCP_PAGES_DIR, f), 'utf-8'));
        return { slug, title: json.title || slug };
      } catch(e) { return { slug, title: slug }; }
    });
    res.json({ templates });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import a SCP template as a personal copy (non-destructive — existing copy is preserved)
router.post('/import-template', (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'slug required' });
    const filePath = path.join(SCP_PAGES_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Template not found' });
    const { pageId, title, existed } = getDb().importTemplate(slug, JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    res.json({ pageId, title, slug, existed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import a page from a FedWiki URL
router.post('/import', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    const parsed = new URL(url);
    const slug = parsed.pathname.replace(/^\//, '').replace(/^view\//, '').replace(/\.json$/, '');
    const jsonUrl = `${parsed.protocol}//${parsed.host}/${slug}.json`;
    const response = await fetch(jsonUrl, { headers: { Accept: 'application/json' }, timeout: 10000 });
    if (!response.ok) return res.status(502).json({ error: `FedWiki returned ${response.status}` });
    const pageJson = await response.json();
    const title = pageJson.title || slug;
    const pageId = getDb().upsertPage(url, title, slug, pageJson);
    res.json({ pageId, title, slug });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List all imported pages
router.get('/', (req, res) => {
  res.json({ pages: getDb().listPages() });
});

// Get a specific page
router.get('/:id', (req, res) => {
  const page = getDb().getPage(req.params.id);
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json({ page });
});

// Export page as FedWiki JSON with full journal (including local edits)
router.get('/:id/export', (req, res) => {
  const json = getDb().buildExportJson(req.params.id);
  if (!json) return res.status(404).json({ error: 'Not found' });
  const page = getDb().getPage(req.params.id);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${page.slug || page.id}.json"`);
  res.json(json);
});

// Edit an existing story item
router.put('/:id/items/:itemId', (req, res) => {
  const { text, authorName } = req.body;
  if (text === undefined) return res.status(400).json({ error: 'text required' });
  const ok = getDb().updateItem(req.params.id, req.params.itemId, text, authorName);
  if (!ok) return res.status(404).json({ error: 'Page or item not found' });
  res.json({ ok: true });
});

// Add a new story item (after a given item, or at end)
router.post('/:id/items', (req, res) => {
  const { text, afterItemId, authorName } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const itemId = getDb().addItem(req.params.id, text, afterItemId || null, authorName);
  if (!itemId) return res.status(404).json({ error: 'Page not found' });
  res.json({ itemId });
});

// Delete a page
router.delete('/:id', (req, res) => {
  getDb().deletePage(req.params.id);
  res.json({ ok: true });
});

module.exports = { router, setDataDir };
