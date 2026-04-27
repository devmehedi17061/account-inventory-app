/**
 * AIC Inventory App — one-click Google Sheet setup
 * --------------------------------------------------
 * 1. Open your "AIC Inventory App" Google Sheet.
 * 2. Extensions → Apps Script. Paste the entire contents of this file
 *    into the script editor (replace any existing code in `Code.gs`).
 *    Save the project (Ctrl+S).
 * 3. Reload the spreadsheet. A new menu "AIC Setup" appears next to Help.
 * 4. Click "AIC Setup → Create All Sheets". Approve permissions on first run.
 *
 * What it does:
 *  - Creates every sheet the React app expects (Suppliers, Customers,
 *    InventoryItems, PurchaseOrders, PurchaseDetails, SalesOrders,
 *    SalesDetails, Receipts, Payments, Dimensions) if they don't already
 *    exist. Existing sheets are left in place — only headers are refreshed.
 *  - Writes the header row each module reads/writes through the Sheets API.
 *  - Formats every date column as MM/dd/yyyy.
 *  - (Re)creates the named ranges (RANGESUPPLIERS, RANGECUSTOMERS,
 *    RANGEINVENTORYITEMS, RANGEPO, RANGEPD, RANGESO, RANGESD,
 *    RANGERECEIPTS, RANGEPAYMENTS, RANGEDIMENSIONS).
 *  - Removes the default empty "Sheet1" if it's untouched.
 *
 * Idempotent — safe to run multiple times. Existing data rows are kept.
 */

const SHEET_DEFS = [
  {
    sheet: 'Suppliers',
    namedRange: 'RANGESUPPLIERS',
    headers: [
      'Supplier ID', 'Supplier Name', 'Supplier Contact', 'Supplier Email',
      'State', 'City', 'Supplier Address',
      'Total Purchases', 'Total Payments', 'Balance Payable',
    ],
  },
  {
    sheet: 'Customers',
    namedRange: 'RANGECUSTOMERS',
    headers: [
      'Customer ID', 'Customer Name', 'Customer Contact', 'Customer Email',
      'State', 'City', 'Customer Address',
      'Total Sales', 'Total Receipts', 'Balance Receivable',
    ],
  },
  {
    sheet: 'InventoryItems',
    namedRange: 'RANGEINVENTORYITEMS',
    headers: [
      'Item ID', 'Item Type', 'Item Category', 'Item Subcategory', 'Item Name',
      'QTY Purchased', 'QTY Sold', 'Remaining QTY', 'Reorder Level', 'Reorder Required',
    ],
  },
  {
    sheet: 'PurchaseOrders',
    namedRange: 'RANGEPO',
    headers: [
      'Date', 'PO ID', 'Supplier ID', 'Supplier Name', 'Bill Num',
      'State', 'City',
      'Total Amount', 'Total Paid', 'PO Balance',
      'PMT Status', 'Shipping Status',
    ],
  },
  {
    sheet: 'PurchaseDetails',
    namedRange: 'RANGEPD',
    headers: [
      'Date', 'PO ID', 'Detail ID', 'Supplier ID', 'Supplier Name',
      'State', 'City', 'Bill Num',
      'Item ID', 'Item Type', 'Item Category', 'Item Subcategory', 'Item Name',
      'QTY Purchased', 'Unit Cost',
      'Cost Excl Tax', 'Tax Rate', 'Total Tax', 'Cost Incl Tax',
      'Shipping Fees', 'Total Purchase Price',
    ],
  },
  {
    sheet: 'SalesOrders',
    namedRange: 'RANGESO',
    headers: [
      'SO Date', 'SO ID', 'Customer ID', 'Customer Name', 'Invoice Num',
      'State', 'City',
      'Total SO Amount', 'Total Received', 'SO Balance',
      'Receipt Status', 'Shipping Status',
    ],
  },
  {
    sheet: 'SalesDetails',
    namedRange: 'RANGESD',
    headers: [
      'SO Date', 'SO ID', 'Detail ID', 'Customer ID', 'Customer Name',
      'State', 'City', 'Invoice Num',
      'Item ID', 'Item Type', 'Item Category', 'Item Subcategory', 'Item Name',
      'QTY Sold', 'Unit Price',
      'Price Excl Tax', 'Tax Rate', 'Total Tax', 'Price Incl Tax',
      'Shipping Fees', 'Total Sales Price',
    ],
  },
  {
    sheet: 'Receipts',
    namedRange: 'RANGERECEIPTS',
    headers: [
      'Trx Date', 'Trx ID', 'Customer ID', 'Customer Name',
      'State', 'City', 'SO ID', 'Invoice Num', 'PMT Mode', 'Amount Received',
    ],
  },
  {
    sheet: 'Payments',
    namedRange: 'RANGEPAYMENTS',
    headers: [
      'Trx Date', 'Trx ID', 'Supplier ID', 'Supplier Name',
      'State', 'City', 'PO ID', 'Bill Num', 'PMT Mode', 'Amount Paid',
    ],
  },
  {
    sheet: 'Dimensions',
    namedRange: 'RANGEDIMENSIONS',
    headers: [
      'State', 'City', 'PMT Mode', 'PMT Status', 'Shipping Status',
      'Item Type', 'Item Category', 'Item Subcategory',
    ],
  },
];

