// GM-editable content. Every list on the site (rules, chapters, cast, ranks, items, moves, abilities,
// index entries, shop) starts from built-in defaults and is overlaid with the GM's edits stored in
// the table state under content/<type>/<id>. {deleted:true} hides a default.
import * as store from './store.js?v=6adff0b8';
import { slug, uid, esc, $, $$, num } from './util.js?v=6adff0b8';
import { modal, closeModal } from './ui.js?v=6adff0b8';

export function merged(type, defaults, key = (d) => d.id || slug(d.name || d.title)) {
  const edits = store.get('content/' + type) || {};
  const out = new Map();
  for (const d of defaults) { const id = key(d); out.set(id, { ...d, id, builtin: true }); }
  for (const [id, e] of Object.entries(edits)) {
    if (e?.deleted) out.delete(id);
    else out.set(id, { ...(out.get(id) || {}), ...e, id, edited: true });
  }
  return [...out.values()];
}

export const saveContent = (type, id, value) => store.set(`content/${type}/${id}`, value);
export const deleteContent = (type, id) => store.set(`content/${type}/${id}`, { deleted: true });
export const resetContent = (type, id) => store.set(`content/${type}/${id}`, null);

// schema: [[key, label, kind]] kind: text | area | lines | list | number | select:<a|b|c>
export function editContent(type, schema, item, { title, onSave } = {}) {
  const isNew = !item;
  const x = item ? structuredClone(item) : {};
  const field = ([k, label, kind = 'text']) => {
    const v = x[k];
    if (kind === 'area') return `<label class="f">${label}<textarea data-k="${k}" rows="4">${esc(v ?? '')}</textarea></label>`;
    if (kind === 'lines') return `<label class="f">${label} <span class="small muted">(one per line)</span><textarea data-k="${k}" data-kind="lines" rows="4">${esc((v || []).join('\n'))}</textarea></label>`;
    if (kind === 'list') return `<label class="f">${label} <span class="small muted">(comma separated)</span><input data-k="${k}" data-kind="list" value="${esc((v || []).join(', '))}"></label>`;
    if (kind === 'number') return `<label class="f">${label}<input data-k="${k}" data-kind="number" type="number" inputmode="numeric" value="${esc(v ?? '')}"></label>`;
    if (kind.startsWith('select:')) return `<label class="f">${label}<select data-k="${k}">${kind.slice(7).split('|').map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    return `<label class="f">${label}<input data-k="${k}" value="${esc(v ?? '')}"></label>`;
  };
  const el = modal(`<h2>${esc(title || (isNew ? 'Add' : 'Edit'))}</h2>
    <div class="stack">${schema.map(field).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn" id="cs-save">Save</button>
    ${isNew ? '' : `<button class="btn alt" id="cs-dup">Duplicate</button><button class="btn bad" id="cs-del">Delete</button>${item.builtin && item.edited ? '<button class="btn alt" id="cs-reset">Undo my changes</button>' : ''}`}</div>
    <p class="small muted" style="margin-top:10px">Saved to this table — players see it straight away.</p>`);
  const read = () => {
    const o = {};
    $$('[data-k]', el).forEach((f) => {
      const k = f.dataset.k;
      if (f.dataset.kind === 'lines') o[k] = f.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (f.dataset.kind === 'list') o[k] = f.value.split(',').map((s) => s.trim()).filter(Boolean);
      else if (f.dataset.kind === 'number') o[k] = f.value === '' ? null : num(f.value);
      else o[k] = f.value.trim();
    });
    return o;
  };
  $('#cs-save', el).onclick = () => {
    const o = read();
    const id = isNew ? (slug(o.name || o.title || '') || uid()) + (isNew && store.get(`content/${type}/${slug(o.name || o.title || '')}`) ? '-' + uid().slice(0, 3) : '') : item.id;
    saveContent(type, id, o); closeModal(); onSave?.(id);
  };
  if (!isNew) {
    $('#cs-dup', el).onclick = () => { const o = read(); const nm = (o.name || o.title || 'Copy') + ' (copy)'; if ('name' in o) o.name = nm; else o.title = nm; saveContent(type, slug(nm) + '-' + uid().slice(0, 3), o); closeModal(); };
    $('#cs-del', el).onclick = () => { if (confirm('Delete this?')) { deleteContent(type, item.id); closeModal(); } };
    const r = $('#cs-reset', el); if (r) r.onclick = () => { resetContent(type, item.id); closeModal(); };
  }
}
