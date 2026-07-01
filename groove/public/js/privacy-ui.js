/**
 * privacy-ui.js
 * Privacy Summary panel — permission grid modeled on SCP 1.0.
 *
 * Rows = Care Team Members who have been granted access.
 * Columns = Access Level + one per SCP page section.
 * Checkboxes = hide that section from that person.
 *
 * NOTE: Access controls are recorded but not yet enforced.
 */

const PrivacyUI = {
  identityId: null,

  SCP_PAGES: [
    { slug: 'about-me',            label: 'About Me' },
    { slug: 'care-team',           label: 'Care Team' },
    { slug: 'diagnoses',           label: 'Diagnoses' },
    { slug: 'medications',         label: 'Medications' },
    { slug: 'reactions',           label: 'Reactions' },
    { slug: 'history',             label: 'History' },
    { slug: 'next-steps',          label: 'Next Steps' },
    { slug: 'health-log',          label: 'Health Log' },
    { slug: 'advanced-directives', label: 'Adv. Dir.' },
  ],

  async display(identityId) {
    this.identityId = identityId;
    const panel = document.getElementById('privacy-panel');
    panel.innerHTML = '<div class="loading">Loading privacy summary…</div>';
    try {
      const [{ grants }, { log }] = await Promise.all([
        API.getGrants(identityId),
        API.getAccessLog(identityId),
      ]);
      panel.innerHTML = this.render(grants, log);
    } catch (err) {
      panel.innerHTML = `<div class="error-msg">Failed to load: ${err.message}</div>`;
    }
  },

  render(grants, log) {
    return `
      <div class="privacy-container">

        <div class="privacy-header">
          <h2>Privacy Summary</h2>
          <div class="privacy-notice">
            <strong>Note:</strong> Access settings are recorded here but not yet enforced.
            This panel is for review and feedback.
          </div>
        </div>

        <section class="privacy-section">
          <p class="privacy-section-desc">
            Each row is a person who has access to your Shared Care Plan.
            Use the <strong>Access Level</strong> column to set overall access.
            Check a section box to <strong>hide that section</strong> from that person.
          </p>

          ${grants.length === 0
            ? '<p class="privacy-empty">No care team members have been given access yet. Use the Grant Access form below to add someone.</p>'
            : this.renderTable(grants)
          }

          ${grants.length > 0 ? `
            <div class="save-row">
              <button class="save-changes-btn hidden" id="save-changes-btn"
                onclick="PrivacyUI.saveAll()">Save Changes</button>
              <span class="save-confirm hidden" id="save-confirm">✓ Saved</span>
            </div>
          ` : ''}
        </section>

        <section class="privacy-section">
          <h3>Grant Access</h3>
          <p class="privacy-section-desc">
            Search for a person by name to add them to your Care Team.
          </p>
          <div class="grant-form-inline">
            <input type="text" id="grant-search-input"
              placeholder="Type a name to search…"
              autocomplete="off"
              oninput="PrivacyUI.onSearchInput(this.value)" />
            <div id="grant-results" class="grant-results hidden"></div>
          </div>
        </section>

        <section class="privacy-section">
          <h3>Activity Log</h3>
          <p class="privacy-section-desc">Recent access events for your health record.</p>
          ${log.length === 0
            ? '<p class="privacy-empty">No activity recorded yet.</p>'
            : `<ul class="access-log-list">${log.map(e => this.renderLogEntry(e)).join('')}</ul>`
          }
        </section>

      </div>
    `;
  },

  renderTable(grants) {
    const pageHeaders = this.SCP_PAGES.map(p =>
      `<th class="page-col"><span class="page-col-label" title="${p.slug}">${p.label}</span></th>`
    ).join('');

    const rows = grants.map(g => this.renderGrantRow(g)).join('');

    return `
      <div class="permissions-table-wrap">
        <table class="permissions-table">
          <thead>
            <tr>
              <th class="person-col">Care Team Member</th>
              <th class="access-col">Access Level</th>
              <th class="hide-group-header" colspan="${this.SCP_PAGES.length}">
                Hide section from this person?
              </th>
              <th class="action-col"></th>
            </tr>
            <tr class="page-header-row">
              <th colspan="2"></th>
              ${pageHeaders}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  renderGrantRow(g) {
    const hiddenPages = JSON.parse(g.hidden_pages || '[]');
    const permission = g.permission === 'full' ? 'full'
      : g.permission === 'none' ? 'none'
      : 'view'; // 'read' (legacy) or 'view' → View Only

    const pageCells = this.SCP_PAGES.map(p => {
      const isHidden = hiddenPages.includes(p.slug);
      const isNA = permission === 'none';
      return `<td class="page-check-cell ${isNA ? 'cell-na' : ''}">
        ${isNA
          ? '<span class="na-label">N/A</span>'
          : `<input type="checkbox" class="page-hide-check"
              data-grant="${g.id}" data-page="${p.slug}"
              ${isHidden ? 'checked' : ''}
              onchange="PrivacyUI.markDirty()" />`
        }
      </td>`;
    }).join('');

    return `
      <tr id="grant-row-${g.id}" class="grant-row ${permission === 'none' ? 'row-no-access' : ''}">
        <td class="person-col">
          <span class="grant-name">${this.esc(g.grantee_display_name)}</span>
        </td>
        <td class="access-col">
          <select class="access-select" data-grant="${g.id}"
            onchange="PrivacyUI.onAccessChange(this)">
            <option value="full" ${permission === 'full' ? 'selected' : ''}>Full Edit</option>
            <option value="view" ${permission === 'view' ? 'selected' : ''}>View Only</option>
            <option value="none" ${permission === 'none' ? 'selected' : ''}>No Access</option>
          </select>
        </td>
        ${pageCells}
        <td class="action-col">
          <button class="revoke-btn-sm"
            onclick="PrivacyUI.revoke('${g.id}', '${this.esc(g.grantee_display_name)}')">
            Revoke
          </button>
        </td>
      </tr>
    `;
  },

  markDirty() {
    const btn = document.getElementById('save-changes-btn');
    const conf = document.getElementById('save-confirm');
    if (btn) btn.classList.remove('hidden');
    if (conf) conf.classList.add('hidden');
  },

  onAccessChange(selectEl) {
    const grantId = selectEl.dataset.grant;
    const value = selectEl.value;
    // Toggle N/A cells without a full re-render
    const row = document.getElementById(`grant-row-${grantId}`);
    if (row) {
      row.classList.toggle('row-no-access', value === 'none');
      row.querySelectorAll('.page-check-cell').forEach((cell, i) => {
        if (value === 'none') {
          const slug = this.SCP_PAGES[i].slug;
          cell.classList.add('cell-na');
          cell.innerHTML = '<span class="na-label">N/A</span>';
        } else {
          cell.classList.remove('cell-na');
          if (!cell.querySelector('input')) {
            const slug = this.SCP_PAGES[i].slug;
            cell.innerHTML = `<input type="checkbox" class="page-hide-check"
              data-grant="${grantId}" data-page="${slug}"
              onchange="PrivacyUI.markDirty()" />`;
          }
        }
      });
    }
    this.markDirty();
  },

  async saveAll() {
    const rows = document.querySelectorAll('.grant-row');
    const saves = [];
    for (const row of rows) {
      const grantId = row.id.replace('grant-row-', '');
      const select = row.querySelector('.access-select');
      const permission = select ? select.value : 'view';
      const hiddenPages = Array.from(row.querySelectorAll('.page-hide-check:checked'))
        .map(cb => cb.dataset.page);
      saves.push(API.updateGrant(grantId, { permission, hiddenPages }));
    }
    try {
      await Promise.all(saves);
      const btn = document.getElementById('save-changes-btn');
      const conf = document.getElementById('save-confirm');
      if (btn) btn.classList.add('hidden');
      if (conf) {
        conf.classList.remove('hidden');
        setTimeout(() => conf.classList.add('hidden'), 2500);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  },

  renderLogEntry(e) {
    const date = new Date(e.timestamp).toLocaleString();
    const who = e.display_name || (e.accessor_id || '').slice(0, 8) + '…';
    return `
      <li class="log-item">
        <span class="log-who">${this.esc(who)}</span>
        <span class="log-action">${this.esc(e.action)}</span>
        <span class="log-time">${date}</span>
      </li>
    `;
  },

  _searchTimer: null,
  onSearchInput(value) {
    clearTimeout(this._searchTimer);
    const resultsEl = document.getElementById('grant-results');
    if (!value.trim()) {
      if (resultsEl) resultsEl.classList.add('hidden');
      return;
    }
    this._searchTimer = setTimeout(() => this.searchGrant(value), 250);
  },

  async searchGrant(query) {
    const resultsEl = document.getElementById('grant-results');
    if (!resultsEl) return;
    try {
      const { identities } = await API.searchIdentities(query);
      const candidates = identities.filter(i => i.id !== this.identityId);
      if (!candidates.length) {
        resultsEl.innerHTML = '<div class="grant-result-empty">No matching people found</div>';
      } else {
        resultsEl.innerHTML = candidates.map(i => `
          <div class="grant-result-item">
            <span class="grant-result-name">${this.esc(i.display_name)}</span>
            <button class="grant-btn"
              onclick="PrivacyUI.grant('${i.id}', '${this.esc(i.display_name)}')">
              Add to Care Team
            </button>
          </div>
        `).join('');
      }
      resultsEl.classList.remove('hidden');
    } catch (err) {
      resultsEl.innerHTML = `<div class="error-msg">${this.esc(err.message)}</div>`;
      resultsEl.classList.remove('hidden');
    }
  },

  async grant(granteeId, granteeName) {
    const identity = IdentityUI.current;
    if (!identity) { alert('No identity set — create one first'); return; }
    try {
      await API.grantAccess({
        workspaceId: this.identityId,
        grantorId: identity.id,
        granteeId,
        permission: 'view',
      });
      await this.display(this.identityId);
    } catch (err) {
      alert('Could not grant access: ' + err.message);
    }
  },

  async revoke(grantId, granteeName) {
    if (!confirm(`Revoke access for ${granteeName}?`)) return;
    try {
      await API.revokeGrant(grantId);
      await this.display(this.identityId);
    } catch (err) {
      alert('Could not revoke: ' + err.message);
    }
  },

  esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');
  },
};

window.PrivacyUI = PrivacyUI;
