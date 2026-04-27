import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId, generateUniqueIdAcross } from '../idGenerator.js';
import { afterPurchaseChange, afterPurchaseEditOrDelete } from '../calculations.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('PurchaseOrders');
    res.json(rows.map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

router.get('/generate-po-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('PurchaseDetails', 'PO ID', 'PO');
    res.json({ id });
  } catch (e) { next(e); }
});

router.get('/:poId/details', async (req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('PurchaseDetails');
    res.json(rows.filter(r => String(r['PO ID']) === String(req.params.poId)).map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

/**
 * POST /api/purchases  — create a PO with multiple line items.
 * Body: { header: {...common fields}, lines: [{Item ID, Item Name, ...calc fields}, ...] }
 */
router.post('/', async (req, res, next) => {
  try {
    const { header, lines } = req.body || {};
    if (!header || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'header and at least one line item are required' });
    }
    const poId = header['PO ID'] || (await generateUniqueId('PurchaseDetails', 'PO ID', 'PO'));

    for (const line of lines) {
      const detailId = await generateUniqueIdAcross('D', [
        { sheet: 'PurchaseDetails', col: 'Detail ID' },
        { sheet: 'SalesDetails', col: 'Detail ID' },
      ]);
      await appendRow('PurchaseDetails', {
        Date: header['PO Date'] || header.Date || '',
        'PO ID': poId,
        'Detail ID': detailId,
        'Supplier ID': header['Supplier ID'] || '',
        'Supplier Name': header['Supplier Name'] || '',
        State: header.State || '',
        City: header.City || '',
        'Bill Num': header['Bill Num'] || '',
        'Item ID': line['Item ID'] || '',
        'Item Type': line['Item Type'] || '',
        'Item Category': line['Item Category'] || '',
        'Item Subcategory': line['Item Subcategory'] || '',
        'Item Name': line['Item Name'] || '',
        'QTY Purchased': Number(line['QTY Purchased'] || 0),
        'Unit Cost': Number(line['Unit Cost'] || 0),
        'Cost Excl Tax': Number(line['Cost Excl Tax'] || 0),
        'Tax Rate': Number(line['Tax Rate'] || 0),
        'Total Tax': Number(line['Total Tax'] || 0),
        'Cost Incl Tax': Number(line['Cost Incl Tax'] || 0),
        'Shipping Fees': Number(line['Shipping Fees'] || 0),
        'Total Purchase Price': Number(line['Total Purchase Price'] || 0),
      });
    }

    await afterPurchaseChange();
    res.json({ ok: true, poId });
  } catch (e) { next(e); }
});

router.put('/details/:detailId', async (req, res, next) => {
  try {
    const allowed = ['Item ID', 'Item Name', 'Item Type', 'Item Category', 'Item Subcategory',
      'QTY Purchased', 'Unit Cost', 'Cost Excl Tax', 'Tax Rate', 'Total Tax', 'Cost Incl Tax',
      'Shipping Fees', 'Total Purchase Price'];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    await updateRowById('PurchaseDetails', 'Detail ID', req.params.detailId, patch);
    await afterPurchaseEditOrDelete();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/details/:detailId', async (req, res, next) => {
  try {
    await deleteRowById('PurchaseDetails', 'Detail ID', req.params.detailId);
    await afterPurchaseEditOrDelete();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
