import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId } from '../idGenerator.js';
import { afterPaymentChange } from '../calculations.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Payments');
    res.json(rows.map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

router.get('/generate-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('Payments', 'Trx ID', 'PT');
    res.json({ id });
  } catch (e) { next(e); }
});

async function validatePaymentAmount(poId, amount, ignoreTrxId = null) {
  const po = await getRowsAsObjects('PurchaseOrders');
  const target = po.rows.find(r => String(r['PO ID']) === String(poId));
  if (!target) return null;
  let balance = Number(target['PO Balance'] || 0);
  if (ignoreTrxId) {
    const pt = await getRowsAsObjects('Payments');
    const prev = pt.rows.find(r => String(r['Trx ID']) === String(ignoreTrxId));
    if (prev) balance += Number(prev['Amount Paid'] || 0);
  }
  return amount > balance ? balance : null;
}

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const amount = Number(b['Amount Paid'] || 0);
    if (amount <= 0) return res.status(400).json({ error: 'Amount Paid must be greater than 0' });
    const overflow = await validatePaymentAmount(b['PO ID'], amount);
    if (overflow !== null) return res.status(400).json({ error: 'Amount paid is more than PO Balance' });
    const trxId = b['Trx ID'] || (await generateUniqueId('Payments', 'Trx ID', 'PT'));
    await appendRow('Payments', {
      'Trx Date': b['Trx Date'] || '',
      'Trx ID': trxId,
      'Supplier ID': b['Supplier ID'] || '',
      'Supplier Name': b['Supplier Name'] || '',
      State: b.State || '',
      City: b.City || '',
      'PO ID': b['PO ID'] || '',
      'Bill Num': b['Bill Num'] || '',
      'PMT Mode': b['PMT Mode'] || '',
      'Amount Paid': amount,
    });
    await afterPaymentChange();
    res.json({ ok: true, trxId });
  } catch (e) { next(e); }
});

router.put('/:trxId', async (req, res, next) => {
  try {
    const b = req.body || {};
    if ('Amount Paid' in b) {
      const amount = Number(b['Amount Paid'] || 0);
      const overflow = await validatePaymentAmount(b['PO ID'], amount, req.params.trxId);
      if (overflow !== null) return res.status(400).json({ error: 'Amount paid is more than PO Balance' });
    }
    const allowed = ['Trx Date', 'Supplier ID', 'Supplier Name', 'State', 'City', 'PO ID', 'Bill Num', 'PMT Mode', 'Amount Paid'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    await updateRowById('Payments', 'Trx ID', req.params.trxId, patch);
    await afterPaymentChange();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:trxId', async (req, res, next) => {
  try {
    await deleteRowById('Payments', 'Trx ID', req.params.trxId);
    await afterPaymentChange();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
