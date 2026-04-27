import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import { api, notifyError, notifySuccess } from '../api/client.js';
import { Field, TxtInput, FormButtons, SimpleAddModal } from './Suppliers.jsx';

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [dims, setDims] = useState({});
  const [busy, setBusy] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showState, setShowState] = useState(false);
  const [showCity, setShowCity] = useState(false);

  const reload = async () => {
    try {
      const [rs, d] = await Promise.all([api.get('/customers'), api.get('/dimensions')]);
      setRows(rs); setDims(d);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const handleSave = async (id, patch) => {
    setBusy(true);
    try { await api.put(`/customers/${encodeURIComponent(id)}`, patch); notifySuccess('Customer Details Updated'); await reload(); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const handleDelete = async id => {
    setBusy(true);
    try { await api.del(`/customers/${encodeURIComponent(id)}`); notifySuccess('Customer deleted'); await reload(); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const columns = [
    { key: 'Customer ID', label: 'Customer ID' },
    { key: 'Customer Name', label: 'Customer Name', editable: true },
    { key: 'Customer Contact', label: 'Contact', editable: true },
    { key: 'Customer Email', label: 'Email', editable: true },
    { key: 'State', label: 'State', editable: true, editType: 'select', options: dims.State || [] },
    { key: 'City', label: 'City', editable: true, editType: 'select', options: dims.City || [] },
    { key: 'Customer Address', label: 'Address', editable: true },
    { key: 'Total Sales', label: 'Sales', format: numFmt },
    { key: 'Total Receipts', label: 'Receipts', format: numFmt },
    { key: 'Balance Receivable', label: 'Balance', format: numFmt },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Customers</h2>
      <p className="text-slate-500 mb-4">Add and manage your customers</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowCustomer(true)} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New Customer
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
        rowId={r => r['Customer ID']}
        searchOptions={['All', 'Customer Name', 'State', 'City']}
        searchKeys={{ 'Customer Name': 'Customer Name', State: 'State', City: 'City' }}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <CustomerModal open={showCustomer} onClose={() => setShowCustomer(false)} dims={dims} setBusy={setBusy} onSaved={async () => { await reload(); setShowCustomer(false); }} />
      <SimpleAddModal open={showState} title="Add New State" label="State Name" onClose={() => setShowState(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'State', value: v }); notifySuccess('New State Added'); await reload(); setShowState(false); }} />
      <SimpleAddModal open={showCity} title="Add New City" label="City Name" onClose={() => setShowCity(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'City', value: v }); notifySuccess('New City Added'); await reload(); setShowCity(false); }} />
    </div>
  );
}

function numFmt(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function CustomerModal({ open, onClose, onSaved, dims, setBusy }) {
  const [id, setId] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { if (open) { setId(''); setForm({}); } }, [open]);

  const generate = async () => {
    setBusy(true);
    try { const r = await api.get('/customers/generate-id'); setId(r.id); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (!form['Customer Name']) return notifyError(new Error('Customer Name is required'));
    if (!form.State) return notifyError(new Error('State is required'));
    if (!form.City) return notifyError(new Error('City is required'));
    if (!id) return notifyError(new Error('Click Generate to create a Customer ID'));
    setBusy(true);
    try {
      await api.post('/customers', { ...form, 'Customer ID': id });
      notifySuccess('New Customer Added');
      await onSaved();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Customer" size="lg">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Customer ID">
          <div className="flex gap-2">
            <input readOnly value={id} placeholder="Click Generate" className="flex-1 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" />
            <button type="button" onClick={generate} className="px-3 py-2 rounded-md bg-ink2 text-white text-sm hover:opacity-90">Generate</button>
          </div>
        </Field>
        <Field label="Customer Name *"><TxtInput v={form['Customer Name']} on={v => setForm(f => ({ ...f, 'Customer Name': v }))} required /></Field>
        <Field label="Customer Contact"><TxtInput v={form['Customer Contact']} on={v => setForm(f => ({ ...f, 'Customer Contact': v }))} /></Field>
        <Field label="Customer Email"><TxtInput v={form['Customer Email']} on={v => setForm(f => ({ ...f, 'Customer Email': v }))} /></Field>
        <Field label="State *"><SearchableSelect options={dims.State || []} value={form.State} onChange={v => setForm(f => ({ ...f, State: v }))} /></Field>
        <Field label="City *"><SearchableSelect options={dims.City || []} value={form.City} onChange={v => setForm(f => ({ ...f, City: v }))} /></Field>
        <Field label="Customer Address"><TxtInput v={form['Customer Address']} on={v => setForm(f => ({ ...f, 'Customer Address': v }))} /></Field>
        <FormButtons onClose={onClose} />
      </form>
    </Modal>
  );
}
