import { getRowsAsObjects, batchSetCells, appendRow } from './sheets.js';

const num = v => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const sumBy = (rows, matchCol, matchVal, sumCol) =>
  rows.filter(r => String(r[matchCol]) === String(matchVal)).reduce((a, r) => a + num(r[sumCol]), 0);

/* =========================================================================
 * Inventory aggregations
 * ========================================================================= */

/** updateQtyPurchased — sumif PurchaseDetails.QTY Purchased per Item ID */
export async function updateQtyPurchased() {
  const inv = await getRowsAsObjects('InventoryItems');
  const pd = await getRowsAsObjects('PurchaseDetails');
  const patches = inv.rows.map(r => ({
    row: r.__row,
    column: 'QTY Purchased',
    value: sumBy(pd.rows, 'Item ID', r['Item ID'], 'QTY Purchased'),
  }));
  await batchSetCells('InventoryItems', patches);
}

/** updateQtySold — sumif SalesDetails.QTY Sold per Item ID */
export async function updateQtySold() {
  const inv = await getRowsAsObjects('InventoryItems');
  const sd = await getRowsAsObjects('SalesDetails');
  const patches = inv.rows.map(r => ({
    row: r.__row,
    column: 'QTY Sold',
    value: sumBy(sd.rows, 'Item ID', r['Item ID'], 'QTY Sold'),
  }));
  await batchSetCells('InventoryItems', patches);
}

/** calcRemainingQty — QTY Purchased - QTY Sold */
export async function calcRemainingQty() {
  const inv = await getRowsAsObjects('InventoryItems');
  const patches = inv.rows.map(r => ({
    row: r.__row,
    column: 'Remaining QTY',
    value: num(r['QTY Purchased']) - num(r['QTY Sold']),
  }));
  await batchSetCells('InventoryItems', patches);
}

/** calcReorderRequired — "Yes" if Remaining QTY < Reorder Level else "No" */
export async function calcReorderRequired() {
  const inv = await getRowsAsObjects('InventoryItems');
  const patches = inv.rows.map(r => ({
    row: r.__row,
    column: 'Reorder Required',
    value: num(r['Remaining QTY']) < num(r['Reorder Level']) ? 'Yes' : 'No',
  }));
  await batchSetCells('InventoryItems', patches);
}

/* =========================================================================
 * Suppliers / Purchases aggregations
 * ========================================================================= */

/** updateTotalPurchases — sumif PurchaseDetails.Total Purchase Price per Supplier ID */
export async function updateTotalPurchases() {
  const sup = await getRowsAsObjects('Suppliers');
  const pd = await getRowsAsObjects('PurchaseDetails');
  const patches = sup.rows.map(r => ({
    row: r.__row,
    column: 'Total Purchases',
    value: sumBy(pd.rows, 'Supplier ID', r['Supplier ID'], 'Total Purchase Price'),
  }));
  await batchSetCells('Suppliers', patches);
}

/** updateBalancePayable — Total Purchases - Total Payments */
export async function updateBalancePayable() {
  const sup = await getRowsAsObjects('Suppliers');
  const patches = sup.rows.map(r => ({
    row: r.__row,
    column: 'Balance Payable',
    value: num(r['Total Purchases']) - num(r['Total Payments']),
  }));
  await batchSetCells('Suppliers', patches);
}

/**
 * updateTotalPO — for each unique PO ID in PurchaseDetails, ensure a single
 * row in PurchaseOrders with summed Total Amount and copied common fields.
 * If no PO row exists for a given PO ID, append one.
 */
export async function updateTotalPO() {
  const pd = await getRowsAsObjects('PurchaseDetails');
  const po = await getRowsAsObjects('PurchaseOrders');

  const byPoId = new Map();
  for (const d of pd.rows) {
    const key = String(d['PO ID']);
    if (!key) continue;
    if (!byPoId.has(key)) {
      byPoId.set(key, {
        Date: d['Date'],
        'PO ID': d['PO ID'],
        'Supplier ID': d['Supplier ID'],
        'Supplier Name': d['Supplier Name'],
        'Bill Num': d['Bill Num'],
        State: d['State'],
        City: d['City'],
        total: 0,
      });
    }
    const acc = byPoId.get(key);
    acc.total += num(d['Total Purchase Price']);
  }

  // Update existing PO rows
  const updates = [];
  const seen = new Set();
  for (const r of po.rows) {
    const key = String(r['PO ID']);
    if (!byPoId.has(key)) continue;
    seen.add(key);
    updates.push({ row: r.__row, column: 'Total Amount', value: byPoId.get(key).total });
  }
  await batchSetCells('PurchaseOrders', updates);

  // Append rows for new PO IDs
  for (const [key, info] of byPoId.entries()) {
    if (seen.has(key)) continue;
    await appendRow('PurchaseOrders', {
      Date: info.Date,
      'PO ID': info['PO ID'],
      'Supplier ID': info['Supplier ID'],
      'Supplier Name': info['Supplier Name'],
      'Bill Num': info['Bill Num'],
      State: info.State,
      City: info.City,
      'Total Amount': info.total,
      'Total Paid': 0,
      'PO Balance': info.total,
      'PMT Status': 'Pending',
      'Shipping Status': '',
    });
  }
}

