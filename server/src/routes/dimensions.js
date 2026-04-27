import { Router } from 'express';
import { getRowsAsObjects, appendRow } from '../sheets.js';

const router = Router();

const VALID_COLUMNS = new Set([
  'State',
  'City',
  'PMT Mode',
  'PMT Status',
  'Shipping Status',
  'Item Type',
  'Item Category',
  'Item Subcategory',
]);

/** GET /api/dimensions → { state: [...], city: [...], 'pmt mode': [...], ... } */
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('Dimensions');
    const out = {};
    for (const col of VALID_COLUMNS) {
      const values = rows
        .map(r => r[col])
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      out[col] = Array.from(new Set(values.map(String)));
    }
    res.json(out);
  } catch (e) { next(e); }
});

/** POST /api/dimensions { column, value } — adds a value to a single column on the next free row */
router.post('/', async (req, res, next) => {
  try {
    const { column, value } = req.body || {};
    if (!VALID_COLUMNS.has(column)) {
      return res.status(400).json({ error: `Unknown dimension column: ${column}` });
    }
    if (!value || !String(value).trim()) {
      return res.status(400).json({ error: 'Value is required' });
    }
    await appendRow('Dimensions', { [column]: String(value).trim() });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
