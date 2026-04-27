import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import FullPageModal from '../components/FullPageModal.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { api, notifyError, notifySuccess } from '../api/client.js';
import { Field, TxtInput } from './Suppliers.jsx';

const fmtDate = d => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
};

export default function Sales() {
  const [sos, setSos] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [viewSoId, setViewSoId] = useState(null);

  const reload = async () => {
    try {
      const [s, c, i] = await Promise.all([api.get('/sales'), api.get('/customers'), api.get('/inventory')]);
      setSos(s); setCustomers(c); setItems(i);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const columns = [
    { key: 'SO Date', label: 'Date' },
    { key: 'SO ID', label: 'SO ID' },
    { key: 'Customer ID', label: 'Customer ID' },
    { key: 'Customer Name', label: 'Customer Name' },
    { key: 'Invoice Num', label: 'Invoice Num' },
    { key: 'State', label: 'State' },
    { key: 'City', label: 'City' },
    { key: 'Total SO Amount', label: 'Total Amount', format: numFmt },
    { key: 'Total Received', label: 'Received', format: numFmt },
    { key: 'SO Balance', label: 'SO Balance', format: numFmt },
    { key: 'Receipt Status', label: 'Receipt Status' },
    { key: 'Shipping Status', label: 'Shipping Status' },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Sales Orders</h2>
      <p className="text-slate-500 mb-4">Add and manage your SOs</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New SO
        </button>
      </div>

      <DataTable
        rows={sos}
        columns={columns}
        rowId={r => r['SO ID']}
        searchOptions={['All', 'SO ID', 'Customer Name', 'Invoice Num', 'Receipt Status', 'Shipping Status']}
        searchKeys={{ 'SO ID': 'SO ID', 'Customer Name': 'Customer Name', 'Invoice Num': 'Invoice Num', 'Receipt Status': 'Receipt Status', 'Shipping Status': 'Shipping Status' }}
        actions={[{ icon: 'fa-eye', title: 'View', onClick: row => setViewSoId(row['SO ID']) }]}
      />

      <NewSoModal open={showNew} onClose={() => setShowNew(false)} customers={customers} items={items} setBusy={setBusy} onSaved={async () => { await reload(); setShowNew(false); }} />
      <SoDetailsModal soId={viewSoId} onClose={() => setViewSoId(null)} items={items} setBusy={setBusy} onChanged={reload} />
    </div>
  );
}

function numFmt(v) {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const emptyLine = () => ({
  'Item ID': '', 'Item Name': '', 'Item Type': '', 'Item Category': '', 'Item Subcategory': '',
  'QTY Sold': '', 'Unit Price': '', 'Shipping Fees': '',
  taxRateInput: '', // user enters numeric only, e.g. "15.25" → 0.1525
});

function parseSoTaxRate(input) {
  if (input == null || input === '') return 0;
  const s = String(input).trim();
  if (s.includes('%')) {
    return NaN; // signal: invalid
  }
  const n = Number(s);
  if (isNaN(n)) return NaN;
  return n / 100;
}

function calcLine(line) {
  const qty = Number(line['QTY Sold'] || 0);
  const unit = Number(line['Unit Price'] || 0);
  const tr = parseSoTaxRate(line.taxRateInput);
  const taxRate = isNaN(tr) ? 0 : tr;
  const ship = Number(line['Shipping Fees'] || 0);
  const priceExcl = +(qty * unit).toFixed(2);
  const totalTax = +(priceExcl * taxRate).toFixed(2);
  const priceIncl = +(priceExcl + totalTax).toFixed(2);
  const totalSP = +(priceIncl + ship).toFixed(2);
  return {
    'Price Excl Tax': priceExcl,
    'Tax Rate': taxRate,
    'Total Tax': totalTax,
    'Price Incl Tax': priceIncl,
    'Shipping Fees': ship,
    'Total Sales Price': totalSP,
  };
}

function NewSoModal({ open, onClose, customers, items, setBusy, onSaved }) {
  const [soId, setSoId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [soDate, setSoDate] = useState(new Date());
  const [lines, setLines] = useState([emptyLine()]);

  useEffect(() => {
    if (!open) return;
    setSoId(''); setCustomerName(''); setInvoiceNum(''); setSoDate(new Date()); setLines([emptyLine()]);
    api.get('/sales/generate-so-id').then(r => setSoId(r.id)).catch(notifyError);
  }, [open]);

  const customer = customers.find(c => c['Customer Name'] === customerName);
  const customerId = customer?.['Customer ID'] || '';
  const state = customer?.State || '';
  const city = customer?.City || '';

  const updateLine = (idx, patch) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = idx => setLines(ls => ls.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!customerName) return notifyError(new Error('Customer Name is required'));
    if (!invoiceNum) return notifyError(new Error('Invoice Num is required'));
    if (lines.length === 0) return notifyError(new Error('Add at least one line item'));
    for (const [i, line] of lines.entries()) {
      if (!line['Item Name']) return notifyError(new Error(`Line ${i + 1}: Item Name is required`));
      if (!line['QTY Sold']) return notifyError(new Error(`Line ${i + 1}: QTY Sold is required`));
      if (!line['Unit Price']) return notifyError(new Error(`Line ${i + 1}: Unit Price is required`));
      if (line.taxRateInput && String(line.taxRateInput).includes('%')) {
        return notifyError(new Error('Enter without % sign'));
      }
    }
    setBusy(true);
    try {
      const payload = {
        header: {
          'SO ID': soId, 'SO Date': fmtDate(soDate),
          'Customer Name': customerName, 'Customer ID': customerId,
          State: state, City: city, 'Invoice Num': invoiceNum,
        },
        lines: lines.map(l => {
          const c = calcLine(l);
          return {
            'Item ID': l['Item ID'], 'Item Name': l['Item Name'],
            'Item Type': l['Item Type'], 'Item Category': l['Item Category'], 'Item Subcategory': l['Item Subcategory'],
            'QTY Sold': Number(l['QTY Sold'] || 0),
            'Unit Price': Number(l['Unit Price'] || 0),
            ...c,
          };
        }),
      };
      await api.post('/sales', payload);
      notifySuccess('New SO Created');
      await onSaved();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <FullPageModal open={open} onClose={onClose} title="Create New SO">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <Field label="SO ID">
          <div className="flex gap-2">
            <input readOnly value={soId} className="flex-1 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" />
            <button type="button" onClick={() => api.get('/sales/generate-so-id').then(r => setSoId(r.id))} className="px-3 py-2 rounded-md bg-ink2 text-white text-sm">Generate</button>
          </div>
        </Field>
        <Field label="Customer Name *"><SearchableSelect options={customers.map(c => c['Customer Name'])} value={customerName} onChange={setCustomerName} /></Field>
        <Field label="Customer ID"><TxtInput v={customerId} on={() => {}} readOnly /></Field>
        <Field label="State"><TxtInput v={state} on={() => {}} readOnly /></Field>
        <Field label="City"><TxtInput v={city} on={() => {}} readOnly /></Field>
        <Field label="Invoice Num *"><TxtInput v={invoiceNum} on={setInvoiceNum} required /></Field>
        <Field label="SO Date *"><DatePicker selected={soDate} onChange={setSoDate} dateFormat="MM/dd/yyyy" /></Field>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-heading font-semibold text-ink">Line Items</h4>
          <button type="button" onClick={addLine} className="px-3 py-1.5 rounded-md bg-emerald-500 text-white text-sm hover:bg-emerald-600 inline-flex items-center gap-1">
            <i className="fa-solid fa-plus" /> Add Row
          </button>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="text-xs">
            <thead className="bg-ink text-white">
              <tr>
                {['Item Name', 'Item ID', 'Item Type', 'Category', 'Subcategory', 'QTY Sold', 'Unit Price', 'Price Excl Tax', 'Tax Rate (no %)', 'Total Tax', 'Price Incl Tax', 'Shipping Fees', 'Total Sales Price', ''].map(h => (
                  <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const calc = calcLine(line);
                return (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-2 py-1 min-w-[220px]">
                      <SearchableSelect
                        options={items.map(it => it['Item Name'])}
                        value={line['Item Name']}
                        onChange={v => {
                          const f = items.find(it => it['Item Name'] === v);
                          updateLine(idx, {
                            'Item Name': v,
                            'Item ID': f?.['Item ID'] || '',
                            'Item Type': f?.['Item Type'] || '',
                            'Item Category': f?.['Item Category'] || '',
                            'Item Subcategory': f?.['Item Subcategory'] || '',
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item ID']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item Type']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item Category']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item Subcategory']}</td>
                    <td className="px-2 py-1"><input type="number" min="0" value={line['QTY Sold']} onChange={e => updateLine(idx, { 'QTY Sold': e.target.value })} className="w-20 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={line['Unit Price']} onChange={e => updateLine(idx, { 'Unit Price': e.target.value })} className="w-24 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Price Excl Tax'])}</td>
                    <td className="px-2 py-1"><input type="text" placeholder="15.25" value={line.taxRateInput} onChange={e => updateLine(idx, { taxRateInput: e.target.value })} className="w-20 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Total Tax'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Price Incl Tax'])}</td>
                    <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={line['Shipping Fees']} onChange={e => updateLine(idx, { 'Shipping Fees': e.target.value })} className="w-20 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1 text-right font-medium">{numFmt(calc['Total Sales Price'])}</td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => removeLine(idx)} className="text-red-600 hover:text-red-800" title="Remove row">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Close</button>
        <button type="button" onClick={submit} className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accentSoft">Save</button>
      </div>
    </FullPageModal>
  );
}

function SoDetailsModal({ soId, onClose, items, setBusy, onChanged }) {
  const [details, setDetails] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (!soId) return;
    api.get(`/sales/${encodeURIComponent(soId)}/details`).then(setDetails).catch(notifyError);
  }, [soId]);

  if (!soId) return null;

  const startEdit = d => {
    setEditingId(d['Detail ID']);
    setEdit({
      'Item Name': d['Item Name'], 'Item ID': d['Item ID'], 'Item Type': d['Item Type'],
      'Item Category': d['Item Category'], 'Item Subcategory': d['Item Subcategory'],
      'QTY Sold': d['QTY Sold'], 'Unit Price': d['Unit Price'],
      'Shipping Fees': d['Shipping Fees'],
      taxRateInput: String((Number(d['Tax Rate'] || 0) * 100).toFixed(2)),
    });
  };
  const cancelEdit = () => { setEditingId(null); setEdit({}); };
  const saveEdit = async () => {
    if (String(edit.taxRateInput).includes('%')) return notifyError(new Error('Enter without % sign'));
    setBusy(true);
    try {
      const calc = calcLine(edit);
      await api.put(`/sales/details/${encodeURIComponent(editingId)}`, {
        'Item ID': edit['Item ID'], 'Item Name': edit['Item Name'],
        'Item Type': edit['Item Type'], 'Item Category': edit['Item Category'], 'Item Subcategory': edit['Item Subcategory'],
        'QTY Sold': Number(edit['QTY Sold'] || 0),
        'Unit Price': Number(edit['Unit Price'] || 0),
        ...calc,
      });
      notifySuccess('SO Details Updated');
      cancelEdit();
      const fresh = await api.get(`/sales/${encodeURIComponent(soId)}/details`);
      setDetails(fresh);
      await onChanged();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const doDelete = async () => {
    const id = confirmDel; setConfirmDel(null);
    setBusy(true);
    try {
      await api.del(`/sales/details/${encodeURIComponent(id)}`);
      notifySuccess('SO Item Deleted');
      const fresh = await api.get(`/sales/${encodeURIComponent(soId)}/details`);
      setDetails(fresh);
      await onChanged();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <>
      <FullPageModal open={!!soId} onClose={onClose} title={`SO Details — ${soId}`}>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="text-xs">
            <thead className="bg-ink text-white">
              <tr>
                {['Date', 'Detail ID', 'Item Name', 'Item ID', 'Type', 'Category', 'Subcategory', 'QTY', 'Unit Price', 'Excl Tax', 'Tax Rate', 'Total Tax', 'Incl Tax', 'Shipping', 'Total', 'Actions'].map(h => (
                  <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {details.map(d => {
                const isEdit = editingId === d['Detail ID'];
                const calc = isEdit ? calcLine(edit) : null;
                return (
                  <tr key={d['Detail ID']} className="border-t border-slate-100">
                    <td className="px-2 py-1 whitespace-nowrap">{d['SO Date']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{d['Detail ID']}</td>
                    <td className="px-2 py-1 min-w-[220px]">
                      {isEdit ? (
                        <SearchableSelect
                          options={items.map(it => it['Item Name'])}
                          value={edit['Item Name']}
                          onChange={v => {
                            const f = items.find(it => it['Item Name'] === v);
                            setEdit(e => ({ ...e, 'Item Name': v, 'Item ID': f?.['Item ID'] || '', 'Item Type': f?.['Item Type'] || '', 'Item Category': f?.['Item Category'] || '', 'Item Subcategory': f?.['Item Subcategory'] || '' }));
                          }}
                        />
                      ) : d['Item Name']}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{isEdit ? edit['Item ID'] : d['Item ID']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{isEdit ? edit['Item Type'] : d['Item Type']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{isEdit ? edit['Item Category'] : d['Item Category']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{isEdit ? edit['Item Subcategory'] : d['Item Subcategory']}</td>
                    <td className="px-2 py-1">{isEdit
                      ? <input type="number" value={edit['QTY Sold']} onChange={e => setEdit(s => ({ ...s, 'QTY Sold': e.target.value }))} className="w-16 px-2 py-1 border border-slate-300 rounded" />
                      : d['QTY Sold']}</td>
                    <td className="px-2 py-1">{isEdit
                      ? <input type="number" step="0.01" value={edit['Unit Price']} onChange={e => setEdit(s => ({ ...s, 'Unit Price': e.target.value }))} className="w-20 px-2 py-1 border border-slate-300 rounded" />
                      : numFmt(d['Unit Price'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Price Excl Tax'] : d['Price Excl Tax'])}</td>
                    <td className="px-2 py-1">{isEdit
                      ? <input type="text" value={edit.taxRateInput} onChange={e => setEdit(s => ({ ...s, taxRateInput: e.target.value }))} className="w-20 px-2 py-1 border border-slate-300 rounded" />
                      : ((Number(d['Tax Rate'] || 0) * 100).toFixed(2) + '%')}</td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Total Tax'] : d['Total Tax'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Price Incl Tax'] : d['Price Incl Tax'])}</td>
                    <td className="px-2 py-1">{isEdit
                      ? <input type="number" step="0.01" value={edit['Shipping Fees']} onChange={e => setEdit(s => ({ ...s, 'Shipping Fees': e.target.value }))} className="w-20 px-2 py-1 border border-slate-300 rounded" />
                      : numFmt(d['Shipping Fees'])}</td>
                    <td className="px-2 py-1 text-right font-medium">{numFmt(isEdit ? calc['Total Sales Price'] : d['Total Sales Price'])}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <div className="flex gap-1">
                        {!isEdit && <button type="button" onClick={() => startEdit(d)} className="px-2 py-1 rounded bg-ink2 text-white"><i className="fa-solid fa-pen" /></button>}
                        {isEdit && <button type="button" onClick={saveEdit} className="px-2 py-1 rounded bg-emerald-600 text-white"><i className="fa-solid fa-check" /></button>}
                        {isEdit && <button type="button" onClick={cancelEdit} className="px-2 py-1 rounded bg-slate-400 text-white"><i className="fa-solid fa-xmark" /></button>}
                        {!isEdit && <button type="button" onClick={() => setConfirmDel(d['Detail ID'])} className="px-2 py-1 rounded bg-red-500 text-white"><i className="fa-solid fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {details.length === 0 && <tr><td colSpan={16} className="text-center py-4 text-slate-500">No line items</td></tr>}
            </tbody>
          </table>
        </div>
      </FullPageModal>
      <ConfirmDialog
        open={confirmDel !== null}
        title="Delete Line Item"
        message="Delete this SO line item?"
        onCancel={() => setConfirmDel(null)}
        onConfirm={doDelete}
      />
    </>
  );
}