/** reviseTotalPO — recompute Total Amount only (no row creation) */
export async function reviseTotalPO() {
  const pd = await getRowsAsObjects('PurchaseDetails');
  const po = await getRowsAsObjects('PurchaseOrders');
  const patches = po.rows.map(r => ({
    row: r.__row,
    column: 'Total Amount',
    value: sumBy(pd.rows, 'PO ID', r['PO ID'], 'Total Purchase Price'),
  }));
  await batchSetCells('PurchaseOrders', patches);
}

/** updatePOBalance — Total Amount - Total Paid */
export async function updatePOBalance() {
  const po = await getRowsAsObjects('PurchaseOrders');
  const patches = po.rows.map(r => ({
    row: r.__row,
    column: 'PO Balance',
    value: num(r['Total Amount']) - num(r['Total Paid']),
  }));
  await batchSetCells('PurchaseOrders', patches);
}

/* =========================================================================
 * Customers / Sales aggregations
 * ========================================================================= */

/** calcTotalSales — sumif SalesDetails.Total Sales Price per Customer ID */
export async function calcTotalSales() {
  const cust = await getRowsAsObjects('Customers');
  const sd = await getRowsAsObjects('SalesDetails');
  const patches = cust.rows.map(r => ({
    row: r.__row,
    column: 'Total Sales',
    value: sumBy(sd.rows, 'Customer ID', r['Customer ID'], 'Total Sales Price'),
  }));
  await batchSetCells('Customers', patches);
}

/** calcBalanceReceivable — Total Sales - Total Receipts */
export async function calcBalanceReceivable() {
  const cust = await getRowsAsObjects('Customers');
  const patches = cust.rows.map(r => ({
    row: r.__row,
    column: 'Balance Receivable',
    value: num(r['Total Sales']) - num(r['Total Receipts']),
  }));
  await batchSetCells('Customers', patches);
}

/**
 * calcTotalSOAmount — for each unique SO ID in SalesDetails, ensure a single
 * row in SalesOrders with summed Total SO Amount; append if missing.
 */
export async function calcTotalSOAmount() {
  const sd = await getRowsAsObjects('SalesDetails');
  const so = await getRowsAsObjects('SalesOrders');

  const bySoId = new Map();
  for (const d of sd.rows) {
    const key = String(d['SO ID']);
    if (!key) continue;
    if (!bySoId.has(key)) {
      bySoId.set(key, {
        'SO Date': d['SO Date'],
        'SO ID': d['SO ID'],
        'Customer ID': d['Customer ID'],
        'Customer Name': d['Customer Name'],
        'Invoice Num': d['Invoice Num'],
        State: d['State'],
        City: d['City'],
        total: 0,
      });
    }
    bySoId.get(key).total += num(d['Total Sales Price']);
  }

  const updates = [];
  const seen = new Set();
  for (const r of so.rows) {
    const key = String(r['SO ID']);
    if (!bySoId.has(key)) continue;
    seen.add(key);
    updates.push({ row: r.__row, column: 'Total SO Amount', value: bySoId.get(key).total });
  }
  await batchSetCells('SalesOrders', updates);

  for (const [key, info] of bySoId.entries()) {
    if (seen.has(key)) continue;
    await appendRow('SalesOrders', {
      'SO Date': info['SO Date'],
      'SO ID': info['SO ID'],
      'Customer ID': info['Customer ID'],
      'Customer Name': info['Customer Name'],
      'Invoice Num': info['Invoice Num'],
      State: info.State,
      City: info.City,
      'Total SO Amount': info.total,
      'Total Received': 0,
      'SO Balance': info.total,
      'Receipt Status': 'Pending',
      'Shipping Status': '',
    });
  }
}

/** reviseTotalSO — recompute Total SO Amount only */
export async function reviseTotalSO() {
  const sd = await getRowsAsObjects('SalesDetails');
  const so = await getRowsAsObjects('SalesOrders');
  const patches = so.rows.map(r => ({
    row: r.__row,
    column: 'Total SO Amount',
    value: sumBy(sd.rows, 'SO ID', r['SO ID'], 'Total Sales Price'),
  }));
  await batchSetCells('SalesOrders', patches);
}

/** calcSOBalance — Total SO Amount - Total Received */
export async function calcSOBalance() {
  const so = await getRowsAsObjects('SalesOrders');
  const patches = so.rows.map(r => ({
    row: r.__row,
    column: 'SO Balance',
    value: num(r['Total SO Amount']) - num(r['Total Received']),
  }));
  await batchSetCells('SalesOrders', patches);
}

