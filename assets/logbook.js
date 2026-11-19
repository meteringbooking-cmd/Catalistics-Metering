// Catalistics — reusable "logbook" page engine.
// A logbook is a list of records in one Firestore collection with filters,
// add / edit / delete, spreadsheet import and Excel export. Pages describe
// their fields; this module does the rest.

import {
  C, db, state, collection, doc, addDoc, setDoc, deleteDoc, serverTimestamp,
  $, $$, esc, el, options, num, fmtDate, fmtMoney, fmtNum, todayISO, addDays,
  fetchAll, fetchRange, getEngineers, engineerOptions, teamName, contractName, teamOf,
  modal, toast, confirmBox, makeSortable, exportXlsx, readSpreadsheet, pick, normaliseDate,
  matchEngineer, commitInBatches, stamp, icon, wantsAdd
} from './app.js';

const optList = (f, cfg) => (typeof f.options === 'function' ? f.options(cfg) : f.options || []);

function displayValue(f, row, ctx) {
  const v = f.compute ? f.compute(row, ctx) : row[f.key];
  if (f.format) return f.format(v, row, ctx);
  switch (f.type) {
    case 'date': return v ? `<span data-v="${esc(v)}">${fmtDate(v)}</span>` : '<span class="faint">–</span>';
    case 'money': return v === '' || v === undefined ? '–' : fmtMoney(v, 2);
    case 'number': return v === '' || v === undefined ? '–' : fmtNum(v, f.dp ?? 0);
    case 'checkbox': return v ? `<span class="t-good">${icon('check', 16)}</span>` : '<span class="faint">–</span>';
    case 'engineer': return esc(row.engineerName || '–');
    case 'team': return esc(teamName(row.teamId));
    case 'contract': return esc(contractName(row.contractId));
    default: return v === '' || v === undefined || v === null ? '<span class="faint">–</span>' : esc(v);
  }
}
function plainValue(f, row, ctx) {
  const v = f.compute ? f.compute(row, ctx) : row[f.key];
  if (f.exportValue) return f.exportValue(v, row, ctx);
  if (f.type === 'engineer') return row.engineerName || '';
  if (f.type === 'team') return teamName(row.teamId);
  if (f.type === 'contract') return contractName(row.contractId);
  if (f.type === 'checkbox') return v ? 'Yes' : 'No';
  return v ?? '';
}

function inputFor(f, value, ctx, engineers) {
  const id = `f_${f.key}`;
  const req = f.required ? 'required' : '';
  switch (f.type) {
    case 'textarea': return `<textarea id="${id}" ${req}>${esc(value)}</textarea>`;
    case 'number': case 'money': return `<input id="${id}" type="number" step="${f.step || 'any'}" value="${esc(value)}" ${req}>`;
    case 'date': return `<input id="${id}" type="date" value="${esc(value)}" ${req}>`;
    case 'time': return `<input id="${id}" type="time" value="${esc(value)}" ${req}>`;
    case 'email': return `<input id="${id}" type="email" value="${esc(value)}" ${req}>`;
    case 'checkbox': return `<label class="field inline"><input id="${id}" type="checkbox" ${value ? 'checked' : ''}> ${esc(f.checkLabel || 'Yes')}</label>`;
    case 'select': return `<select id="${id}" ${req}>${options(optList(f, ctx.cfg), value, { blank: f.blank ?? 'Select…' })}</select>`;
    case 'engineer': return `<select id="${id}" ${req}>${engineerOptions(engineers, value)}</select>`;
    case 'team': return `<select id="${id}" ${req}>${options(ctx.cfg.teams.map(t => ({ value: t.id, label: `${t.name} — ${t.leader}` })), value, { blank: 'Select team…' })}</select>`;
    case 'contract': return `<select id="${id}" ${req}>${options(ctx.cfg.contracts.map(c => ({ value: c.id, label: c.name })), value, { blank: 'Select contract…' })}</select>`;
    default: return `<input id="${id}" type="text" value="${esc(value)}" ${req}>`;
  }
}
function readInput(f, root) {
  const n = $(`#f_${f.key}`, root);
  if (!n) return undefined;
  if (f.type === 'checkbox') return n.checked;
  if (f.type === 'number' || f.type === 'money') return n.value === '' ? '' : Number(n.value);
  return n.value.trim();
}

