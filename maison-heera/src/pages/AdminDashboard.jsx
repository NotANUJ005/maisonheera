import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Boxes, ChartColumnBig, IndianRupee, PackageCheck, RotateCcw, Truck, Undo2, CircleCheckBig, Ban } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { buildAdminAnalytics, DEFAULT_ANALYTICS_RANGE, resolveAnalyticsRange } from '../utils/adminAnalytics';
import {
  cancelAdminShipment,
  createAdminReturnShipment,
  getAllLocalOrders,
  getLocalCatalog,
  jsonRequest,
  loadAdminShipmentOrders,
  markAdminShipmentDelivered,
  refreshAdminShipment,
  resolveMediaUrl,
  saveLocalProduct,
  shouldUseLocalFallback,
  CATALOG_UPDATED_EVENT,
} from '../utils/api';

const formatCurrency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const formatPercent = (value) => `${((Number(value) || 0) * 100).toFixed(1)}%`;
const CHART_COLORS = ['#d4af37', '#eeb288', '#8a7d72', '#b3b0a9', '#4a4441', '#2c2a29', '#a29285', '#6b5e54'];
const RANGE_UNIT_OPTIONS = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
];

const createRangeSelection = (amount, unit) => ({ amount: String(amount), unit });

const DEFAULT_WIDGET_RANGES = {
  overview: createRangeSelection(1, 'month'),
  sellingRate: createRangeSelection(10, 'day'),
  revenue: createRangeSelection(10, 'week'),
  orders: createRangeSelection(10, 'day'),
  category: createRangeSelection(1, 'month'),
};
const ANALYTICS_WIDGET_KEYS = ['overview', 'sellingRate', 'revenue', 'orders', 'category'];

const normalizeRangeSelection = (selection) => ({
  amount: Math.max(Number.parseInt(selection?.amount, 10) || DEFAULT_ANALYTICS_RANGE.amount, 1),
  unit: RANGE_UNIT_OPTIONS.some((option) => option.value === selection?.unit) ? selection.unit : DEFAULT_ANALYTICS_RANGE.unit,
});

