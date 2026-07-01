/**
 * identity-ui.js
 * Manages local identity (stored in localStorage for prototype).
 * Production: key material lives only in the browser, never sent to server.
 */

const IdentityUI = {
  identity: null,

  init() {
    const stored = localStorage.getItem('groove-identity');
    if (stored) {
      this.identity = JSON.parse(stored);
      this.render();
    }
    document.getElementById('create-identity-btn').addEventListener('click', () => this.create());
    document.getElementById('identity-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.create();
    });
  },

  async create() {
    const name = document.getElementById('identity-name').value.trim();
    if (!name) return;
    try {
      const { identity } = await API.createIdentity(name);
      this.identity = identity;
      localStorage.setItem('groove-identity', JSON.stringify(identity));
      this.render();
      document.getElementById('identity-name').value = '';
    } catch (err) {
      alert('Could not create identity: ' + err.message);
    }
  },

  render() {
    const el = document.getElementById('current-identity');
    if (!this.identity) {
      el.innerHTML = '<span class="no-identity">No identity</span>';
      return;
    }
    el.innerHTML = `
      <div class="identity-name">${this.escape(this.identity.displayName)}</div>
      <div class="identity-id">${this.identity.id.slice(0, 12)}…</div>
    `;
  },

  get current() { return this.identity; },

  escape(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
};

window.IdentityUI = IdentityUI;
