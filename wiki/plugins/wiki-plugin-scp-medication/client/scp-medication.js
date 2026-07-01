/**
 * wiki-plugin-scp
 *
 * Individual typed plugins for the Shared Care Plan.
 * Each item type registers separately so FedWiki's factory system can create
 * items of a specific type without editing raw JSON.
 *
 * Types registered:
 *   scp-medication  scp-vital  scp-symptom  scp-visit
 */

(function () {
  'use strict';

  // ── Styles ─────────────────────────────────────────────────────────────────
  // Minimal — inherits wiki font, background, and color. No card chrome.

  var STYLES = [
    '.scp { padding: 4px 0 6px; }',
    '.scp-head { font-size:.84rem; font-weight:600; color:#333; padding-bottom:3px;',
    '  margin-bottom:4px; border-bottom:1px solid rgba(0,0,0,.1); }',
    '.scp-row { display:flex; align-items:baseline; gap:8px; padding:2px 0; }',
    '.scp-lbl { flex:0 0 110px; font-size:.7rem; color:#888; text-transform:uppercase;',
    '  letter-spacing:.04em; padding-top:3px; line-height:1.3; }',
    '.scp-val { flex:1; min-width:0; }',
    '.scp-val input, .scp-val select, .scp-val textarea {',
    '  font:inherit; font-size:.88rem; width:100%; box-sizing:border-box;',
    '  border:none; border-bottom:1px solid transparent;',
    '  background:transparent; color:inherit; padding:2px 0; margin:0; }',
    '.scp-val input:focus, .scp-val select:focus, .scp-val textarea:focus {',
    '  outline:none; border-bottom-color:#aaa; background:rgba(0,0,0,.02); }',
    '.scp-val textarea { resize:none; overflow:hidden; min-height:1.3em; line-height:1.4; }',
    '.scp-val select { cursor:pointer; }',
    '.scp-checks { display:flex; flex-wrap:wrap; gap:3px 14px; padding:3px 0; }',
    '.scp-chk { display:flex; align-items:center; gap:4px; font-size:.84rem; cursor:pointer; }',
    '.scp-flag { color:#b45309; font-size:.78rem; font-style:italic; margin-top:2px; padding-left:118px; }',
    '.scp-commit-btn { display:block; margin-top:8px; padding:5px 12px; font-size:.82rem;',
    '  background:#2563eb; color:#fff; border:none; border-radius:3px; cursor:pointer; }',
    '.scp-commit-btn:hover { background:#1d4ed8; }',
    '.scp-fold-btn { float:right; background:none; border:none; cursor:pointer;',
    '  font-size:.8rem; color:#aaa; padding:0 2px; line-height:1; }',
    '.scp-fold-btn:hover { color:#555; }',
    '.scp-summary { font-size:.85rem; color:#555; padding:2px 0; cursor:pointer; }',
    '.scp-summary:hover { color:#222; }',
    '.scp-done { opacity:.8; }',
    '.scp-controls-bar { display:flex; gap:6px; padding:4px 0; }',
    '.scp-ctrl-btn { padding:3px 10px; font-size:.78rem; background:#f3f4f6;',
    '  border:1px solid #d1d5db; border-radius:3px; cursor:pointer; color:#555; }',
    '.scp-ctrl-btn:hover { background:#e5e7eb; color:#222; }',
    '.scp-log-row { display:flex; gap:10px; align-items:baseline; padding:3px 0;',
    '  border-bottom:1px solid rgba(0,0,0,.05); }',
    '.scp-log-date { flex:0 0 88px; font-size:.78rem; color:#888; font-family:monospace; }',
    '.scp-log-type { flex:0 0 82px; font-size:.72rem; font-weight:600;',
    '  text-transform:uppercase; letter-spacing:.04em; color:#6366f1; }',
    '.scp-log-summary { flex:1; font-size:.85rem; color:#333; }',
    '.scp-date-wrap { display:flex; align-items:center; gap:5px; }',
    '.scp-date-wrap input { flex:1; }',
    '.scp-date-btn { flex:0 0 auto; padding:1px 7px; font-size:.72rem; background:#f3f4f6;',
    '  border:1px solid #d1d5db; border-radius:3px; cursor:pointer; color:#555; white-space:nowrap; }',
    '.scp-date-btn:hover { background:#e5e7eb; color:#222; }',
    '.scp-vc-active { background:#2563eb !important; color:#fff !important; border-color:#2563eb !important; }',
    '.scp-factory-wrap { padding:6px 0 2px; }',
    '.scp-factory-label { font-size:.7rem; color:#9ca3af; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }',
    '.scp-factory-btn { padding:5px 12px; font-size:.82rem; background:#f0fdf4;',
    '  border:1px solid #86efac; border-radius:4px; cursor:pointer; color:#166534;',
    '  margin:0 6px 4px 0; font-family:inherit; }',
    '.scp-factory-btn:hover { background:#dcfce7; border-color:#4ade80; }',
    '.scp-discard-btn { display:inline-block; margin-top:8px; margin-left:8px; padding:5px 12px; font-size:.82rem;',
    '  background:#fff; color:#b91c1c; border:1px solid #fca5a5; border-radius:3px; cursor:pointer; }',
    '.scp-discard-btn:hover { background:#fef2f2; border-color:#ef4444; }',
    '.scp-edit-btn { float:right; background:none; border:none; cursor:pointer;',
    '  font-size:.75rem; color:#aaa; padding:0 4px; line-height:1; margin-right:2px; }',
    '.scp-edit-btn:hover { color:#2563eb; }',
  ].join('\n');

  var injected = false;
  function injectStyles() {
    if (injected) return;
    var s = document.createElement('style');
    s.textContent = STYLES;
    document.head.appendChild(s);
    injected = true;
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Search text generation ──────────────────────────────────────────────────
  // Populates item.text so FedWiki's search index can find SCP content.
  // Called automatically by save() for every type.

  function scpText(item) {
    var p = [];
    function add(label, val) { if (val) p.push(label ? label + ' ' + val : val); }
    switch (item.type) {
      case 'scp-medication':
        add('Medication:', item.label);
        if (item.med_type)   p.push('(' + item.med_type + ')');
        add('Prescribed by', item.prescribed_by ? item.prescribed_by + '.' : null);
        add('Started',       item.started ? item.started + '.' : null);
        add('',              item.directions);
        add('Use:',          item.use);
        if (item.timing && item.timing.length) p.push('Timing: ' + item.timing.join(', ') + '.');
        add('Not as prescribed:', item.not_prescribed);
        break;
      case 'scp-vital':
        if (item.measurement) p.push(item.measurement + ' reading:');
        add('', item.value);
        add('', item.unit);
        add('on', item.date);
        add('at', item.time);
        add('', item.notes);
        break;
      case 'scp-symptom':
        add('Symptom:', item.symptom);
        if (item.severity) p.push('(' + item.severity + ')');
        add('on',              item.date);
        add('Duration:',       item.duration ? item.duration + '.' : null);
        add('Possible cause:', item.possible_cause);
        add('Action taken:',   item.action_taken);
        break;
      case 'scp-visit':
        add('Visit with', item.provider);
        if (item.provider_type) p.push('(' + item.provider_type + ')');
        if (item.visit_type) p.push('[' + item.visit_type + ']');
        add('on',        item.date ? item.date + '.' : null);
        add('Reason:',   item.reason);
        add('Outcome:',  item.outcome);
        add('Follow up:', item.follow_up);
        break;
      case 'scp-about':
        var name = item.preferred_name || item.legal_name;
        add('About:', name);
        if (item.preferred_name && item.legal_name) p.push('(legal: ' + item.legal_name + ')');
        add('Born',     item.dob ? item.dob + '.' : null);
        add('Pronouns:', item.pronouns ? item.pronouns + '.' : null);
        add('Language:', item.language ? item.language + '.' : null);
        add('Phone:',    item.phone ? item.phone + '.' : null);
        add('Emergency contact:', item.emergency_contact);
        add('',          item.emergency_phone ? item.emergency_phone + '.' : null);
        add('',          item.notes);
        break;
      case 'scp-provider':
        if (item.name) {
          var role = [item.role, item.specialty].filter(Boolean).join(', ');
          p.push('Care team: ' + item.name + (role ? ' (' + role + ')' : '') + '.');
        }
        add('Phone:', item.phone ? item.phone + '.' : null);
        add('When to call:', item.when_to_call);
        add('', item.notes);
        break;
      case 'scp-diagnosis':
        if (item.condition) p.push('Diagnosis: ' + item.condition + (item.status ? ' (' + item.status + ')' : '') + '.');
        add('ICD:', item.icd_code ? item.icd_code + '.' : null);
        add('Diagnosed', item.diagnosed_date ? item.diagnosed_date + '.' : null);
        add('By',        item.diagnosing_provider ? item.diagnosing_provider + '.' : null);
        add('',          item.notes);
        break;
      case 'scp-reaction':
        add('Reaction to:', item.substance ? item.substance + '.' : null);
        add('',             item.reaction);
        add('Severity:',    item.severity ? item.severity + '.' : null);
        add('Identified',   item.date_identified ? item.date_identified + '.' : null);
        add('',             item.notes);
        break;
      case 'scp-history':
        add('Medical history:', item.event);
        add('on',      item.date ? item.date + '.' : null);
        add('Provider:', item.provider ? item.provider + '.' : null);
        add('',          item.notes);
        break;
      case 'scp-next-step':
        if (item.action) p.push('Next step: ' + item.action + (item.status ? ' (' + item.status + ').' : '.'));
        add('Who:',    item.who ? item.who + '.' : null);
        add('By:',     item.by_when ? item.by_when + '.' : null);
        add('',        item.notes);
        break;
      case 'scp-directive':
        add('Advanced directive:', item.directive_type ? item.directive_type + '.' : null);
        add('',          item.details);
        add('Proxy:',    item.proxy_name);
        add('',          item.proxy_phone ? item.proxy_phone + '.' : null);
        add('Document:', item.document_location ? item.document_location + '.' : null);
        add('Signed',    item.date_signed ? item.date_signed + '.' : null);
        break;
      case 'scp-access':
        add('Plan accessed by:', item.accessor);
        if (item.role) p.push('(' + item.role + ')');
        add('on',      item.date ? item.date + '.' : null);
        add('Reason:', item.reason);
        break;
      case 'scp-care-member':
        var cmRole = item.role === 'Other' ? (item.other_role || 'Other') : (item.role || '');
        if (item.name) p.push('Care team: ' + item.name + (cmRole ? ' (' + cmRole + ')' : '') + '.');
        add('Phone:', item.phone ? item.phone + '.' : null);
        add('',       item.notes);
        break;
    }
    return p.join(' ');
  }

  function save($item, item) {
    item.text = scpText(item);
    var $page = $item.parents('.page:first');
    wiki.pageHandler.put($page, { type: 'edit', id: item.id, item: item });
  }

  function grow(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // Move item to top of page story (reverse chronological for health log cards).
  // If an scp-factory is pinned at position 0, inserts at position 1 so the
  // factory stays fixed at the top.
  function moveToTop($item, item) {
    var $page = $item.parents('.page:first');
    var $allItems = $page.find('.item');
    var ids = [];
    $allItems.each(function () { ids.push($(this).attr('data-id')); });
    var myIdx = ids.indexOf(item.id);
    if (myIdx < 0) return;
    var insertAt = $allItems.first().hasClass('scp-factory') ? 1 : 0;
    if (myIdx === insertAt) return;
    ids.splice(myIdx, 1);
    ids.splice(insertAt, 0, item.id);
    wiki.pageHandler.put($page, { type: 'move', id: item.id, order: ids });
  }

  // ── Shared fold-toggle helper for committed items ───────────────────────────

  function bindFoldToggle($item) {
    $item.find('.scp-fold-btn').on('click', function () {
      if ($item.find('.scp-detail').is(':visible')) {
        $item.find('.scp-detail').hide();
        $item.find('.scp-summary').show();
        $(this).text('▼');
      } else {
        $item.find('.scp-detail').show();
        $item.find('.scp-summary').hide();
        $(this).text('▲');
      }
    });
    $item.find('.scp-summary').on('click', function () {
      $item.find('.scp-detail').show();
      $item.find('.scp-summary').hide();
      $item.find('.scp-fold-btn').text('▲');
    });
  }

  // ── Edit helper for editable (non-log) committed items ─────────────────────

  function addEditButton($item, item, emitFn, bindFn) {
    bindFoldToggle($item);
    $item.find('.scp-edit-btn').on('click', function () {
      item.committed = false;
      $item.empty();
      emitFn($item, item);
      bindFn($item, item);
    });
  }

  // ── Health Log push ─────────────────────────────────────────────────────────

  function pvId() {
    return (Date.now().toString(16) + Math.floor(Math.random() * 0xFFFFFF).toString(16) +
            '0000000000000000').slice(0, 16);
  }

  function wikiPut(slug, action) {
    $.ajax({
      type: 'PUT',
      url: '/page/' + slug + '/action',
      data: { action: JSON.stringify(action) },
      error: function (xhr) { console.error('wikiPut ' + slug + ' failed:', xhr.status, xhr.statusText); }
    });
  }

  function pushToHealthLog(entry_type, summary, date) {
    var id = pvId();
    var logDate = date || new Date().toISOString().slice(0, 10);
    var item = {
      type: 'scp-log-entry',
      id: id,
      entry_type: entry_type,
      summary: summary,
      date: logDate,
      text: logDate + ' ' + entry_type + ': ' + summary,
    };
    wikiPut('health-log', { type: 'add', id: id, item: item });
  }

  // ── DOM helpers ─────────────────────────────────────────────────────────────

  function row(lbl, html) {
    return '<div class="scp-row">' +
      '<span class="scp-lbl">' + esc(lbl) + '</span>' +
      '<div class="scp-val">' + html + '</div>' +
    '</div>';
  }

  function inp(cls, v, ph) {
    return '<input class="' + cls + '" value="' + esc(v || '') + '"' +
      (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>';
  }

  function ta(cls, v) {
    return '<textarea class="' + cls + '" rows="1">' + esc(v || '') + '</textarea>';
  }

  function sel(cls, opts, cur) {
    return '<select class="' + cls + '">' +
      opts.map(function (o) {
        var v = typeof o === 'object' ? o.value : o;
        var l = typeof o === 'object' ? o.label : o;
        return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
      }).join('') +
    '</select>';
  }

  function chks(cls, opts, cur) {
    var vals = Array.isArray(cur) ? cur : [];
    return '<div class="scp-checks">' +
      opts.map(function (o) {
        var chk = vals.indexOf(o) !== -1 ? ' checked' : '';
        return '<label class="scp-chk">' +
          '<input type="checkbox" class="' + cls + '" value="' + esc(o) + '"' + chk + '>' +
          '<span>' + esc(o) + '</span></label>';
      }).join('') +
    '</div>';
  }

  // Date input: native calendar picker + Today shortcut
  function dateInp(cls, val) {
    return '<div class="scp-date-wrap">' +
      '<input type="date" class="' + cls + '"' + (val ? ' value="' + esc(val) + '"' : '') + '>' +
      '<button type="button" class="scp-date-btn scp-date-today">Today</button>' +
      '</div>';
  }

  // Time input: text field + Now shortcut
  function timeInp(cls, val) {
    return '<div class="scp-date-wrap">' +
      '<input class="' + cls + '" value="' + esc(val || '') + '" placeholder="e.g. 8:00 AM, Fasting">' +
      '<button type="button" class="scp-date-btn scp-time-now">Now</button>' +
      '</div>';
  }

  // Global delegated handlers — fire once, work for all dynamically added SCP items
  $(document).on('click', '.scp-date-today', function () {
    var today = new Date().toISOString().slice(0, 10);
    $(this).siblings('input').val(today).trigger('input').trigger('change');
  });
  $(document).on('click', '.scp-time-now', function () {
    var now = new Date();
    var h = now.getHours(), m = now.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    $(this).siblings('input').val(h + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm)
      .trigger('input');
  });


  // ══════════════════════════════════════════════════════════════════════════
  // scp-medication
  // ══════════════════════════════════════════════════════════════════════════

  var MED_TYPE = ['Prescribed', 'Additional / OTC'];
  var TIMING   = ['Morning / Breakfast', 'Midday / Lunch', 'Evening / Dinner',
                  'Bedtime', 'As Needed (PRN)', 'Other'];

  function medicationSummaryHtml(item) {
    var s = esc(item.label || 'Medication');
    if (item.med_type) s += ' (' + esc(item.med_type) + ')';
    if (item.started)  s += ' — started ' + esc(item.started);
    return s;
  }

  function medicationDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Medication</span><div class="scp-val">'    + esc(item.label || '')        + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Type</span><div class="scp-val">'               + esc(item.med_type || '')     + '</div></div>' +
      (item.rxnorm_code   ? '<div class="scp-row"><span class="scp-lbl">RxNorm</span><div class="scp-val">'        + esc(item.rxnorm_code)   + '</div></div>' : '') +
      (item.prescribed_by ? '<div class="scp-row"><span class="scp-lbl">Prescribed By</span><div class="scp-val">' + esc(item.prescribed_by) + '</div></div>' : '') +
      (item.started       ? '<div class="scp-row"><span class="scp-lbl">Started</span><div class="scp-val">'       + esc(item.started)       + '</div></div>' : '') +
      (item.directions    ? '<div class="scp-row"><span class="scp-lbl">Directions</span><div class="scp-val">'    + esc(item.directions)    + '</div></div>' : '') +
      (item.use           ? '<div class="scp-row"><span class="scp-lbl">Use / Purpose</span><div class="scp-val">' + esc(item.use)           + '</div></div>' : '') +
      (item.timing && item.timing.length ? '<div class="scp-row"><span class="scp-lbl">Timing</span><div class="scp-val">' + esc(item.timing.join(', ')) + '</div></div>' : '') +
      (item.not_prescribed ? '<div class="scp-flag">Not taken as prescribed: ' + esc(item.not_prescribed) + '</div>' : '');
  }

  function emitMedication($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Medication<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + medicationDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + medicationSummaryHtml(item) + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.label || 'New Medication') + '</div>' +
      row('Medication Name', inp('scp-label', item.label, 'Name, dose, and form — e.g. Metformin 500mg Tablet')) +
      row('Type',            sel('scp-med-type', MED_TYPE, item.med_type)) +
      row('RxNorm',          inp('scp-rxnorm', item.rxnorm_code, 'optional')) +
      row('Prescribed By',   inp('scp-prescribed-by', item.prescribed_by)) +
      row('Started',         dateInp('scp-started', item.started)) +
      row('Directions',      ta('scp-directions', item.directions)) +
      row('Use / Purpose',   ta('scp-use', item.use)) +
      row('Timing',          chks('scp-timing', TIMING, item.timing)) +
      row('Not as prescribed', ta('scp-not-prescribed', item.not_prescribed)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindMedication($item, item) {
    if (item.committed) { addEditButton($item, item, emitMedication, bindMedication); return; }

    $item.find('.scp-directions, .scp-use, .scp-not-prescribed').each(function () { grow(this); });

    // input: update item data + live preview only, no save
    $item.find('.scp-label').on('input', function () {
      item.label = this.value;
      $item.find('.scp-head').text(this.value || 'New Medication');
    });
    $item.find('.scp-rxnorm').on('input',        function () { item.rxnorm_code    = this.value; });
    $item.find('.scp-prescribed-by').on('input', function () { item.prescribed_by  = this.value; });
    $item.find('.scp-started').on('input change', function () { item.started       = this.value; });
    $item.find('.scp-directions').on('input',    function () { grow(this); item.directions     = this.value; });
    $item.find('.scp-use').on('input',           function () { grow(this); item.use            = this.value; });
    $item.find('.scp-not-prescribed').on('input',function () { grow(this); item.not_prescribed = this.value; });

    // selects and checkboxes: update only
    $item.find('.scp-med-type').on('change', function () { item.med_type = this.value; });
    $item.find('.scp-timing').on('change', function () {
      var v = []; $item.find('.scp-timing:checked').each(function () { v.push(this.value); });
      item.timing = v;
    });

    // Commit: write ONE journal entry, re-render as read-only
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      var summary = (item.label || 'Medication') + (item.med_type ? ' (' + item.med_type + ')' : '');
      pushToHealthLog('Medication', summary, item.started || null);
      $item.empty(); emitMedication($item, item); bindMedication($item, item);
    });
  }

  window.plugins['scp-medication'] = {
    emit: emitMedication,
    bind: bindMedication,
    editor: function ($item, item) {
      item.label    = item.label    || 'New Medication';
      item.med_type = item.med_type || 'Prescribed';
      item.timing   = item.timing   || [];
      $item.empty();
      emitMedication($item, item);
      bindMedication($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-vital
  // Publishes a thumb event so downstream chart/bars plugins can consume data.
  // ══════════════════════════════════════════════════════════════════════════

  var VITALS = ['Blood Pressure', 'Blood Glucose', 'Weight', 'Heart Rate / Pulse',
                'Temperature', 'Oxygen Saturation (SpO2)', 'Other'];

  function vitalSummaryHtml(item) {
    var s = esc(item.measurement || 'Vital');
    if (item.value) s += ': ' + esc(item.value);
    if (item.unit)  s += ' ' + esc(item.unit);
    if (item.date)  s += ' — ' + esc(item.date);
    return s;
  }

  function vitalDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Measurement</span><div class="scp-val">' + esc(item.measurement || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Value</span><div class="scp-val">' + esc(item.value || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Unit</span><div class="scp-val">' + esc(item.unit || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Date</span><div class="scp-val">' + esc(item.date || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Time</span><div class="scp-val">' + esc(item.time || '') + '</div></div>' +
      (item.notes ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">' + esc(item.notes) + '</div></div>' : '');
  }

  function emitVital($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Vital<button class="scp-fold-btn" title="collapse">▲</button></div>' +
        '<div class="scp-detail">' + vitalDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + vitalSummaryHtml(item) + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">Vital: ' + esc(item.measurement || '') + '</div>' +
      row('Measurement', sel('scp-measurement', VITALS, item.measurement)) +
      row('Value',       inp('scp-vital-value', item.value, 'e.g. 148/92')) +
      row('Unit',        inp('scp-vital-unit', item.unit, 'e.g. mmHg, mg/dL')) +
      row('Date',        dateInp('scp-vital-date', item.date)) +
      row('Time',        timeInp('scp-vital-time', item.time)) +
      row('Notes',       ta('scp-vital-notes', item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindVital($item, item) {
    if (item.committed) {
      $item.find('.scp-fold-btn').on('click', function () {
        if ($item.find('.scp-detail').is(':visible')) {
          $item.find('.scp-detail').hide();
          $item.find('.scp-summary').show();
          $(this).text('▼');
        } else {
          $item.find('.scp-detail').show();
          $item.find('.scp-summary').hide();
          $(this).text('▲');
        }
      });
      $item.find('.scp-summary').on('click', function () {
        $item.find('.scp-detail').show();
        $item.find('.scp-summary').hide();
        $item.find('.scp-fold-btn').text('▲');
      });
      return;
    }

    $item.find('.scp-vital-notes').each(function () { grow(this); });

    function thumb() {
      if (item.value && item.date) {
        $item.trigger('thumb', { date: item.date, value: item.value, measurement: item.measurement });
      }
    }

    // input: update item data only, no save
    $item.find('.scp-vital-value').on('input', function () { item.value = this.value; });
    $item.find('.scp-vital-unit').on('input',  function () { item.unit  = this.value; });
    $item.find('.scp-vital-date').on('input change', function () { item.date = this.value; });
    $item.find('.scp-vital-time').on('input',  function () { item.time  = this.value; });
    $item.find('.scp-vital-notes').on('input', function () { grow(this); item.notes = this.value; });

    // select: update live preview only
    $item.find('.scp-measurement').on('change', function () {
      item.measurement = this.value;
      $item.find('.scp-head').text('Vital: ' + this.value);
    });

    // Commit: write ONE journal entry, re-render as read-only (stays expanded)
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      thumb();
      var summary = (item.measurement || 'Vital') + ': ' + (item.value || '') +
                    (item.unit ? ' ' + item.unit : '');
      pushToHealthLog('Vital', summary, item.date);
      $item.empty();
      emitVital($item, item);
      bindVital($item, item);
    });
  }

  window.plugins['scp-vital'] = {
    emit: emitVital,
    bind: bindVital,
    editor: function ($item, item) {
      item.measurement = item.measurement || 'Blood Pressure';
      $item.empty();
      emitVital($item, item);
      bindVital($item, item);
      save($item, item);
      moveToTop($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-symptom
  // ══════════════════════════════════════════════════════════════════════════

  var SEVERITY = ['Mild', 'Moderate', 'Severe', 'Very Severe'];

  function symptomSummaryHtml(item) {
    var s = esc(item.symptom || 'Symptom');
    if (item.severity) s += ' (' + esc(item.severity) + ')';
    if (item.date)     s += ' — ' + esc(item.date);
    return s;
  }

  function symptomDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Symptom</span><div class="scp-val">' + esc(item.symptom || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Severity</span><div class="scp-val">' + esc(item.severity || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Date</span><div class="scp-val">' + esc(item.date || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Duration</span><div class="scp-val">' + esc(item.duration || '') + '</div></div>' +
      (item.possible_cause ? '<div class="scp-row"><span class="scp-lbl">Possible Cause</span><div class="scp-val">' + esc(item.possible_cause) + '</div></div>' : '') +
      (item.action_taken   ? '<div class="scp-row"><span class="scp-lbl">Action Taken</span><div class="scp-val">'   + esc(item.action_taken)   + '</div></div>' : '');
  }

  function emitSymptom($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Symptom<button class="scp-fold-btn" title="collapse">▲</button></div>' +
        '<div class="scp-detail">' + symptomDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + symptomSummaryHtml(item) + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">Symptom: ' + esc(item.symptom || '') + '</div>' +
      row('Symptom',        ta('scp-symptom-text', item.symptom)) +
      row('Severity',       sel('scp-severity', SEVERITY, item.severity)) +
      row('Date',           dateInp('scp-symptom-date', item.date)) +
      row('Duration',       inp('scp-symptom-duration', item.duration, 'e.g. 2 hours')) +
      row('Possible Cause', ta('scp-symptom-cause', item.possible_cause)) +
      row('Action Taken',   ta('scp-symptom-action', item.action_taken)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindSymptom($item, item) {
    if (item.committed) {
      $item.find('.scp-fold-btn').on('click', function () {
        if ($item.find('.scp-detail').is(':visible')) {
          $item.find('.scp-detail').hide();
          $item.find('.scp-summary').show();
          $(this).text('▼');
        } else {
          $item.find('.scp-detail').show();
          $item.find('.scp-summary').hide();
          $(this).text('▲');
        }
      });
      $item.find('.scp-summary').on('click', function () {
        $item.find('.scp-detail').show();
        $item.find('.scp-summary').hide();
        $item.find('.scp-fold-btn').text('▲');
      });
      return;
    }

    $item.find('.scp-symptom-text, .scp-symptom-cause, .scp-symptom-action').each(function () { grow(this); });

    // input: update item data + live preview only, no save
    $item.find('.scp-symptom-text').on('input', function () {
      grow(this); item.symptom = this.value;
      $item.find('.scp-head').text('Symptom: ' + this.value);
    });
    $item.find('.scp-symptom-date').on('input change', function () { item.date        = this.value; });
    $item.find('.scp-symptom-duration').on('input', function () { item.duration      = this.value; });
    $item.find('.scp-symptom-cause').on('input',    function () { grow(this); item.possible_cause = this.value; });
    $item.find('.scp-symptom-action').on('input',   function () { grow(this); item.action_taken   = this.value; });

    // select: update only
    $item.find('.scp-severity').on('change', function () { item.severity = this.value; });

    // Commit: write ONE journal entry, re-render as read-only (stays expanded)
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      var summary = (item.symptom || 'Symptom') + (item.severity ? ' (' + item.severity + ')' : '');
      pushToHealthLog('Symptom', summary, item.date);
      $item.empty();
      emitSymptom($item, item);
      bindSymptom($item, item);
    });
  }

  window.plugins['scp-symptom'] = {
    emit: emitSymptom,
    bind: bindSymptom,
    editor: function ($item, item) {
      item.symptom  = item.symptom  || '';
      item.severity = item.severity || 'Mild';
      $item.empty();
      emitSymptom($item, item);
      bindSymptom($item, item);
      save($item, item);
      moveToTop($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-visit
  // ══════════════════════════════════════════════════════════════════════════

  var PROVIDER_ROLE = ['Primary Care', 'Specialist', 'Nurse', 'Community Health Worker',
                       'Pharmacist', 'Social Worker', 'Dentist', 'Mental Health', 'Other'];

  var VISIT_TYPE = ['Office Visit', 'Telehealth / Video', 'Phone / Nurse Line',
                   'Emergency Room', 'Hospital / Inpatient', 'Lab / Imaging', 'Other'];

  function visitSummaryHtml(item) {
    var s = esc(item.provider || 'Visit');
    if (item.provider_type) s += ' (' + esc(item.provider_type) + ')';
    if (item.visit_type)    s += ' — ' + esc(item.visit_type);
    if (item.date)          s += ' — ' + esc(item.date);
    return s;
  }

  function visitDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Provider</span><div class="scp-val">' + esc(item.provider || '') + '</div></div>' +
      (item.provider_type ? '<div class="scp-row"><span class="scp-lbl">Provider Type</span><div class="scp-val">' + esc(item.provider_type) + '</div></div>' : '') +
      '<div class="scp-row"><span class="scp-lbl">Visit Type</span><div class="scp-val">' + esc(item.visit_type || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Date</span><div class="scp-val">' + esc(item.date || '') + '</div></div>' +
      (item.reason    ? '<div class="scp-row"><span class="scp-lbl">Reason</span><div class="scp-val">'    + esc(item.reason)    + '</div></div>' : '') +
      (item.outcome   ? '<div class="scp-row"><span class="scp-lbl">Outcome</span><div class="scp-val">'   + esc(item.outcome)   + '</div></div>' : '') +
      (item.follow_up ? '<div class="scp-row"><span class="scp-lbl">Follow Up</span><div class="scp-val">' + esc(item.follow_up) + '</div></div>' : '');
  }

  function emitVisit($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Visit<button class="scp-fold-btn" title="collapse">▲</button></div>' +
        '<div class="scp-detail">' + visitDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + visitSummaryHtml(item) + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">Visit: ' + esc(item.provider || '') + '</div>' +
      row('Provider',      inp('scp-visit-provider', item.provider)) +
      row('Provider Type', sel('scp-visit-ptype', PROVIDER_ROLE, item.provider_type)) +
      row('Visit Type',    sel('scp-visit-type', VISIT_TYPE, item.visit_type)) +
      row('Date',      dateInp('scp-visit-date', item.date)) +
      row('Reason',    ta('scp-visit-reason', item.reason)) +
      row('Outcome',   ta('scp-visit-outcome', item.outcome)) +
      row('Follow Up', ta('scp-visit-followup', item.follow_up)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindVisit($item, item) {
    if (item.committed) {
      $item.find('.scp-fold-btn').on('click', function () {
        if ($item.find('.scp-detail').is(':visible')) {
          $item.find('.scp-detail').hide();
          $item.find('.scp-summary').show();
          $(this).text('▼');
        } else {
          $item.find('.scp-detail').show();
          $item.find('.scp-summary').hide();
          $(this).text('▲');
        }
      });
      $item.find('.scp-summary').on('click', function () {
        $item.find('.scp-detail').show();
        $item.find('.scp-summary').hide();
        $item.find('.scp-fold-btn').text('▲');
      });
      return;
    }

    $item.find('.scp-visit-reason, .scp-visit-outcome, .scp-visit-followup').each(function () { grow(this); });

    // input: update item data + live preview only, no save
    $item.find('.scp-visit-provider').on('input', function () {
      item.provider = this.value;
      $item.find('.scp-head').text('Visit: ' + this.value);
    });
    $item.find('.scp-visit-date').on('input change', function () { item.date     = this.value; });
    $item.find('.scp-visit-reason').on('input',   function () { grow(this); item.reason    = this.value; });
    $item.find('.scp-visit-outcome').on('input',  function () { grow(this); item.outcome   = this.value; });
    $item.find('.scp-visit-followup').on('input', function () { grow(this); item.follow_up = this.value; });

    // selects: update only
    $item.find('.scp-visit-ptype').on('change', function () { item.provider_type = this.value; });
    $item.find('.scp-visit-type').on('change',  function () { item.visit_type    = this.value; });

    // Commit: write ONE journal entry, re-render as read-only (stays expanded)
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      var summary = (item.provider || 'Visit') +
                    (item.provider_type ? ' (' + item.provider_type + ')' : '') +
                    (item.visit_type ? ' — ' + item.visit_type : '');
      pushToHealthLog('Visit', summary, item.date);
      $item.empty();
      emitVisit($item, item);
      bindVisit($item, item);
    });
  }

  window.plugins['scp-visit'] = {
    emit: emitVisit,
    bind: bindVisit,
    editor: function ($item, item) {
      item.provider   = item.provider   || '';
      item.visit_type = item.visit_type || 'Office Visit';
      $item.empty();
      emitVisit($item, item);
      bindVisit($item, item);
      save($item, item);
      moveToTop($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-about  — About Me
  // ══════════════════════════════════════════════════════════════════════════

  function aboutDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Preferred Name</span><div class="scp-val">' + esc(item.preferred_name || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Legal Name</span><div class="scp-val">'       + esc(item.legal_name || '')      + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Date of Birth</span><div class="scp-val">'    + esc(item.dob || '')             + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Pronouns</span><div class="scp-val">'         + esc(item.pronouns || '')        + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Language</span><div class="scp-val">'         + esc(item.language || '')        + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Phone</span><div class="scp-val">'            + esc(item.phone || '')           + '</div></div>' +
      (item.address           ? '<div class="scp-row"><span class="scp-lbl">Address</span><div class="scp-val">'           + esc(item.address)           + '</div></div>' : '') +
      (item.emergency_contact ? '<div class="scp-row"><span class="scp-lbl">Emergency Contact</span><div class="scp-val">' + esc(item.emergency_contact) + '</div></div>' : '') +
      (item.emergency_phone   ? '<div class="scp-row"><span class="scp-lbl">Emergency Phone</span><div class="scp-val">'   + esc(item.emergency_phone)   + '</div></div>' : '') +
      (item.notes             ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">'             + esc(item.notes)             + '</div></div>' : '');
  }

  function emitAbout($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">About Me<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + aboutDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + esc(item.preferred_name || item.legal_name || 'About Me') + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">About Me</div>' +
      row('Preferred Name',    inp('scp-about-preferred', item.preferred_name, 'Name you go by')) +
      row('Legal Name',        inp('scp-about-legal',     item.legal_name)) +
      row('Date of Birth',     inp('scp-about-dob',       item.dob, 'YYYY-MM-DD')) +
      row('Pronouns',          inp('scp-about-pronouns',  item.pronouns, 'e.g. she/her')) +
      row('Language',          inp('scp-about-language',  item.language, 'Preferred language')) +
      row('Phone',             inp('scp-about-phone',     item.phone)) +
      row('Address',           ta('scp-about-address',    item.address)) +
      row('Emergency Contact', inp('scp-about-ec-name',   item.emergency_contact)) +
      row('Emergency Phone',   inp('scp-about-ec-phone',  item.emergency_phone)) +
      row('Notes',             ta('scp-about-notes',      item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindAbout($item, item) {
    if (item.committed) { addEditButton($item, item, emitAbout, bindAbout); return; }
    $item.find('.scp-about-address, .scp-about-notes').each(function () { grow(this); });
    $item.find('.scp-about-preferred').on('input', function () { item.preferred_name    = this.value; });
    $item.find('.scp-about-legal').on('input',     function () { item.legal_name        = this.value; });
    $item.find('.scp-about-dob').on('input',       function () { item.dob              = this.value; });
    $item.find('.scp-about-pronouns').on('input',  function () { item.pronouns         = this.value; });
    $item.find('.scp-about-language').on('input',  function () { item.language         = this.value; });
    $item.find('.scp-about-phone').on('input',     function () { item.phone            = this.value; });
    $item.find('.scp-about-address').on('input',   function () { grow(this); item.address           = this.value; });
    $item.find('.scp-about-ec-name').on('input',   function () { item.emergency_contact = this.value; });
    $item.find('.scp-about-ec-phone').on('input',  function () { item.emergency_phone   = this.value; });
    $item.find('.scp-about-notes').on('input',     function () { grow(this); item.notes = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitAbout($item, item); bindAbout($item, item);
    });
  }

  window.plugins['scp-about'] = {
    emit: emitAbout,
    bind: bindAbout,
    editor: function ($item, item) {
      $item.empty();
      emitAbout($item, item);
      bindAbout($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-provider  — Care Team member
  // ══════════════════════════════════════════════════════════════════════════

  function providerDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Name</span><div class="scp-val">'      + esc(item.name || '')      + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Role</span><div class="scp-val">'           + esc(item.role || '')      + '</div></div>' +
      (item.specialty    ? '<div class="scp-row"><span class="scp-lbl">Specialty</span><div class="scp-val">'    + esc(item.specialty)    + '</div></div>' : '') +
      '<div class="scp-row"><span class="scp-lbl">Phone</span><div class="scp-val">'          + esc(item.phone || '')     + '</div></div>' +
      (item.fax          ? '<div class="scp-row"><span class="scp-lbl">Fax</span><div class="scp-val">'          + esc(item.fax)          + '</div></div>' : '') +
      (item.when_to_call ? '<div class="scp-row"><span class="scp-lbl">When to Call</span><div class="scp-val">' + esc(item.when_to_call) + '</div></div>' : '') +
      (item.notes        ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">'        + esc(item.notes)        + '</div></div>' : '') +
      (item.add_to_care_team ? '<div class="scp-row"><span class="scp-lbl">Care Team</span><div class="scp-val" style="color:#059669">Added</div></div>' : '');
  }

  function emitProvider($item, item) {
    injectStyles();
    if (item.committed) {
      var summary = esc(item.name || 'Provider') + (item.role ? ' — ' + esc(item.role) : '');
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Care Team<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + providerDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + summary + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.name || 'Care Team Member') + '</div>' +
      row('Name',            inp('scp-prov-name',     item.name)) +
      row('Role',            sel('scp-prov-role',     PROVIDER_ROLE, item.role)) +
      row('Specialty',       inp('scp-prov-specialty',item.specialty)) +
      row('Phone',           inp('scp-prov-phone',    item.phone)) +
      row('Fax',             inp('scp-prov-fax',      item.fax)) +
      row('When to Call',    ta('scp-prov-when',      item.when_to_call)) +
      row('Notes',           ta('scp-prov-notes',     item.notes)) +
      row('Add to Care Team','<label class="scp-chk"><input type="checkbox" class="scp-prov-care-team"' +
        (item.add_to_care_team ? ' checked' : '') + '><span>Add to Care Team page</span></label>') +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  // Map a provider role to the nearest scp-care-member role
  var CM_DIRECT_ROLES = ['Primary Care', 'Specialist', 'Community Health Worker'];
  function providerToCareRole(role) {
    return CM_DIRECT_ROLES.indexOf(role) !== -1 ? role : 'Other';
  }

  function pushToCareteam(provItem) {
    var cmRole    = providerToCareRole(provItem.role);
    var otherRole = cmRole === 'Other' ? (provItem.role || provItem.specialty || '') : '';
    var id = pvId();
    var cmItem = {
      type: 'scp-care-member', id: id, committed: true,
      name: provItem.name || '', role: cmRole, other_role: otherRole,
      phone: provItem.phone || '', notes: provItem.notes || '',
    };
    cmItem.text = scpText(cmItem);
    wikiPut('care-team', { type: 'add', id: id, item: cmItem });
  }

  function bindProvider($item, item) {
    if (item.committed) { addEditButton($item, item, emitProvider, bindProvider); return; }
    $item.find('.scp-prov-when, .scp-prov-notes').each(function () { grow(this); });
    $item.find('.scp-prov-name').on('input', function () {
      item.name = this.value;
      $item.find('.scp-head').text(this.value || 'Care Team Member');
    });
    $item.find('.scp-prov-specialty').on('input', function () { item.specialty    = this.value; });
    $item.find('.scp-prov-phone').on('input',     function () { item.phone        = this.value; });
    $item.find('.scp-prov-fax').on('input',       function () { item.fax          = this.value; });
    $item.find('.scp-prov-when').on('input',      function () { grow(this); item.when_to_call = this.value; });
    $item.find('.scp-prov-notes').on('input',     function () { grow(this); item.notes        = this.value; });
    $item.find('.scp-prov-role').on('change',     function () { item.role = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.add_to_care_team = $item.find('.scp-prov-care-team').is(':checked');
      item.committed = true;
      save($item, item);
      if (item.add_to_care_team) pushToCareteam(item);
      $item.empty(); emitProvider($item, item); bindProvider($item, item);
    });
  }

  window.plugins['scp-provider'] = {
    emit: emitProvider,
    bind: bindProvider,
    editor: function ($item, item) {
      item.role = item.role || 'Primary Care';
      $item.empty();
      emitProvider($item, item);
      bindProvider($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-diagnosis  — Diagnosis
  // ══════════════════════════════════════════════════════════════════════════

  var DX_STATUS = ['Active', 'Managed', 'Resolved'];

  function diagnosisDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Condition</span><div class="scp-val">' + esc(item.condition || '') + '</div></div>' +
      (item.icd_code            ? '<div class="scp-row"><span class="scp-lbl">ICD Code</span><div class="scp-val">'           + esc(item.icd_code)            + '</div></div>' : '') +
      '<div class="scp-row"><span class="scp-lbl">Diagnosed</span><div class="scp-val">'          + esc(item.diagnosed_date || '')      + '</div></div>' +
      (item.diagnosing_provider ? '<div class="scp-row"><span class="scp-lbl">Provider</span><div class="scp-val">'           + esc(item.diagnosing_provider) + '</div></div>' : '') +
      '<div class="scp-row"><span class="scp-lbl">Status</span><div class="scp-val">'             + esc(item.status || '')              + '</div></div>' +
      (item.notes               ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">'              + esc(item.notes)               + '</div></div>' : '');
  }

  function emitDiagnosis($item, item) {
    injectStyles();
    if (item.committed) {
      var summary = esc(item.condition || 'Diagnosis') + (item.status ? ' (' + esc(item.status) + ')' : '');
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Diagnosis<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + diagnosisDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + summary + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.condition || 'New Diagnosis') + '</div>' +
      row('Condition',           inp('scp-dx-condition', item.condition)) +
      row('ICD Code',            inp('scp-dx-icd',       item.icd_code, 'optional')) +
      row('Diagnosed',           dateInp('scp-dx-date',      item.diagnosed_date)) +
      row('Diagnosing Provider', inp('scp-dx-provider',  item.diagnosing_provider)) +
      row('Status',              sel('scp-dx-status',    DX_STATUS, item.status)) +
      row('Notes',               ta('scp-dx-notes',      item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindDiagnosis($item, item) {
    if (item.committed) { addEditButton($item, item, emitDiagnosis, bindDiagnosis); return; }
    $item.find('.scp-dx-notes').each(function () { grow(this); });
    $item.find('.scp-dx-condition').on('input', function () {
      item.condition = this.value;
      $item.find('.scp-head').text(this.value || 'New Diagnosis');
    });
    $item.find('.scp-dx-icd').on('input',      function () { item.icd_code            = this.value; });
    $item.find('.scp-dx-date').on('input change', function () { item.diagnosed_date   = this.value; });
    $item.find('.scp-dx-provider').on('input', function () { item.diagnosing_provider = this.value; });
    $item.find('.scp-dx-notes').on('input',    function () { grow(this); item.notes   = this.value; });
    $item.find('.scp-dx-status').on('change',  function () { item.status = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      var summary = (item.condition || 'Diagnosis') + (item.status ? ' (' + item.status + ')' : '');
      pushToHealthLog('Diagnosis', summary, item.diagnosed_date || null);
      $item.empty(); emitDiagnosis($item, item); bindDiagnosis($item, item);
    });
  }

  window.plugins['scp-diagnosis'] = {
    emit: emitDiagnosis,
    bind: bindDiagnosis,
    editor: function ($item, item) {
      item.status = item.status || 'Active';
      $item.empty();
      emitDiagnosis($item, item);
      bindDiagnosis($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-reaction  — Allergy / Adverse Reaction
  // ══════════════════════════════════════════════════════════════════════════

  var RXN_SEVERITY = ['Mild', 'Moderate', 'Severe', 'Life-threatening'];

  function reactionDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Substance</span><div class="scp-val">'      + esc(item.substance || '')        + '</div></div>' +
      (item.reaction        ? '<div class="scp-row"><span class="scp-lbl">Reaction</span><div class="scp-val">'        + esc(item.reaction)        + '</div></div>' : '') +
      '<div class="scp-row"><span class="scp-lbl">Severity</span><div class="scp-val">'            + esc(item.severity || '')         + '</div></div>' +
      (item.date_identified ? '<div class="scp-row"><span class="scp-lbl">Date Identified</span><div class="scp-val">' + esc(item.date_identified) + '</div></div>' : '') +
      (item.notes           ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">'           + esc(item.notes)           + '</div></div>' : '');
  }

  function emitReaction($item, item) {
    injectStyles();
    if (item.committed) {
      var summary = esc(item.substance || 'Reaction') + (item.severity ? ' — ' + esc(item.severity) : '');
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Reaction<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + reactionDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + summary + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.substance || 'New Reaction') + '</div>' +
      row('Substance',       inp('scp-rxn-substance', item.substance)) +
      row('Reaction',        ta('scp-rxn-reaction',   item.reaction)) +
      row('Severity',        sel('scp-rxn-severity',  RXN_SEVERITY, item.severity)) +
      row('Date Identified', dateInp('scp-rxn-date',      item.date_identified)) +
      row('Notes',           ta('scp-rxn-notes',       item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindReaction($item, item) {
    if (item.committed) { addEditButton($item, item, emitReaction, bindReaction); return; }
    $item.find('.scp-rxn-reaction, .scp-rxn-notes').each(function () { grow(this); });
    $item.find('.scp-rxn-substance').on('input', function () {
      item.substance = this.value;
      $item.find('.scp-head').text(this.value || 'New Reaction');
    });
    $item.find('.scp-rxn-reaction').on('input', function () { grow(this); item.reaction       = this.value; });
    $item.find('.scp-rxn-date').on('input change', function () { item.date_identified = this.value; });
    $item.find('.scp-rxn-notes').on('input',    function () { grow(this); item.notes          = this.value; });
    $item.find('.scp-rxn-severity').on('change',function () { item.severity = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitReaction($item, item); bindReaction($item, item);
    });
  }

  window.plugins['scp-reaction'] = {
    emit: emitReaction,
    bind: bindReaction,
    editor: function ($item, item) {
      item.severity = item.severity || 'Mild';
      $item.empty();
      emitReaction($item, item);
      bindReaction($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-history  — Medical History event  (log style: commit + fold + top)
  // ══════════════════════════════════════════════════════════════════════════

  function historySummaryHtml(item) {
    var s = esc(item.event || 'History');
    if (item.date) s += ' — ' + esc(item.date);
    return s;
  }

  function historyDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Event</span><div class="scp-val">' + esc(item.event || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Date</span><div class="scp-val">' + esc(item.date || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Provider</span><div class="scp-val">' + esc(item.provider || '') + '</div></div>' +
      (item.notes ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">' + esc(item.notes) + '</div></div>' : '');
  }

  function emitHistory($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">History<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + historyDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + historySummaryHtml(item) + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">History: ' + esc(item.event || '') + '</div>' +
      row('Event',    ta('scp-hist-event',    item.event)) +
      row('Date',     dateInp('scp-hist-date', item.date)) +
      row('Provider', inp('scp-hist-prov',    item.provider)) +
      row('Notes',    ta('scp-hist-notes',    item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindHistory($item, item) {
    if (item.committed) { addEditButton($item, item, emitHistory, bindHistory); return; }
    $item.find('.scp-hist-event, .scp-hist-notes').each(function () { grow(this); });
    $item.find('.scp-hist-event').on('input', function () {
      grow(this); item.event = this.value;
      $item.find('.scp-head').text('History: ' + this.value);
    });
    $item.find('.scp-hist-date').on('input change', function () { item.date = this.value; });
    $item.find('.scp-hist-prov').on('input', function () { item.provider = this.value; });
    $item.find('.scp-hist-notes').on('input',function () { grow(this); item.notes = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitHistory($item, item); bindHistory($item, item);
    });
  }

  window.plugins['scp-history'] = {
    emit: emitHistory,
    bind: bindHistory,
    editor: function ($item, item) {
      $item.empty();
      emitHistory($item, item);
      bindHistory($item, item);
      save($item, item);
      moveToTop($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-next-step  — Next Step / Action Item
  // ══════════════════════════════════════════════════════════════════════════

  var STEP_WHO    = ['Patient', 'Family / Caregiver', 'Community Health Worker', 'Provider', 'Other'];
  var STEP_STATUS = ['Planned', 'In Progress', 'Done'];

  function nextStepDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Action</span><div class="scp-val">'  + esc(item.action || '')  + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Who</span><div class="scp-val">'          + esc(item.who || '')     + '</div></div>' +
      (item.by_when ? '<div class="scp-row"><span class="scp-lbl">By When</span><div class="scp-val">' + esc(item.by_when) + '</div></div>' : '') +
      '<div class="scp-row"><span class="scp-lbl">Status</span><div class="scp-val">'       + esc(item.status || '')  + '</div></div>' +
      (item.notes   ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">'   + esc(item.notes)   + '</div></div>' : '');
  }

  function emitNextStep($item, item) {
    injectStyles();
    if (item.committed) {
      var summary = esc(item.action || 'Next Step') + (item.status ? ' (' + esc(item.status) + ')' : '');
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Next Step<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + nextStepDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + summary + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.action || 'New Next Step') + '</div>' +
      row('Action',  ta('scp-step-action',  item.action)) +
      row('Who',     sel('scp-step-who',    STEP_WHO,    item.who)) +
      row('By When', inp('scp-step-by',     item.by_when, 'YYYY-MM-DD or description')) +
      row('Status',  sel('scp-step-status', STEP_STATUS, item.status)) +
      row('Notes',   ta('scp-step-notes',   item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindNextStep($item, item) {
    if (item.committed) { addEditButton($item, item, emitNextStep, bindNextStep); return; }
    $item.find('.scp-step-action, .scp-step-notes').each(function () { grow(this); });
    $item.find('.scp-step-action').on('input', function () {
      grow(this); item.action = this.value;
      $item.find('.scp-head').text(this.value || 'New Next Step');
    });
    $item.find('.scp-step-by').on('input',     function () { item.by_when = this.value; });
    $item.find('.scp-step-notes').on('input',  function () { grow(this); item.notes = this.value; });
    $item.find('.scp-step-who').on('change',   function () { item.who    = this.value; });
    $item.find('.scp-step-status').on('change',function () { item.status = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitNextStep($item, item); bindNextStep($item, item);
    });
  }

  window.plugins['scp-next-step'] = {
    emit: emitNextStep,
    bind: bindNextStep,
    editor: function ($item, item) {
      item.who    = item.who    || 'Patient';
      item.status = item.status || 'Planned';
      $item.empty();
      emitNextStep($item, item);
      bindNextStep($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-directive  — Advanced Directive
  // ══════════════════════════════════════════════════════════════════════════

  var DIRECTIVE_TYPE = ['DNR / DNI', 'Healthcare Proxy', 'Living Will', 'POLST', 'Other'];

  function directiveDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Type</span><div class="scp-val">'            + esc(item.directive_type || '')    + '</div></div>' +
      (item.details           ? '<div class="scp-row"><span class="scp-lbl">Details</span><div class="scp-val">'           + esc(item.details)           + '</div></div>' : '') +
      (item.proxy_name        ? '<div class="scp-row"><span class="scp-lbl">Proxy Name</span><div class="scp-val">'        + esc(item.proxy_name)        + '</div></div>' : '') +
      (item.proxy_phone       ? '<div class="scp-row"><span class="scp-lbl">Proxy Phone</span><div class="scp-val">'       + esc(item.proxy_phone)       + '</div></div>' : '') +
      (item.document_location ? '<div class="scp-row"><span class="scp-lbl">Document Location</span><div class="scp-val">' + esc(item.document_location) + '</div></div>' : '') +
      (item.date_signed       ? '<div class="scp-row"><span class="scp-lbl">Date Signed</span><div class="scp-val">'       + esc(item.date_signed)       + '</div></div>' : '');
  }

  function emitDirective($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Directive<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + directiveDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + esc(item.directive_type || 'Advanced Directive') + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.directive_type || 'Advanced Directive') + '</div>' +
      row('Directive Type',    sel('scp-dir-type',     DIRECTIVE_TYPE, item.directive_type)) +
      row('Details',           ta('scp-dir-details',   item.details)) +
      row('Proxy Name',        inp('scp-dir-proxy',    item.proxy_name)) +
      row('Proxy Phone',       inp('scp-dir-phone',    item.proxy_phone)) +
      row('Document Location', inp('scp-dir-location', item.document_location)) +
      row('Date Signed',       dateInp('scp-dir-signed', item.date_signed)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindDirective($item, item) {
    if (item.committed) { addEditButton($item, item, emitDirective, bindDirective); return; }
    $item.find('.scp-dir-details').each(function () { grow(this); });
    $item.find('.scp-dir-details').on('input',  function () { grow(this); item.details           = this.value; });
    $item.find('.scp-dir-proxy').on('input',    function () { item.proxy_name          = this.value; });
    $item.find('.scp-dir-phone').on('input',    function () { item.proxy_phone         = this.value; });
    $item.find('.scp-dir-location').on('input', function () { item.document_location   = this.value; });
    $item.find('.scp-dir-signed').on('input change', function () { item.date_signed    = this.value; });
    $item.find('.scp-dir-type').on('change', function () {
      item.directive_type = this.value;
      $item.find('.scp-head').text(this.value);
    });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitDirective($item, item); bindDirective($item, item);
    });
  }

  window.plugins['scp-directive'] = {
    emit: emitDirective,
    bind: bindDirective,
    editor: function ($item, item) {
      item.directive_type = item.directive_type || 'DNR / DNI';
      $item.empty();
      emitDirective($item, item);
      bindDirective($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-access  — Who's Accessed My Plan  (log style: commit + fold + top)
  // ══════════════════════════════════════════════════════════════════════════

  function accessSummaryHtml(item) {
    var s = esc(item.accessor || 'Access');
    if (item.role) s += ' (' + esc(item.role) + ')';
    if (item.date) s += ' — ' + esc(item.date);
    return s;
  }

  function accessDetailHtml(item) {
    return '<div class="scp-row"><span class="scp-lbl">Accessor</span><div class="scp-val">' + esc(item.accessor || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Role</span><div class="scp-val">' + esc(item.role || '') + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Date</span><div class="scp-val">' + esc(item.date || '') + '</div></div>' +
      (item.reason ? '<div class="scp-row"><span class="scp-lbl">Reason</span><div class="scp-val">' + esc(item.reason) + '</div></div>' : '');
  }

  function emitAccess($item, item) {
    injectStyles();
    if (item.committed) {
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Access<button class="scp-fold-btn">▲</button></div>' +
        '<div class="scp-detail">' + accessDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + accessSummaryHtml(item) + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">Access: ' + esc(item.accessor || '') + '</div>' +
      row('Who Accessed', inp('scp-acc-who',    item.accessor)) +
      row('Their Role',   inp('scp-acc-role',   item.role)) +
      row('Date',         dateInp('scp-acc-date', item.date)) +
      row('Reason',       ta('scp-acc-reason',  item.reason)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindAccess($item, item) {
    if (item.committed) { bindFoldToggle($item); return; }
    $item.find('.scp-acc-reason').each(function () { grow(this); });
    $item.find('.scp-acc-who').on('input', function () {
      item.accessor = this.value;
      $item.find('.scp-head').text('Access: ' + this.value);
    });
    $item.find('.scp-acc-role').on('input',   function () { item.role   = this.value; });
    $item.find('.scp-acc-date').on('input change', function () { item.date = this.value; });
    $item.find('.scp-acc-reason').on('input', function () { grow(this); item.reason = this.value; });
    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitAccess($item, item); bindAccess($item, item);
    });
  }

  window.plugins['scp-access'] = {
    emit: emitAccess,
    bind: bindAccess,
    editor: function ($item, item) {
      $item.empty();
      emitAccess($item, item);
      bindAccess($item, item);
      save($item, item);
      moveToTop($item, item);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // scp-previsit  — Pre-Visit Summary generator
  // ══════════════════════════════════════════════════════════════════════════

  var PREVISIT_SECTIONS = [
    { key: 'about',       label: 'Patient',               page: 'about-me',            type: 'scp-about',      limit: 1 },
    { key: 'vitals',      label: 'Recent Vitals',          page: 'vitals',              type: 'scp-vital',      limit: 4 },
    { key: 'diagnoses',   label: 'Active Diagnoses',       page: 'diagnoses',           type: 'scp-diagnosis'            },
    { key: 'next-steps',  label: 'Care Plan / Next Steps', page: 'next-steps',          type: 'scp-next-step'            },
    { key: 'symptoms',    label: 'Current Symptoms',       page: 'symptoms',            type: 'scp-symptom',    limit: 3 },
    { key: 'providers',   label: 'Medical Providers',      page: 'providers',           type: 'scp-provider'             },
    { key: 'care-team',   label: 'Care Team',              page: 'care-team',           type: 'scp-care-member'          },
    { key: 'medications', label: 'Medications',            page: 'medications',         type: 'scp-medication'           },
    { key: 'visits',      label: 'Recent Provider Visits', page: 'visits',              type: 'scp-visit'                },
    { key: 'allergies',   label: 'Allergies & Reactions',  page: 'allergies-reactions', type: 'scp-reaction'             },
    { key: 'history',     label: 'Medical History',        page: 'medical-history',     type: 'scp-history'              },
    { key: 'directives',  label: 'Medical Directives',     page: 'medical-directives',  type: 'scp-directive'            },
  ];

  // Per-item filters (applied before limit)
  var PREVISIT_FILTERS = {
    'diagnoses':  function (i) { return i.status === 'Active'; },
    'next-steps': function (i) { return i.status !== 'Done'; },
  };

  // Whole-array transforms (replace filter + limit for complex cases)
  var PREVISIT_TRANSFORMS = {
    'visits': function (items) {
      var cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 3);
      var recent = items.filter(function (i) { return i.date && new Date(i.date) >= cutoff; });
      // Return last-3-months results, or last 3 visits if fewer than 3 qualify
      return recent.length >= 3 ? recent : items.slice(0, 3);
    },
  };

  function pvItems(pageData, sec) {
    var data = pageData[sec.page];
    if (!data || !data.story) return [];
    var items = data.story.filter(function (i) { return i.type === sec.type && i.committed; });
    var transform = PREVISIT_TRANSFORMS[sec.key];
    if (transform) return transform(items);
    var filter = PREVISIT_FILTERS[sec.key];
    if (filter) items = items.filter(filter);
    if (sec.limit) items = items.slice(0, sec.limit);
    return items;
  }

  function pvRow(label, value) {
    if (value == null || value === '') return '';
    return '<tr><td class="pv-lbl">' + esc(label) + '</td>' +
           '<td class="pv-val">' + esc(String(value)) + '</td></tr>';
  }

  function pvAge(dob) {
    if (!dob) return '';
    var d = new Date(dob), now = new Date();
    if (isNaN(d)) return '';
    var age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() ||
        (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
  }

  function pvSection(sec, pageData) {
    var items = pvItems(pageData, sec);
    var html = '<div class="pv-section"><h2>' + esc(sec.label) + '</h2>';
    if (!items.length) return html + '<p class="pv-empty">No data recorded.</p></div>';

    switch (sec.type) {

      case 'scp-about':
        var a = items[0];
        var age = pvAge(a.dob);
        html += '<table class="pv-table">' +
          pvRow('Name', a.preferred_name || a.legal_name) +
          (a.preferred_name && a.legal_name && a.preferred_name !== a.legal_name
            ? pvRow('Legal Name', a.legal_name) : '') +
          pvRow('Age / DOB', age ? age + ' years  (' + a.dob + ')' : a.dob) +
          pvRow('Pronouns', a.pronouns) +
          pvRow('Language', a.language) +
          pvRow('Phone', a.phone) +
          pvRow('Emergency Contact', a.emergency_contact
            ? a.emergency_contact + (a.emergency_phone ? '  —  ' + a.emergency_phone : '') : '') +
          '</table>';
        break;

      case 'scp-vital':
        html += '<table class="pv-table">';
        items.forEach(function (v) {
          var val = (v.value || '') + (v.unit ? ' ' + v.unit : '');
          var when = (v.date || '') + (v.time ? '  ' + v.time : '');
          html += pvRow(v.measurement || 'Vital', val + (when ? '  —  ' + when : ''));
        });
        html += '</table>';
        break;

      case 'scp-diagnosis':
        html += '<table class="pv-table">';
        items.forEach(function (d) {
          var meta = [d.status,
            d.icd_code ? 'ICD: ' + d.icd_code : '',
            d.diagnosed_date ? 'Dx: ' + d.diagnosed_date : ''].filter(Boolean).join('  ·  ');
          html += pvRow(d.condition || 'Diagnosis', meta);
          if (d.notes) html += '<tr><td></td><td class="pv-note">' + esc(d.notes) + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-next-step':
        html += '<ul class="pv-list">';
        items.forEach(function (n) {
          html += '<li>' + esc(n.action || '') +
            (n.who    ? '  —  ' + esc(n.who)        : '') +
            (n.by_when ? '  by ' + esc(n.by_when)   : '') +
            (n.status  ? '  <em>(' + esc(n.status) + ')</em>' : '') +
            (n.notes   ? '<br><span class="pv-note">' + esc(n.notes) + '</span>' : '') +
            '</li>';
        });
        html += '</ul>';
        break;

      case 'scp-symptom':
        html += '<table class="pv-table">';
        items.forEach(function (s) {
          var meta = [s.severity,
            s.duration ? 'Duration: ' + s.duration : '',
            s.date].filter(Boolean).join('  ·  ');
          html += pvRow(s.symptom || 'Symptom', meta);
          if (s.action_taken) html += '<tr><td></td><td class="pv-note">Action taken: ' + esc(s.action_taken) + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-provider':
        html += '<table class="pv-table">';
        items.forEach(function (p) {
          var role = [p.role, p.specialty].filter(Boolean).join('  ·  ');
          html += pvRow(p.name || 'Provider', role);
          if (p.phone) html += '<tr><td></td><td class="pv-note">Phone: ' + esc(p.phone) +
            (p.when_to_call ? '  —  ' + esc(p.when_to_call) : '') + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-medication':
        html += '<table class="pv-table">';
        items.forEach(function (m) {
          var meta = [m.med_type,
            m.prescribed_by ? 'Rx: ' + m.prescribed_by : '',
            m.started ? 'Started: ' + m.started : ''].filter(Boolean).join('  ·  ');
          html += pvRow(m.label || 'Medication', meta);
          if (m.directions) html += '<tr><td></td><td class="pv-note">' + esc(m.directions) + '</td></tr>';
          if (m.timing && m.timing.length)
            html += '<tr><td></td><td class="pv-note">Timing: ' + esc(m.timing.join(', ')) + '</td></tr>';
          if (m.not_prescribed)
            html += '<tr><td></td><td class="pv-note pv-flag">Not as prescribed: ' + esc(m.not_prescribed) + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-visit':
        items.forEach(function (vi, idx) {
          if (idx > 0) html += '<div style="border-top:1px solid #eee;margin:6px 0"></div>';
          html += '<table class="pv-table">' +
            pvRow('Provider',      vi.provider) +
            pvRow('Provider Type', vi.provider_type) +
            pvRow('Visit Type',    vi.visit_type) +
            pvRow('Date',          vi.date) +
            pvRow('Reason',        vi.reason) +
            pvRow('Outcome',       vi.outcome) +
            pvRow('Follow Up',     vi.follow_up) +
            '</table>';
        });
        break;

      case 'scp-reaction':
        html += '<table class="pv-table">';
        items.forEach(function (r) {
          var detail = [r.severity, r.reaction].filter(Boolean).join(': ');
          html += pvRow(r.substance || 'Substance', detail);
          if (r.notes) html += '<tr><td></td><td class="pv-note">' + esc(r.notes) + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-history':
        html += '<table class="pv-table">';
        items.forEach(function (h) {
          var meta = [h.date, h.provider].filter(Boolean).join('  ·  ');
          html += pvRow(h.event || 'Event', meta);
          if (h.notes) html += '<tr><td></td><td class="pv-note">' + esc(h.notes) + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-directive':
        html += '<table class="pv-table">';
        items.forEach(function (d) {
          html += pvRow(d.directive_type || 'Directive',
            d.date_signed ? 'Signed ' + d.date_signed : '');
          if (d.details) html += '<tr><td></td><td class="pv-note">' + esc(d.details) + '</td></tr>';
          if (d.proxy_name) html += '<tr><td></td><td class="pv-note">Proxy: ' + esc(d.proxy_name) +
            (d.proxy_phone ? '  —  ' + esc(d.proxy_phone) : '') + '</td></tr>';
          if (d.document_location) html += '<tr><td></td><td class="pv-note">Document: ' +
            esc(d.document_location) + '</td></tr>';
        });
        html += '</table>';
        break;

      case 'scp-care-member':
        html += '<table class="pv-table">';
        items.forEach(function (m) {
          var role = m.role === 'Other' ? (m.other_role || 'Other') : (m.role || '');
          html += pvRow(m.name || 'Care Member', role);
          if (m.phone) html += '<tr><td></td><td class="pv-note">Phone: ' + esc(m.phone) + '</td></tr>';
          if (m.notes) html += '<tr><td></td><td class="pv-note">' + esc(m.notes) + '</td></tr>';
        });
        html += '</table>';
        break;
    }

    return html + '</div>';
  }

  function pvHealthLogHtml(data) {
    if (!data || !data.story) return '';
    var entries = data.story.filter(function (i) { return i.type === 'scp-log-entry'; });
    if (!entries.length) return '<div class="pv-section" style="page-break-before:always">' +
      '<h2>Health Log</h2><p class="pv-empty">No entries recorded.</p></div>';
    var rows = entries.map(function (e) {
      return '<tr>' +
        '<td class="pv-lbl" style="width:90px">' + esc(e.date || '') + '</td>' +
        '<td style="width:82px;font-size:9pt;font-weight:600;text-transform:uppercase;' +
          'letter-spacing:.04em;color:#555;vertical-align:top;padding:2px 6px 2px 0">' +
          esc(e.entry_type || '') + '</td>' +
        '<td class="pv-val">' + esc(e.summary || '') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="pv-section" style="page-break-before:always">' +
      '<h2>Health Log</h2>' +
      '<table class="pv-table">' + rows + '</table>' +
      '</div>';
  }

  function pvOpenPrint(pageData, active, healthLogData) {
    // Patient name for header — pulled from about-me even if section is deselected
    var patientName = 'Patient';
    var aboutPage = pageData['about-me'];
    if (aboutPage && aboutPage.story) {
      var ai = aboutPage.story.find(function (i) { return i.type === 'scp-about' && i.committed; });
      if (ai) patientName = ai.preferred_name || ai.legal_name || 'Patient';
    }

    var today = new Date().toLocaleDateString('en-US',
      { year: 'numeric', month: 'long', day: 'numeric' });

    var body = active.map(function (s) { return pvSection(s, pageData); }).join('') +
               (healthLogData ? pvHealthLogHtml(healthLogData) : '');

    var doc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<title>Pre-Visit Summary — ' + esc(patientName) + '</title><style>' +
      'body{font-family:Georgia,serif;font-size:11pt;color:#111;margin:0;padding:0}' +
      '.pv-doc{max-width:720px;margin:0 auto;padding:24px 32px}' +
      '.pv-print-btn{display:block;margin:0 auto 20px;padding:8px 28px;font-size:11pt;' +
        'background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer}' +
      '.pv-header{border-bottom:2px solid #222;margin-bottom:20px;padding-bottom:10px}' +
      '.pv-header h1{margin:0 0 4px;font-size:16pt;font-weight:bold}' +
      '.pv-meta{font-size:9pt;color:#666}' +
      '.pv-section{margin-bottom:16px;page-break-inside:avoid}' +
      '.pv-section h2{font-size:9pt;text-transform:uppercase;letter-spacing:.07em;' +
        'color:#444;margin:0 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}' +
      '.pv-table{width:100%;border-collapse:collapse;font-size:10pt}' +
      '.pv-lbl{width:155px;color:#666;vertical-align:top;padding:2px 10px 2px 0;font-style:italic}' +
      '.pv-val{vertical-align:top;padding:2px 0}' +
      '.pv-note{font-size:9pt;color:#555;padding:1px 0 3px}' +
      '.pv-flag{color:#b45309;font-style:italic}' +
      '.pv-list{margin:2px 0;padding-left:18px;font-size:10pt}' +
      '.pv-list li{margin-bottom:3px}' +
      '.pv-empty{font-size:9pt;color:#aaa;font-style:italic;margin:2px 0}' +
      '@media print{.pv-print-btn{display:none}}' +
      '</style></head><body><div class="pv-doc">' +
      '<button class="pv-print-btn" onclick="window.print()">Print</button>' +
      '<div class="pv-header">' +
        '<h1>Pre-Visit Summary — ' + esc(patientName) + '</h1>' +
        '<div class="pv-meta">Prepared ' + esc(today) + ' &nbsp;·&nbsp; Shared Care Plan</div>' +
      '</div>' +
      body +
      '</div></body></html>';

    var win = window.open('', '_blank', 'width=820,height=960');
    win.document.write(doc);
    win.document.close();
  }

  function emitPrevisit($item, item) {
    injectStyles();
    var enabled = item.sections || PREVISIT_SECTIONS.map(function (s) { return s.key; });
    var boxes = PREVISIT_SECTIONS.map(function (s) {
      var chk = enabled.indexOf(s.key) !== -1 ? ' checked' : '';
      return '<label class="scp-chk" style="flex:0 0 calc(50% - 7px)">' +
        '<input type="checkbox" class="scp-pv-sec" value="' + esc(s.key) + '"' + chk + '>' +
        '<span>' + esc(s.label) + '</span></label>';
    }).join('');
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">Pre-Visit Summary</div>' +
      '<div style="font-size:.78rem;color:#888;margin-bottom:6px">Sections to include:</div>' +
      '<div class="scp-checks" style="margin-bottom:10px">' + boxes + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="scp-commit-btn scp-pv-btn" style="background:#059669;margin-top:0">Generate &amp; Print</button>' +
      '<button class="scp-commit-btn scp-pv-btn-log" style="background:#7c3aed;margin-top:0">+ Health Log</button>' +
      '<button class="scp-commit-btn scp-pv-btn-chat" style="background:#0e7490;margin-top:0">&#128172; Chat with Claude</button>' +
      '</div>' +
      '</div>'
    );
  }

  function bindPrevisit($item, item) {
    // Persist section selections on the item
    $item.find('.scp-pv-sec').on('change', function () {
      var v = [];
      $item.find('.scp-pv-sec:checked').each(function () { v.push(this.value); });
      item.sections = v;
      save($item, item);
    });

    function fetchAndPrint(withHealthLog) {
      var enabled = item.sections || PREVISIT_SECTIONS.map(function (s) { return s.key; });
      var active  = PREVISIT_SECTIONS.filter(function (s) { return enabled.indexOf(s.key) !== -1; });

      // Deduplicate page slugs; always include about-me for the header name
      var slugs = ['about-me'];
      active.forEach(function (s) { if (slugs.indexOf(s.page) === -1) slugs.push(s.page); });
      if (withHealthLog && slugs.indexOf('health-log') === -1) slugs.push('health-log');

      var pageData = {}, pending = slugs.length;
      slugs.forEach(function (slug) {
        fetch('/' + slug + '.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function ()  { return null; })
          .then(function (data) {
            pageData[slug] = data;
            if (--pending === 0) pvOpenPrint(pageData, active,
              withHealthLog ? pageData['health-log'] : null);
          });
      });
    }

    $item.find('.scp-pv-btn').on('click',     function () { fetchAndPrint(false); });
    $item.find('.scp-pv-btn-log').on('click', function () { fetchAndPrint(true);  });
    $item.find('.scp-pv-btn-chat').on('click', function () {
      window.open('http://localhost:8765/tools/scp-chat.html', '_blank',
        'width=480,height=700,resizable=yes');
    });
  }

  window.plugins['scp-previsit'] = {
    emit: emitPrevisit,
    bind: bindPrevisit,
    editor: function ($item, item) {
      if (!item.sections) item.sections = PREVISIT_SECTIONS.map(function (s) { return s.key; });
      $item.empty();
      emitPrevisit($item, item);
      bindPrevisit($item, item);
      save($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-log-entry  — Read-only Health Log entry (auto-generated on commit)
  // ══════════════════════════════════════════════════════════════════════════

  function emitLogEntry($item, item) {
    injectStyles();
    $item.append(
      '<div class="scp-log-row">' +
      '<span class="scp-log-date">' + esc(item.date || '') + '</span>' +
      '<span class="scp-log-type">' + esc(item.entry_type || '') + '</span>' +
      '<span class="scp-log-summary">' + esc(item.summary || '') + '</span>' +
      '</div>'
    );
  }

  window.plugins['scp-log-entry'] = {
    emit: emitLogEntry,
    bind: function () {},  // read-only
    editor: function ($item, item) {
      $item.empty();
      emitLogEntry($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-controls  — Page-level collapse / expand toolbar
  // ══════════════════════════════════════════════════════════════════════════

  function emitControls($item, item) {
    injectStyles();
    $item.append(
      '<div class="scp scp-controls-bar">' +
      '<button class="scp-ctrl-btn scp-expand-all">▲ Expand All</button>' +
      '<button class="scp-ctrl-btn scp-collapse-all">▼ Collapse All</button>' +
      '</div>'
    );
  }

  function bindControls($item, item) {
    var $page = $item.parents('.page:first');

    $item.find('.scp-expand-all').on('click', function () {
      $page.find('.scp-done').each(function () {
        $(this).find('.scp-detail').show();
        $(this).find('.scp-summary').hide();
        $(this).find('.scp-fold-btn').text('▲');
      });
    });

    $item.find('.scp-collapse-all').on('click', function () {
      $page.find('.scp-done').each(function () {
        $(this).find('.scp-detail').hide();
        $(this).find('.scp-summary').show();
        $(this).find('.scp-fold-btn').text('▼');
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // scp-vital-chart  — BP, pulse, and weight trend charts
  // ══════════════════════════════════════════════════════════════════════════

  function vcParseBP(str) {
    var m = String(str || '').match(/^(\d+)\s*\/\s*(\d+)$/);
    return m ? { sys: +m[1], dia: +m[2] } : null;
  }

  function vcParseDate(str) {
    if (!str) return null;
    var d = new Date(str + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function vcFilterDays(arr, days) {
    if (!days) return arr;
    var cutoff = Date.now() - days * 86400000;
    return arr.filter(function (r) { return r.date.getTime() >= cutoff; });
  }

  function vcFmtDate(d) {
    return ['Jan','Feb','Mar','Apr','May','Jun',
            'Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate();
  }

  function vcNiceTicks(minMs, maxMs) {
    if (maxMs <= minMs) return [new Date(minMs)];
    var range = maxMs - minMs, D = 86400000;
    var step = range <= D*20 ? D*2 : range <= D*60 ? D*7 :
               range <= D*180 ? D*30 : range <= D*540 ? D*60 : D*120;
    var ticks = [], t = Math.ceil(minMs / step) * step;
    while (t <= maxMs && ticks.length < 8) { ticks.push(new Date(t)); t += step; }
    return ticks;
  }

  function vcBuildSVG(bpData, pulseData, wtData, wtUnit, cfg) {
    var m = cfg.margin;
    var W = cfg.W, bpH = cfg.bpH, prH = cfg.prH, wtH = cfg.wtH, gap = cfg.gap;
    var H = m.top + bpH + gap + prH + gap + wtH + m.bottom;
    var pL = m.left, pR = W - m.right, pW = pR - pL;
    var bpTop = m.top,           bpBot = bpTop + bpH;
    var prTop = bpBot + gap,     prBot = prTop + prH;
    var wtTop = prBot + gap,     wtBot = wtTop + wtH;

    // Shared X domain
    var allMs = [];
    [bpData, pulseData, wtData].forEach(function (arr) {
      arr.forEach(function (d) { allMs.push(d.date.getTime()); });
    });
    var noData = !allMs.length;
    var xMin = noData ? Date.now() - 86400000*30 : Math.min.apply(null, allMs);
    var xMax = noData ? Date.now() : Math.max.apply(null, allMs);
    var xPad = Math.max((xMax - xMin) * 0.05, 86400000);
    xMin -= xPad; xMax += xPad;
    function xs(ms) { return pL + (ms - xMin) / (xMax - xMin) * pW; }

    // BP Y: fixed 50–200
    var BP_MIN = 50, BP_MAX = 200;
    function bpY(v) {
      v = Math.max(BP_MIN, Math.min(BP_MAX, v));
      return bpBot - (v - BP_MIN) / (BP_MAX - BP_MIN) * bpH;
    }

    // Pulse Y: fixed 40–140
    var PR_MIN = 40, PR_MAX = 140;
    function prY(v) {
      v = Math.max(PR_MIN, Math.min(PR_MAX, v));
      return prBot - (v - PR_MIN) / (PR_MAX - PR_MIN) * prH;
    }

    // Weight Y: auto-scaled from data
    var wtVals = wtData.map(function (d) { return d.wt; });
    var WT_MIN, WT_MAX;
    if (wtVals.length) {
      var wtRange = Math.max.apply(null, wtVals) - Math.min.apply(null, wtVals);
      var wtPad = Math.max(wtRange * 0.15, 2);
      WT_MIN = Math.floor(Math.min.apply(null, wtVals) - wtPad);
      WT_MAX = Math.ceil(Math.max.apply(null, wtVals) + wtPad);
    } else {
      WT_MIN = 100; WT_MAX = 200;
    }
    function wtY(v) {
      v = Math.max(WT_MIN, Math.min(WT_MAX, v));
      return wtBot - (v - WT_MIN) / (WT_MAX - WT_MIN) * wtH;
    }
    // Nice weight ticks
    function wtTicks() {
      var range = WT_MAX - WT_MIN;
      var step = range <= 10 ? 1 : range <= 25 ? 5 : range <= 50 ? 10 : 20;
      var ticks = [];
      for (var v = Math.ceil(WT_MIN/step)*step; v <= WT_MAX; v += step) ticks.push(v);
      return ticks;
    }

    // SVG element builders
    function R(x, y, w, h, fill) {
      if (h <= 0 || w <= 0) return '';
      return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+
        '" height="'+h.toFixed(1)+'" fill="'+fill+'"/>';
    }
    function L(x1, y1, x2, y2, stroke, sw, dash) {
      return '<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+
        '" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+
        '" stroke="'+stroke+'" stroke-width="'+(sw||1)+'"'+
        (dash?' stroke-dasharray="'+dash+'"':'')+'/>';
    }
    function P(pts, stroke, sw) {
      if (!pts || pts.length < 2) return '';
      return '<path d="M'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join('L')+
        '" fill="none" stroke="'+stroke+'" stroke-width="'+(sw||1.5)+
        '" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    function C(cx, cy, r, fill, stroke, tip) {
      return '<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+r+
        '" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1"/>'+
        (tip?'<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+
          '" r="8" fill="transparent" data-tip="'+esc(tip)+'"/>':'');
    }
    function T(x, y, t, sz, fill, anchor, weight) {
      return '<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="'+(sz||8)+
        '" fill="'+(fill||'#666')+'"'+
        (anchor?' text-anchor="'+anchor+'"':'')+
        (weight?' font-weight="'+weight+'"':'')+
        '>'+esc(String(t))+'</text>';
    }

    var s = '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg"'+
      ' style="width:100%;display:block;font-family:system-ui,sans-serif">';

    var xTicks = vcNiceTicks(xMin + xPad, xMax - xPad);

    // ── Panel builder helper ──────────────────────────────────────────────
    function panelBorder(top, h) {
      s += '<rect x="'+pL+'" y="'+top+'" width="'+pW+'" height="'+h+
        '" fill="none" stroke="#d1d5db" stroke-width="0.5"/>';
    }
    function xAxis(panelBot) {
      xTicks.forEach(function (d) {
        var x = xs(d.getTime());
        if (x < pL || x > pR) return;
        s += L(x, panelBot, x, panelBot+3, '#ccc', 0.75);
        s += T(x, panelBot+11, vcFmtDate(d), 7, '#888', 'middle');
      });
    }

    // ── BP Panel ──────────────────────────────────────────────────────────
    s += R(pL, bpY(BP_MAX), pW, bpY(140)-bpY(BP_MAX),  'rgba(252,165,165,0.28)');
    s += R(pL, bpY(140),    pW, bpY(120)-bpY(140),     'rgba(253,224,71,0.28)');
    s += R(pL, bpY(120),    pW, bpY(80) -bpY(120),     'rgba(134,239,172,0.2)');
    s += R(pL, bpY(80),     pW, bpBot   -bpY(80),      'rgba(147,197,253,0.22)');
    panelBorder(bpTop, bpH);
    [60,80,100,120,140,160,180].forEach(function (v) {
      var y = bpY(v);
      if (y < bpTop-1 || y > bpBot+1) return;
      s += L(pL, y, pR, y, '#e5e7eb', 0.5);
      s += T(pL-3, y+3, v, 7, '#888', 'end');
    });
    s += L(pL, bpY(120), pR, bpY(120), '#16a34a', 0.8, '4,3');
    s += L(pL, bpY(80),  pR, bpY(80),  '#16a34a', 0.8, '4,3');
    s += L(pL, bpY(140), pR, bpY(140), '#dc2626', 0.8, '4,3');
    s += T(pL, bpTop-2, 'Blood Pressure (mmHg)', 8, '#444', null, '600');
    // Legend
    s += L(pR-70, bpTop+10, pR-58, bpTop+10, '#ef4444', 1.5);
    s += C(pR-64, bpTop+10, 2.5, '#fff', '#ef4444');
    s += T(pR-56, bpTop+13, 'Systolic', 7, '#ef4444');
    s += L(pR-70, bpTop+21, pR-58, bpTop+21, '#3b82f6', 1.5);
    s += C(pR-64, bpTop+21, 2.5, '#fff', '#3b82f6');
    s += T(pR-56, bpTop+24, 'Diastolic', 7, '#3b82f6');
    // Data
    s += P(bpData.map(function(d){return [xs(d.date.getTime()), bpY(d.sys)];}), '#ef4444', 1.5);
    s += P(bpData.map(function(d){return [xs(d.date.getTime()), bpY(d.dia)];}), '#3b82f6', 1.5);
    bpData.forEach(function (d) {
      var x = xs(d.date.getTime()), tip = vcFmtDate(d.date)+': '+d.sys+'/'+d.dia+' mmHg';
      s += C(x, bpY(d.sys), 3, '#fff', '#ef4444', tip);
      s += C(x, bpY(d.dia), 3, '#fff', '#3b82f6', tip);
    });
    if (!bpData.length) s += T(pL+pW/2, bpTop+bpH/2+4, 'No blood pressure readings', 9, '#bbb', 'middle');
    xAxis(bpBot);

    // ── Pulse Panel ───────────────────────────────────────────────────────
    s += R(pL, prY(PR_MAX), pW, prY(100)-prY(PR_MAX), 'rgba(252,165,165,0.28)');
    s += R(pL, prY(100),    pW, prY(60) -prY(100),    'rgba(134,239,172,0.2)');
    s += R(pL, prY(60),     pW, prBot   -prY(60),     'rgba(147,197,253,0.22)');
    panelBorder(prTop, prH);
    [50,60,70,80,90,100,110,120,130].forEach(function (v) {
      var y = prY(v);
      if (y < prTop-1 || y > prBot+1) return;
      s += L(pL, y, pR, y, '#e5e7eb', 0.5);
      s += T(pL-3, y+3, v, 7, '#888', 'end');
    });
    s += L(pL, prY(60),  pR, prY(60),  '#16a34a', 0.8, '4,3');
    s += L(pL, prY(100), pR, prY(100), '#dc2626', 0.8, '4,3');
    s += T(pL, prTop-2, 'Heart Rate (bpm)', 8, '#444', null, '600');
    s += L(pR-42, prTop+10, pR-30, prTop+10, '#8b5cf6', 1.5);
    s += C(pR-36, prTop+10, 2.5, '#fff', '#8b5cf6');
    s += T(pR-28, prTop+13, 'Pulse', 7, '#8b5cf6');
    s += P(pulseData.map(function(d){return [xs(d.date.getTime()), prY(d.bpm)];}), '#8b5cf6', 1.5);
    pulseData.forEach(function (d) {
      s += C(xs(d.date.getTime()), prY(d.bpm), 3, '#fff', '#8b5cf6',
        vcFmtDate(d.date)+': '+d.bpm+' bpm');
    });
    if (!pulseData.length) s += T(pL+pW/2, prTop+prH/2+4, 'No heart rate readings', 9, '#bbb', 'middle');
    xAxis(prBot);

    // ── Weight Panel ──────────────────────────────────────────────────────
    // No fixed reference bands — weight is individual; just show trend
    s += R(pL, wtTop, pW, wtH, 'rgba(249,250,251,0.8)');
    panelBorder(wtTop, wtH);
    wtTicks().forEach(function (v) {
      var y = wtY(v);
      if (y < wtTop-1 || y > wtBot+1) return;
      s += L(pL, y, pR, y, '#e5e7eb', 0.5);
      s += T(pL-3, y+3, v, 7, '#888', 'end');
    });
    s += T(pL, wtTop-2, 'Weight ('+(wtUnit||'lbs')+')', 8, '#444', null, '600');
    s += L(pR-42, wtTop+10, pR-30, wtTop+10, '#f59e0b', 1.5);
    s += C(pR-36, wtTop+10, 2.5, '#fff', '#f59e0b');
    s += T(pR-28, wtTop+13, 'Weight', 7, '#f59e0b');
    s += P(wtData.map(function(d){return [xs(d.date.getTime()), wtY(d.wt)];}), '#f59e0b', 1.5);
    wtData.forEach(function (d) {
      s += C(xs(d.date.getTime()), wtY(d.wt), 3, '#fff', '#f59e0b',
        vcFmtDate(d.date)+': '+d.wt+(wtUnit?' '+wtUnit:''));
    });
    if (!wtData.length) s += T(pL+pW/2, wtTop+wtH/2+4, 'No weight readings', 9, '#bbb', 'middle');
    xAxis(wtBot);

    s += '</svg>';
    return s;
  }

  function vcOpenFull(bpData, pulseData, wtData, wtUnit) {
    var cfg = { W:700, bpH:200, prH:155, wtH:130, gap:46,
                margin:{top:18,right:20,bottom:30,left:52} };
    var doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vital Signs Chart</title>'+
      '<style>body{margin:0;padding:20px 30px;font-family:system-ui,sans-serif}'+
      'h2{margin:0 0 10px;font-size:13pt;color:#222}'+
      '.vc-btn{padding:7px 22px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-bottom:14px;font-size:10pt}'+
      '@media print{.vc-btn{display:none}}</style></head><body>'+
      '<button class="vc-btn" onclick="window.print()">Print</button>'+
      '<h2>Vital Signs — Blood Pressure, Heart Rate &amp; Weight</h2>'+
      vcBuildSVG(bpData, pulseData, wtData, wtUnit, cfg)+
      '</body></html>';
    var win = window.open('', '_blank', 'width=780,height=780');
    win.document.write(doc);
    win.document.close();
  }

  function emitVitalChart($item, item) {
    injectStyles();
    var ranges = [
      {label:'30d',days:30},{label:'90d',days:90},{label:'6mo',days:180},
      {label:'1y',days:365},{label:'All',days:0}
    ];
    var btnHtml = ranges.map(function (r) {
      return '<button class="scp-date-btn scp-vc-range-btn" data-days="'+r.days+'">'+r.label+'</button>';
    }).join('');
    $item.append(
      '<div class="scp">'+
      '<div class="scp-head">Vital Signs Chart'+
      '<button class="scp-vc-popout" style="float:right;background:none;border:none;'+
        'cursor:pointer;font-size:.9rem;color:#aaa;padding:0 3px" title="Open full window">⛶</button>'+
      '</div>'+
      '<div style="display:flex;gap:4px;margin-bottom:7px">'+btnHtml+'</div>'+
      '<div class="scp-vc-wrap" style="position:relative">'+
      '<div class="scp-vc-svg"><div style="color:#bbb;font-size:.8rem;padding:4px">Loading…</div></div>'+
      '<div class="scp-vc-tip" style="display:none;position:absolute;background:rgba(20,20,20,0.82);'+
        'color:#fff;padding:4px 9px;border-radius:3px;font-size:.74rem;pointer-events:none;'+
        'white-space:nowrap;z-index:10;line-height:1.4"></div>'+
      '</div>'+
      '</div>'
    );
  }

  function bindVitalChart($item, item) {
    var bpAll = [], pulseAll = [], wtAll = [], wtUnit = 'lbs';
    var curDays = 0;

    function render() {
      var bp = vcFilterDays(bpAll, curDays);
      var pr = vcFilterDays(pulseAll, curDays);
      var wt = vcFilterDays(wtAll, curDays);
      var cfg = { W:470, bpH:118, prH:90, wtH:75, gap:30,
                  margin:{top:12,right:14,bottom:22,left:44} };
      $item.find('.scp-vc-svg').html(vcBuildSVG(bp, pr, wt, wtUnit, cfg));

      // Floating tooltip
      var $wrap = $item.find('.scp-vc-wrap');
      var $tip  = $item.find('.scp-vc-tip');
      $item.find('.scp-vc-svg circle[data-tip]').off('mouseenter mouseleave')
        .on('mouseenter', function (e) {
          var rect = $wrap[0].getBoundingClientRect();
          var x = e.clientX - rect.left + 12;
          var y = e.clientY - rect.top  - 36;
          if (x + 150 > rect.width) x -= 165;
          if (y < 4) y = 4;
          $tip.text($(this).attr('data-tip')).css({ left: x, top: y }).show();
        })
        .on('mouseleave', function () { $tip.hide(); });

      $item.find('.scp-vc-range-btn').removeClass('scp-vc-active');
      $item.find('.scp-vc-range-btn[data-days="'+curDays+'"]').addClass('scp-vc-active');
    }

    $item.find('.scp-vc-range-btn').on('click', function () {
      curDays = +$(this).data('days');
      render();
    });

    $item.find('.scp-vc-popout').on('click', function () {
      vcOpenFull(
        vcFilterDays(bpAll, curDays),
        vcFilterDays(pulseAll, curDays),
        vcFilterDays(wtAll, curDays),
        wtUnit
      );
    });

    fetch('/vitals.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (data) {
        if (data && data.story) {
          data.story.forEach(function (i) {
            if (i.type !== 'scp-vital' || !i.committed) return;
            var d = vcParseDate(i.date);
            if (!d) return;
            if (i.measurement === 'Blood Pressure') {
              var bp = vcParseBP(i.value);
              if (bp) bpAll.push({ date: d, sys: bp.sys, dia: bp.dia });
            } else if (i.measurement === 'Heart Rate / Pulse') {
              var bpm = parseFloat(i.value);
              if (!isNaN(bpm)) pulseAll.push({ date: d, bpm: bpm });
            } else if (i.measurement === 'Weight') {
              var wt = parseFloat(i.value);
              if (!isNaN(wt)) {
                if (i.unit) wtUnit = i.unit;
                wtAll.push({ date: d, wt: wt });
              }
            }
          });
          bpAll.sort(function (a, b) { return a.date - b.date; });
          pulseAll.sort(function (a, b) { return a.date - b.date; });
          wtAll.sort(function (a, b) { return a.date - b.date; });
        }
        render();
      });
  }

  window.plugins['scp-vital-chart'] = {
    emit: emitVitalChart,
    bind: bindVitalChart,
    editor: function ($item, item) {
      $item.empty();
      emitVitalChart($item, item);
      bindVitalChart($item, item);
    }
  };


  window.plugins['scp-controls'] = {
    emit: emitControls,
    bind: bindControls,
    editor: function ($item, item) {
      $item.empty();
      emitControls($item, item);
      bindControls($item, item);
    }
  };


  // ══════════════════════════════════════════════════════════════════════════
  // scp-care-member  — Patient-defined Care Team member
  // Broad roles: family, friends, peers, community, and clinical supports.
  // When role is 'Other', item.other_role holds the free-text type.
  // ══════════════════════════════════════════════════════════════════════════

  var CARE_MEMBER_ROLE = ['Family', 'Friend', 'Peer', 'Community Health Worker',
                          'Primary Care', 'Specialist', 'Other'];

  function careMemberRole(item) {
    return item.role === 'Other' ? (item.other_role || 'Other') : (item.role || '');
  }

  function careMemberDetailHtml(item) {
    var displayRole = careMemberRole(item);
    return '<div class="scp-row"><span class="scp-lbl">Name</span><div class="scp-val">'  + esc(item.name || '')  + '</div></div>' +
      '<div class="scp-row"><span class="scp-lbl">Role</span><div class="scp-val">'       + esc(displayRole)      + '</div></div>' +
      (item.phone ? '<div class="scp-row"><span class="scp-lbl">Phone</span><div class="scp-val">' + esc(item.phone) + '</div></div>' : '') +
      (item.notes ? '<div class="scp-row"><span class="scp-lbl">Notes</span><div class="scp-val">' + esc(item.notes) + '</div></div>' : '');
  }

  function emitCareMember($item, item) {
    injectStyles();
    if (item.committed) {
      var summary = esc(item.name || 'Care Member') + ' — ' + esc(careMemberRole(item));
      $item.append(
        '<div class="scp scp-done">' +
        '<div class="scp-head">Care Team<button class="scp-fold-btn">▲</button><button class="scp-edit-btn">✎ Edit</button></div>' +
        '<div class="scp-detail">' + careMemberDetailHtml(item) + '</div>' +
        '<div class="scp-summary" style="display:none">' + summary + '</div>' +
        '</div>'
      );
      return;
    }
    $item.append(
      '<div class="scp">' +
      '<div class="scp-head">' + esc(item.name || 'New Care Team Member') + '</div>' +
      row('Name',         inp('scp-cm-name',  item.name)) +
      row('Role',         sel('scp-cm-role',  CARE_MEMBER_ROLE, item.role)) +
      row('Specify Role', inp('scp-cm-other', item.other_role, 'e.g. naturopath, yoga instructor')) +
      row('Phone',        inp('scp-cm-phone', item.phone)) +
      row('Notes',        ta('scp-cm-notes',  item.notes)) +
      '<button class="scp-commit-btn">Save Entry</button>' +
      '</div>'
    );
  }

  function bindCareMember($item, item) {
    if (item.committed) { addEditButton($item, item, emitCareMember, bindCareMember); return; }

    // Show/hide "Specify Role" based on selection
    function toggleOther() {
      var isOther = $item.find('.scp-cm-role').val() === 'Other';
      $item.find('.scp-cm-other').closest('.scp-row').toggle(isOther);
    }
    toggleOther();

    $item.find('.scp-cm-notes').each(function () { grow(this); });

    $item.find('.scp-cm-name').on('input', function () {
      item.name = this.value;
      $item.find('.scp-head').text(this.value || 'New Care Team Member');
    });
    $item.find('.scp-cm-other').on('input', function () { item.other_role = this.value; });
    $item.find('.scp-cm-phone').on('input', function () { item.phone      = this.value; });
    $item.find('.scp-cm-notes').on('input', function () { grow(this); item.notes = this.value; });
    $item.find('.scp-cm-role').on('change', function () {
      item.role = this.value;
      toggleOther();
    });

    $item.find('.scp-commit-btn').on('click', function () {
      item.committed = true;
      save($item, item);
      $item.empty(); emitCareMember($item, item); bindCareMember($item, item);
    });
  }

  window.plugins['scp-care-member'] = {
    emit: emitCareMember,
    bind: bindCareMember,
    editor: function ($item, item) {
      item.role = item.role || 'Family';
      $item.empty();
      emitCareMember($item, item);
      bindCareMember($item, item);
      save($item, item);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // scp-factory — Page-specific persistent add-entry widget
  //
  // item.types  — array of SCP type names to offer as buttons
  //               e.g. ["scp-medication"] or ["scp-vital","scp-symptom","scp-visit"]
  //
  // Clicking a button:
  //   1. Creates a blank item of that type
  //   2. Inserts it before the factory in the DOM (factory stays as permanent widget)
  //   3. Persists the add to the server via wiki.pageHandler.put
  //   4. Emits and binds the new item's plugin so it's immediately editable
  // ══════════════════════════════════════════════════════════════════════════

  var SCP_TYPE_NAMES = {
    'scp-medication':  'Medication',
    'scp-vital':       'Vital Sign',
    'scp-symptom':     'Symptom',
    'scp-visit':       'Visit / Appointment',
    'scp-about':       'About Me entry',
    'scp-care-member': 'Care Team member',
    'scp-provider':    'Provider',
    'scp-diagnosis':   'Diagnosis',
    'scp-reaction':    'Reaction / Allergy',
    'scp-history':     'History entry',
    'scp-next-step':   'Next Step',
    'scp-directive':   'Directive',
    'scp-access':      'Access entry',
    'scp-field':       'Lab Result',
  };

  function emitScpFactory($item, item) {
    injectStyles();
    var types = Array.isArray(item.types) ? item.types : [];
    var html = '<div class="scp scp-factory-wrap">';
    html += '<div class="scp-factory-label">Add entry</div>';
    if (types.length === 0) {
      html += '<span style="color:#9ca3af;font-size:.82rem">No types configured.</span>';
    } else {
      types.forEach(function (type) {
        var name = SCP_TYPE_NAMES[type] || type;
        html += '<button class="scp-factory-btn" data-type="' + esc(type) + '">+ ' + esc(name) + '</button>';
      });
    }
    html += '</div>';
    $item.append(html);
  }

  function bindScpFactory($item, item) {
    $item.find('.scp-factory-btn').on('click', function () {
      var chosenType = $(this).data('type');
      if (!chosenType) return;

      var atTop = item.position === 'top';
      var $page = $item.parents('.page:first');
      var newId = pvId();
      var newItem = { type: chosenType, id: newId };

      // Insert in DOM: after factory when pinned at top, before it when at bottom
      var $newEl = $('<div class="item ' + chosenType + '" data-id="' + newId + '">');
      if (atTop) {
        $item.after($newEl);   // new item appears just below the factory
      } else {
        $item.before($newEl);  // new item appears just above the factory
      }

      // Persist: after factory (top) keeps factory pinned; after prev item (bottom)
      var action = { type: 'add', id: newId, item: newItem };
      if (atTop) {
        action.after = item.id;
      } else {
        var $prevItem = $item.prev('.item');
        if ($prevItem.length) { action.after = $prevItem.attr('data-id'); }
      }
      wiki.pageHandler.put($page, action);

      // Render and bind the new item via its own plugin
      $newEl.data('pageElement', $page);
      $newEl.data('item', newItem);
      wiki.getPlugin(chosenType, function (plugin) {
        plugin.emit($newEl, newItem);
        plugin.bind($newEl, newItem);
        $newEl.find('.scp-commit-btn').first().after(
          '<button class="scp-discard-btn">&#x2715; Discard</button>'
        );
        $newEl.find('.scp-discard-btn').on('click', function () {
          wiki.pageHandler.put($page, { type: 'remove', id: newId });
          $newEl.remove();
        });
      });

      $newEl[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  window.plugins['scp-factory'] = {
    emit: emitScpFactory,
    bind: bindScpFactory
  };

}());