const buildRangeKey = (selection) => {
  const normalized = normalizeRangeSelection(selection);
  return `${normalized.amount}-${normalized.unit}`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

const getAnalyticsPeriodLabel = (analytics) => analytics?.period?.label || 'selected period';
const DEFAULT_FILTERS = { category: 'all', material: 'all' };
const DEFAULT_WIDGET_FILTERS = {
  overview: { ...DEFAULT_FILTERS },
  sellingRate: { ...DEFAULT_FILTERS },
  revenue: { ...DEFAULT_FILTERS },
  orders: { ...DEFAULT_FILTERS },
  category: { ...DEFAULT_FILTERS },
};

const isAnalyticsPayloadCompatible = (analytics, selection) => {
  if (!analytics?.period || !analytics?.trends) {
    return false;
  }

  const normalized = normalizeRangeSelection(selection);
  const expected = resolveAnalyticsRange({ rangeAmount: normalized.amount, rangeUnit: normalized.unit });
  const expectedWeeklyPoints = Math.max(Math.ceil(expected.days / 7), 1);

  return (
    Number(analytics.period.amount) === normalized.amount &&
    analytics.period.unit === normalized.unit &&
    Array.isArray(analytics.trends.daily) &&
    Array.isArray(analytics.trends.weekly) &&
    analytics.trends.daily.length === expected.days &&
    analytics.trends.weekly.length === expectedWeeklyPoints
  );
};

const buildAnalyticsRequestKey = (selection, filters) => {
  const normalized = normalizeRangeSelection(selection);
  const category = String(filters?.category || 'all').trim().toLowerCase();
  const material = String(filters?.material || 'all').trim().toLowerCase();
  return `${normalized.amount}-${normalized.unit}::${category}::${material}`;
};

const AdminMenuButton = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition-colors ${
      active
        ? 'border-stone-900 bg-stone-900 text-white'
        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
    }`}
  >
    <span className="block text-[10px] uppercase tracking-[0.25em] opacity-70">Workspace</span>
    <span className="mt-2 block text-base font-medium">{label}</span>
  </button>
);

const MetricCard = ({ icon: Icon, label, value, meta }) => (
  <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">{label}</p>
        <p className="mt-4 text-3xl font-serif text-stone-900">{value}</p>
        {meta && <p className="mt-3 text-sm text-stone-500">{meta}</p>}
      </div>
      <div className="rounded-full bg-stone-100 p-3 text-stone-900">
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const RangeSelector = ({ selection, onChange }) => (
  <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2">
    <input
      type="number"
      min="1"
      value={selection.amount}
      onChange={(event) => onChange('amount', event.target.value)}
      className="w-16 bg-transparent text-center text-sm font-medium text-stone-900 focus:outline-none"
      aria-label="Range amount"
    />
    <select
      value={selection.unit}
      onChange={(event) => onChange('unit', event.target.value)}
      className="bg-transparent text-sm uppercase tracking-[0.16em] text-stone-600 focus:outline-none"
      aria-label="Range unit"
    >
      {RANGE_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const CompactSelect = ({ value, onChange, options, ariaLabel, className = '' }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    aria-label={ariaLabel}
    className={`rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 focus:outline-none ${className}`}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const resolveTrendBucketKey = (selection) => (normalizeRangeSelection(selection).unit === 'day' ? 'daily' : 'weekly');

const buildPieSegments = (rows, valueKey) => {
  const normalizedRows = rows.filter((row) => Number(row?.[valueKey]) > 0);
  const total = normalizedRows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);

  if (!total) {
    return [];
  }

  return normalizedRows.map((row, index) => ({
    ...row,
    color: CHART_COLORS[index % CHART_COLORS.length],
    value: Number(row[valueKey] || 0),
    percentage: Number(row[valueKey] || 0) / total,
  }));
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (centerX, centerY, radius, startAngle, endAngle) => {
  // SVG arcs collapse if start and end are identical; fallback to 359.99 for full circles
  let adjustedEndAngle = endAngle;
  if (endAngle - startAngle >= 360) {
    adjustedEndAngle = startAngle + 359.999;
  }
  const start = polarToCartesian(centerX, centerY, radius, adjustedEndAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = adjustedEndAngle - startAngle <= 180 ? 0 : 1;

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
};

const LineChart = ({ title, series, valueKey, valueLabel, stroke = '#1c1917', actions }) => {
  if (!series.length) {
    return (
      <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-serif text-stone-900">{title}</h3>
          {actions}
        </div>
        <p className="mt-4 text-sm text-stone-500">No chart data is available yet.</p>
      </div>
    );
  }

  const chartWidth = 680;
  const chartHeight = 260;
  const paddingX = 36;
  const paddingY = 26;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;
  const maxValue = Math.max(...series.map((item) => Number(item[valueKey]) || 0), 1);

  const points = series.map((item, index) => {
    const value = Number(item[valueKey]) || 0;
    const x = series.length === 1 ? chartWidth / 2 : paddingX + (index / (series.length - 1)) * usableWidth;
    const y = chartHeight - paddingY - (value / maxValue) * usableHeight;
    return { x, y, label: item.label, value };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;
  const footerPoints = points.filter((_, index) => {
    if (points.length <= 8) {
      return true;
    }

    const step = Math.ceil(points.length / 8);
    return index === 0 || index === points.length - 1 || index % step === 0;
  });

  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-serif text-stone-900">{title}</h3>
          <p className="mt-1 text-sm text-stone-500">{valueLabel}</p>
        </div>
        {actions}
      </div>

      <div className="mt-8">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-64 w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = chartHeight - paddingY - usableHeight * step;
            return (
              <line
                key={step}
                x1={paddingX}
                y1={y}
                x2={chartWidth - paddingX}
                y2={y}
                stroke="#e7e5e4"
                strokeDasharray="4 6"
              />
            );
          })}
          <path d={areaPath} fill={stroke} fillOpacity="0.08" />
          <path d={linePath} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={`${point.label}-${point.value}`}>
              <circle cx={point.x} cy={point.y} r="5" fill={stroke} />
              <circle cx={point.x} cy={point.y} r="11" fill={stroke} fillOpacity="0.12" />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-stone-500 md:grid-cols-4 xl:grid-cols-8">
        {footerPoints.map((point) => (
          <div key={`label-${point.label}`} className="rounded-2xl bg-stone-50 px-3 py-3">
            <p className="uppercase tracking-[0.18em] text-stone-400">{point.label}</p>
            <p className="mt-2 font-semibold text-stone-900">{point.value.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ComparisonLineChart = ({ title, series, lines, valueLabel, actions }) => {
  if (!series.length || !lines.length) {
    return (
      <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-serif text-stone-900">{title}</h3>
          {actions}
        </div>
        <p className="mt-4 text-sm text-stone-500">No comparison chart data is available yet.</p>
      </div>
    );
  }

  const chartWidth = 680;
  const chartHeight = 260;
  const paddingX = 36;
  const paddingY = 26;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;
  const maxValue = Math.max(
    ...series.flatMap((item) => lines.map((line) => Number(item[line.key]) || 0)),
    1,
  );

  const footerPoints = series.filter((_, index) => {
    if (series.length <= 6) {
      return true;
    }

    const step = Math.ceil(series.length / 6);
    return index === 0 || index === series.length - 1 || index % step === 0;
  });

  const lineSeries = lines.map((line) => {
    const points = series.map((item, index) => {
      const value = Number(item[line.key]) || 0;
      const x = series.length === 1 ? chartWidth / 2 : paddingX + (index / (series.length - 1)) * usableWidth;
      const y = chartHeight - paddingY - (value / maxValue) * usableHeight;
      return { x, y, label: item.label, value };
    });

    return {
      ...line,
      points,
      path: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
    };
  });

  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-serif text-stone-900">{title}</h3>
          <p className="mt-1 text-sm text-stone-500">{valueLabel}</p>
        </div>
        {actions}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {lineSeries.map((line) => (
          <div key={line.key} className="inline-flex items-center gap-2 rounded-full bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: line.stroke }} />
            <span className="uppercase tracking-[0.16em]">{line.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-64 w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const y = chartHeight - paddingY - usableHeight * step;
            return (
              <line
                key={step}
                x1={paddingX}
                y1={y}
                x2={chartWidth - paddingX}
                y2={y}
                stroke="#e7e5e4"
                strokeDasharray="4 6"
              />
            );
          })}
          {lineSeries.map((line) => (
            <g key={line.key}>
              <path d={line.path} fill="none" stroke={line.stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {line.points.map((point) => (
                <g key={`${line.key}-${point.label}-${point.value}`}>
                  <circle cx={point.x} cy={point.y} r="4.5" fill={line.stroke} />
                  <circle cx={point.x} cy={point.y} r="10" fill={line.stroke} fillOpacity="0.12" />
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-stone-500 md:grid-cols-3 xl:grid-cols-6">
        {footerPoints.map((point) => (
          <div key={`comparison-${point.label}`} className="rounded-2xl bg-stone-50 px-3 py-3">
            <p className="uppercase tracking-[0.18em] text-stone-400">{point.label}</p>
            {lineSeries.map((line) => (
              <p key={`${point.label}-${line.key}`} className="mt-2 font-semibold text-stone-900">
                {line.label}: {(Number(point[line.key]) || 0).toLocaleString('en-IN')}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const PieChart = ({ title, rows, valueKey, valueFormatter, subtitle, totalLabel, actions }) => {
  const segments = buildPieSegments(rows, valueKey);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const center = 110;
  const radius = 78;
  const strokeWidth = 28;
  const arcSegments = segments.reduce((accumulator, segment) => {
    const startAngle = accumulator.length ? accumulator[accumulator.length - 1].endAngle : 0;
    const endAngle = startAngle + segment.percentage * 360;

    accumulator.push({
      ...segment,
      startAngle,
      endAngle,
    });

    return accumulator;
  }, []);

  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-serif text-stone-900">{title}</h3>
          <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
        </div>
        {actions}
      </div>

      {segments.length ? (
        <div className="mt-8 grid gap-8 xl:grid-cols-[240px_1fr] xl:items-center">
          <div className="mx-auto">
            <svg viewBox="0 0 220 220" className="h-56 w-56">
              <circle cx={center} cy={center} r={radius} fill="none" stroke="#f5f5f4" strokeWidth={strokeWidth} />
              {arcSegments.map((segment) => {
                const isFull = segment.percentage >= 0.999;
                const gap = isFull ? 0 : 2;
                let drawEndAngle = segment.endAngle - gap;
                
                // Ensure tiny slivers still visibly draw at least a minimal arc
                if (drawEndAngle <= segment.startAngle && segment.percentage > 0) {
                  drawEndAngle = segment.startAngle + 0.1;
                }

                return (
                  <path
                    key={`${segment.name}-${segment.startAngle}`}
                    d={describeArc(center, center, radius, segment.startAngle, drawEndAngle)}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="butt"
                    className="transition-all duration-500 hover:opacity-80"
                  />
                );
              })}
              <circle cx={center} cy={center} r="46" fill="white" />
              <text x={center} y={center - 4} textAnchor="middle" className="fill-stone-900 text-[11px] uppercase tracking-[0.25em]">
                {totalLabel}
              </text>
              <text x={center} y={center + 24} textAnchor="middle" className="fill-stone-900 text-lg font-semibold">
                {valueFormatter(total)}
              </text>
            </svg>
          </div>

          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.name} className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-stone-50 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <div>
                    <p className="font-medium text-stone-900">{segment.name}</p>
                    {segment.category && segment.category !== segment.name && (
                      <p className="mt-1 text-xs text-stone-400">{segment.category}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-stone-900">{valueFormatter(segment.value)}</p>
                  <p className="mt-1 text-xs text-stone-500">{formatPercent(segment.percentage)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone-500">No pie chart data is available yet.</p>
      )}
    </div>
  );
};

const SummaryTable = ({ title, rows, emptyCopy, actions }) => (
  <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <h3 className="text-xl font-serif text-stone-900">{title}</h3>
      {actions}
    </div>
    {rows.length ? (
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-100 text-[10px] uppercase tracking-[0.25em] text-stone-400">
            <tr>
              <th className="pb-3 pr-4 font-medium">Name</th>
              <th className="pb-3 pr-4 font-medium">Revenue</th>
              <th className="pb-3 pr-4 font-medium">Sold</th>
              <th className="pb-3 pr-4 font-medium">Remaining</th>
              <th className="pb-3 pr-4 font-medium">Return Rate</th>
              <th className="pb-3 font-medium">Sell-through</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId || row.name} className="border-b border-stone-100 last:border-b-0">
                <td className="py-4 pr-4">
                  <div className="font-medium text-stone-900">{row.name}</div>
                  {row.category && <div className="mt-1 text-xs text-stone-400">{row.category}</div>}
                </td>
                <td className="py-4 pr-4 text-stone-700">{formatCurrency(row.revenue)}</td>
                <td className="py-4 pr-4 text-stone-700">{Number(row.netSoldUnits ?? row.soldUnits ?? 0).toLocaleString('en-IN')}</td>
                <td className="py-4 pr-4 text-stone-700">{Number(row.remainingUnits ?? 0).toLocaleString('en-IN')}</td>
                <td className="py-4 pr-4 text-stone-700">{formatPercent(row.returnRate)}</td>
                <td className="py-4 text-stone-700">{formatPercent(row.sellThroughRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="mt-6 text-sm text-stone-500">{emptyCopy}</p>
    )}
  </div>
);

const DataTable = ({ title, subtitle, columns, rows, emptyCopy, actions }) => (
  <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h3 className="text-xl font-serif text-stone-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {rows.length ? (
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-100 text-[10px] uppercase tracking-[0.25em] text-stone-400">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="pb-3 pr-4 font-medium last:pr-0">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id || row.key || row.name || rowIndex} className="border-b border-stone-100 last:border-b-0">
                {columns.map((column) => (
                  <td key={column.key} className="py-4 pr-4 text-stone-700 last:pr-0">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="mt-6 text-sm text-stone-500">{emptyCopy}</p>
    )}
  </div>
);

const AnalyticsPlaceholder = ({ loadingCopy }) => (
  <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
    <div className="flex items-center gap-3">
      <ChartColumnBig size={18} className="text-stone-900" />
      <p className="text-stone-500">{loadingCopy}</p>
    </div>
  </div>
);

const ProductComparisonChart = ({ title, rows, valueKey, valueFormatter, subtitle, actions }) => {
  const normalizedRows = rows.filter((row) => Number(row?.[valueKey]) > 0);
  const maxValue = Math.max(...normalizedRows.map((row) => Number(row[valueKey]) || 0), 1);

  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-serif text-stone-900">{title}</h3>
          <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
        </div>
        {actions}
      </div>

      {normalizedRows.length ? (
        <div className="mt-8 space-y-4">
          {normalizedRows.map((row, index) => (
            <div key={row.productId || row.name} className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_120px] md:items-center">
              <div>
                <p className="font-medium text-stone-900">{row.name}</p>
                {row.category && <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">{row.category}</p>}
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max((Number(row[valueKey]) / maxValue) * 100, 4)}%`,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
              </div>
              <div className="text-right text-sm font-semibold text-stone-900">{valueFormatter(row[valueKey])}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone-500">No product comparison data is available for the current filters.</p>
      )}
    </div>
  );
};

