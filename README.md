# AIC Inventory App — React + Google Sheets

Professional inventory management web app written in React (Vite + Tailwind) with a Node/Express backend that reads and writes the same `AIC Inventory App` Google Sheet your existing Apps Script app uses.

Modules: Dashboard, Inventory, Suppliers, Customers, Purchases, Sales, Receipts, Payments, Reports.

```
.
├── server/   Node + Express + googleapis
└── client/   Vite + React + Tailwind + ApexCharts
```

## One-time setup

You only do these steps once.

### 1. Google Cloud — service account

1. Go to <https://console.cloud.google.com/> and create a new project (e.g. `aic-inventory`).
2. Enable the **Google Sheets API** for the project (APIs & Services → Library).
3. Go to **APIs & Services → Credentials → Create Credentials → Service Account**. Give it a name; skip the optional steps.
4. Open the service account, **Keys → Add Key → JSON**. Save the downloaded file.
5. Move the JSON file to `server/credentials/sa.json` (create the `credentials/` folder if missing).
6. Open the service account details and copy its email (looks like `name@project.iam.gserviceaccount.com`).

### 2. Share your sheet with the service account

1. Open your `AIC Inventory App` Google Sheet in the browser.
2. Click **Share**, paste the service account email, give it **Editor** access, and confirm.
3. Copy the sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`.

### 3. Configure the server `.env`

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```
SHEET_ID=<paste sheet id from step 2>
GOOGLE_APPLICATION_CREDENTIALS=./credentials/sa.json
PORT=4000
```

### 4. Install and run

In two terminals:

```bash
# terminal 1 — backend
cd server
npm install
npm run dev      # http://localhost:4000

# terminal 2 — frontend
cd client
npm install
npm run dev      # http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the Express server, so no extra config is needed.

## How the data flows

- The React app never talks to Google directly — it calls `/api/*` on the Node server.
- The Node server uses the **service account** to read/write the same named ranges your Apps Script app uses (`Suppliers`, `Customers`, `InventoryItems`, `PurchaseOrders`, `PurchaseDetails`, `SalesOrders`, `SalesDetails`, `Receipts`, `Payments`, `Dimensions`).
- Every write that affects totals/balances/reorder runs the spec's calculation chain server-side before responding (e.g. saving a PO triggers `updateTotalPO → updatePOBalance → updateQtyPurchased → calcRemainingQty → calcReorderRequired → updateTotalPurchases → updateBalancePayable`).

## Module-by-module summary

| Page | Sheet(s) | Highlights |
|---|---|---|
| Dashboard | All | 7 KPI cards + 7 charts (spline, column, pie, horizontal bar, donut, stacked column, treemap) |
| Inventory | InventoryItems, Dimensions | Add Item / Type / Category / Subcategory; inline edit; delete blocked when stock > 0 |
| Suppliers | Suppliers, Dimensions | New Supplier / State / City; inline edit; delete blocked on outstanding balance |
| Customers | Customers, Dimensions | New Customer / State / City; inline edit; delete blocked on outstanding balance |
| Purchases | PurchaseOrders, PurchaseDetails | Multi-line PO with auto-calc (Cost Excl Tax → Total Tax → Cost Incl Tax → Shipping 1% → Total); View → edit/delete lines |
| Sales | SalesOrders, SalesDetails | Multi-line SO with auto-calc (Tax Rate without %); View → edit/delete lines |
| Receipts | Receipts | Customer → SO → SO Balance auto-fetch; Amount Received cannot exceed SO Balance |
| Payments | Payments | Supplier → PO → PO Balance auto-fetch; Amount Paid cannot exceed PO Balance |
| Reports | All | Snapshot counts; extend with custom report layouts as needed |

## Troubleshooting

- **403 on first request** — sheet was not shared with the service account email. Re-check step 2.
- **`Sheet "X" not found`** — your sheet doesn't have a tab with that exact title. Tab names must be: `Suppliers`, `Customers`, `InventoryItems`, `PurchaseOrders`, `PurchaseDetails`, `SalesOrders`, `SalesDetails`, `Receipts`, `Payments`, `Dimensions`.
- **`Column "X" not found`** — column headers in row 1 of the sheet must match the spec exactly (e.g. `Supplier ID`, `Total Purchase Price`). Check for stray spaces.
- **Charts empty** — totals haven't been computed yet. Save any record (or trigger a recalc by editing one) to run the calculation chain.

## Tech stack

- **Backend:** Node 18+, Express, googleapis (service account), CORS, dotenv.
- **Frontend:** Vite, React 18, React Router 6, Tailwind CSS, react-select, react-apexcharts, react-datepicker, react-hot-toast.
