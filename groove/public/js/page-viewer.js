/**
 * page-viewer.js
 * Renders FedWiki pages with:
 *  - Tab bar for multiple open pages
 *  - Per-item toolbar: pin to message, edit inline, add paragraph after
 *  - Export link (server builds proper FedWiki JSON with journal)
 */

const PageViewer = {
  currentPageId: null,
  openPages: [], // [{ id, title }]

  // ── Tabs ──────────────────────────────────────────────────────────────────

  addTab(pageId, title) {
    if (!this.openPages.find(p => p.id === pageId)) {
      this.openPages.push({ id: pageId, title });
    }
    this.renderTabs();
  },

  renderTabs() {
    const bar = document.getElementById('page-tabs');
    if (this.openPages.length === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    bar.innerHTML = this.openPages.map(p => `
      <div class="page-tab ${p.id === this.currentPageId ? 'active' : ''}"
           onclick="PageViewer.switchTab('${p.id}')">
        <span>${this.escape(p.title)}</span>
        <button class="tab-close" title="Close"
          onclick="event.stopPropagation(); PageViewer.closeTab('${p.id}')">×</button>
      </div>
    `).join('');
  },

  switchTab(pageId) { this.display(pageId); },

  closeTab(pageId) {
    this.openPages = this.openPages.filter(p => p.id !== pageId);
    if (this.currentPageId === pageId) {
      if (this.openPages.length > 0) {
        this.display(this.openPages[this.openPages.length - 1].id);
      } else {
        this.currentPageId = null;
        document.getElementById('page-view').innerHTML = '';
        this.renderTabs();
      }
    } else {
      this.renderTabs();
    }
  },

  // ── Display ───────────────────────────────────────────────────────────────

  async display(pageId) {
    this.currentPageId = pageId;
    const view = document.getElementById('page-view');
    const welcome = document.getElementById('welcome');
    const mainPanels = document.getElementById('main-panels');

    welcome.classList.add('hidden');
    mainPanels.classList.remove('hidden');
    view.innerHTML = '<div class="loading">Loading page…</div>';

    try {
      const { page } = await API.getPage(pageId);
      this.addTab(pageId, page.title || page.slug);
      view.innerHTML = this.render(page);
    } catch (err) {
      view.innerHTML = `<div class="error-msg">Failed to load page: ${err.message}</div>`;
    }
  },

  render(page) {
    const json = page.raw_json;
    const story = json.story || [];
    const pageId = page.id;
    const pageTitle = json.title || page.title;

    let storyHtml = story.map(item => {
      const itemHtml = this.renderItem(item, pageId, pageTitle);
      const addRow = item.id
        ? `<div class="add-item-row">
             <button class="add-here-btn"
               onclick="PageViewer.showAddForm('${pageId}', '${item.id}')">+ add paragraph</button>
           </div>`
        : '';
      return itemHtml + addRow;
    }).join('');

    // "Add at end" when story is empty or as a final affordance
    storyHtml += `
      <div class="add-item-row" style="opacity:1;margin-top:8px">
        <button class="add-here-btn"
          onclick="PageViewer.showAddForm('${pageId}', null)">+ add paragraph at end</button>
      </div>`;

    return `
      <div class="page-container">
        <div class="page-header">
          <div>
            <h2>${this.escape(pageTitle)}</h2>
            <div class="source-url">${this.escape(page.source_url || '')}</div>
          </div>
          <a href="${API.exportPageUrl(page.id)}" class="export-btn" download>Export JSON</a>
        </div>
        <div class="page-story">${storyHtml}</div>
      </div>
    `;
  },

  renderItem(item, pageId, pageTitle) {
    if (!item) return '';
    const itemId = item.id || '';

    const toolbar = itemId ? `
      <div class="item-toolbar">
        <button class="item-btn" id="pin-${itemId}" title="Pin to message"
          onclick="PageViewer.pinItem('${pageId}', '${itemId}', this)">📌 pin</button>
        <button class="item-btn" title="Edit"
          onclick="PageViewer.startEdit('${pageId}', '${itemId}')">✏️ edit</button>
      </div>` : '';

    let inner = '';
    switch (item.type) {
      case 'paragraph':
        inner = `<div class="fedwiki-paragraph">${this.linkify(this.escape(item.text || ''))}</div>`;
        break;
      case 'markdown': {
        const rawMd = item.text || '';
        const rendered = (typeof marked !== 'undefined')
          ? marked.parse(rawMd)
          : `<pre>${this.escape(rawMd)}</pre>`;
        inner = `<div class="fedwiki-item fedwiki-markdown"
          data-raw="${this.escapeAttr(rawMd)}">${rendered}</div>`;
        break;
      }
      case 'html':
        inner = `<div class="fedwiki-item">${item.text || ''}</div>`;
        break;
      case 'image':
        inner = `<div class="fedwiki-item"><img src="${this.escape(item.url || '')}"
          alt="${this.escape(item.caption || '')}" style="max-width:100%"></div>`;
        break;
      case 'reference':
        inner = `<div class="fedwiki-item" style="border-left:3px solid #5b6af0;padding-left:12px">
          <strong>→ ${this.escape(item.title || '')}</strong><br>
          <small style="color:#6b7280">${this.escape(item.site || '')}</small>
        </div>`;
        break;
      case 'scp-field':
        inner = this.renderScpField(item);
        break;
      default:
        if (item.text) inner = `<div class="fedwiki-item">${this.escape(item.text)}</div>`;
    }

    if (!inner) return '';
    return `<div class="story-item" data-item-id="${itemId}"
      data-item-type="${item.type}">${toolbar}${inner}</div>`;
  },

  // ── Pin ───────────────────────────────────────────────────────────────────

  pinItem(pageId, itemId, btnEl) {
    const storyItem = btnEl.closest('.story-item');
    const textEl = storyItem.querySelector('.fedwiki-paragraph, .fedwiki-item');
    const itemText = textEl ? (textEl.textContent || '').trim().slice(0, 200) : '';
    const pageEntry = this.openPages.find(p => p.id === pageId);
    const pageTitle = pageEntry ? pageEntry.title : pageId;

    document.querySelectorAll('.item-btn.active').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.story-item.highlighted').forEach(el => el.classList.remove('highlighted'));
    btnEl.classList.add('active');
    btnEl.closest('.story-item').classList.add('highlighted');

    if (typeof DiscussionUI !== 'undefined') {
      DiscussionUI.pinParagraph({ pageId, pageTitle, itemId, itemText });
    }
  },

  // ── Inline edit ───────────────────────────────────────────────────────────

  startEdit(pageId, itemId) {
    const storyItem = document.querySelector(`.story-item[data-item-id="${itemId}"]`);
    if (!storyItem) return;
    const itemType = storyItem.dataset.itemType || 'paragraph';
    const contentEl = storyItem.querySelector('.fedwiki-paragraph, .fedwiki-item');
    // For markdown items read the stored raw source; for others use textContent
    const currentText = contentEl
      ? (contentEl.dataset.raw !== undefined ? contentEl.dataset.raw : contentEl.textContent.trim())
      : '';

    const isMarkdown = itemType === 'markdown';
    const previewHtml = isMarkdown && typeof marked !== 'undefined'
      ? marked.parse(currentText)
      : `<span style="white-space:pre-wrap">${this.escape(currentText)}</span>`;

    storyItem.innerHTML = `
      <div class="item-edit-form">
        <div class="edit-split">
          <div class="edit-pane">
            <div class="pane-label">Markdown</div>
            <textarea id="edit-ta-${itemId}"
              oninput="PageViewer.updatePreview('${itemId}', '${itemType}')"
              >${this.escapeAttr(currentText)}</textarea>
          </div>
          <div class="edit-pane">
            <div class="pane-label">Preview</div>
            <div class="edit-preview fedwiki-markdown" id="edit-preview-${itemId}">${previewHtml}</div>
          </div>
        </div>
        <div class="item-edit-actions">
          <button class="save-btn"
            onclick="PageViewer.saveEdit('${pageId}', '${itemId}')">Save</button>
          <button onclick="PageViewer.display('${pageId}')">Cancel</button>
        </div>
      </div>
    `;
    const ta = document.getElementById(`edit-ta-${itemId}`);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  },

  updatePreview(itemId, itemType) {
    const ta = document.getElementById(`edit-ta-${itemId}`);
    const preview = document.getElementById(`edit-preview-${itemId}`);
    if (!ta || !preview) return;
    if (itemType === 'markdown' && typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(ta.value);
    } else {
      preview.innerHTML = `<span style="white-space:pre-wrap">${this.escape(ta.value)}</span>`;
    }
  },

  async saveEdit(pageId, itemId) {
    const ta = document.getElementById(`edit-ta-${itemId}`);
    if (!ta) return;
    const text = ta.value;
    const identity = typeof IdentityUI !== 'undefined' ? IdentityUI.current : null;
    try {
      await API.updatePageItem(pageId, itemId, text, identity ? identity.displayName : 'anonymous');
      await this.display(pageId);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  },

  // ── Add paragraph after ───────────────────────────────────────────────────

  showAddForm(pageId, afterItemId) {
    // Remove any existing add form first
    const existing = document.getElementById('add-item-form');
    if (existing) existing.remove();

    const formId = 'add-item-form';
    const form = document.createElement('div');
    form.id = formId;
    form.className = 'add-item-form';
    form.innerHTML = `
      <textarea id="add-item-ta" placeholder="New paragraph…"></textarea>
      <div class="item-edit-actions">
        <button class="save-btn"
          onclick="PageViewer.saveAddItem('${pageId}', ${afterItemId ? `'${afterItemId}'` : 'null'})">Add</button>
        <button onclick="PageViewer.display('${pageId}')">Cancel</button>
      </div>
    `;

    if (afterItemId) {
      const ref = document.querySelector(`.story-item[data-item-id="${afterItemId}"]`);
      const addRow = ref ? ref.nextElementSibling : null;
      if (addRow && addRow.classList.contains('add-item-row')) {
        addRow.after(form);
      } else if (ref) {
        ref.after(form);
      }
    } else {
      // Add at end
      const story = document.querySelector('.page-story');
      if (story) story.appendChild(form);
    }

    const ta = document.getElementById('add-item-ta');
    if (ta) ta.focus();
  },

  async saveAddItem(pageId, afterItemId) {
    const ta = document.getElementById('add-item-ta');
    if (!ta || !ta.value.trim()) return;
    const identity = typeof IdentityUI !== 'undefined' ? IdentityUI.current : null;
    try {
      await API.addPageItem(pageId, ta.value.trim(), afterItemId, identity ? identity.displayName : 'anonymous');
      await this.display(pageId);
    } catch (err) {
      alert('Add failed: ' + err.message);
    }
  },

  // ── Lift message content into this page ───────────────────────────────────

  async liftContent(text, authorName) {
    if (!this.currentPageId) {
      alert('Open a FedWiki page first, then lift a message into it.');
      return;
    }
    try {
      await API.addPageItem(this.currentPageId, text, null, authorName);
      await this.display(this.currentPageId);
    } catch (err) {
      alert('Lift failed: ' + err.message);
    }
  },

  // ── Jump to item (from message paragraph ref) ─────────────────────────────

  async jumpToItem(pageId, itemId) {
    if (this.currentPageId !== pageId) await this.display(pageId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`.story-item[data-item-id="${itemId}"]`);
      if (!el) return;
      document.querySelectorAll('.story-item.highlighted').forEach(e => e.classList.remove('highlighted'));
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlighted');
    });
  },

  // ── scp-field renderer (read-only display in Groove) ─────────────────────
  // Editing scp-field items happens in FedWiki directly.

  renderScpField(item) {
    const label = this.escape(item.label || item.field || '');
    const hint  = item.hint ? `<div class="scp-hint">${this.escape(item.hint)}</div>` : '';
    const widget = this.renderScpWidget(item);
    const comments = ('comments' in item && item.comments)
      ? `<div class="scp-comments-ro"><span class="scp-comments-label">Comments:</span> ${this.escape(item.comments)}</div>`
      : '';
    return `<div class="fedwiki-item scp-field-ro">
      <div class="scp-label">${label}</div>
      ${hint}
      <div class="scp-widget-ro">${widget}</div>
      ${comments}
    </div>`;
  },

  renderScpWidget(item) {
    switch (item.widget) {
      case 'select':
        return `<span class="scp-value-pill">${this.escape(item.value || '—')}</span>`;
      case 'multiselect': {
        const values = Array.isArray(item.value) ? item.value : [];
        if (!values.length) return '<span class="scp-value-empty">None selected</span>';
        return values.map(v =>
          `<span class="scp-value-pill">${this.escape(v)}</span>`
        ).join(' ');
      }
      case 'toggle':
        return `<span class="scp-value-pill ${item.value ? 'scp-yes' : 'scp-no'}">${item.value ? 'Yes' : 'No'}</span>`;
      default: // textarea
        return `<div class="scp-value-text">${this.escape(item.value || '')}</div>`;
    }
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  linkify(text) {
    return text.replace(/\[\[(.+?)\]\]/g, '<span style="color:#5b6af0;cursor:pointer">$1</span>');
  },

  escape(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  escapeAttr(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

window.PageViewer = PageViewer;