export const AdminDashboard = ({ setCurrentView, userInfo }) => {
  const allowLocalProductFallback =
    import.meta.env.DEV ||
    String(import.meta.env.VITE_ENABLE_LOCAL_FALLBACK ?? '').toLowerCase() === 'true';
  const [view, setView] = useState('analytics');
  const [analyticsView, setAnalyticsView] = useState('line');
  const [widgetFilters, setWidgetFilters] = useState(DEFAULT_WIDGET_FILTERS);
  const [selectedSellingRateProductId, setSelectedSellingRateProductId] = useState('all');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRanges, setLoadingRanges] = useState({});
  const [analyticsCache, setAnalyticsCache] = useState({});
  const [rangeSelections, setRangeSelections] = useState(DEFAULT_WIDGET_RANGES);
  const [shipmentOrders, setShipmentOrders] = useState([]);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentActionKey, setShipmentActionKey] = useState('');
  const [lastCreatedProduct, setLastCreatedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    material: '',
    description: '',
    image: '',
    stockQuantity: '25',
    type: 'product',
    featured: false,
  });
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageInputKey, setImageInputKey] = useState(0);

  useEffect(() => {
    if (!selectedImageFile) {
      setImagePreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedImageFile);
    setImagePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImageFile]);

  const analyticsRequests = useMemo(() => {
    const seen = new Set();
    return ANALYTICS_WIDGET_KEYS.map((widgetKey) => ({
      widgetKey,
      selection: rangeSelections[widgetKey],
      filters: widgetFilters[widgetKey] || DEFAULT_FILTERS,
    })).filter(({ selection, filters }) => {
      const key = buildAnalyticsRequestKey(selection, filters);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [rangeSelections, widgetFilters]);

  const filterOptions = useMemo(() => {
    const analyticsEntries = Object.values(analyticsCache);
    const source = analyticsEntries.find((entry) => entry?.filters?.options) || null;

    return {
      categories: source?.filters?.options?.categories || [],
      materials: source?.filters?.options?.materials || [],
    };
  }, [analyticsCache]);

  const updateRangeSelection = (widgetKey, field, value) => {
    setRangeSelections((prev) => ({
      ...prev,
      [widgetKey]: {
        ...prev[widgetKey],
        [field]: value,
      },
    }));
  };

  const updateWidgetFilter = (widgetKey, field, value) => {
    setWidgetFilters((prev) => ({
      ...prev,
      [widgetKey]: {
        ...(prev[widgetKey] || DEFAULT_FILTERS),
        [field]: value,
      },
    }));
  };

  const loadAnalyticsForSelection = async (selection, filters, forceRefresh = false) => {
    const normalized = normalizeRangeSelection(selection);
    const normalizedFilters = filters || DEFAULT_FILTERS;
    const key = buildAnalyticsRequestKey(normalized, normalizedFilters);

    if (!forceRefresh && analyticsCache[key]) {
      return analyticsCache[key];
    }

    setLoadingRanges((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await jsonRequest(
        `/api/orders/admin/analytics?rangeAmount=${encodeURIComponent(normalized.amount)}&rangeUnit=${encodeURIComponent(normalized.unit)}&category=${encodeURIComponent(normalizedFilters.category)}&material=${encodeURIComponent(normalizedFilters.material)}`,
      );

      if (!response.ok) {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Could not load analytics');
        }

        throw new Error('Temporary server issue');
      }

      if (!isAnalyticsPayloadCompatible(response.data, normalized)) {
        throw new Error('Analytics response did not match the selected range');
      }

      setAnalyticsCache((prev) => ({ ...prev, [key]: response.data }));
      return response.data;
    } catch {
      const fallbackData = buildAdminAnalytics({
        products: getLocalCatalog(),
        orders: getAllLocalOrders(),
        rangeAmount: normalized.amount,
        rangeUnit: normalized.unit,
        filters: normalizedFilters,
      });
      setAnalyticsCache((prev) => ({ ...prev, [key]: fallbackData }));
      return fallbackData;
    } finally {
      setLoadingRanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  useEffect(() => {
    analyticsRequests.forEach(({ selection, filters }) => {
      const key = buildAnalyticsRequestKey(selection, filters);
      if (!analyticsCache[key]) {
        loadAnalyticsForSelection(selection, filters);
      }
    });
  }, [analyticsRequests, analyticsCache]);

  const refreshVisibleAnalytics = async () => {
    await Promise.all(analyticsRequests.map(({ selection, filters }) => loadAnalyticsForSelection(selection, filters, true)));
  };

  const getFiltersForWidget = (widgetKey) => widgetFilters[widgetKey] || DEFAULT_FILTERS;
  const getAnalyticsForWidget = (widgetKey) =>
    analyticsCache[buildAnalyticsRequestKey(rangeSelections[widgetKey], getFiltersForWidget(widgetKey))] || null;
  const isWidgetLoading = (widgetKey) =>
    Boolean(loadingRanges[buildAnalyticsRequestKey(rangeSelections[widgetKey], getFiltersForWidget(widgetKey))]);

  const overviewAnalytics = getAnalyticsForWidget('overview');
  const sellingRateAnalytics = getAnalyticsForWidget('sellingRate');
  const revenueAnalytics = getAnalyticsForWidget('revenue');
  const ordersAnalytics = getAnalyticsForWidget('orders');
  const categoryAnalytics = getAnalyticsForWidget('category');

  const sellingRateProductOptions = useMemo(() => {
    const rows = (sellingRateAnalytics?.productTrends || [])
      .filter((row) => Number(row?.soldUnits) > 0 || Number(row?.revenue) > 0)
      .map((row) => ({
        value: row.productId,
        label: row.name,
      }));

    return [{ value: 'all', label: 'All Items' }, ...rows];
  }, [sellingRateAnalytics]);

  useEffect(() => {
    if (!sellingRateProductOptions.some((option) => option.value === selectedSellingRateProductId)) {
      setSelectedSellingRateProductId('all');
    }
  }, [selectedSellingRateProductId, sellingRateProductOptions]);

  const sellingRateBucketKey = resolveTrendBucketKey(rangeSelections.sellingRate);
  const revenueBucketKey = resolveTrendBucketKey(rangeSelections.revenue);
  const ordersBucketKey = resolveTrendBucketKey(rangeSelections.orders);

  const selectedSellingRateProduct =
    selectedSellingRateProductId === 'all'
      ? null
      : sellingRateAnalytics?.productTrends?.find((trend) => trend.productId === selectedSellingRateProductId) || null;

  const sellingRateSeries = selectedSellingRateProduct
    ? selectedSellingRateProduct[sellingRateBucketKey] || []
    : sellingRateAnalytics?.trends?.[sellingRateBucketKey] || [];
  const revenueSeries = revenueAnalytics?.trends?.[revenueBucketKey] || [];
  const ordersSeries = ordersAnalytics?.trends?.[ordersBucketKey] || [];

  const sellingRatePieRows = sellingRateSeries
    .filter((entry) => Number(entry?.soldUnits) > 0)
    .map((entry) => ({ name: entry.label, soldUnits: Number(entry.soldUnits || 0) }));
  const revenuePieRows = revenueSeries
    .filter((entry) => Number(entry?.revenue) > 0)
    .map((entry) => ({ name: entry.label, revenue: Number(entry.revenue || 0) }));
  const ordersPieRows = ordersAnalytics
    ? [
        {
          name: 'Orders Placed',
          count: ordersSeries.reduce((sum, entry) => sum + Number(entry.orderCount || 0), 0),
        },
        {
          name: 'Orders Returned',
          count: ordersSeries.reduce((sum, entry) => sum + Number(entry.returnedOrderCount || 0), 0),
        },
      ].filter((entry) => entry.count > 0)
    : [];
  const categoryPieRows = (categoryAnalytics?.categories || [])
    .slice(0, 8)
    .filter((entry) => Number(entry?.revenue) > 0);

  const sellingRateTableRows = sellingRateSeries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    soldUnits: Number(entry.soldUnits || 0),
    returnedUnits: Number(entry.returnedUnits || 0),
    revenue: Number(entry.revenue || 0),
  }));
  const revenueTableRows = revenueSeries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    revenue: Number(entry.revenue || 0),
    soldUnits: Number(entry.soldUnits || 0),
    orderCount: Number(entry.orderCount || 0),
  }));
  const ordersTableRows = ordersSeries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    orderCount: Number(entry.orderCount || 0),
    returnedOrderCount: Number(entry.returnedOrderCount || 0),
    returnRate: Number(entry.orderCount || 0) ? Number(entry.returnedOrderCount || 0) / Number(entry.orderCount || 0) : 0,
  }));

  const shipmentOverview = useMemo(() => ({
    active: shipmentOrders.filter((order) => !['delivered', 'shipment-cancelled', 'returned'].includes(String(order.orderStatus || '').toLowerCase())).length,
    delivered: shipmentOrders.filter((order) => String(order.orderStatus || '').toLowerCase() === 'delivered').length,
    returns: shipmentOrders.reduce(
      (count, order) =>
        count +
        (order.orderItems || []).filter((item) => ['requested', 'pickup-scheduled', 'returned'].includes(String(item.returnStatus || '').toLowerCase())).length,
      0,
    ),
    cod: shipmentOrders.filter((order) => String(order.paymentMethod || '').toLowerCase() === 'cod').length,
  }), [shipmentOrders]);

  const syncShipmentOrder = (updatedOrder) => {
    if (!updatedOrder?._id) {
      return;
    }

    setShipmentOrders((prev) => {
      const hasOrder = prev.some((order) => order._id === updatedOrder._id);
      const next = hasOrder
        ? prev.map((order) => (order._id === updatedOrder._id ? updatedOrder : order))
        : [updatedOrder, ...prev];

      return next.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    });
  };

  const loadShipmentOrders = async () => {
    if (!userInfo) {
      return;
    }

    setShipmentLoading(true);

    try {
      const orders = await loadAdminShipmentOrders(userInfo);
      setShipmentOrders(orders);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'Could not load shipment management data.',
      });
    } finally {
      setShipmentLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'shipments') {
      loadShipmentOrders();
    }
  }, [view, userInfo?._id, userInfo?.token]);

  const runShipmentAction = async ({ key, successMessage, action }) => {
    setShipmentActionKey(key);
    setStatusMessage({ type: '', text: '' });

    try {
      const updatedOrder = await action();
      syncShipmentOrder(updatedOrder);
      setStatusMessage({
        type: 'success',
        text: successMessage,
      });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'Shipment action failed.',
      });
    } finally {
      setShipmentActionKey('');
    }
  };

  const renderWidgetFilterControls = (widgetKey) => (
    <>
      <CompactSelect
        value={getFiltersForWidget(widgetKey).category}
        onChange={(value) => updateWidgetFilter(widgetKey, 'category', value)}
        ariaLabel={`Filter ${widgetKey} by category`}
        options={[
          { value: 'all', label: 'All Categories' },
          ...filterOptions.categories.map((category) => ({ value: category, label: category })),
        ]}
      />
      <CompactSelect
        value={getFiltersForWidget(widgetKey).material}
        onChange={(value) => updateWidgetFilter(widgetKey, 'material', value)}
        ariaLabel={`Filter ${widgetKey} by material`}
        options={[
          { value: 'all', label: 'All Materials' },
          ...filterOptions.materials.map((material) => ({ value: material, label: material })),
        ]}
      />
    </>
  );

  const renderWidgetActions = (widgetKey, extraControls = null) => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <RangeSelector
        selection={rangeSelections[widgetKey]}
        onChange={(field, value) => updateRangeSelection(widgetKey, field, value)}
      />
      {renderWidgetFilterControls(widgetKey)}
      {extraControls}
    </div>
  );

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSelectedImageFile(nextFile);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category: '',
      material: '',
      description: '',
      image: '',
      stockQuantity: '25',
      type: 'product',
      featured: false,
    });
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setImageInputKey((prev) => prev + 1);
  };

  const handleSingleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setStatusMessage({ type: '', text: '' });

    if (!selectedImageFile && !String(formData.image || '').trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Upload a product image from your device, or provide an image URL if you need a fallback.',
      });
      setIsLoading(false);
      return;
    }

    const payload = {
      ...formData,
      price: Number(formData.price),
      stockQuantity: Number(formData.stockQuantity),
    };

    try {
      const requestBody = selectedImageFile
        ? (() => {
            const multipartPayload = new FormData();
            Object.entries(payload).forEach(([key, value]) => {
              multipartPayload.append(key, String(value ?? ''));
            });
            multipartPayload.append('imageFile', selectedImageFile);
            return multipartPayload;
          })()
        : JSON.stringify(payload);

      const response = await jsonRequest('/api/products', {
        method: 'POST',
        body: requestBody,
      });

      if (!response.ok) {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Failed to create product');
        }

        throw new Error(response.data?.message || 'Temporary server issue');
      }

      setStatusMessage({
        type: 'success',
        text: response.data?.image
          ? `${payload.type === 'prestige' ? 'Prestige item' : 'Product'} created successfully. The image has been stored on the server at ${response.data.image}. It should now appear in ${payload.type === 'prestige' ? 'The Prestige Archives' : 'The Archive'} after the catalog refresh.`
          : `${payload.type === 'prestige' ? 'Prestige item' : 'Product'} created successfully. It should now appear in ${payload.type === 'prestige' ? 'The Prestige Archives' : 'The Archive'}.`,
      });
      setLastCreatedProduct({
        name: response.data?.name || payload.name,
        type: response.data?.type || payload.type,
        image: response.data?.image || payload.image,
        imageUrl: resolveMediaUrl(response.data?.image || payload.image),
        isLocalOnly: false,
      });
      window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
      resetForm();
      refreshVisibleAnalytics();
    } catch (error) {
      if (allowLocalProductFallback) {
        const localPayload = {
          ...payload,
          image: selectedImageFile ? await readFileAsDataUrl(selectedImageFile) : payload.image,
        };

        saveLocalProduct(localPayload);
        setStatusMessage({
          type: 'success',
          text: `The backend request failed, so this ${payload.type === 'prestige' ? 'prestige item' : 'product'} was saved only in local demo mode. It will appear on this browser, but it was not published to the live database.`,
        });
        setLastCreatedProduct({
          name: localPayload.name,
          type: localPayload.type,
          image: localPayload.image,
          imageUrl: localPayload.image,
          isLocalOnly: true,
        });
        resetForm();
        refreshVisibleAnalytics();
      } else {
        setStatusMessage({
          type: 'error',
          text: error.message || 'The product upload did not reach the live backend, so nothing was published.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto">
      <div className="flex flex-col gap-6 border-b border-stone-200 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif text-stone-900">Admin Dashboard</h1>
          <p className="mt-4 max-w-3xl text-stone-500">
            Monitor revenue, sell-through, inventory remaining, return behavior, and product performance.
            Each chart and table can now run on its own time window.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button variant={view === 'analytics' ? 'primary' : 'secondary'} onClick={() => setView('analytics')}>
            Analytics
          </Button>
          <Button variant={view === 'shipments' ? 'primary' : 'secondary'} onClick={() => setView('shipments')}>
            Shipments
          </Button>
          <Button variant={view === 'single' ? 'primary' : 'secondary'} onClick={() => setView('single')}>
            Add Product
          </Button>
          <Button variant="secondary" onClick={() => setCurrentView('home')}>
            Back Home
          </Button>
        </div>
      </div>

      {statusMessage.text && (
        <div
          className={`mt-8 p-4 text-sm ${
            statusMessage.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {view === 'single' && lastCreatedProduct && (
        <div className="mt-6 rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Last Uploaded Item</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[9rem_minmax(0,1fr)]">
            <div className="aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-white">
              {lastCreatedProduct.imageUrl ? (
                <img
                  src={lastCreatedProduct.imageUrl}
                  alt={lastCreatedProduct.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-stone-400">
                  No image preview available
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-serif text-stone-900">{lastCreatedProduct.name}</h3>
              <p className="mt-2 text-sm text-stone-600">
                Section: {lastCreatedProduct.type === 'prestige' ? 'The Prestige Archives' : 'The Archive'}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Storage: {lastCreatedProduct.isLocalOnly ? 'This browser only' : 'Live backend upload'}
              </p>
              <p className="mt-4 break-all text-sm text-stone-500">
                Image path: {lastCreatedProduct.image || 'Not available'}
              </p>
              {lastCreatedProduct.imageUrl && (
                <a
                  href={lastCreatedProduct.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border border-stone-900 px-5 py-2 text-sm uppercase tracking-[0.22em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                >
                  Open Uploaded Image
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'analytics' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-serif text-stone-900">Sales Intelligence</h2>
              <p className="mt-2 text-sm text-stone-500">
                Each mode now shows the same four insights: item selling rate, total revenue, orders placed vs returned, and category performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={analyticsView === 'line' ? 'primary' : 'secondary'}
                onClick={() => setAnalyticsView('line')}
              >
                Line Charts
              </Button>
              <Button
                variant={analyticsView === 'pie' ? 'primary' : 'secondary'}
                onClick={() => setAnalyticsView('pie')}
              >
                Pie Charts
              </Button>
              <Button
                variant={analyticsView === 'tables' ? 'primary' : 'secondary'}
                onClick={() => setAnalyticsView('tables')}
              >
                Tables
              </Button>
              <Button variant="secondary" onClick={refreshVisibleAnalytics} disabled={Object.keys(loadingRanges).length > 0}>
                {Object.keys(loadingRanges).length > 0 ? 'Refreshing...' : 'Refresh Analytics'}
              </Button>
            </div>
          </div>

          {overviewAnalytics ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={IndianRupee}
                label="Revenue"
                value={formatCurrency(overviewAnalytics.overview.revenue)}
                meta={`${overviewAnalytics.overview.orderCount} orders in ${getAnalyticsPeriodLabel(overviewAnalytics)}`}
              />
              <MetricCard
                icon={PackageCheck}
                label="Units Sold"
                value={overviewAnalytics.overview.soldUnits.toLocaleString('en-IN')}
                meta={`Sell-through ${formatPercent(overviewAnalytics.overview.sellThroughRate)} in ${getAnalyticsPeriodLabel(overviewAnalytics)}`}
              />
              <MetricCard
                icon={RotateCcw}
                label="Return Rate"
                value={formatPercent(overviewAnalytics.overview.returnRate)}
                meta={`${overviewAnalytics.overview.returnedUnits.toLocaleString('en-IN')} returned units in ${getAnalyticsPeriodLabel(overviewAnalytics)}`}
              />
              <MetricCard
                icon={Boxes}
                label="Remaining Stock"
                value={overviewAnalytics.overview.remainingInventoryUnits.toLocaleString('en-IN')}
                meta={`${formatCurrency(overviewAnalytics.overview.remainingInventoryValue)} current inventory`}
              />
            </div>
          ) : (
            <AnalyticsPlaceholder loadingCopy={isWidgetLoading('overview') ? 'Loading overview analytics...' : 'No overview analytics available yet.'} />
          )}
          
          {analyticsView === 'line' && (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                {sellingRateAnalytics ? (
                  <LineChart
                    title="Items Unit Selling Rate"
                    series={sellingRateSeries}
                    valueKey="soldUnits"
                    valueLabel={`Units sold across ${getAnalyticsPeriodLabel(sellingRateAnalytics).toLowerCase()}${selectedSellingRateProduct ? ` for ${selectedSellingRateProduct.name}` : ''}`}
                    stroke="#1c1917"
                    actions={renderWidgetActions(
                      'sellingRate',
                      <CompactSelect
                        value={selectedSellingRateProductId}
                        onChange={setSelectedSellingRateProductId}
                        options={sellingRateProductOptions}
                        ariaLabel="Choose item for selling rate"
                      />,
                    )}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('sellingRate') ? 'Loading item selling rate chart...' : 'No item selling rate chart data is available yet.'} />
                )}

                {revenueAnalytics ? (
                  <LineChart
                    title="Total Revenue"
                    series={revenueSeries}
                    valueKey="revenue"
                    valueLabel={`Revenue across ${getAnalyticsPeriodLabel(revenueAnalytics).toLowerCase()}`}
                    stroke="#15803d"
                    actions={renderWidgetActions('revenue')}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('revenue') ? 'Loading total revenue chart...' : 'No total revenue chart data is available yet.'} />
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                {ordersAnalytics ? (
                  <ComparisonLineChart
                    title="Orders Placed vs Orders Returned"
                    series={ordersSeries}
                    lines={[
                      { key: 'orderCount', label: 'Placed', stroke: '#1c1917' },
                      { key: 'returnedOrderCount', label: 'Returned', stroke: '#b45309' },
                    ]}
                    valueLabel={`Order movement across ${getAnalyticsPeriodLabel(ordersAnalytics).toLowerCase()}`}
                    actions={renderWidgetActions('orders')}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('orders') ? 'Loading order comparison chart...' : 'No order comparison chart data is available yet.'} />
                )}

                {categoryAnalytics ? (
                  <ProductComparisonChart
                    title="Category Performance Snapshot"
                    rows={categoryAnalytics.categories.slice(0, 8)}
                    valueKey="revenue"
                    valueFormatter={formatCurrency}
                    subtitle={`Category revenue across ${getAnalyticsPeriodLabel(categoryAnalytics).toLowerCase()}`}
                    actions={renderWidgetActions('category')}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('category') ? 'Loading category performance snapshot...' : 'No category performance data is available yet.'} />
                )}
              </div>
            </>
          )}

          {analyticsView === 'pie' && (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                {sellingRateAnalytics ? (
                  <PieChart
                    title="Items Unit Selling Rate"
                    rows={sellingRatePieRows}
                    valueKey="soldUnits"
                    valueFormatter={(value) => `${Number(value || 0).toLocaleString('en-IN')} units`}
                    subtitle={`Unit mix across ${getAnalyticsPeriodLabel(sellingRateAnalytics).toLowerCase()}${selectedSellingRateProduct ? ` for ${selectedSellingRateProduct.name}` : ''}`}
                    totalLabel="Units"
                    actions={renderWidgetActions(
                      'sellingRate',
                      <CompactSelect
                        value={selectedSellingRateProductId}
                        onChange={setSelectedSellingRateProductId}
                        options={sellingRateProductOptions}
                        ariaLabel="Choose item for unit selling pie chart"
                      />,
                    )}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('sellingRate') ? 'Loading item selling rate split...' : 'No item selling rate split is available yet.'} />
                )}

                {revenueAnalytics ? (
                  <PieChart
                    title="Total Revenue"
                    rows={revenuePieRows}
                    valueKey="revenue"
                    valueFormatter={formatCurrency}
                    subtitle={`Revenue distribution across ${getAnalyticsPeriodLabel(revenueAnalytics).toLowerCase()}`}
                    totalLabel="Revenue"
                    actions={renderWidgetActions('revenue')}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('revenue') ? 'Loading total revenue split...' : 'No total revenue split is available yet.'} />
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                {ordersAnalytics ? (
                  <PieChart
                    title="Orders Placed vs Orders Returned"
                    rows={ordersPieRows}
                    valueKey="count"
                    valueFormatter={(value) => `${Number(value || 0).toLocaleString('en-IN')} orders`}
                    subtitle={`Order outcome split across ${getAnalyticsPeriodLabel(ordersAnalytics).toLowerCase()}`}
                    totalLabel="Orders"
                    actions={renderWidgetActions('orders')}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('orders') ? 'Loading orders split...' : 'No orders split is available yet.'} />
                )}

                {categoryAnalytics ? (
                  <PieChart
                    title="Category Performance Snapshot"
                    rows={categoryPieRows}
                    valueKey="revenue"
                    valueFormatter={formatCurrency}
                    subtitle={`Category revenue share across ${getAnalyticsPeriodLabel(categoryAnalytics).toLowerCase()}`}
                    totalLabel="Revenue"
                    actions={renderWidgetActions('category')}
                  />
                ) : (
                  <AnalyticsPlaceholder loadingCopy={isWidgetLoading('category') ? 'Loading category performance split...' : 'No category performance split is available yet.'} />
                )}
              </div>
            </>
          )}

          {analyticsView === 'tables' && (
            <>
              {sellingRateAnalytics ? (
                <DataTable
                  title="Items Unit Selling Rate"
                  subtitle={`Units sold across ${getAnalyticsPeriodLabel(sellingRateAnalytics).toLowerCase()}${selectedSellingRateProduct ? ` for ${selectedSellingRateProduct.name}` : ''}`}
                  rows={sellingRateTableRows}
                  emptyCopy="No item selling rate data is available yet."
                  actions={renderWidgetActions(
                    'sellingRate',
                    <CompactSelect
                      value={selectedSellingRateProductId}
                      onChange={setSelectedSellingRateProductId}
                      options={sellingRateProductOptions}
                      ariaLabel="Choose item for selling rate table"
                    />,
                  )}
                  columns={[
                    { key: 'label', label: 'Period' },
                    { key: 'soldUnits', label: 'Units Sold', render: (row) => row.soldUnits.toLocaleString('en-IN') },
                    { key: 'returnedUnits', label: 'Returned Units', render: (row) => row.returnedUnits.toLocaleString('en-IN') },
                    { key: 'revenue', label: 'Revenue', render: (row) => formatCurrency(row.revenue) },
                  ]}
                />
              ) : (
                <AnalyticsPlaceholder loadingCopy={isWidgetLoading('sellingRate') ? 'Loading item selling rate table...' : 'No item selling rate table is available yet.'} />
              )}

              {revenueAnalytics ? (
                <DataTable
                  title="Total Revenue"
                  subtitle={`Revenue across ${getAnalyticsPeriodLabel(revenueAnalytics).toLowerCase()}`}
                  rows={revenueTableRows}
                  emptyCopy="No revenue table data is available yet."
                  actions={renderWidgetActions('revenue')}
                  columns={[
                    { key: 'label', label: 'Period' },
                    { key: 'revenue', label: 'Revenue', render: (row) => formatCurrency(row.revenue) },
                    { key: 'soldUnits', label: 'Units Sold', render: (row) => row.soldUnits.toLocaleString('en-IN') },
                    { key: 'orderCount', label: 'Orders', render: (row) => row.orderCount.toLocaleString('en-IN') },
                  ]}
                />
              ) : (
                <AnalyticsPlaceholder loadingCopy={isWidgetLoading('revenue') ? 'Loading revenue table...' : 'No revenue table data is available yet.'} />
              )}

              {ordersAnalytics ? (
                <DataTable
                  title="Orders Placed vs Orders Returned"
                  subtitle={`Order flow across ${getAnalyticsPeriodLabel(ordersAnalytics).toLowerCase()}`}
                  rows={ordersTableRows}
                  emptyCopy="No order comparison data is available yet."
                  actions={renderWidgetActions('orders')}
                  columns={[
                    { key: 'label', label: 'Period' },
                    { key: 'orderCount', label: 'Placed', render: (row) => row.orderCount.toLocaleString('en-IN') },
                    { key: 'returnedOrderCount', label: 'Returned', render: (row) => row.returnedOrderCount.toLocaleString('en-IN') },
                    { key: 'returnRate', label: 'Return Rate', render: (row) => formatPercent(row.returnRate) },
                  ]}
                />
              ) : (
                <AnalyticsPlaceholder loadingCopy={isWidgetLoading('orders') ? 'Loading orders table...' : 'No orders table data is available yet.'} />
              )}

              {categoryAnalytics ? (
                <SummaryTable
                  title="Category Performance Snapshot"
                  rows={categoryAnalytics.categories.slice(0, 12)}
                  emptyCopy="No category performance data is available yet."
                  actions={renderWidgetActions('category')}
                />
              ) : (
                <AnalyticsPlaceholder loadingCopy={isWidgetLoading('category') ? 'Loading category performance table...' : 'No category performance table is available yet.'} />
              )}
            </>
          )}
        </motion.div>
      )}

      {view === 'shipments' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-serif text-stone-900">Shipment Management</h2>
              <p className="mt-2 text-sm text-stone-500">
                Refresh carrier tracking, cancel shipments before pickup, manually confirm delivery, and create reverse shipments for approved returns.
              </p>
            </div>
            <Button variant="secondary" onClick={loadShipmentOrders} disabled={shipmentLoading}>
              {shipmentLoading ? 'Refreshing...' : 'Refresh Orders'}
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Truck} label="Active Shipments" value={shipmentOverview.active.toLocaleString('en-IN')} meta="Orders still moving through dispatch or transit" />
            <MetricCard icon={CircleCheckBig} label="Delivered Orders" value={shipmentOverview.delivered.toLocaleString('en-IN')} meta="Orders already marked as delivered" />
            <MetricCard icon={Undo2} label="Return Requests" value={shipmentOverview.returns.toLocaleString('en-IN')} meta="Items waiting on reverse logistics or return receipt" />
            <MetricCard icon={IndianRupee} label="COD Orders" value={shipmentOverview.cod.toLocaleString('en-IN')} meta="Orders booked for cash-on-delivery handling" />
          </div>

          {shipmentOrders.length ? (
            <div className="space-y-6">
              {shipmentOrders.map((order) => (
                <div key={order._id} className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-stone-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Order</p>
                      <h3 className="mt-2 text-xl font-serif text-stone-900">{order._id}</h3>
                      <p className="mt-2 text-sm text-stone-500">
                        {order.shippingAddress?.fullName} · {order.shippingAddress?.city}, {order.shippingAddress?.state}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        Placed {new Date(order.createdAt).toLocaleString()} · {String(order.paymentMethod || 'prepaid').toUpperCase()}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm text-stone-600">
                      <div className="rounded-full bg-stone-100 px-4 py-2">
                        Shipment: {order.shipment?.currentStatus || 'Not booked yet'}
                      </div>
                      {order.shipment?.awbCode && (
                        <div className="rounded-full bg-stone-100 px-4 py-2">AWB: {order.shipment.awbCode}</div>
                      )}
                      {order.shipment?.courierName && (
                        <div className="rounded-full bg-stone-100 px-4 py-2">{order.shipment.courierName}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      className="px-5 py-2"
                      disabled={shipmentActionKey === `refresh-${order._id}`}
                      onClick={() =>
                        runShipmentAction({
                          key: `refresh-${order._id}`,
                          successMessage: `Tracking refreshed for order ${order._id}.`,
                          action: () => refreshAdminShipment({ user: userInfo, orderId: order._id }),
                        })
                      }
                    >
                      {shipmentActionKey === `refresh-${order._id}` ? 'Refreshing...' : 'Refresh Tracking'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-5 py-2"
                      disabled={
                        shipmentActionKey === `cancel-${order._id}` ||
                        !order.shipment?.awbCode ||
                        ['delivered', 'shipment-cancelled'].includes(String(order.orderStatus || '').toLowerCase())
                      }
                      onClick={() =>
                        runShipmentAction({
                          key: `cancel-${order._id}`,
                          successMessage: `Shipment cancelled for order ${order._id}.`,
                          action: () => cancelAdminShipment({ user: userInfo, orderId: order._id }),
                        })
                      }
                    >
                      {shipmentActionKey === `cancel-${order._id}` ? 'Cancelling...' : 'Cancel Shipment'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-5 py-2"
                      disabled={
                        shipmentActionKey === `deliver-${order._id}` ||
                        String(order.orderStatus || '').toLowerCase() === 'delivered'
                      }
                      onClick={() =>
                        runShipmentAction({
                          key: `deliver-${order._id}`,
                          successMessage: `Order ${order._id} marked as delivered.`,
                          action: () => markAdminShipmentDelivered({ user: userInfo, orderId: order._id }),
                        })
                      }
                    >
                      {shipmentActionKey === `deliver-${order._id}` ? 'Saving...' : 'Mark Delivered'}
                    </Button>
                  </div>

                  {order.shipment?.error && (
                    <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {order.shipment.error}
                    </div>
                  )}

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-stone-100 bg-stone-50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Shipment timeline</p>
                      <div className="mt-4 space-y-3">
                        {(order.shipment?.trackingEvents || []).slice(0, 4).map((event, index) => (
                          <div key={`${order._id}-event-${index}`} className="rounded-2xl bg-white px-4 py-3">
                            <p className="text-sm font-medium text-stone-900">{event.statusLabel || event.status}</p>
                            {event.activity && <p className="mt-1 text-sm text-stone-500">{event.activity}</p>}
                            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-400">
                              {event.date ? new Date(event.date).toLocaleString() : 'Pending'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-stone-100 bg-stone-50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Return logistics</p>
                      <div className="mt-4 space-y-3">
                        {(order.orderItems || []).map((item) => {
                          const itemActionKey = `return-${order._id}-${item._id}`;
                          const canCreateReturnShipment =
                            ['requested', 'pickup-scheduled'].includes(String(item.returnStatus || '').toLowerCase()) &&
                            !item.returnShipment?.shipmentId;

                          return (
                            <div key={`${order._id}-${item._id}`} className="rounded-2xl bg-white px-4 py-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="font-medium text-stone-900">{item.name}</p>
                                  <p className="mt-1 text-sm text-stone-500">
                                    Return status: {String(item.returnStatus || 'none').replace(/-/g, ' ')}
                                  </p>
                                  {item.returnReason && <p className="mt-1 text-sm text-stone-500">Reason: {item.returnReason}</p>}
                                  {item.returnShipment?.awbCode && (
                                    <p className="mt-1 text-sm text-stone-500">
                                      Reverse AWB: {item.returnShipment.awbCode} · {item.returnShipment.courierName || 'Courier assigned'}
                                    </p>
                                  )}
                                  {item.returnShipment?.error && (
                                    <p className="mt-1 text-sm text-amber-700">{item.returnShipment.error}</p>
                                  )}
                                </div>

                                <Button
                                  variant="secondary"
                                  className="px-5 py-2"
                                  disabled={!canCreateReturnShipment || shipmentActionKey === itemActionKey}
                                  onClick={() =>
                                    runShipmentAction({
                                      key: itemActionKey,
                                      successMessage: `Return shipment created for ${item.name}.`,
                                      action: () => createAdminReturnShipment({ user: userInfo, orderId: order._id, itemId: item._id }),
                                    })
                                  }
                                >
                                  {shipmentActionKey === itemActionKey ? 'Creating...' : item.returnShipment?.shipmentId ? 'Return Shipment Created' : 'Create Return Shipment'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-stone-200 bg-white px-8 py-16 text-center text-sm text-stone-500 shadow-sm">
              {shipmentLoading ? 'Loading shipment workspace...' : 'No shipment orders are available yet.'}
            </div>
          )}
        </motion.div>
      )}

      {view === 'single' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-10 bg-white p-8 shadow-sm border border-stone-100">
          <h2 className="text-2xl font-serif mb-8 text-stone-900">Add New Product</h2>
          <p className="mb-8 max-w-2xl text-sm text-stone-500">
            Upload a product image directly from the admin device. The backend will save the file under
            the server uploads folder, store the local media path in MongoDB, and use that same image in the storefront.
          </p>
          <form onSubmit={handleSingleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { label: 'Product Name', name: 'name', type: 'text', wide: true },
              { label: 'Price (INR)', name: 'price', type: 'number', step: '0.01' },
              { label: 'Stock Quantity', name: 'stockQuantity', type: 'number', step: '1' },
              { label: 'Category', name: 'category', type: 'text' },
              { label: 'Material', name: 'material', type: 'text', wide: true },
            ].map((field) => (
              <div key={field.name} className={`relative ${field.wide ? 'md:col-span-2' : ''}`}>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleInputChange}
                  required
                  placeholder=" "
                  step={field.step}
                  className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none text-stone-900"
                />
                <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                  {field.label}
                </label>
              </div>
            ))}

            <div className="md:col-span-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">Product Image</p>
                <p className="mt-3 text-sm text-stone-500">
                  Choose an image from this device. The uploaded file will be used in the product card and product page.
                </p>
                <label
                  htmlFor="product-image-upload"
                  className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-full border border-stone-900 px-6 py-3 text-sm uppercase tracking-[0.24em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                >
                  {selectedImageFile ? 'Change Image' : 'Upload From Device'}
                </label>
                <input
                  key={imageInputKey}
                  id="product-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <p className="mt-4 text-sm text-stone-600">
                  {selectedImageFile ? selectedImageFile.name : 'No image selected yet.'}
                </p>
                {selectedImageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImageFile(null);
                      setImageInputKey((prev) => prev + 1);
                    }}
                    className="mt-3 text-xs uppercase tracking-[0.22em] text-stone-500 transition-colors hover:text-stone-900"
                  >
                    Remove Selected Image
                  </button>
                )}
                <div className="relative mt-6">
                  <input
                    type="text"
                    name="image"
                    value={formData.image}
                    onChange={handleInputChange}
                    placeholder=" "
                    className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none text-stone-900"
                  />
                  <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                    Optional Image URL Fallback
                  </label>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">Preview</p>
                <div className="mt-4 aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-stone-100">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Selected product preview" className="h-full w-full object-cover" />
                  ) : formData.image ? (
                    <img src={formData.image} alt="Image URL preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-400">
                      Product image preview will appear here.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="relative md:col-span-2">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                placeholder=" "
                rows="3"
                className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none text-stone-900 resize-none"
              />
              <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                Description
              </label>
            </div>

            <div className="flex flex-col gap-4 text-stone-900">
              <label className="text-sm uppercase tracking-widest text-stone-500">Product Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'product', label: 'Standard Product', copy: 'Appears in The Archive' },
                  { value: 'prestige', label: 'Prestige Item', copy: 'Appears in The Prestige Archives' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: option.value }))}
                    className={`rounded-[1.25rem] border px-4 py-4 text-left transition-colors ${
                      formData.type === option.value
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.18em] opacity-75">{option.copy}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 text-stone-900 h-full mt-4">
              <input
                type="checkbox"
                name="featured"
                id="featured"
                checked={formData.featured}
                onChange={handleInputChange}
                className="w-4 h-4 accent-stone-900"
              />
              <label htmlFor="featured" className="text-sm uppercase tracking-widest cursor-pointer select-none">
                Feature on Home Page
              </label>
            </div>

            <div className="md:col-span-2 mt-4">
              <Button type="submit" className="w-full md:w-auto px-12" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Product'}
              </Button>
            </div>
          </form>
        </motion.div>
      )}

    </div>
  );
};
