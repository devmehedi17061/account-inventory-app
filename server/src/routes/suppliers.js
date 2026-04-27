import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId } from '../idGenerator.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Suppliers');
    res.json(rows.map(({ __row, ...rest }) => rest));
  } catch (e) { next(e); }
});

router.get('/generate-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('Suppliers', 'Supplier ID', 'P');
    res.json({ id });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b['Supplier Name']) return res.status(400).json({ error: 'Supplier Name is required' });
    const id = b['Supplier ID'] || (await generateUniqueId('Suppliers', 'Supplier ID', 'P'));
    await appendRow('Suppliers', {
      'Supplier ID': id,
      'Supplier Name': b['Supplier Name'] || '',
      'Supplier Contact': b['Supplier Contact'] || '',
      'Supplier Email': b['Supplier Email'] || '',
      State: b.State || '',
      City: b.City || '',
      'Supplier Address': b['Supplier Address'] || '',
      'Total Purchases': 0,
      'Total Payments': 0,
      'Balance Payable': 0,
    });
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const allowed = ['Supplier Name', 'Supplier Contact', 'Supplier Email', 'State', 'City', 'Supplier Address'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    await updateRowById('Suppliers', 'Supplier ID', req.params.id, patch);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Suppliers');
    const target = rows.find(r => String(r['Supplier ID']) === String(req.params.id));
    if (!target) return res.status(404).json({ error: 'Supplier not found' });
    if (Number(target['Balance Payable']) > 0) {
      return res.status(409).json({ error: 'Supplier has outstanding balance' });
    }
    await deleteRowById('Suppliers', 'Supplier ID', req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
