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

export default function Receipts() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [dims, setDims] = useState({});
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);

  const reload = async () => {
    try {
      const [rs, c, so, d] = await Promise.all([api.get('/receipts'), api.get('/customers'), api.get('/sales'), api.get('/dimensions')]);
      setRows(rs); setCustomers(c); setSalesOrders(so); setDims(d);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const handleDelete = async id => {
    setBusy(true);
    try { await api.del(`/receipts/${encodeURIComponent(id)}`); notifySuccess('Receipt deleted'); await reload(); }
    catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  const columns = [
    { key: 'Trx Date', label: 'Trx Date' },
    { key: 'Trx ID', label: 'Trx ID' },
    { key: 'Customer ID', label: 'Customer ID' },
    { key: 'Customer Name', label: 'Customer Name' },
    { key: 'State', label: 'State' },
    { key: 'City', label: 'City' },
    { key: 'SO ID', label: 'SO ID' },
    { key: 'Invoice Num', label: 'Invoice Num' },
    { key: 'PMT Mode', label: 'PMT Mode' },
    { key: 'Amount Received', label: 'Amount Received', format: numFmt },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Cash and Bank Module</h2>
      <p className="text-slate-500 mb-4">Create Receipts and Payments</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { setEditing(null); setShow(true); }} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New Receipt
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowId={r => r['Trx ID']}
        searchOptions={['All', 'SO ID', 'Customer Name', 'Invoice Num', 'PMT Mode']}
        searchKeys={{ 'SO ID': 'SO ID', 'Customer Name': 'Customer Name', 'Invoice Num': 'Invoice Num', 'PMT Mode': 'PMT Mode' }}
        onDelete={handleDelete}
        actions={[{ icon: 'fa-pen', title: 'Edit', onClick: row => { setEditing(row); setShow(true); } }]}
      />

      <ReceiptModal
        open={show}
        onClose={() => setShow(false)}
        editing={editing}
        customers={customers}
        salesOrders={salesOrders}
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

function ReceiptModal({ open, onClose, editing, customers, salesOrders, dims, setBusy, onSaved }) {
  const [trxId, setTrxId] = useState('');
  const [trxDate, setTrxDate] = useState(new Date());
  const [customerName, setCustomerName] = useState('');
  const [soId, setSoId] = useState('');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [pmtMode, setPmtMode] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTrxId(editing['Trx ID'] || '');
      setTrxDate(parseMmddyyyy(editing['Trx Date']) || new Date());
      setCustomerName(editing['Customer Name'] || '');
      setSoId(editing['SO ID'] || '');
      setInvoiceNum(editing['Invoice Num'] || '');
      setPmtMode(editing['PMT Mode'] || '');
      setAmount(editing['Amount Received'] || '');
    } else {
      setTrxId(''); setTrxDate(new Date()); setCustomerName(''); setSoId(''); setInvoiceNum(''); setPmtMode(''); setAmount('');
      api.get('/receipts/generate-id').then(r => setTrxId(r.id)).catch(notifyError);
    }
  }, [open, editing]);

  const customer = customers.find(c => c['Customer Name'] === customerName);
  const customerId = customer?.['Customer ID'] || '';
  const state = customer?.State || '';
  const city = customer?.City || '';

  const customerSos = customerId
    ? salesOrders.filter(so => String(so['Customer ID']) === String(customerId))
    : [];
  const selectedSo = customerSos.find(so => so['SO ID'] === soId);
  const soBalance = selectedSo ? Number(selectedSo['SO Balance'] || 0) : 0;

  const submit = async e => {
    e.preventDefault();
    if (!customerName) return notifyError(new Error('Customer Name is required'));
    if (!soId) return notifyError(new Error('SO ID is required'));
    if (!pmtMode) return notifyError(new Error('PMT Mode is required'));
    const amt = Number(amount);
    if (!amt || amt <= 0) return notifyError(new Error('Amount Received must be > 0'));
    setBusy(true);
    try {
      const payload = {
        'Trx Date': fmtDate(trxDate),
        'Trx ID': trxId,
        'Customer ID': customerId,
        'Customer Name': customerName,
        State: state, City: city,
        'SO ID': soId,
        'Invoice Num': invoiceNum,
        'PMT Mode': pmtMode,
        'Amount Received': amt,
      };
      if (editing) {
        await api.put(`/receipts/${encodeURIComponent(editing['Trx ID'])}`, payload);
        notifySuccess('Receipt Updated');
      } else {
        await api.post('/receipts', payload);
        notifySuccess('New Receipt Saved');
      }
      await onSaved();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Receipt' : 'New Receipt'} size="lg">
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Trx Date *"><DatePicker selected={trxDate} onChange={setTrxDate} dateFormat="MM/dd/yyyy" /></Field>
        <Field label="Trx ID">
          <input readOnly value={trxId} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" />
        </Field>
        <Field label="Customer Name *"><SearchableSelect options={customers.map(c => c['Customer Name'])} value={customerName} onChange={setCustomerName} /></Field>
        <Field label="Customer ID"><TxtInput v={customerId} on={() => {}} readOnly /></Field>
        <Field label="State"><TxtInput v={state} on={() => {}} readOnly /></Field>
        <Field label="City"><TxtInput v={city} on={() => {}} readOnly /></Field>
        <Field label="SO ID *"><SearchableSelect options={customerSos.map(so => so['SO ID'])} value={soId} onChange={v => { setSoId(v); const f = customerSos.find(so => so['SO ID'] === v); setInvoiceNum(f?.['Invoice Num'] || ''); }} /></Field>
        <Field label="Invoice Num"><TxtInput v={invoiceNum} on={setInvoiceNum} /></Field>
        <Field label="SO Balance"><TxtInput v={numFmt(soBalance)} on={() => {}} readOnly /></Field>
        <Field label="PMT Mode *"><SearchableSelect options={dims['PMT Mode'] || []} value={pmtMode} onChange={setPmtMode} /></Field>
        <Field label="Amount Received *"><TxtInput type="number" v={amount} on={setAmount} /></Field>
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
