import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { api, notifyError, notifySuccess } from '../api/client.js';
import { Field, TxtInput, FormButtons, SimpleAddModal } from './Suppliers.jsx';

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [dims, setDims] = useState({});
  const [busy, setBusy] = useState(false);
  const [showItem, setShowItem] = useState(false);
  const [showType, setShowType] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [showSubcategory, setShowSubcategory] = useState(false);

  const reload = async () => {
    try {
      const [rs, d] = await Promise.all([api.get('/inventory'), api.get('/dimensions')]);
      setRows(rs); setDims(d);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const handleSave = async (id, patch) => {
    setBusy(true);
    try { await api.put(`/inventory/${encodeURIComponent(id)}`, patch); notifySuccess('Inventory Item Updated'); await reload(); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const handleDelete = async id => {
    setBusy(true);
    try { await api.del(`/inventory/${encodeURIComponent(id)}`); notifySuccess('Item deleted'); await reload(); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const columns = [
    { key: 'Item ID', label: 'Item ID' },
    { key: 'Item Type', label: 'Item Type', editable: true, editType: 'select', options: dims['Item Type'] || [] },
    { key: 'Item Category', label: 'Item Category', editable: true, editType: 'select', options: dims['Item Category'] || [] },
    { key: 'Item Subcategory', label: 'Item Subcategory', editable: true, editType: 'select', options: dims['Item Subcategory'] || [] },
    { key: 'Item Name', label: 'Item Name', editable: true },
    { key: 'QTY Purchased', label: 'QTY Purchased' },
    { key: 'QTY Sold', label: 'QTY Sold' },
    { key: 'Remaining QTY', label: 'Remaining QTY' },
    { key: 'Reorder Level', label: 'Reorder Level', editable: true, editType: 'number' },
    {
      key: 'Reorder Required', label: 'Reorder Required',
      render: v => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
          String(v) === 'Yes' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
        }`}>{v || 'No'}</span>
      ),
    },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Inventory Items</h2>
      <p className="text-slate-500 mb-4">Add and manage your inventory items</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowItem(true)} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> Add Inventory Item
        </button>
        <button onClick={() => setShowType(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-tag" /> Add Item Type
        </button>
        <button onClick={() => setShowCategory(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-layer-group" /> Add Item Category
        </button>
        <button onClick={() => setShowSubcategory(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-folder-tree" /> Add Item Subcategory
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowId={r => r['Item ID']}
        searchOptions={['All', 'Item Type', 'Item Category', 'Item Subcategory', 'Item Name', 'Reorder Required']}
        searchKeys={{ 'Item Type': 'Item Type', 'Item Category': 'Item Category', 'Item Subcategory': 'Item Subcategory', 'Item Name': 'Item Name', 'Reorder Required': 'Reorder Required' }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <ItemModal open={showItem} onClose={() => setShowItem(false)} dims={dims} setBusy={setBusy} onSaved={async () => { await reload(); setShowItem(false); }} />
      <SimpleAddModal open={showType} title="Add New Item Type" label="Item Type" onClose={() => setShowType(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'Item Type', value: v }); notifySuccess('New Item Type Added'); await reload(); setShowType(false); }} />
      <SimpleAddModal open={showCategory} title="Add New Item Category" label="Item Category" onClose={() => setShowCategory(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'Item Category', value: v }); notifySuccess('New Item Category Added'); await reload(); setShowCategory(false); }} />
      <SimpleAddModal open={showSubcategory} title="Add New Item Subcategory" label="Item Subcategory" onClose={() => setShowSubcategory(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'Item Subcategory', value: v }); notifySuccess('New Item Subcategory Added'); await reload(); setShowSubcategory(false); }} />
    </div>
  );
}

function ItemModal({ open, onClose, onSaved, dims, setBusy }) {
  const [id, setId] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { if (open) { setId(''); setForm({}); } }, [open]);

  const generate = async () => {
    setBusy(true);
    try { const r = await api.get('/inventory/generate-id'); setId(r.id); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (!form['Item Name']) return notifyError(new Error('Item Name is required'));
    if (!form['Item Type']) return notifyError(new Error('Item Type is required'));
    if (!form['Item Category']) return notifyError(new Error('Item Category is required'));
    if (!form['Item Subcategory']) return notifyError(new Error('Item Subcategory is required'));
    if (form['Reorder Level'] === undefined || form['Reorder Level'] === '') return notifyError(new Error('Reorder Level is required'));
    if (!id) return notifyError(new Error('Click Generate to create an Item ID'));
    setBusy(true);
    try {
      await api.post('/inventory', { ...form, 'Item ID': id });
      notifySuccess('New Item Added');
      await onSaved();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Inventory Item" size="lg">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Item ID">
          <div className="flex gap-2">
            <input readOnly value={id} placeholder="Click Generate" className="flex-1 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" />
            <button type="button" onClick={generate} className="px-3 py-2 rounded-md bg-ink2 text-white text-sm hover:opacity-90">Generate</button>
          </div>
        </Field>
        <Field label="Item Type *"><SearchableSelect options={dims['Item Type'] || []} value={form['Item Type']} onChange={v => setForm(f => ({ ...f, 'Item Type': v }))} /></Field>
        <Field label="Item Category *"><SearchableSelect options={dims['Item Category'] || []} value={form['Item Category']} onChange={v => setForm(f => ({ ...f, 'Item Category': v }))} /></Field>
        <Field label="Item Subcategory *"><SearchableSelect options={dims['Item Subcategory'] || []} value={form['Item Subcategory']} onChange={v => setForm(f => ({ ...f, 'Item Subcategory': v }))} /></Field>
        <Field label="Item Name *"><TxtInput v={form['Item Name']} on={v => setForm(f => ({ ...f, 'Item Name': v }))} required /></Field>
        <Field label="Reorder Level *"><TxtInput type="number" v={form['Reorder Level']} on={v => setForm(f => ({ ...f, 'Reorder Level': v === '' ? '' : Number(v) }))} required /></Field>
        <FormButtons onClose={onClose} />
      </form>
    </Modal>
  );
}
