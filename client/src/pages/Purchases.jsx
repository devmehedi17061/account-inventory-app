import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import FullPageModal from '../components/FullPageModal.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import SearchableSelect from '../components/SearchableSelect.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { api, notifyError, notifySuccess } from '../api/client.js';
import { Field, TxtInput, SimpleAddModal } from './Suppliers.jsx';

const fmtDate = d => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
};

export default function Purchases() {
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showPmtStatus, setShowPmtStatus] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [viewPoId, setViewPoId] = useState(null);

  const reload = async () => {
    try {
      const [p, s, i] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers'),
        api.get('/inventory'),
      ]);
      setPos(p); setSuppliers(s); setItems(i);
    } catch (e) { notifyError(e); }
  };
  useEffect(() => { reload(); }, []);

  const columns = [
    { key: 'Date', label: 'Date' },
    { key: 'PO ID', label: 'PO ID' },
    { key: 'Supplier ID', label: 'Supplier ID' },
    { key: 'Supplier Name', label: 'Supplier Name' },
    { key: 'Bill Num', label: 'Bill Num' },
    { key: 'State', label: 'State' },
    { key: 'City', label: 'City' },
    { key: 'Total Amount', label: 'Total Amount', format: numFmt },
    { key: 'Total Paid', label: 'Total Paid', format: numFmt },
    { key: 'PO Balance', label: 'PO Balance', format: numFmt },
    { key: 'PMT Status', label: 'PMT Status' },
    { key: 'Shipping Status', label: 'Shipping Status' },
  ];

  return (
    <div>
      <ProcessingOverlay active={busy} />
      <h2 className="text-2xl font-heading font-semibold text-ink">Purchase Orders</h2>
      <p className="text-slate-500 mb-4">Add and manage your POs</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-md bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New PO
        </button>
        <button onClick={() => setShowPmtStatus(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-tag" /> PMT Status
        </button>
        <button onClick={() => setShowShipping(true)} className="px-4 py-2 rounded-md bg-ink2 text-white text-sm font-medium hover:opacity-90 inline-flex items-center gap-2">
          <i className="fa-solid fa-truck" /> Shipping Status
        </button>
      </div>

      <DataTable
        rows={pos}
        columns={columns}
        rowId={r => r['PO ID']}
        searchOptions={['All', 'PO ID', 'Supplier Name', 'Bill Num', 'PMT Status', 'Shipping Status']}
        searchKeys={{
          'PO ID': 'PO ID', 'Supplier Name': 'Supplier Name', 'Bill Num': 'Bill Num',
          'PMT Status': 'PMT Status', 'Shipping Status': 'Shipping Status',
        }}
        actions={[{ icon: 'fa-eye', title: 'View', onClick: row => setViewPoId(row['PO ID']) }]}
      />

      <NewPoModal
        open={showNew}
        onClose={() => setShowNew(false)}
        suppliers={suppliers}
        items={items}
        setBusy={setBusy}
        onSaved={async () => { await reload(); setShowNew(false); }}
      />
      <PoDetailsModal
        poId={viewPoId}
        onClose={() => setViewPoId(null)}
        items={items}
        setBusy={setBusy}
        onChanged={reload}
      />
      <SimpleAddModal open={showPmtStatus} title="Configure PMT Status" label="PMT Status" onClose={() => setShowPmtStatus(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'PMT Status', value: v }); notifySuccess('New PMT Status Added'); setShowPmtStatus(false); }} />
      <SimpleAddModal open={showShipping} title="Configure Shipping Status" label="Shipping Status" onClose={() => setShowShipping(false)} setBusy={setBusy} onSubmit={async v => { await api.post('/dimensions', { column: 'Shipping Status', value: v }); notifySuccess('New Shipping Status Added'); setShowShipping(false); }} />
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
  'QTY Purchased': '', 'Unit Cost': '', 'Tax Rate': '', // tax rate stored as decimal at save (e.g. 0.1525)
  taxRateInput: '', // raw user input ("15.25%" or "15.25")
});

