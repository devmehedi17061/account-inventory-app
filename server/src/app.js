import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import dimensions from './routes/dimensions.js';
import suppliers from './routes/suppliers.js';
import customers from './routes/customers.js';
import inventory from './routes/inventory.js';
import purchases from './routes/purchases.js';
import sales from './routes/sales.js';
import receipts from './routes/receipts.js';
import payments from './routes/payments.js';
import dashboard from './routes/dashboard.js';
import reports from './routes/reports.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/dimensions', dimensions);
app.use('/api/suppliers', suppliers);
app.use('/api/customers', customers);
app.use('/api/inventory', inventory);
app.use('/api/purchases', purchases);
app.use('/api/sales', sales);
app.use('/api/receipts', receipts);
app.use('/api/payments', payments);
app.use('/api/dashboard', dashboard);
app.use('/api/reports', reports);

app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal error' });
});

export default app;
