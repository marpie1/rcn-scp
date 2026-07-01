/**
 * api.js — thin fetch wrapper for all server endpoints
 */

const API = {
  base: '',

  async post(path, body) {
    const r = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  },

  async get(path) {
    const r = await fetch(this.base + path);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  },

  async del(path) {
    const r = await fetch(this.base + path, { method: 'DELETE' });
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  },

  async put(path, body) {
    const r = await fetch(this.base + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  },

  // Identity
  createIdentity: (displayName) => API.post('/api/identity/generate', { displayName }),
  getIdentity: (id) => API.get(`/api/identity/${id}`),
  searchIdentities: (name) => API.get(`/api/identity/search?name=${encodeURIComponent(name)}`),
  grantAccess: (body) => API.post('/api/identity/grant', body),
  updateGrant: (grantId, body) => API.put(`/api/identity/grants/${grantId}`, body),
  revokeGrant: (grantId) => API.post(`/api/identity/revoke/${grantId}`, {}),
  getGrants: (identityId) => API.get(`/api/identity/grants/${identityId}`),
  getAccessLog: (identityId) => API.get(`/api/identity/log/${identityId}`),

  // Pages
  listTemplates: () => API.get('/api/pages/templates'),
  importTemplate: (slug) => API.post('/api/pages/import-template', { slug }),
  importPage: (url) => API.post('/api/pages/import', { url }),
  listPages: () => API.get('/api/pages'),
  getPage: (id) => API.get(`/api/pages/${id}`),
  deletePage: (id) => API.del(`/api/pages/${id}`),
  exportPageUrl: (id) => `/api/pages/${id}/export`,
  updatePageItem: (pageId, itemId, text, authorName) =>
    API.put(`/api/pages/${pageId}/items/${itemId}`, { text, authorName }),
  addPageItem: (pageId, text, afterItemId, authorName) =>
    API.post(`/api/pages/${pageId}/items`, { text, afterItemId, authorName }),

  // Discussions
  createDiscussion: (name, workspaceId, createdBy) =>
    API.post('/api/discussions', { name, workspaceId, createdBy }),
  listDiscussions: (workspaceId) =>
    API.get(workspaceId ? `/api/discussions?workspaceId=${workspaceId}` : '/api/discussions'),
  getMessages: (id) => API.get(`/api/discussions/${id}/messages`),
  postMessage: (id, body) => API.post(`/api/discussions/${id}/messages`, body),
};

window.API = API;
