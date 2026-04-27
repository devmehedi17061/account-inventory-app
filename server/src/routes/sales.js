import { Router } from 'express';
import { getRowsAsObjects, appendRow, updateRowById, deleteRowById } from '../sheets.js';
import { generateUniqueId, generateUniqueIdAcross } from '../idGenerator.js';
import { afterSaleChange, afterSaleEditOrDelete } from '../calculations.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('SalesOrders');
    res.json(rows.map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

router.get('/generate-so-id', async (_req, res, next) => {
  try {
    const id = await generateUniqueId('SalesDetails', 'SO ID', 'SO');
    res.json({ id });
  } catch (e) { next(e); }
});

router.get('/by-customer/:customerId', async (req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('SalesOrders');
    res.json(rows.filter(r => String(r['Customer ID']) === String(req.params.customerId)).map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

router.get('/:soId/details', async (req, res, next) => {
  try {
    const { rows } = await getRowsAsObjects('SalesDetails');
    res.json(rows.filter(r => String(r['SO ID']) === String(req.params.soId)).map(({ __row, ...r }) => r));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { header, lines } = req.body || {};
    if (!header || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'header and at least one line item are required' });
    }
    const soId = header['SO ID'] || (await generateUniqueId('SalesDetails', 'SO ID', 'SO'));

    for (const line of lines) {
      const detailId = await generateUniqueIdAcross('D', [
        { sheet: 'PurchaseDetails', col: 'Detail ID' },
        { sheet: 'SalesDetails', col: 'Detail ID' },
      ]);
      await appendRow('SalesDetails', {
        'SO Date': header['SO Date'] || '',
        'SO ID': soId,
        'Detail ID': detailId,
        'Customer ID': header['Customer ID'] || '',
        'Customer Name': header['Customer Name'] || '',
        State: header.State || '',
        City: header.City || '',
        'Invoice Num': header['Invoice Num'] || '',
        'Item ID': line['Item ID'] || '',
        'Item Type': line['Item Type'] || '',
        'Item Category': line['Item Category'] || '',
        'Item Subcategory': line['Item Subcategory'] || '',
        'Item Name': line['Item Name'] || '',
        'QTY Sold': Number(line['QTY Sold'] || 0),
        'Unit Price': Number(line['Unit Price'] || 0),
        'Price Excl Tax': Number(line['Price Excl Tax'] || 0),
        'Tax Rate': Number(line['Tax Rate'] || 0),
        'Total Tax': Number(line['Total Tax'] || 0),
        'Price Incl Tax': Number(line['Price Incl Tax'] || 0),
        'Shipping Fees': Number(line['Shipping Fees'] || 0),
        'Total Sales Price': Number(line['Total Sales Price'] || 0),
      });
    }

    await afterSaleChange();
    res.json({ ok: true, soId });
  } catch (e) { next(e); }
});

router.put('/details/:detailId', async (req, res, next) => {
  try {
    const allowed = ['Item ID', 'Item Name', 'Item Type', 'Item Category', 'Item Subcategory',
      'QTY Sold', 'Unit Price', 'Price Excl Tax', 'Tax Rate', 'Total Tax', 'Price Incl Tax',
      'Shipping Fees', 'Total Sales Price'];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    await updateRowById('SalesDetails', 'Detail ID', req.params.detailId, patch);
    await afterSaleEditOrDelete();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/details/:detailId', async (req, res, next) => {
  try {
    await deleteRowById('SalesDetails', 'Detail ID', req.params.detailId);
    await afterSaleEditOrDelete();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