/**
 * spec: {
 *   collection, fields: [{ key, label, type, options, required, list, form, filter, compute, format, full, default }],
 *   dateField, defaultDays (0 = load everything), addLabel, intro,
 *   rowClass(row, ctx), summary(rows, el, ctx), toolbar: [{ label, kind, onClick(api) }],
 *   rowActions: [{ label, kind, show(row, ctx), run(row, api) }], beforeSave(data, existing, ctx),
 *   importable (default true), canEdit(row, ctx), deleteRoles
 * }
 */
export async function logbook(container, spec, ctx) {
  const fields = spec.fields;
  const dateField = spec.dateField;
  const hasEngineer = fields.some(f => f.type === 'engineer');
  let engineers = hasEngineer ? await getEngineers() : [];
  let rows = [];

  const filterFields = fields.filter(f => f.filter && f.type === 'select');
  container.innerHTML = `
    ${spec.intro ? `<p class="muted" style="margin-top:-6px">${spec.intro}</p>` : ''}
    <div class="toolbar">
      <label class="field">Search<input type="search" id="lbSearch" placeholder="Type to filter…"></label>
      ${dateField ? `<label class="field">From<input type="date" id="lbFrom"></label><label class="field">To<input type="date" id="lbTo"></label>` : ''}
      ${hasEngineer ? `<label class="field">Team<select id="lbTeam">${options(ctx.cfg.teams.map(t => ({ value: t.id, label: t.name })), '', { blank: 'All teams' })}</select></label>
        <label class="field">Engineer<select id="lbEng">${engineerOptions(engineers, '', 'All engineers')}</select></label>` : ''}
      ${filterFields.map(f => `<label class="field">${esc(f.label)}<select data-filter="${f.key}">${options(optList(f, ctx.cfg), '', { blank: 'All' })}</select></label>`).join('')}
      <div class="spacer"></div>
      <div class="row" id="lbButtons"></div>
    </div>
    <div class="lb-summary"></div>
    <div class="table-wrap" style="--max-h:70vh"><table class="table" id="lbTable"></table></div>
    <div class="muted" id="lbCount" style="margin-top:8px"></div>`;

  const btns = $('#lbButtons', container);
  for (const t of spec.toolbar || []) {
    const b = el(`<button class="btn ${t.kind || ''}" type="button">${t.icon ? icon(t.icon, 15) : ''}${esc(t.label)}</button>`);
    b.onclick = () => t.onClick(api); btns.append(b);
  }
  if (spec.importable !== false) {
    const b = el('<button class="btn" type="button"><svg class="ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/></svg> Import</button>'); b.onclick = () => importDialog(); btns.append(b);
  }
  const ex = el('<button class="btn" type="button"><svg class="ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg> Export</button>'); ex.onclick = () => exportRows(); btns.append(ex);
  if (spec.canAdd !== false) {
    const add = el(`<button class="btn primary" type="button">${icon('plus', 15)} ${esc(spec.addLabel || 'Add record')}</button>`); add.onclick = () => openForm(); btns.append(add);
  }

  if (dateField) {
    const days = spec.defaultDays ?? 90;
    if (days) { $('#lbFrom', container).value = addDays(todayISO(), -days); $('#lbTo', container).value = addDays(todayISO(), spec.futureDays ?? 0); }
    $('#lbFrom', container).onchange = load; $('#lbTo', container).onchange = load;
  }
  $('#lbSearch', container).oninput = render;
  $$('[data-filter]', container).forEach(s => s.onchange = render);
  if (hasEngineer) { $('#lbTeam', container).onchange = render; $('#lbEng', container).onchange = render; }

  async function load() {
    $('#lbTable', container).innerHTML = '<tbody><tr><td class="empty">Loading…</td></tr></tbody>';
    try {
      const from = dateField && $('#lbFrom', container).value;
      const to = dateField && ($('#lbTo', container).value || '9999-12-31');
      rows = from ? await fetchRange(spec.collection, from, to, dateField) : await fetchAll(spec.collection);
      if (dateField && !from && $('#lbTo', container).value) rows = rows.filter(r => !r[dateField] || r[dateField] <= to);
      const sk = spec.sortKey || dateField;
      rows.sort((a, b) => (sk ? String(b[sk] || '').localeCompare(String(a[sk] || '')) : 0) || String(a.engineerName || a.name || '').localeCompare(String(b.engineerName || b.name || '')));
      if (spec.sortAsc) rows.reverse();
      render();
    } catch (e) {
      console.error(e);
      $('#lbTable', container).innerHTML = `<tbody><tr><td class="empty">Could not load records: ${esc(e.message)}</td></tr></tbody>`;
    }
  }

  function visibleRows() {
    const q = $('#lbSearch', container).value.trim().toLowerCase();
    const team = hasEngineer && $('#lbTeam', container).value;
    const eng = hasEngineer && $('#lbEng', container).value;
    const sel = $$('[data-filter]', container).map(s => [s.dataset.filter, s.value]).filter(([, v]) => v);
    return rows.filter(r => {
      if (team && r.teamId !== team) return false;
      if (eng && r.engineerId !== eng) return false;
      for (const [k, v] of sel) if (String(r[k] ?? '') !== v) return false;
      if (q) {
        const hay = fields.map(f => plainValue(f, r, ctx)).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    const vis = visibleRows();
    const cols = fields.filter(f => f.list !== false);
    const actions = spec.rowActions || [];
    const table = $('#lbTable', container);
    table.innerHTML = `<thead><tr>${cols.map(f => `<th class="${f.type === 'number' || f.type === 'money' ? 'num' : ''}">${esc(f.label)}</th>`).join('')}<th data-nosort></th></tr></thead>
      <tbody>${vis.length ? vis.map(r => `<tr data-id="${esc(r.id)}" class="${spec.rowClass ? spec.rowClass(r, ctx) || '' : ''}">
        ${cols.map(f => `<td class="${f.type === 'number' || f.type === 'money' ? 'num' : ''}">${displayValue(f, r, ctx)}</td>`).join('')}
        <td class="actions">${actions.filter(a => !a.show || a.show(r, ctx)).map((a, i) => `<button class="btn sm ${a.kind || ''}" data-act="${actions.indexOf(a)}">${esc(a.label)}</button>`).join(' ')}
          ${(!spec.canEdit || spec.canEdit(r, ctx)) ? '<button class="btn sm ghost" data-edit>Edit</button>' : ''}</td>
      </tr>`).join('') : `<tr><td colspan="${cols.length + 1}" class="empty">No records match. ${spec.canAdd !== false ? 'Use “Add” to create one.' : ''}</td></tr>`}</tbody>`;
    makeSortable(table);
    $$('[data-edit]', table).forEach(b => b.onclick = () => openForm(rows.find(r => r.id === b.closest('tr').dataset.id)));
    $$('[data-act]', table).forEach(b => b.onclick = () => actions[b.dataset.act].run(rows.find(r => r.id === b.closest('tr').dataset.id), api));
    $('#lbCount', container).textContent = `${vis.length} of ${rows.length} record${rows.length === 1 ? '' : 's'} shown`;
    if (spec.summary) spec.summary(vis, $('.lb-summary', container), ctx, rows);
  }

  function openForm(row = null, defaults = {}) {
    const isNew = !row;
    const data = row || { ...(spec.newDefaults ? spec.newDefaults(ctx) : {}), ...defaults };
    for (const f of fields) if (isNew && data[f.key] === undefined && f.default !== undefined) data[f.key] = typeof f.default === 'function' ? f.default(ctx) : f.default;
    const formFields = fields.filter(f => f.form !== false && !f.compute);
    const body = el(`<form class="form-grid" onsubmit="return false">${formFields.map(f => `
      <label class="field ${f.full || f.type === 'textarea' ? 'full' : ''}">${esc(f.label)}${f.required ? ' *' : ''}
        ${inputFor(f, f.type === 'engineer' ? data.engineerId : data[f.key], ctx, engineers)}
        ${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</label>`).join('')}</form>`);
    const canDelete = !isNew && (spec.deleteRoles || ['admin', 'manager']).includes(ctx.role);
    spec.onFormOpen?.(body, data, ctx);
    modal({
      title: isNew ? (spec.addLabel || 'Add record') : 'Edit record', body, wide: formFields.length > 8,
      actions: [
        ...(canDelete ? [{ label: 'Delete', kind: 'danger', onClick: async () => {
          if (!(await confirmBox('Delete this record? This cannot be undone.', { okLabel: 'Delete', danger: true }))) return false;
          await deleteDoc(doc(db, spec.collection, row.id)); toast('Deleted', 'good'); await load(); spec.afterSave?.(api);
        } }] : []),
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Save', kind: 'primary', onClick: async () => {
          let out = {};
          for (const f of formFields) {
            const v = readInput(f, body);
            if (f.required && (v === '' || v === undefined)) { toast(`${f.label} is required`, 'warn'); return false; }
            if (f.type === 'engineer') {
              const e = engineers.find(x => x.id === v);
              Object.assign(out, { engineerId: v || '', engineerName: e?.name || '' });
              if (e) Object.assign(out, { teamId: e.teamId || '', contractId: e.contractId || '' });
              else if (!formFields.some(x => x.key === 'teamId' && x.type === 'team')) Object.assign(out, { teamId: '', contractId: '' });
            } else out[f.key] = v;
          }
          if (spec.beforeSave) { const r = await spec.beforeSave(out, row, ctx); if (r === false) return false; if (r) out = r; }
          if (isNew) await addDoc(collection(db, spec.collection), { ...out, createdAt: serverTimestamp(), createdBy: state.user.email, ...stamp() });
          else await setDoc(doc(db, spec.collection, row.id), stamp(out), { merge: true });
          toast('Saved', 'good'); await load(); spec.afterSave?.(api);
        } },
      ],
    });
  }

  async function exportRows() {
    const cols = fields.filter(f => f.export !== false);
    const out = visibleRows().map(r => Object.fromEntries(cols.map(f => [f.label, plainValue(f, r, ctx)])));
    await exportXlsx(`${spec.collection}-${todayISO()}`, { [spec.sheetName || 'Records']: out });
  }

  function importDialog() {
    const formFields = fields.filter(f => f.form !== false && !f.compute);
    const body = el(`<div>
      <p>Choose an Excel or CSV file. The first row should hold column headings matching these names:</p>
      <p class="mono" style="font-size:12px">${formFields.map(f => esc(f.type === 'engineer' ? 'Engineer (name or employee number)' : f.label)).join(' · ')}</p>
      <input type="file" accept=".xlsx,.xls,.csv"><div class="lb-preview" style="margin-top:12px"></div></div>`);
    let ready = [];
    $('input', body).onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      const raw = await readSpreadsheet(file);
      engineers = hasEngineer ? await getEngineers({ includeLeavers: true }) : [];
      let missing = 0;
      ready = raw.map(r => {
        const o = {};
        for (const f of formFields) {
          if (f.type === 'engineer') {
            const m = matchEngineer(engineers, pick(r, 'Engineer', 'Engineer name', 'Name', 'Employee number', 'Employee no', f.label));
            if (!m) { missing++; return null; }
            Object.assign(o, { engineerId: m.id, engineerName: m.name, teamId: m.teamId || '', contractId: m.contractId || '' });
            continue;
          }
          let v = pick(r, f.label, f.key);
          if (f.type === 'date') v = normaliseDate(v);
          if (f.type === 'number' || f.type === 'money') v = v === '' ? '' : num(String(v).replace(/[£$€,]/g, ''));
          if (f.type === 'checkbox') v = /^(y|yes|true|1)$/i.test(String(v));
          if (f.type === 'team') v = ctx.cfg.teams.find(t => t.id === v || t.name.toLowerCase() === String(v).toLowerCase())?.id || '';
          if (f.type === 'contract') v = ctx.cfg.contracts.find(c => c.id === v || c.name.toLowerCase() === String(v).toLowerCase())?.id || '';
          if ((v === '' || v === undefined) && f.default !== undefined) v = typeof f.default === 'function' ? f.default(ctx) : f.default;
          o[f.key] = v ?? '';
        }
        return o;
      }).filter(Boolean);
      $('.lb-preview', body).innerHTML = `<p><b>${ready.length}</b> row(s) ready to import.${missing ? ` <span class="t-warn">${missing} row(s) skipped — engineer not found in the directory.</span>` : ''}</p>`;
    };
    modal({
      title: 'Import records', body,
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Import', kind: 'primary', onClick: async () => {
        if (!ready.length) { toast('Choose a file first', 'warn'); return false; }
        const ops = [];
        for (const r of ready) {
          const d = spec.beforeSave ? (await spec.beforeSave({ ...r }, null, ctx)) || r : r;
          ops.push({ type: 'set', ref: doc(collection(db, spec.collection)), data: { ...d, createdAt: serverTimestamp(), createdBy: state.user.email, ...stamp() } });
        }
        await commitInBatches(ops);
        toast(`Imported ${ops.length} record(s)`, 'good'); await load(); spec.afterSave?.(api);
      } }],
    });
  }

  const api = { reload: load, openForm, get rows() { return rows; }, get visible() { return visibleRows(); }, ctx, render };
  await load();
  if (spec.canAdd !== false && !spec.noAutoAdd && wantsAdd()) openForm();
  return api;
}

/** Shared engineer + team columns most logbooks start with. */
export const engineerFields = (extra = {}) => [
  { key: 'engineerId', label: 'Engineer', type: 'engineer', required: true, ...extra },
  { key: 'teamId', label: 'Team', type: 'team', form: false },
];
export { teamOf };
