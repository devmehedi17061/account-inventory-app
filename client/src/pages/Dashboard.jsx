import { useEffect, useState } from 'react';
import Chart from 'react-apexcharts';
import KpiCard from '../components/KpiCard.jsx';
import ProcessingOverlay from '../components/ProcessingOverlay.jsx';
import { api, notifyError } from '../api/client.js';

const PALETTE = ['#021640', '#0066CC', '#0099CC', '#4572C4', '#558ED5', '#1F4E79'];
const fmtUsd = v => {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};
const fmtThousands = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 1000)}K`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get('/dashboard')
      .then(d => { if (alive) setData(d); })
      .catch(notifyError)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <ProcessingOverlay active />;
  if (!data) return null;

  const k = data.kpis;
  const c = data.charts;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-heading font-semibold text-ink">Dashboard</h2>
        <p className="text-slate-500">Key trends and business insights</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard icon="fa-chart-line" title="Total Sales" value={fmtUsd(k.totalSales)} />
        <KpiCard icon="fa-cart-shopping" title="Total Purchases" value={fmtUsd(k.totalPurchases)} />
        <KpiCard icon="fa-dollar-sign" title="Net Profit" value={fmtUsd(k.netProfit)} />
        <KpiCard icon="fa-money-bill-trend-up" title="Total Receivable" value={fmtUsd(k.totalReceivable)} />
        <KpiCard icon="fa-credit-card" title="Total Payable" value={fmtUsd(k.totalPayable)} />
        <KpiCard icon="fa-location-dot" title="Top Sales Location" value={k.topSalesLocation || '—'} />
        <KpiCard icon="fa-trophy" title="Top Selling Item" value={k.topSellingItem || '—'} />
      </div>

      {/* Charts grid: 40/20/40 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Column 1 (40%) */}
        <div className="lg:col-span-4 space-y-4">
          <ChartCard title="Sales Trend">
            <Chart
              type="area" height={300}
              options={{
                chart: { toolbar: { show: false } },
                colors: ['#021640'],
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'solid', opacity: 0.2 },
                markers: { size: 2, colors: ['#021640'] },
                xaxis: { categories: c.salesTrend.map(p => p.x), labels: { rotate: -45, style: { fontSize: '10px' } } },
                yaxis: { labels: { formatter: v => fmtThousands(v) } },
                dataLabels: { enabled: false },
                grid: { borderColor: '#eef2f7' },
              }}
              series={[{ name: 'Sales', data: c.salesTrend.map(p => p.y) }]}
            />
          </ChartCard>
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title="Sales By Location">
              <Chart
                type="bar" height={300}
                options={{
                  chart: { toolbar: { show: false } },
                  colors: PALETTE,
                  plotOptions: { bar: { distributed: true, borderRadius: 4 } },
                  legend: { show: false },
                  xaxis: { categories: c.salesByLocation.map(p => p.x), labels: { rotate: -45, style: { fontSize: '10px' } } },
                  yaxis: { labels: { formatter: v => fmtThousands(v) } },
                  dataLabels: { enabled: false },
                }}
                series={[{ name: 'Sales', data: c.salesByLocation.map(p => p.y) }]}
              />
            </ChartCard>
            <ChartCard title="Sales By Category">
              <Chart
                type="pie" height={300}
                options={{
                  colors: PALETTE,
                  labels: c.salesByCategory.map(p => p.label),
                  legend: { position: 'bottom', fontSize: '11px' },
                  dataLabels: { style: { fontSize: '11px' } },
                }}
                series={c.salesByCategory.map(p => Number(p.value) || 0)}
              />
            </ChartCard>
          </div>
        </div>

        {/* Column 2 (20%) */}
        <div className="lg:col-span-2">
          <ChartCard title="Top 10 Customers" minH={620}>
            <Chart
              type="bar" height={600}
              options={{
                chart: { toolbar: { show: false } },
                colors: ['#0099CC'],
                plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
                xaxis: { labels: { formatter: v => fmtThousands(v), style: { fontSize: '10px' } } },
                yaxis: { labels: { style: { fontSize: '10px' } } },
                dataLabels: { enabled: true, formatter: v => fmtThousands(v), style: { fontSize: '10px' } },
              }}
              series={[{ name: 'Sales', data: c.top10Customers.map(p => ({ x: p.name, y: p.total })) }]}
            />
          </ChartCard>
        </div>

        {/* Column 3 (40%) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ChartCard title="Purchase By Location">
              <Chart
                type="donut" height={300}
                options={{
                  colors: PALETTE,
                  labels: c.purchaseByLocation.map(p => p.label),
                  legend: { position: 'bottom', fontSize: '11px' },
                  dataLabels: { formatter: val => `${Math.round(val * 10) / 10}%` },
                }}
                series={c.purchaseByLocation.map(p => Number(p.value) || 0)}
              />
            </ChartCard>
            <ChartCard title="Purchase By Category">
              <Chart
                type="bar" height={300}
                options={{
                  chart: { stacked: true, toolbar: { show: false } },
                  colors: PALETTE,
                  plotOptions: { bar: { borderRadius: 4 } },
                  xaxis: { categories: c.purchaseByCategory.categories },
                  yaxis: { labels: { formatter: v => fmtThousands(v) } },
                  legend: { position: 'bottom', fontSize: '10px' },
                  dataLabels: { enabled: false },
                }}
                series={c.purchaseByCategory.series}
              />
            </ChartCard>
          </div>
          <ChartCard title="Sales By City">
            <Chart
              type="treemap" height={300}
              options={{
                chart: { toolbar: { show: false } },
                colors: PALETTE,
                legend: { show: false },
                plotOptions: { treemap: { distributed: true, enableShades: false } },
              }}
              series={[{ data: c.salesByCity.map(p => ({ x: p.x, y: p.y })) }]}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, minH }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4" style={minH ? { minHeight: minH } : undefined}>
      <h4 className="font-heading font-semibold text-ink mb-2 text-sm">{title}</h4>
      {children}
    </div>
  );
}
