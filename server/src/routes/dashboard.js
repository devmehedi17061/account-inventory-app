import { Router } from 'express';
import { getRowsAsObjects } from '../sheets.js';

const router = Router();

const num = v => {
  if (v === '' || v == null) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

const sum = (rows, col) => rows.reduce((a, r) => a + num(r[col]), 0);

function groupSum(rows, keyCol, sumCol) {
  const m = new Map();
  for (const r of rows) {
    const k = r[keyCol];
    if (k === undefined || k === null || String(k).trim() === '') continue;
    m.set(String(k), (m.get(String(k)) || 0) + num(r[sumCol]));
  }
  return m;
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/* SO Date format on the sheet is MM/DD/YYYY */
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const str = String(s);
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

const monthLabel = d => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
};

router.get('/', async (_req, res, next) => {
  try {
    const [sd, pd, customers, suppliers] = await Promise.all([
      getRowsAsObjects('SalesDetails'),
      getRowsAsObjects('PurchaseDetails'),
      getRowsAsObjects('Customers'),
      getRowsAsObjects('Suppliers'),
    ]);

    const totalSales = sum(sd.rows, 'Total Sales Price');
    const totalPurchases = sum(pd.rows, 'Total Purchase Price');
    const netProfit = totalSales - totalPurchases;
    const totalReceivable = sum(customers.rows, 'Balance Receivable');
    const totalPayable = sum(suppliers.rows, 'Balance Payable');

    // Top sales location: from Customers.City weighted by Total Sales
    const cityMap = groupSum(customers.rows, 'City', 'Total Sales');
    const topSalesLocation = topN(cityMap, 1)[0]?.[0] || '';

    // Top selling item: Item Type by Total Sales Price
    const itemTypeMap = groupSum(sd.rows, 'Item Type', 'Total Sales Price');
    const topSellingItem = topN(itemTypeMap, 1)[0]?.[0] || '';

    /* Sales Trend — group by Month/Year on SO Date */
    const trendMap = new Map();
    for (const r of sd.rows) {
      const d = parseDate(r['SO Date']);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const t = (trendMap.get(key) || 0) + num(r['Total Sales Price']);
      trendMap.set(key, t);
    }
    const trendKeys = [...trendMap.keys()].sort();
    const salesTrend = trendKeys.map(k => {
      const [y, m] = k.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return { x: monthLabel(d), y: trendMap.get(k) };
    });

    /* Sales By Location (state column chart) */
    const salesByLocation = [...groupSum(sd.rows, 'State', 'Total Sales Price').entries()]
      .map(([state, total]) => ({ x: state, y: total }))
      .sort((a, b) => b.y - a.y);

    /* Sales By Category (Item Type pie) */
    const salesByCategory = [...itemTypeMap.entries()].map(([label, value]) => ({ label, value }));

    /* Top 10 Customers (horizontal bar) */
    const top10Customers = topN(groupSum(sd.rows, 'Customer Name', 'Total Sales Price'), 10)
      .map(([name, total]) => ({ name, total }));

    /* Purchase By Location (donut) */
    const purchaseByLocation = [...groupSum(pd.rows, 'State', 'Total Purchase Price').entries()]
      .map(([label, value]) => ({ label, value }));

    /* Purchase By Category — stacked column grouped by Year × Item Type */
    const purchaseByCategoryYearItem = new Map(); // year -> { itemType -> value }
    const itemTypesInPurchases = new Set();
    for (const r of pd.rows) {
      const d = parseDate(r['Date']);
      if (!d) continue;
      const y = String(d.getFullYear());
      const it = r['Item Type'] || 'Unknown';
      itemTypesInPurchases.add(it);
      if (!purchaseByCategoryYearItem.has(y)) purchaseByCategoryYearItem.set(y, {});
      const obj = purchaseByCategoryYearItem.get(y);
      obj[it] = (obj[it] || 0) + num(r['Total Purchase Price']);
    }
    const years = [...purchaseByCategoryYearItem.keys()].sort();
    const itemTypes = [...itemTypesInPurchases];
    const purchaseByCategory = {
      categories: years,
      series: itemTypes.map(it => ({
        name: it,
        data: years.map(y => Math.round((purchaseByCategoryYearItem.get(y)[it] || 0) * 100) / 100),
      })),
    };

    /* Sales By City (treemap) */
    const salesByCity = [...groupSum(sd.rows, 'City', 'Total Sales Price').entries()]
      .map(([x, y]) => ({ x, y }))
      .sort((a, b) => b.y - a.y);

    res.json({
      kpis: {
        totalSales,
        totalPurchases,
        netProfit,
        totalReceivable,
        totalPayable,
        topSalesLocation,
        topSellingItem,
      },
      charts: {
        salesTrend,
        salesByLocation,
        salesByCategory,
        top10Customers,
        purchaseByLocation,
        purchaseByCategory,
        salesByCity,
      },
    });
  } catch (e) { next(e); }
});

export default router;