// Columns on these sheets are date-formatted MM/dd/yyyy
const DATE_COLUMNS = {
  PurchaseOrders: ['Date'],
  PurchaseDetails: ['Date'],
  SalesOrders: ['SO Date'],
  SalesDetails: ['SO Date'],
  Receipts: ['Trx Date'],
  Payments: ['Trx Date'],
};

const HEADER_BG = '#021640';   // navy (matches React app theme)
const HEADER_FG = '#ffffff';

/** Custom menu — appears every time the spreadsheet is opened. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AIC Setup')
    .addItem('Create All Sheets', 'setupAllSheets')
    .addSeparator()
    .addItem('Reset (delete & recreate empty)', 'resetAllSheets')
    .addToUi();
}

/** Main entry point — idempotent. */
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  const existed = [];

  SHEET_DEFS.forEach(def => {
    let sheet = ss.getSheetByName(def.sheet);
    let isNew = false;
    if (!sheet) {
      sheet = ss.insertSheet(def.sheet);
      isNew = true;
    }
    writeHeaders_(sheet, def.headers);
    formatHeader_(sheet, def.headers.length);
    formatDateColumns_(sheet, def);
    autoSizeColumns_(sheet, def.headers.length);
    setOrReplaceNamedRange_(ss, def.namedRange, sheet, def.headers.length);
    (isNew ? created : existed).push(def.sheet);
  });

  removeEmptyDefaultSheet1_(ss);

  SpreadsheetApp.getUi().alert(
    'AIC Setup complete\n\n' +
    'Created sheets: ' + (created.length ? created.join(', ') : '(none — all already existed)') + '\n\n' +
    'Refreshed (kept data): ' + (existed.length ? existed.join(', ') : '(none)') + '\n\n' +
    'Named ranges defined: ' + SHEET_DEFS.map(d => d.namedRange).join(', ')
  );
}

/** Destructive — wipes every AIC sheet and recreates them empty. */
function resetAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert(
    'Reset all AIC sheets',
    'This will DELETE every AIC sheet (Suppliers, Customers, ..., Dimensions) ' +
    'along with all data, then recreate them empty. Other sheets in this ' +
    'spreadsheet are not touched. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (r !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Ensure at least one non-AIC sheet exists during deletion.
  const tmpName = '__aic_reset_tmp__';
  let tmp = ss.getSheetByName(tmpName);
  if (!tmp) tmp = ss.insertSheet(tmpName);

  SHEET_DEFS.forEach(def => {
    const s = ss.getSheetByName(def.sheet);
    if (s) ss.deleteSheet(s);
  });

  // Also drop the named ranges so setupAllSheets can recreate them cleanly.
  ss.getNamedRanges().forEach(nr => {
    if (SHEET_DEFS.some(d => d.namedRange === nr.getName())) nr.remove();
  });

  setupAllSheets();

  const t = ss.getSheetByName(tmpName);
  if (t) ss.deleteSheet(t);
}

/* ===== helpers ===== */

function writeHeaders_(sheet, headers) {
  // Make sure the sheet has enough columns.
  const need = headers.length - sheet.getMaxColumns();
  if (need > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), need);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function formatHeader_(sheet, numCols) {
  const r = sheet.getRange(1, 1, 1, numCols);
  r.setFontWeight('bold')
    .setBackground(HEADER_BG)
    .setFontColor(HEADER_FG)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
}

function formatDateColumns_(sheet, def) {
  const cols = DATE_COLUMNS[def.sheet] || [];
  cols.forEach(name => {
    const idx = def.headers.indexOf(name);
    if (idx === -1) return;
    sheet.getRange(2, idx + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('MM/dd/yyyy');
  });
}

function autoSizeColumns_(sheet, numCols) {
  for (let c = 1; c <= numCols; c++) sheet.autoResizeColumn(c);
}

function setOrReplaceNamedRange_(ss, name, sheet, numCols) {
  // Drop any existing range with the same name (regardless of which sheet).
  ss.getNamedRanges().forEach(nr => { if (nr.getName() === name) nr.remove(); });
  const range = sheet.getRange(1, 1, sheet.getMaxRows(), numCols);
  ss.setNamedRange(name, range);
}

function removeEmptyDefaultSheet1_(ss) {
  if (SHEET_DEFS.some(d => d.sheet === 'Sheet1')) return; // we never use this name, but defensive
  const sh = ss.getSheetByName('Sheet1');
  if (!sh) return;
  const data = sh.getDataRange().getValues();
  const empty = data.length === 0 || (data.length === 1 && data[0].every(v => v === ''));
  // Only delete when truly empty so we never destroy user data.
  if (empty && ss.getSheets().length > 1) ss.deleteSheet(sh);
}
