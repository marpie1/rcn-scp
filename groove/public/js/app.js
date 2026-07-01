/**
 * app.js — initializes and coordinates all UI modules
 */

const App = {
  async init() {
    IdentityUI.init();
    await this.loadTemplates();
    await this.loadPages();
    await this.loadDiscussions();

    document.getElementById('import-btn').addEventListener('click', () => this.importPage());
    document.getElementById('fedwiki-url').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.importPage();
    });
    document.getElementById('create-discussion-btn').addEventListener('click', () => this.createDiscussion());
    document.getElementById('discussion-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createDiscussion();
    });
  },

  // ── SCP Templates ────────────────────────────────────────────────────────

  async loadTemplates() {
    try {
      const { templates } = await API.listTemplates();
      const list = document.getElementById('templates-list');
      list.innerHTML = templates.length
        ? templates.map(t => `
            <li onclick="App.importTemplate('${t.slug}', '${this.escape(t.title)}')"
                title="Open or create your personal copy">
              📋 ${this.escape(t.title)}
            </li>`).join('')
        : '<li style="opacity:0.4;cursor:default">No templates found</li>';
    } catch (err) {
      console.error('loadTemplates', err);
    }
  },

  async importTemplate(slug, title) {
    try {
      const { pageId, existed } = await API.importTemplate(slug);
      if (!existed) await this.loadPages();
      this.openPage(pageId);
    } catch (err) {
      alert('Could not open template: ' + err.message);
    }
  },

  // ── Pages ────────────────────────────────────────────────────────────────

  async loadPages() {
    try {
      const { pages } = await API.listPages();
      const list = document.getElementById('pages-list');
      list.innerHTML = pages.length
        ? pages.map(p => `
            <li onclick="App.openPage('${p.id}')" title="${p.source_url || ''}">
              ${this.escape(p.title)}
            </li>`).join('')
        : '<li style="opacity:0.4;cursor:default">No pages yet</li>';
    } catch (err) {
      console.error('loadPages', err);
    }
  },

  async importPage() {
    const input = document.getElementById('fedwiki-url');
    const url = input.value.trim();
    if (!url) return;
    try {
      input.disabled = true;
      const { pageId, title } = await API.importPage(url);
      input.value = '';
      await this.loadPages();
      this.openPage(pageId);
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      input.disabled = false;
    }
  },

  async openPage(pageId) {
    document.getElementById('privacy-panel').classList.add('hidden');
    await PageViewer.display(pageId);
    // Highlight active
    document.querySelectorAll('#pages-list li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('#pages-list li').forEach(li => {
      if (li.getAttribute('onclick') && li.getAttribute('onclick').includes(pageId)) {
        li.classList.add('active');
      }
    });
    document.querySelectorAll('#discussions-list li').forEach(li => li.classList.remove('active'));
  },

  // ── Discussions ──────────────────────────────────────────────────────────

  async loadDiscussions() {
    try {
      const { discussions } = await API.listDiscussions();
      const list = document.getElementById('discussions-list');
      list.innerHTML = discussions.length
        ? discussions.map(d => `
            <li onclick="App.openDiscussion('${d.id}', '${this.escape(d.name)}')" title="${this.escape(d.name)}">
              💬 ${this.escape(d.name)}
            </li>`).join('')
        : '<li style="opacity:0.4;cursor:default">No discussions yet</li>';
    } catch (err) {
      console.error('loadDiscussions', err);
    }
  },

  async createDiscussion() {
    const input = document.getElementById('discussion-name');
    const name = input.value.trim();
    if (!name) return;
    try {
      const identity = IdentityUI.current;
      const { discussionId } = await API.createDiscussion(name, null, identity ? identity.id : null);
      input.value = '';
      await this.loadDiscussions();
      this.openDiscussion(discussionId, name);
    } catch (err) {
      alert('Failed to create discussion: ' + err.message);
    }
  },

  async openDiscussion(discussionId, name) {
    document.getElementById('privacy-panel').classList.add('hidden');
    await DiscussionUI.display(discussionId, name);
    document.querySelectorAll('#discussions-list li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('#discussions-list li').forEach(li => {
      if (li.getAttribute('onclick') && li.getAttribute('onclick').includes(discussionId)) {
        li.classList.add('active');
      }
    });
    document.querySelectorAll('#pages-list li').forEach(li => li.classList.remove('active'));
  },

  openPrivacy() {
    const identity = IdentityUI.current;
    if (!identity) {
      alert('Create an identity first to view your privacy summary.');
      return;
    }
    document.getElementById('welcome').classList.add('hidden');
    document.getElementById('main-panels').classList.add('hidden');
    document.getElementById('privacy-panel').classList.remove('hidden');
    document.querySelectorAll('#pages-list li, #discussions-list li').forEach(li => li.classList.remove('active'));
    PrivacyUI.display(identity.id);
  },

  escape(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
