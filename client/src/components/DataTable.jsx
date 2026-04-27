import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

const PAGE_SIZE = 25;

/**
 * Generic data table.
 *
 * Props:
 *  - rows: array of objects.
 *  - columns: [{ key, label, width?, render?, editable?, editType?, options?, format? }]
 *      editType: 'text' | 'number' | 'select'
 *      options: for select editType
 *      format: function(value) => display value
 *  - rowId: (row) => unique id (string)
 *  - searchOptions: ['All', 'Customer Name', ...] — drop-down values
 *  - searchKeys: { 'Customer Name': 'Customer Name', ... } — maps option to row key
 *  - onSave: async (rowId, patchObj) => ...
 *  - onDelete: async (rowId) => ...
 *  - actions: optional list of extra actions [{ icon, title, onClick(row) }]
 *  - emptyMessage: shown when no rows
 */
export default function DataTable({
  rows,
  columns,
  rowId,
  searchOptions,
  searchKeys = {},
  onSave,
  onDelete,
  actions = [],
  emptyMessage = 'No records to display',
}) {
  const [page, setPage] = useState(1);
  const [searchCol, setSearchCol] = useState('All');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState({ col: 'All', q: '' });

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Reset pagination if data shrinks
  useEffect(() => { setPage(1); }, [rows]);

  const filtered = useMemo(() => {
    if (!appliedQuery.q || appliedQuery.col === 'All') return rows;
    const key = searchKeys[appliedQuery.col] || appliedQuery.col;
    const q = appliedQuery.q.toLowerCase();
    return rows.filter(r => String(r[key] ?? '').toLowerCase().includes(q));
  }, [rows, appliedQuery, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const startEdit = row => {
    setEditingId(rowId(row));
    const init = {};
    for (const c of columns) if (c.editable) init[c.key] = row[c.key] ?? '';
    setEditValues(init);
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = async row => {
    if (!onSave) return;
    await onSave(rowId(row), editValues);
    cancelEdit();
  };

  const setEditField = (key, value) => setEditValues(v => ({ ...v, [key]: value }));

  return (
    <div>
      {/* search bar */}
      {searchOptions && searchOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 justify-end">
          <div className="w-44">
            <SearchableSelect
              options={searchOptions}
              value={searchCol}
              onChange={setSearchCol}
              isClearable={false}
            />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            className="px-3 py-2 border border-slate-300 rounded-md text-sm w-56"
            onKeyDown={e => { if (e.key === 'Enter') setAppliedQuery({ col: searchCol, q: query }); }}
          />
          <button
            type="button"
            onClick={() => setAppliedQuery({ col: searchCol, q: query })}
            className="px-3 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:bg-ink hover:opacity-90 inline-flex items-center gap-1"
          >
            <i className="fa-solid fa-magnifying-glass" /> Search
          </button>
          <button
            type="button"
            onClick={() => { setQuery(''); setSearchCol('All'); setAppliedQuery({ col: 'All', q: '' }); }}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <i className="fa-solid fa-xmark" /> Clear
          </button>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink text-white">
              <tr>
                {columns.map(c => (
                  <th key={c.key} className="text-left font-semibold px-4 py-3 whitespace-nowrap" style={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
                {(onSave || onDelete || actions.length > 0) && (
                  <th className="text-left font-semibold px-4 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center text-slate-500 py-6">
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {pageRows.map(row => {
                const id = rowId(row);
                const isEditing = editingId === id;
                return (
                  <tr key={id} className="border-t border-slate-100 hover:bg-slate-50">
                    {columns.map(c => (
                      <td key={c.key} className="px-4 py-3 align-top">
                        {isEditing && c.editable ? (
                          renderEditor(c, editValues[c.key], v => setEditField(c.key, v))
                        ) : c.render ? (
                          c.render(row[c.key], row)
                        ) : c.format ? (
                          c.format(row[c.key], row)
                        ) : (
                          formatDisplay(row[c.key])
                        )}
                      </td>
                    ))}
                    {(onSave || onDelete || actions.length > 0) && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          {actions.map((a, i) => (
                            <button
                              key={i}
                              type="button"
                              title={a.title}
                              onClick={() => a.onClick(row)}
                              className="px-2 py-1 rounded bg-ink2 text-white hover:opacity-90"
                            >
                              <i className={`fa-solid ${a.icon}`} />
                            </button>
                          ))}
                          {!isEditing && onSave && (
                            <button type="button" onClick={() => startEdit(row)} title="Edit" className="px-2 py-1 rounded bg-ink2 text-white hover:opacity-90">
                              <i className="fa-solid fa-pen" />
                            </button>
                          )}
                          {isEditing && onSave && (
                            <>
                              <button type="button" onClick={() => saveEdit(row)} title="Update" className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                                <i className="fa-solid fa-check" />
                              </button>
                              <button type="button" onClick={cancelEdit} title="Cancel" className="px-2 py-1 rounded bg-slate-400 text-white hover:bg-slate-500">
                                <i className="fa-solid fa-xmark" />
                              </button>
                            </>
                          )}
                          {!isEditing && onDelete && (
                            <button type="button" onClick={() => setConfirmDeleteId(id)} title="Delete" className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600">
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate-600">
          <span>
            Page {safePage} of {totalPages} • {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete record"
        message="Are you sure you want to delete this record? This cannot be undone."
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (onDelete) await onDelete(id);
        }}
      />
    </div>
  );
}

function renderEditor(col, value, setValue) {
  if (col.editType === 'select') {
    return (
      <SearchableSelect
        options={col.options || []}
        value={value}
        onChange={setValue}
        placeholder="Select..."
      />
    );
  }
  if (col.editType === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={e => setValue(e.target.value === '' ? '' : Number(e.target.value))}
        className="px-2 py-1 border border-slate-300 rounded text-sm w-full"
      />
    );
  }
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => setValue(e.target.value)}
      className="px-2 py-1 border border-slate-300 rounded text-sm w-full"
    />
  );
}

function formatDisplay(v) {
  if (v === undefined || v === null || v === '') return '';
  return String(v);
}