function calcLine(line) {
  const qty = Number(line['QTY Purchased'] || 0);
  const unit = Number(line['Unit Cost'] || 0);
  const taxRate = parsePoTaxRate(line.taxRateInput);
  const costExcl = +(qty * unit).toFixed(2);
  const totalTax = +(costExcl * taxRate).toFixed(2);
  const costIncl = +(costExcl + totalTax).toFixed(2);
  const shipFees = +(costIncl * 0.01).toFixed(2);
  const totalPP = +(costIncl + shipFees).toFixed(2);
  return {
    'Cost Excl Tax': costExcl,
    'Tax Rate': taxRate,
    'Total Tax': totalTax,
    'Cost Incl Tax': costIncl,
    'Shipping Fees': shipFees,
    'Total Purchase Price': totalPP,
  };
}
function parsePoTaxRate(input) {
  if (input == null || input === '') return 0;
  const s = String(input).trim();
  if (s.endsWith('%')) {
    const n = Number(s.slice(0, -1));
    return isNaN(n) ? 0 : n / 100;
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n; // assume already a decimal
}

function NewPoModal({ open, onClose, suppliers, items, setBusy, onSaved }) {
  const [poId, setPoId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [billNum, setBillNum] = useState('');
  const [poDate, setPoDate] = useState(new Date());
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!open) return;
    setPoId(''); setSupplierName(''); setBillNum(''); setPoDate(new Date()); setLines([emptyLine()]);
    api.get('/purchases/generate-po-id').then(r => setPoId(r.id)).catch(notifyError);
  }, [open]);

  const supplier = suppliers.find(s => s['Supplier Name'] === supplierName);
  const supplierId = supplier?.['Supplier ID'] || '';
  const state = supplier?.State || '';
  const city = supplier?.City || '';

  const updateLine = (idx, patch) => setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = idx => setLines(ls => ls.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!supplierName) return notifyError(new Error('Supplier Name is required'));
    if (!billNum) return notifyError(new Error('Bill Num is required'));
    if (lines.length === 0) return notifyError(new Error('Add at least one line item'));
    for (const [i, line] of lines.entries()) {
      if (!line['Item Name']) return notifyError(new Error(`Line ${i + 1}: Item Name is required`));
      if (!line['QTY Purchased']) return notifyError(new Error(`Line ${i + 1}: QTY Purchased is required`));
      if (!line['Unit Cost']) return notifyError(new Error(`Line ${i + 1}: Unit Cost is required`));
    }
    setBusy(true);
    try {
      const payload = {
        header: {
          'PO ID': poId,
          'PO Date': fmtDate(poDate),
          'Supplier Name': supplierName,
          'Supplier ID': supplierId,
          State: state, City: city,
          'Bill Num': billNum,
        },
        lines: lines.map(l => {
          const c = calcLine(l);
          return {
            'Item ID': l['Item ID'], 'Item Name': l['Item Name'],
            'Item Type': l['Item Type'], 'Item Category': l['Item Category'], 'Item Subcategory': l['Item Subcategory'],
            'QTY Purchased': Number(l['QTY Purchased'] || 0),
            'Unit Cost': Number(l['Unit Cost'] || 0),
            ...c,
          };
        }),
      };
      await api.post('/purchases', payload);
      notifySuccess('New PO Created');
      await onSaved();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <FullPageModal open={open} onClose={onClose} title="Create New PO">
      {/* SECTION 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <Field label="PO ID">
          <div className="flex gap-2">
            <input readOnly value={poId} className="flex-1 px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm" />
            <button type="button" onClick={() => api.get('/purchases/generate-po-id').then(r => setPoId(r.id))} className="px-3 py-2 rounded-md bg-ink2 text-white text-sm">Generate</button>
          </div>
        </Field>
        <Field label="Supplier Name *"><SearchableSelect options={suppliers.map(s => s['Supplier Name'])} value={supplierName} onChange={setSupplierName} /></Field>
        <Field label="Supplier ID"><TxtInput v={supplierId} on={() => {}} readOnly /></Field>
        <Field label="State"><TxtInput v={state} on={() => {}} readOnly /></Field>
        <Field label="City"><TxtInput v={city} on={() => {}} readOnly /></Field>
        <Field label="Bill Num *"><TxtInput v={billNum} on={setBillNum} required /></Field>
        <Field label="PO Date *"><DatePicker selected={poDate} onChange={setPoDate} dateFormat="MM/dd/yyyy" /></Field>
      </div>

      {/* SECTION 2 */}
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
                {['Item Name', 'Item ID', 'Item Type', 'Item Category', 'Item Subcategory', 'QTY Purchased', 'Unit Cost', 'Cost Excl Tax', 'Tax Rate', 'Total Tax', 'Cost Incl Tax', 'Shipping Fees', 'Total Purchase Price', ''].map(h => (
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
                          const found = items.find(it => it['Item Name'] === v);
                          updateLine(idx, {
                            'Item Name': v,
                            'Item ID': found?.['Item ID'] || '',
                            'Item Type': found?.['Item Type'] || '',
                            'Item Category': found?.['Item Category'] || '',
                            'Item Subcategory': found?.['Item Subcategory'] || '',
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item ID']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item Type']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item Category']}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{line['Item Subcategory']}</td>
                    <td className="px-2 py-1"><input type="number" min="0" value={line['QTY Purchased']} onChange={e => updateLine(idx, { 'QTY Purchased': e.target.value })} className="w-20 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={line['Unit Cost']} onChange={e => updateLine(idx, { 'Unit Cost': e.target.value })} className="w-24 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Cost Excl Tax'])}</td>
                    <td className="px-2 py-1"><input type="text" placeholder="15.25%" value={line.taxRateInput} onChange={e => updateLine(idx, { taxRateInput: e.target.value })} className="w-20 px-2 py-1 border border-slate-300 rounded" /></td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Total Tax'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Cost Incl Tax'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(calc['Shipping Fees'])}</td>
                    <td className="px-2 py-1 text-right font-medium">{numFmt(calc['Total Purchase Price'])}</td>
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

function PoDetailsModal({ poId, onClose, items, setBusy, onChanged }) {
  const [details, setDetails] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (!poId) return;
    api.get(`/purchases/${encodeURIComponent(poId)}/details`).then(setDetails).catch(notifyError);
  }, [poId]);

  if (!poId) return null;

  const startEdit = d => {
    setEditingId(d['Detail ID']);
    setEdit({
      'Item Name': d['Item Name'],
      'Item ID': d['Item ID'],
      'Item Type': d['Item Type'],
      'Item Category': d['Item Category'],
      'Item Subcategory': d['Item Subcategory'],
      'QTY Purchased': d['QTY Purchased'],
      'Unit Cost': d['Unit Cost'],
      taxRateInput: String((Number(d['Tax Rate'] || 0) * 100).toFixed(2)) + '%',
    });
  };
  const cancelEdit = () => { setEditingId(null); setEdit({}); };
  const saveEdit = async () => {
    setBusy(true);
    try {
      const calc = calcLine(edit);
      await api.put(`/purchases/details/${encodeURIComponent(editingId)}`, {
        'Item ID': edit['Item ID'],
        'Item Name': edit['Item Name'],
        'Item Type': edit['Item Type'],
        'Item Category': edit['Item Category'],
        'Item Subcategory': edit['Item Subcategory'],
        'QTY Purchased': Number(edit['QTY Purchased'] || 0),
        'Unit Cost': Number(edit['Unit Cost'] || 0),
        ...calc,
      });
      notifySuccess('PO Details Updated');
      cancelEdit();
      const fresh = await api.get(`/purchases/${encodeURIComponent(poId)}/details`);
      setDetails(fresh);
      await onChanged();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };
  const doDelete = async () => {
    const id = confirmDel;
    setConfirmDel(null);
    setBusy(true);
    try {
      await api.del(`/purchases/details/${encodeURIComponent(id)}`);
      notifySuccess('PO Item Deleted');
      const fresh = await api.get(`/purchases/${encodeURIComponent(poId)}/details`);
      setDetails(fresh);
      await onChanged();
    } catch (e) { notifyError(e); } finally { setBusy(false); }
  };

  return (
    <>
      <FullPageModal open={!!poId} onClose={onClose} title={`PO Details — ${poId}`}>
        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="text-xs">
            <thead className="bg-ink text-white">
              <tr>
                {['Date', 'Detail ID', 'Item Name', 'Item ID', 'Item Type', 'Category', 'Subcategory', 'QTY', 'Unit Cost', 'Cost Excl Tax', 'Tax Rate', 'Total Tax', 'Cost Incl Tax', 'Shipping', 'Total', 'Actions'].map(h => (
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
                    <td className="px-2 py-1 whitespace-nowrap">{d['Date']}</td>
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
                    <td className="px-2 py-1">
                      {isEdit
                        ? <input type="number" value={edit['QTY Purchased']} onChange={e => setEdit(s => ({ ...s, 'QTY Purchased': e.target.value }))} className="w-16 px-2 py-1 border border-slate-300 rounded" />
                        : d['QTY Purchased']}
                    </td>
                    <td className="px-2 py-1">
                      {isEdit
                        ? <input type="number" step="0.01" value={edit['Unit Cost']} onChange={e => setEdit(s => ({ ...s, 'Unit Cost': e.target.value }))} className="w-20 px-2 py-1 border border-slate-300 rounded" />
                        : numFmt(d['Unit Cost'])}
                    </td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Cost Excl Tax'] : d['Cost Excl Tax'])}</td>
                    <td className="px-2 py-1">
                      {isEdit
                        ? <input type="text" value={edit.taxRateInput} onChange={e => setEdit(s => ({ ...s, taxRateInput: e.target.value }))} className="w-20 px-2 py-1 border border-slate-300 rounded" />
                        : ((Number(d['Tax Rate'] || 0) * 100).toFixed(2) + '%')}
                    </td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Total Tax'] : d['Total Tax'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Cost Incl Tax'] : d['Cost Incl Tax'])}</td>
                    <td className="px-2 py-1 text-right">{numFmt(isEdit ? calc['Shipping Fees'] : d['Shipping Fees'])}</td>
                    <td className="px-2 py-1 text-right font-medium">{numFmt(isEdit ? calc['Total Purchase Price'] : d['Total Purchase Price'])}</td>
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
        message="Delete this PO line item?"
        onCancel={() => setConfirmDel(null)}
        onConfirm={doDelete}
      />
    </>
  );
}
