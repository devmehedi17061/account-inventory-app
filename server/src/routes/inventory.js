import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId } from '../idGenerator.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('InventoryItems');
    res.json(rows.map(({ __row, ...rest }) => rest));
  } catch (e) { next(e); }
});

router.get('/generate-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('InventoryItems', 'Item ID', 'P');
    res.json({ id });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b['Item Name']) return res.status(400).json({ error: 'Item Name is required' });
    if (!b['Item Type']) return res.status(400).json({ error: 'Item Type is required' });
    const id = b['Item ID'] || (await generateUniqueId('InventoryItems', 'Item ID', 'P'));
    await appendRow('InventoryItems', {
      'Item ID': id,
      'Item Type': b['Item Type'] || '',
      'Item Category': b['Item Category'] || '',
      'Item Subcategory': b['Item Subcategory'] || '',
      'Item Name': b['Item Name'] || '',
      'QTY Purchased': 0,
      'QTY Sold': 0,
      'Remaining QTY': 0,
      'Reorder Level': Number(b['Reorder Level'] || 0),
      'Reorder Required': 'No',
    });
    res.json({ ok: true, id });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body || {};
    const allowed = ['Item Type', 'Item Category', 'Item Subcategory', 'Item Name', 'Reorder Level'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    await updateRowById('InventoryItems', 'Item ID', req.params.id, patch);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('InventoryItems');
    const target = rows.find(r => String(r['Item ID']) === String(req.params.id));
    if (!target) return res.status(404).json({ error: 'Item not found' });
    if (Number(target['Remaining QTY']) > 0) {
      return res.status(409).json({ error: "Item with stock in hand can't be deleted" });
    }
    await deleteRowById('InventoryItems', 'Item ID', req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
