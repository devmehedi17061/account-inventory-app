import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId } from '../idGenerator.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Customers');
    res.json(rows.map(({ __row, ...rest }) => rest));
  } catch (e) { next(e); }
});

router.get('/generate-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('Customers', 'Customer ID', 'C');
    res.json({ id });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b['Customer Name']) return res.status(400).json({ error: 'Customer Name is required' });
    const id = b['Customer ID'] || (await generateUniqueId('Customers', 'Customer ID', 'C'));
    await appendRow('Customers', {
      'Customer ID': id,
      'Customer Name': b['Customer Name'] || '',
      'Customer Contact': b['Customer Contact'] || '',
      'Customer Email': b['Customer Email'] || '',
      State: b.State || '',
      City: b.City || '',
      'Customer Address': b['Customer Address'] || '',
      'Total Sales': 0,
      'Total Receipts': 0,
      'Balance Receivable': 0,
    });
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const allowed = ['Customer Name', 'Customer Contact', 'Customer Email', 'State', 'City', 'Customer Address'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    await updateRowById('Customers', 'Customer ID', req.params.id, patch);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Customers');
    const target = rows.find(r => String(r['Customer ID']) === String(req.params.id));
    if (!target) return res.status(404).json({ error: 'Customer not found' });
    if (Number(target['Balance Receivable']) > 0) {
      return res.status(409).json({ error: 'Customer has outstanding balance' });
    }
    await deleteRowById('Customers', 'Customer ID', req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
