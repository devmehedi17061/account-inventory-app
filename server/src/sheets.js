import { google } from 'googleapis';
import path from 'node:path';
import fs from 'node:fs';

const SHEET_ID = process.env.SHEET_ID;

if (!SHEET_ID) {
  console.warn('[sheets] SHEET_ID is not set. Configure server/.env before making requests.');
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let auth;
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!fs.existsSync(credPath)) {
    console.warn(`[sheets] Credentials file not found at ${credPath}. The server will start, but Sheets calls will fail until you fix this.`);
  }
  auth = new google.auth.GoogleAuth({ keyFile: credPath, scopes: SCOPES });
} else {
  console.warn('[sheets] No credentials configured. Set GOOGLE_CREDENTIALS_JSON (production) or GOOGLE_APPLICATION_CREDENTIALS (local).');
  auth = new google.auth.GoogleAuth({ scopes: SCOPES });
}

const sheets = google.sheets({ version: 'v4', auth });

const sheetMetaCache = { byTitle: null, fetchedAt: 0 };
const SHEET_META_TTL_MS = 60_000;

async function getSheetMeta() {
  const now = Date.now();
  if (sheetMetaCache.byTitle && now - sheetMetaCache.fetchedAt < SHEET_META_TTL_MS) {
    return sheetMetaCache.byTitle;
  }
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(sheetId,title))',
  });
  const byTitle = {};
  for (const s of res.data.sheets || []) {
    byTitle[s.properties.title] = s.properties.sheetId;
  }
  sheetMetaCache.byTitle = byTitle;
  sheetMetaCache.fetchedAt = now;
  return byTitle;
}

export async function getSheetIdByTitle(title) {
  const meta = await getSheetMeta();
  if (!(title in meta)) {
    throw new Error(`Sheet "${title}" not found in spreadsheet`);
  }
  return meta[title];
}

/**
 * Fetch values for a named range. Returns 2-D array (raw).
 */
export async function getNamedRangeValues(rangeName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeName,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

/**
 * Fetch raw values for a sheet (entire sheet). Useful when we need to know the
 * full row index of a record (named ranges may start mid-sheet).
 */
export async function getSheetValues(sheetTitle) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: sheetTitle,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

/**
 * Read a sheet and return rows as objects keyed by header (first row).
 * Filters out rows that are entirely blank.
 * Returns: { headers: string[], rows: Array<{__row: number, ...cols}> }
 * __row is the 1-based sheet row number (so header is __row=1, first data is __row=2).
 */
export async function getRowsAsObjects(sheetTitle) {
  const values = await getSheetValues(sheetTitle);
  if (values.length === 0) return { headers: [], rows: [] };
  const headers = values[0].map(h => String(h || '').trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const isBlank = !row || row.every(c => c === undefined || c === null || String(c).trim() === '');
    if (isBlank) continue;
    const obj = { __row: i + 1 };
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c] !== undefined ? row[c] : '';
    }
    rows.push(obj);
  }
  return { headers, rows };
}

/**
 * Append a row to a sheet, ordered by the sheet's existing header row.
 * - rowObj: { ColName: value, ... } (only keys that match a header are written)
 * Returns the 1-based row number where the data was written.
 */
export async function appendRow(sheetTitle, rowObj) {
  const { headers } = await getRowsAsObjects(sheetTitle);
  const ordered = headers.map(h => (rowObj[h] !== undefined ? rowObj[h] : ''));
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: sheetTitle,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [ordered] },
  });
  // updatedRange like "Suppliers!A42:J42"
  const m = res.data.updates?.updatedRange?.match(/!([A-Z]+)(\d+):/);
  return m ? Number(m[2]) : null;
}

/**
 * Update specific columns for a row identified by an ID.
 * patchObj: { ColName: newValue, ... }
 */
export async function updateRowById(sheetTitle, idColumn, idValue, patchObj) {
  const { headers, rows } = await getRowsAsObjects(sheetTitle);
  const target = rows.find(r => String(r[idColumn]) === String(idValue));
  if (!target) throw new Error(`${idColumn}=${idValue} not found in ${sheetTitle}`);

  const data = [];
  for (const [col, val] of Object.entries(patchObj)) {
    const colIdx = headers.indexOf(col);
    if (colIdx === -1) continue;
    const a1 = `${sheetTitle}!${columnLetter(colIdx)}${target.__row}`;
    data.push({ range: a1, values: [[val]] });
  }
  if (data.length === 0) return target.__row;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
  return target.__row;
}

/**
 * Update a single cell by row index (1-based) and column header name.
 */
export async function setCell(sheetTitle, rowNumber, columnName, value) {
  const { headers } = await getRowsAsObjects(sheetTitle);
  const colIdx = headers.indexOf(columnName);
  if (colIdx === -1) throw new Error(`Column "${columnName}" not found in ${sheetTitle}`);
  const a1 = `${sheetTitle}!${columnLetter(colIdx)}${rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: a1,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

/**
 * Bulk update many cells at once (faster than calling setCell repeatedly).
 * cellPatches: Array<{row: number, column: string, value: any}>
 */
export async function batchSetCells(sheetTitle, cellPatches) {
  if (cellPatches.length === 0) return;
  const { headers } = await getRowsAsObjects(sheetTitle);
  const data = cellPatches
    .map(p => {
      const colIdx = headers.indexOf(p.column);
      if (colIdx === -1) return null;
      return {
        range: `${sheetTitle}!${columnLetter(colIdx)}${p.row}`,
        values: [[p.value]],
      };
    })
    .filter(Boolean);
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

/**
 * Physically delete the row that has idColumn === idValue.
 */
export async function deleteRowById(sheetTitle, idColumn, idValue) {
  const { rows } = await getRowsAsObjects(sheetTitle);
  const target = rows.find(r => String(r[idColumn]) === String(idValue));
  if (!target) throw new Error(`${idColumn}=${idValue} not found in ${sheetTitle}`);
  const sheetId = await getSheetIdByTitle(sheetTitle);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: target.__row - 1,
              endIndex: target.__row,
            },
          },
        },
      ],
    },
  });
}

function columnLetter(i) {
  let s = '';
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