/* =========================================================================
 * Receipts / Payments aggregations
 * ========================================================================= */

/** calcSOReceipts — sumif Receipts.Amount Received per SO ID → SalesOrders.Total Received */
export async function calcSOReceipts() {
  const so = await getRowsAsObjects('SalesOrders');
  const rc = await getRowsAsObjects('Receipts');
  const patches = so.rows.map(r => ({
    row: r.__row,
    column: 'Total Received',
    value: sumBy(rc.rows, 'SO ID', r['SO ID'], 'Amount Received'),
  }));
  await batchSetCells('SalesOrders', patches);
}

/** calcTotalReceipts — sumif SalesOrders.Total Received per Customer ID → Customers.Total Receipts */
export async function calcTotalReceipts() {
  const cust = await getRowsAsObjects('Customers');
  const so = await getRowsAsObjects('SalesOrders');
  const patches = cust.rows.map(r => ({
    row: r.__row,
    column: 'Total Receipts',
    value: sumBy(so.rows, 'Customer ID', r['Customer ID'], 'Total Received'),
  }));
  await batchSetCells('Customers', patches);
}

/** updateReceiptStatus on SalesOrders */
export async function updateReceiptStatus() {
  const so = await getRowsAsObjects('SalesOrders');
  const patches = so.rows.map(r => {
    const total = num(r['Total SO Amount']);
    const recv = num(r['Total Received']);
    let status;
    if (recv === 0) status = 'Pending';
    else if (recv < total) status = 'Partial Receipt';
    else status = 'Received';
    return { row: r.__row, column: 'Receipt Status', value: status };
  });
  await batchSetCells('SalesOrders', patches);
}

/** calcPOPayments — sumif Payments.Amount Paid per PO ID → PurchaseOrders.Total Paid */
export async function calcPOPayments() {
  const po = await getRowsAsObjects('PurchaseOrders');
  const pt = await getRowsAsObjects('Payments');
  const patches = po.rows.map(r => ({
    row: r.__row,
    column: 'Total Paid',
    value: sumBy(pt.rows, 'PO ID', r['PO ID'], 'Amount Paid'),
  }));
  await batchSetCells('PurchaseOrders', patches);
}

/** calcTotalPayments — sumif PurchaseOrders.Total Paid per Supplier ID → Suppliers.Total Payments */
export async function calcTotalPayments() {
  const sup = await getRowsAsObjects('Suppliers');
  const po = await getRowsAsObjects('PurchaseOrders');
  const patches = sup.rows.map(r => ({
    row: r.__row,
    column: 'Total Payments',
    value: sumBy(po.rows, 'Supplier ID', r['Supplier ID'], 'Total Paid'),
  }));
  await batchSetCells('Suppliers', patches);
}

/** updatePaymentStatus on PurchaseOrders */
export async function updatePaymentStatus() {
  const po = await getRowsAsObjects('PurchaseOrders');
  const patches = po.rows.map(r => {
    const total = num(r['Total Amount']);
    const paid = num(r['Total Paid']);
    let status;
    if (paid === 0) status = 'Pending';
    else if (paid < total) status = 'Partial Payment';
    else status = 'Paid';
    return { row: r.__row, column: 'PMT Status', value: status };
  });
  await batchSetCells('PurchaseOrders', patches);
}

/* =========================================================================
 * Sequences (run after specific actions, in spec order)
 * ========================================================================= */

export async function afterPurchaseChange() {
  await updateTotalPO();
  await updatePOBalance();
  await updateQtyPurchased();
  await calcRemainingQty();
  await calcReorderRequired();
  await updateTotalPurchases();
  await updateBalancePayable();
}

export async function afterPurchaseEditOrDelete() {
  await reviseTotalPO();
  await updatePOBalance();
  await updateQtyPurchased();
  await calcRemainingQty();
  await calcReorderRequired();
  await updateTotalPurchases();
  await updateBalancePayable();
}

export async function afterSaleChange() {
  await calcTotalSOAmount();
  await calcSOBalance();
  await updateQtySold();
  await calcRemainingQty();
  await calcReorderRequired();
  await calcTotalSales();
  await calcBalanceReceivable();
}

export async function afterSaleEditOrDelete() {
  await reviseTotalSO();
  await calcSOBalance();
  await updateQtySold();
  await calcRemainingQty();
  await calcReorderRequired();
  await calcTotalSales();
  await calcBalanceReceivable();
}

export async function afterReceiptChange() {
  await calcSOReceipts();
  await calcTotalReceipts();
  await calcSOBalance();
  await calcBalanceReceivable();
  await updateReceiptStatus();
}

export async function afterPaymentChange() {
  await calcPOPayments();
  await calcTotalPayments();
  await updatePOBalance();
  await updateBalancePayable();
  await updatePaymentStatus();
}
