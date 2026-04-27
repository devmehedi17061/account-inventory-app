import { Router } from 'express';
import { getRowsAsObjects } from '../sheets.js';

const router = Router();

/**
 * GET /api/reports/summary — flat summary numbers used by Reports page tiles.
 * Reports module instructions weren't fully spelled out in the original spec
 * (prompt 9 covered the dashboard), so this gives the page real data to show
 * without inventing UX. Extend as report requirements solidify.
 */
router.get('/summary', async (_req, res, next) => {
  try {
    const [suppliers, customers, inventory, po, so, receipts, payments] = await Promise.all([
      getRowsAsObjects('Suppliers'),
      getRowsAsObjects('Customers'),
      getRowsAsObjects('InventoryItems'),
      getRowsAsObjects('PurchaseOrders'),
      getRowsAsObjects('SalesOrders'),
      getRowsAsObjects('Receipts'),
      getRowsAsObjects('Payments'),
    ]);
    res.json({
      counts: {
        suppliers: suppliers.rows.length,
        customers: customers.rows.length,
        inventory: inventory.rows.length,
        purchaseOrders: po.rows.length,
        salesOrders: so.rows.length,
        receipts: receipts.rows.length,
        payments: payments.rows.length,
      },
    });
  } catch (e) { next(e); }
});

export default router;
