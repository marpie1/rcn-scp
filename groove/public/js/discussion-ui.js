/**
 * discussion-ui.js
 * Renders threaded discussions with reply support.
 * Messages written by someone other than the person of record are
 * prominently marked (written_by_other flag).
 */

const DiscussionUI = {
  currentDiscussionId: null,
  replyingToId: null,
  replyingToAuthor: null,
  pinnedParagraph: null, // { pageId, pageTitle, itemId, itemText }
  pollInterval: null,

  async display(discussionId, discussionName) {
    this.currentDiscussionId = discussionId;
    this.replyingToId = null;

    const view = document.getElementById('discussion-view');
    const discussionPanel = document.getElementById('discussion-panel');
    const welcome = document.getElementById('welcome');
    const mainPanels = document.getElementById('main-panels');

    welcome.classList.add('hidden');
    mainPanels.classList.remove('hidden');
    discussionPanel.classList.remove('hidden');

    // If no page is loaded yet, show a prompt in the page panel
    if (!PageViewer.currentPageId) {
      document.getElementById('page-view').innerHTML =
        '<div class="loading" style="padding:60px;text-align:center;color:#aaa">Import a FedWiki page to read it alongside this discussion.</div>';
    }

    view.innerHTML = `
      <div class="discussion-container">
        <div class="discussion-header">
          <h2>${this.escape(discussionName || 'Discussion')}</h2>
        </div>
        <div class="messages-area" id="messages-area">
          <div class="loading">Loading messages…</div>
        </div>
        <div class="compose-area" id="compose-area">
          <div id="pinned-para-banner" class="pinned-para-banner hidden">
            <span class="para-text" id="pinned-para-text"></span>
            <button onclick="DiscussionUI.clearPinnedParagraph()">✕</button>
          </div>
          <div id="replying-to-banner" class="replying-to-banner hidden"></div>
          <textarea id="compose-text" placeholder="Write a message…"></textarea>
          <div class="compose-actions">
            <label>
              <input type="checkbox" id="written-by-other-check">
              Entry by someone else
            </label>
            <button class="send-btn" id="send-btn">Send</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
    document.getElementById('compose-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) this.sendMessage();
    });

    await this.loadMessages();

    // Poll for new messages every 5s
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.loadMessages(), 5000);
  },

  async loadMessages() {
    const area = document.getElementById('messages-area');
    if (!area) return;
    try {
      const { messages } = await API.getMessages(this.currentDiscussionId);
      const scrolledToBottom = area.scrollHeight - area.clientHeight <= area.scrollTop + 40;
      area.innerHTML = this.renderThread(messages, null);
      if (scrolledToBottom) area.scrollTop = area.scrollHeight;
    } catch (err) {
      area.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  },

  renderThread(messages, parentId) {
    const children = messages.filter(m => (m.parent_id || null) === parentId);
    if (!children.length) return parentId ? '' : '<div class="loading" style="padding:40px">No messages yet. Start the discussion.</div>';

    return children.map(m => {
      const replies = this.renderThread(messages, m.id);
      const replyBlock = replies ? `<div class="message-replies">${replies}</div>` : '';
      const otherBadge = m.written_by_other ? '<span class="other-badge">Entered by other</span>' : '';
      const refs = (m.pageReferences || []).map(r => {
        if (r.item_id && r.item_text) {
          return `<div class="msg-para-ref"
            onclick="PageViewer.jumpToItem('${r.page_id}', '${r.item_id}')">
            <span class="ref-page">📄 ${this.escape(r.page_title || r.page_id)}</span>
            "${this.escape(r.item_text)}"
          </div>`;
        }
        return `<span class="page-ref-tag" onclick="PageViewer.display('${r.page_id}')">📄 ${this.escape(r.page_title || r.page_id)}</span>`;
      }).join('');

      return `
        <div class="message ${m.written_by_other ? 'written-by-other' : ''}">
          <div class="message-meta">
            <span class="message-author">${this.escape(m.author_name)}</span>
            ${otherBadge}
            <span> · ${this.formatTime(m.created_at)}</span>
          </div>
          ${refs}
          <div class="message-content">${this.escape(m.content)}</div>
          <button class="reply-btn" onclick="DiscussionUI.setReplyTo('${m.id}', '${this.escape(m.author_name)}')">Reply</button>
          <button class="lift-btn" title="Add to page" onclick="PageViewer.liftContent(${JSON.stringify(m.content)}, '${this.escape(m.author_name)}')">↑ to page</button>
          ${replyBlock}
        </div>
      `;
    }).join('');
  },

  setReplyTo(messageId, authorName) {
    this.replyingToId = messageId;
    this.replyingToAuthor = authorName;
    const banner = document.getElementById('replying-to-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `Replying to <strong>${this.escape(authorName)}</strong> <button onclick="DiscussionUI.clearReplyTo()">✕</button>`;
    }
    document.getElementById('compose-text').focus();
  },

  clearReplyTo() {
    this.replyingToId = null;
    this.replyingToAuthor = null;
    const banner = document.getElementById('replying-to-banner');
    if (banner) banner.classList.add('hidden');
  },

  pinParagraph(ref) {
    this.pinnedParagraph = ref;
    const banner = document.getElementById('pinned-para-banner');
    const textEl = document.getElementById('pinned-para-text');
    if (banner && textEl) {
      textEl.textContent = `📄 ${ref.pageTitle} — "${ref.itemText}"`;
      banner.classList.remove('hidden');
    }
  },

  clearPinnedParagraph() {
    this.pinnedParagraph = null;
    const banner = document.getElementById('pinned-para-banner');
    if (banner) banner.classList.add('hidden');
    // Clear the pinned button and item highlight in the page viewer
    document.querySelectorAll('.item-btn.active').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.story-item.highlighted').forEach(el => el.classList.remove('highlighted'));
  },

  async sendMessage() {
    const textarea = document.getElementById('compose-text');
    const content = textarea.value.trim();
    if (!content) return;

    const writtenByOther = document.getElementById('written-by-other-check').checked;
    const identity = IdentityUI.current;

    const pageReferences = this.pinnedParagraph
      ? [{ pageId: this.pinnedParagraph.pageId, pageTitle: this.pinnedParagraph.pageTitle,
           itemId: this.pinnedParagraph.itemId, itemText: this.pinnedParagraph.itemText }]
      : [];

    try {
      await API.postMessage(this.currentDiscussionId, {
        authorId: identity ? identity.id : 'anonymous',
        authorName: identity ? identity.displayName : 'Anonymous',
        content,
        parentId: this.replyingToId,
        pageReferences,
        writtenByOther,
      });
      textarea.value = '';
      document.getElementById('written-by-other-check').checked = false;
      this.clearReplyTo();
      this.clearPinnedParagraph();
      await this.loadMessages();
    } catch (err) {
      alert('Failed to send: ' + err.message);
    }
  },

  formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  escape(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};

window.DiscussionUI = DiscussionUI;
