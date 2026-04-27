import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { api, notifyError, notifySuccess } from '../api/client.js';

export default function Suppliers() {
  const [rows, setRows] = useState([]);
  const [dims, setDims] = useState({});
  const [busy, setBusy] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [showState, setShowState] = useState(false);
  const [showCity, setShowCity] = useState(false);

  const reload = async () => {
    try {
      const [rs, d] = await Promise.all([api.get('/suppliers'), api.get('/dimensions')]);
      setRows(rs);
      setDims(d);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const handleSave = async (id, patch) => {
    setBusy(true);
    try { await api.put(`/suppliers/${encodeURIComponent(id)}`, patch); notifySuccess('Supplier Details Updated'); await reload(); }
    catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };
  const handleDelete = async id => {
    setBusy(true);
    try { await api.del(`/suppliers/${encodeURIComponent(id)}`); notifySuccess('Supplier deleted'); await reload(); }
    catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };

  const columns = [
    { key: 'Supplier ID', label: 'Supplier ID' },
    { key: 'Supplier Name', label: 'Supplier Name', editable: true },
    { key: 'Supplier Contact', label: 'Contact', editable: true },
    { key: 'Supplier Email', label: 'Email', editable: true },
    { key: 'State', label: 'State', editable: true, editType: 'select', options: dims.State || [] },
    { key: 'City', label: 'City', editable: true, editType: 'select', options: dims.City || [] },
    { key: 'Supplier Address', label: 'Address', editable: true },
    { key: 'Total Purchases', label: 'Purchases', format: numFmt },
    { key: 'Total Payments', label: 'Payments', format: numFmt },
    { key: 'Balance Payable', label: 'Balance', format: numFmt },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Suppliers</h2>
      <p className="text-slate-500 mb-4">Add and manage your suppliers</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowSupplier(true)} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New Supplier
        </button>
        <button onClick={() => setShowState(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New State
        </button>
        <button onClick={() => setShowCity(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New City
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowId={r => r['Supplier ID']}
        searchOptions={['All', 'Supplier Name', 'State', 'City']}
        searchKeys={{ 'Supplier Name': 'Supplier Name', State: 'State', City: 'City' }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <SupplierModal
        open={showSupplier}
        onClose={() => setShowSupplier(false)}
        onSaved={async () => { await reload(); setShowSupplier(false); }}
        dims={dims}
        setBusy={setBusy}
      />
      <SimpleAddModal
        open={showState}
        title="Add New State"
        label="State Name"
        onClose={() => setShowState(false)}
        onSubmit={async value => {
          await api.post('/dimensions', { column: 'State', value });
          notifySuccess('New State Added');
          await reload();
          setShowState(false);
        }}
        setBusy={setBusy}
      />
      <SimpleAddModal
        open={showCity}
        title="Add New City"
        label="City Name"
        onClose={() => setShowCity(false)}
        onSubmit={async value => {
          await api.post('/dimensions', { column: 'City', value });
          notifySuccess('New City Added');
          await reload();
          setShowCity(false);
        }}
        setBusy={setBusy}
      />
    </div>
  );
}

function numFmt(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function SupplierModal({ open, onClose, onSaved, dims, setBusy }) {
  const [id, setId] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { if (open) { setId(''); setForm({}); } }, [open]);

  const generate = async () => {
    setBusy(true);
    try { const r = await api.get('/suppliers/generate-id'); setId(r.id); }
    catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (!form['Supplier Name']) return notifyError(new Error('Supplier Name is required'));
    if (!form.State) return notifyError(new Error('State is required'));
    if (!form.City) return notifyError(new Error('City is required'));
    if (!id) return notifyError(new Error('Click Generate to create a Supplier ID'));
    setBusy(true);
    try {
      await api.post('/suppliers', { ...form, 'Supplier ID': id });
      notifySuccess('New Supplier Added');
      await onSaved();
    } catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Supplier" size="lg">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Supplier ID">
          <div className="flex gap-2">
            <input readOnly value={id} placeholder="Click Generate" className="flex-1 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" />
            <button type="button" onClick={generate} className="px-3 py-2 rounded-md bg-ink2 text-white text-sm hover:opacity-90">Generate</button>
          </div>
        </Field>
        <Field label="Supplier Name *"><TxtInput v={form['Supplier Name']} on={v => setForm(f => ({ ...f, 'Supplier Name': v }))} required /></Field>
        <Field label="Supplier Contact"><TxtInput v={form['Supplier Contact']} on={v => setForm(f => ({ ...f, 'Supplier Contact': v }))} /></Field>
        <Field label="Supplier Email"><TxtInput v={form['Supplier Email']} on={v => setForm(f => ({ ...f, 'Supplier Email': v }))} /></Field>
        <Field label="State *"><SearchableSelect options={dims.State || []} value={form.State} onChange={v => setForm(f => ({ ...f, State: v }))} /></Field>
        <Field label="City *"><SearchableSelect options={dims.City || []} value={form.City} onChange={v => setForm(f => ({ ...f, City: v }))} /></Field>
        <Field label="Supplier Address"><TxtInput v={form['Supplier Address']} on={v => setForm(f => ({ ...f, 'Supplier Address': v }))} /></Field>
        <FormButtons onClose={onClose} />
      </form>
    </Modal>
  );
}

export function SimpleAddModal({ open, onClose, title, label, onSubmit, setBusy }) {
  const [val, setVal] = useState('');
  useEffect(() => { if (open) setVal(''); }, [open]);
  const submit = async e => {
    e.preventDefault();
    if (!val.trim()) return notifyError(new Error(`${label} is required`));
    setBusy(true);
    try { await onSubmit(val.trim()); }
    catch (e) { notifyError(e); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <Field label={label}><TxtInput v={val} on={setVal} required /></Field>
        <FormButtons onClose={onClose} saveLabel="Save" />
      </form>
    </Modal>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
export function TxtInput({ v, on, required, type = 'text', readOnly, ...rest }) {
  return (
    <input
      type={type}
      value={v ?? ''}
      onChange={e => on(e.target.value)}
      required={required}
      readOnly={readOnly}
      className={`w-full px-3 py-2 border border-slate-300 rounded-md text-sm ${readOnly ? 'bg-slate-50' : ''}`}
      {...rest}
    />
  );
}
export function FormButtons({ onClose, saveLabel = 'Save' }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Close</button>
      <button type="submit" className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accentSoft">{saveLabel}</button>
    </div>
  );
}
