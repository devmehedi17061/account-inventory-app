import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import DatePicker from 'react-datepicker';
import { api, notifyError, notifySuccess } from '../api/client.js';
import { Field, TxtInput, FormButtons } from './Suppliers.jsx';

const fmtDate = d => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
};

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [dims, setDims] = useState({});
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);

  const reload = async () => {
    try {
      const [rs, s, po, d] = await Promise.all([api.get('/payments'), api.get('/suppliers'), api.get('/purchases'), api.get('/dimensions')]);
      setRows(rs); setSuppliers(s); setPurchaseOrders(po); setDims(d);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const handleDelete = async id => {
    setBusy(true);
    try { await api.del(`/payments/${encodeURIComponent(id)}`); notifySuccess('Payment deleted'); await reload(); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const columns = [
    { key: 'Trx Date', label: 'Trx Date' },
    { key: 'Trx ID', label: 'Trx ID' },
    { key: 'Supplier ID', label: 'Supplier ID' },
    { key: 'Supplier Name', label: 'Supplier Name' },
    { key: 'State', label: 'State' },
    { key: 'City', label: 'City' },
    { key: 'PO ID', label: 'PO ID' },
    { key: 'Bill Num', label: 'Bill Num' },
    { key: 'PMT Mode', label: 'PMT Mode' },
    { key: 'Amount Paid', label: 'Amount Paid', format: numFmt },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Payments Module</h2>
      <p className="text-slate-500 mb-4">Create Payments Against Purchase Orders</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { setEditing(null); setShow(true); }} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New Payment
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowId={r => r['Trx ID']}
        searchOptions={['All', 'PO ID', 'Supplier Name', 'Bill Num', 'PMT Mode']}
        searchKeys={{ 'PO ID': 'PO ID', 'Supplier Name': 'Supplier Name', 'Bill Num': 'Bill Num', 'PMT Mode': 'PMT Mode' }}
        onDelete={handleDelete}
        actions={[{ icon: 'fa-pen', title: 'Edit', onClick: row => { setEditing(row); setShow(true); } }]}
      />

      <PaymentModal
        open={show}
        onClose={() => setShow(false)}
        editing={editing}
        suppliers={suppliers}
        purchaseOrders={purchaseOrders}
        dims={dims}
        setBusy={setBusy}
        onSaved={async () => { await reload(); setShow(false); }}
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

function PaymentModal({ open, onClose, editing, suppliers, purchaseOrders, dims, setBusy, onSaved }) {
  const [trxId, setTrxId] = useState('');
  const [trxDate, setTrxDate] = useState(new Date());
  const [supplierName, setSupplierName] = useState('');
  const [poId, setPoId] = useState('');
  const [billNum, setBillNum] = useState('');
  const [pmtMode, setPmtMode] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTrxId(editing['Trx ID'] || '');
      setTrxDate(parseMmddyyyy(editing['Trx Date']) || new Date());
      setSupplierName(editing['Supplier Name'] || '');
      setPoId(editing['PO ID'] || '');
      setBillNum(editing['Bill Num'] || '');
      setPmtMode(editing['PMT Mode'] || '');
      setAmount(editing['Amount Paid'] || '');
    } else {
      setTrxId(''); setTrxDate(new Date()); setSupplierName(''); setPoId(''); setBillNum(''); setPmtMode(''); setAmount('');
      api.get('/payments/generate-id').then(r => setTrxId(r.id)).catch(notifyError);
    }
  }, [open, editing]);

  const supplier = suppliers.find(s => s['Supplier Name'] === supplierName);
  const supplierId = supplier?.['Supplier ID'] || '';
  const state = supplier?.State || '';
  const city = supplier?.City || '';

  const supplierPos = supplierName
    ? purchaseOrders.filter(po => String(po['Supplier Name']) === String(supplierName))
    : [];
  const selectedPo = supplierPos.find(po => po['PO ID'] === poId);
  const poBalance = selectedPo ? Number(selectedPo['PO Balance'] || 0) : 0;

  const submit = async e => {
    e.preventDefault();
    if (!supplierName) return notifyError(new Error('Supplier Name is required'));
    if (!poId) return notifyError(new Error('PO ID is required'));
    if (!pmtMode) return notifyError(new Error('PMT Mode is required'));
    const amt = Number(amount);
    if (!amt || amt <= 0) return notifyError(new Error('Amount Paid must be > 0'));
    setBusy(true);
    try {
      const payload = {
        'Trx Date': fmtDate(trxDate),
        'Trx ID': trxId,
        'Supplier ID': supplierId,
        'Supplier Name': supplierName,
        State: state, City: city,
        'PO ID': poId,
        'Bill Num': billNum,
        'PMT Mode': pmtMode,
        'Amount Paid': amt,
      };
      if (editing) {
        await api.put(`/payments/${encodeURIComponent(editing['Trx ID'])}`, payload);
        notifySuccess('Payment Updated');
      } else {
        await api.post('/payments', payload);
        notifySuccess('New Payment Saved');
      }
      await onSaved();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Payment' : 'New Payment'} size="lg">
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Trx Date *"><DatePicker selected={trxDate} onChange={setTrxDate} dateFormat="MM/dd/yyyy" /></Field>
        <Field label="Trx ID"><input readOnly value={trxId} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" /></Field>
        <Field label="Supplier Name *"><SearchableSelect options={suppliers.map(s => s['Supplier Name'])} value={supplierName} onChange={setSupplierName} /></Field>
        <Field label="Supplier ID"><TxtInput v={supplierId} on={() => {}} readOnly /></Field>
        <Field label="State"><TxtInput v={state} on={() => {}} readOnly /></Field>
        <Field label="City"><TxtInput v={city} on={() => {}} readOnly /></Field>
        <Field label="PO ID *"><SearchableSelect options={supplierPos.map(po => po['PO ID'])} value={poId} onChange={v => { setPoId(v); const f = supplierPos.find(po => po['PO ID'] === v); setBillNum(f?.['Bill Num'] || ''); }} /></Field>
        <Field label="Bill Num"><TxtInput v={billNum} on={setBillNum} /></Field>
        <Field label="PO Balance"><TxtInput v={numFmt(poBalance)} on={() => {}} readOnly /></Field>
        <Field label="PMT Mode *"><SearchableSelect options={dims['PMT Mode'] || []} value={pmtMode} onChange={setPmtMode} /></Field>
        <Field label="Amount Paid *"><TxtInput type="number" v={amount} on={setAmount} /></Field>
        <div className="md:col-span-2"><FormButtons onClose={onClose} saveLabel={editing ? 'Update' : 'Save'} /></div>
      </form>
    </Modal>
  );
}

function parseMmddyyyy(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
}
