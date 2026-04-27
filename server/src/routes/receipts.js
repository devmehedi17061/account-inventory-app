import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId } from '../idGenerator.js';
import { afterReceiptChange } from '../calculations.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Receipts');
    res.json(rows.map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

router.get('/generate-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('Receipts', 'Trx ID', 'RT');
    res.json({ id });
  } catch (e) { next(e); }
});

async function validateReceiptAmount(soId, amount, ignoreTrxId = null) {
  const so = await getRowsAsObjects('SalesOrders');
  const target = so.rows.find(r => String(r['SO ID']) === String(soId));
  if (!target) return null;
  let balance = Number(target['SO Balance'] || 0);
  if (ignoreTrxId) {
    const rc = await getRowsAsObjects('Receipts');
    const prev = rc.rows.find(r => String(r['Trx ID']) === String(ignoreTrxId));
    if (prev) balance += Number(prev['Amount Received'] || 0);
  }
  return amount > balance ? balance : null;
}

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const amount = Number(b['Amount Received'] || 0);
    if (amount <= 0) return res.status(400).json({ error: 'Amount Received must be greater than 0' });
    const overflow = await validateReceiptAmount(b['SO ID'], amount);
    if (overflow !== null) return res.status(400).json({ error: 'Amount received is more than SO Balance' });
    const trxId = b['Trx ID'] || (await generateUniqueId('Receipts', 'Trx ID', 'RT'));
    await appendRow('Receipts', {
      'Trx Date': b['Trx Date'] || '',
      'Trx ID': trxId,
      'Customer ID': b['Customer ID'] || '',
      'Customer Name': b['Customer Name'] || '',
      State: b.State || '',
      City: b.City || '',
      'SO ID': b['SO ID'] || '',
      'Invoice Num': b['Invoice Num'] || '',
      'PMT Mode': b['PMT Mode'] || '',
      'Amount Received': amount,
    });
    await afterReceiptChange();
    res.json({ ok: true, trxId });
  } catch (e) { next(e); }
});

router.put('/:trxId', async (req, res, next) => {
  try {
    const b = req.body || {};
    if ('Amount Received' in b) {
      const amount = Number(b['Amount Received'] || 0);
      const overflow = await validateReceiptAmount(b['SO ID'], amount, req.params.trxId);
      if (overflow !== null) return res.status(400).json({ error: 'Amount received is more than SO Balance' });
    }
    const allowed = ['Trx Date', 'Customer ID', 'Customer Name', 'State', 'City', 'SO ID', 'Invoice Num', 'PMT Mode', 'Amount Received'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    await updateRowById('Receipts', 'Trx ID', req.params.trxId, patch);
    await afterReceiptChange();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:trxId', async (req, res, next) => {
  try {
    await deleteRowById('Receipts', 'Trx ID', req.params.trxId);
    await afterReceiptChange();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
