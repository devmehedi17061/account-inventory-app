import { getRowsAsObjects } from './sheets.js';

function fiveRandomDigits() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

/**
 * Generate a unique ID with given prefix that does not already exist in
 * sheetTitle's idColumn. Tries up to 10 times then throws.
 */
export async function generateUniqueId(sheetTitle, idColumn, prefix) {
  const { rows } = await getRowsAsObjects(sheetTitle);
  const existing = new Set(rows.map(r => String(r[idColumn])));
  for (let i = 0; i < 20; i++) {
    const candidate = `${prefix}${fiveRandomDigits()}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique ID with prefix ${prefix}`);
}

/**
 * Like generateUniqueId, but checks across multiple (sheet, column) pairs.
 * Useful for Detail IDs that should be unique across the whole DB.
 */
export async function generateUniqueIdAcross(prefix, lookups /* [{sheet, col}, ...] */) {
  const used = new Set();
  for (const { sheet, col } of lookups) {
    const { rows } = await getRowsAsObjects(sheet);
    for (const r of rows) used.add(String(r[col]));
  }
  for (let i = 0; i < 20; i++) {
    const candidate = `${prefix}${fiveRandomDigits()}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique ID with prefix ${prefix}`);
}
