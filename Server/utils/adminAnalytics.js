const DEFAULT_STOCK_QUANTITY = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PERIOD_PRESETS = {
  '7d': { key: '7d', amount: 7, unit: 'day' },
  '14d': { key: '14d', amount: 14, unit: 'day' },
  '30d': { key: '30d', amount: 30, unit: 'day' },
  '90d': { key: '90d', amount: 90, unit: 'day' },
};

const RANGE_UNITS = new Set(['day', 'week', 'month', 'year']);
const DEFAULT_ANALYTICS_RANGE = { amount: 30, unit: 'day' };

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const getProductKeys = (product) => {
  const keys = new Set();
  if (product?._id) keys.add(String(product._id));
  if (product?.id) keys.add(String(product.id));
  if (product?.name) keys.add(slugify(product.name));
  return [...keys];
};

const buildProductIndex = (products) => {
  const map = new Map();

  products.forEach((product) => {
    getProductKeys(product).forEach((key) => {
      map.set(key, product);
    });
  });

  return map;
};

const formatCurrency = (value) => Number(value || 0);
const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);

const getWeekStart = (date) => {
  const value = new Date(date);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  value.setUTCHours(0, 0, 0, 0);
  return value;
};

const getPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getRangeStartDate = (endDate, amount, unit) => {
  const startDate = new Date(endDate);
  startDate.setUTCHours(0, 0, 0, 0);

  if (unit === 'day') {
    startDate.setUTCDate(startDate.getUTCDate() - amount + 1);
    return startDate;
  }

  if (unit === 'week') {
    startDate.setUTCDate(startDate.getUTCDate() - amount * 7 + 1);
    return startDate;
  }

  if (unit === 'month') {
    startDate.setUTCMonth(startDate.getUTCMonth() - amount);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    return startDate;
  }

  startDate.setUTCFullYear(startDate.getUTCFullYear() - amount);
  startDate.setUTCDate(startDate.getUTCDate() + 1);
  return startDate;
};

const resolveAnalyticsRange = ({ periodKey, rangeAmount, rangeUnit }) => {
  const preset = PERIOD_PRESETS[periodKey];
  const unit = RANGE_UNITS.has(rangeUnit) ? rangeUnit : preset?.unit || DEFAULT_ANALYTICS_RANGE.unit;
  const amount = getPositiveInteger(rangeAmount, preset?.amount || DEFAULT_ANALYTICS_RANGE.amount);

  const endDate = new Date();
  endDate.setUTCHours(23, 59, 59, 999);

  const startDate = getRangeStartDate(endDate, amount, unit);
  const days = Math.max(Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1, 1);
  const label = `Last ${amount} ${unit}${amount === 1 ? '' : 's'}`;

  return {
    amount,
    unit,
    label,
    startDate,
    endDate,
    days,
  };
};

const createPeriodSeries = ({ type, count }) => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const series = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now);

    if (type === 'daily') {
      date.setUTCDate(date.getUTCDate() - index);
      series.push({
        key: toDateKey(date),
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        soldUnits: 0,
        returnedUnits: 0,
        revenue: 0,
        orderCount: 0,
        returnedOrderCount: 0,
      });
    } else {
      date.setUTCDate(date.getUTCDate() - index * 7);
      const weekStart = getWeekStart(date);
      series.push({
        key: toDateKey(weekStart),
        label: `Week of ${weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })}`,
        soldUnits: 0,
        returnedUnits: 0,
        revenue: 0,
        orderCount: 0,
        returnedOrderCount: 0,
      });
    }
  }

  return series;
};

const updateSeries = (series, date, type, metrics) => {
  const key = type === 'daily' ? toDateKey(date) : toDateKey(getWeekStart(date));
  const entry = series.find((item) => item.key === key);
  if (!entry) return;

  entry.soldUnits += metrics.soldUnits || 0;
  entry.returnedUnits += metrics.returnedUnits || 0;
  entry.revenue += metrics.revenue || 0;
  entry.orderCount += metrics.orderCount || 0;
  entry.returnedOrderCount += metrics.returnedOrderCount || 0;
};

export { DEFAULT_ANALYTICS_RANGE, PERIOD_PRESETS, resolveAnalyticsRange };

export const buildAdminAnalytics = ({
  products = [],
  orders = [],
  periodKey,
  rangeAmount,
  rangeUnit,
  filters = {},
} = {}) => {
  const productIndex = buildProductIndex(products);
  const range = resolveAnalyticsRange({ periodKey, rangeAmount, rangeUnit });
  const normalizedCategory = String(filters.category || 'all').trim().toLowerCase();
  const normalizedMaterial = String(filters.material || 'all').trim().toLowerCase();
  const filterOptions = {
    categories: [...new Set(products.map((product) => String(product.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    materials: [...new Set(products.map((product) => String(product.material || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  };
  const matchesFilters = (productLike) => {
    const productCategory = String(productLike?.category || '').trim().toLowerCase();
    const productMaterial = String(productLike?.material || '').trim().toLowerCase();
    const categoryMatch = normalizedCategory === 'all' || productCategory === normalizedCategory;
    const materialMatch = normalizedMaterial === 'all' || productMaterial === normalizedMaterial;
    return categoryMatch && materialMatch;
  };
  const dailySeries = createPeriodSeries({ type: 'daily', count: range.days });
  const weeklySeries = createPeriodSeries({ type: 'weekly', count: Math.max(Math.ceil(range.days / 7), 1) });

  const productMetrics = new Map();
  const categoryMetrics = new Map();
  const productTrendMap = new Map();

  let totalRevenue = 0;
  let totalSoldUnits = 0;
  let totalReturnedUnits = 0;
  let totalInventoryUnits = 0;
  let totalInventoryValue = 0;
  let orderCount = 0;

  const ensureProductMetric = (productLike, fallbackProductId) => {
    const resolvedProductId = String(productLike?._id || productLike?.id || fallbackProductId || slugify(productLike?.name || 'product'));
    if (!productMetrics.has(resolvedProductId)) {
      productMetrics.set(resolvedProductId, {
        productId: resolvedProductId,
        name: productLike?.name || 'Unknown product',
        category: productLike?.category || 'Uncategorized',
        material: productLike?.material || 'Unspecified',
        type: productLike?.type || 'product',
        price: Number(productLike?.price) || 0,
        stockQuantity: Number(productLike?.stockQuantity) || DEFAULT_STOCK_QUANTITY,
        soldUnits: 0,
        returnedUnits: 0,
        netSoldUnits: 0,
        allTimeNetSoldUnits: 0,
        revenue: 0,
        remainingUnits: Number(productLike?.stockQuantity) || DEFAULT_STOCK_QUANTITY,
        inventoryValue: 0,
        remainingValue: 0,
        returnRate: 0,
        sellThroughRate: 0,
      });
    }

    return productMetrics.get(resolvedProductId);
  };

  const ensureProductTrend = (productLike, fallbackProductId) => {
    const resolvedProductId = String(productLike?._id || productLike?.id || fallbackProductId || slugify(productLike?.name || 'product'));
    if (!productTrendMap.has(resolvedProductId)) {
      productTrendMap.set(resolvedProductId, {
        productId: resolvedProductId,
        name: productLike?.name || 'Unknown product',
        category: productLike?.category || 'Uncategorized',
        daily: createPeriodSeries({ type: 'daily', count: range.days }),
        weekly: createPeriodSeries({ type: 'weekly', count: Math.max(Math.ceil(range.days / 7), 1) }),
      });
    }

    return productTrendMap.get(resolvedProductId);
  };

  products.forEach((product) => {
    if (!matchesFilters(product)) {
      return;
    }
    const metric = ensureProductMetric(product, product._id);
    ensureProductTrend(product, product._id);
    totalInventoryUnits += metric.stockQuantity;
    totalInventoryValue += metric.stockQuantity * metric.price;
  });

  orders.forEach((order) => {
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const isCancelled = order.orderStatus === 'cancelled';
    const isReturned = order.orderStatus === 'returned';
    const isInSelectedRange = createdAt >= range.startDate && createdAt <= range.endDate;

    if (isInSelectedRange) {
      orderCount += 1;
      updateSeries(dailySeries, createdAt, 'daily', {
        orderCount: 1,
        returnedOrderCount: isReturned ? 1 : 0,
      });
      updateSeries(weeklySeries, createdAt, 'weekly', {
        orderCount: 1,
        returnedOrderCount: isReturned ? 1 : 0,
      });
    }

    (order.orderItems || []).forEach((item) => {
      const matchedProduct =
        productIndex.get(String(item.product)) ||
        productIndex.get(slugify(item.name)) || {
          _id: item.product,
          name: item.name,
          category: 'Uncategorized',
          material: 'Unspecified',
          type: 'product',
          price: Number(item.price) || 0,
          stockQuantity: DEFAULT_STOCK_QUANTITY,
        };

      if (!matchesFilters(matchedProduct)) {
        return;
      }

      const metric = ensureProductMetric(matchedProduct, item.product);
      const trend = ensureProductTrend(matchedProduct, item.product);
      const qty = Number(item.qty) || 0;
      const revenue = isCancelled || isReturned ? 0 : qty * Number(item.price || 0);
      const returnedUnits = isReturned ? qty : 0;
      const soldUnits = isCancelled ? 0 : qty;
      const netUnits = Math.max(soldUnits - returnedUnits, 0);

      metric.allTimeNetSoldUnits += netUnits;

      if (!isInSelectedRange) {
        return;
      }

      metric.soldUnits += soldUnits;
      metric.returnedUnits += returnedUnits;
      metric.revenue += revenue;

      totalSoldUnits += soldUnits;
      totalReturnedUnits += returnedUnits;
      totalRevenue += revenue;

      updateSeries(dailySeries, createdAt, 'daily', { soldUnits, returnedUnits, revenue });
      updateSeries(weeklySeries, createdAt, 'weekly', { soldUnits, returnedUnits, revenue });
      updateSeries(trend.daily, createdAt, 'daily', { soldUnits, returnedUnits, revenue });
      updateSeries(trend.weekly, createdAt, 'weekly', { soldUnits, returnedUnits, revenue });
    });
  });

  [...productMetrics.values()].forEach((metric) => {
    metric.netSoldUnits = Math.max(metric.soldUnits - metric.returnedUnits, 0);
    metric.remainingUnits = Math.max(metric.stockQuantity - metric.allTimeNetSoldUnits, 0);
    metric.inventoryValue = formatCurrency(metric.stockQuantity * metric.price);
    metric.remainingValue = formatCurrency(metric.remainingUnits * metric.price);
    metric.returnRate = metric.soldUnits ? metric.returnedUnits / metric.soldUnits : 0;
    metric.sellThroughRate = metric.stockQuantity ? metric.netSoldUnits / metric.stockQuantity : 0;

    const categoryKey = metric.category || 'Uncategorized';
    const currentCategory =
      categoryMetrics.get(categoryKey) || {
        name: categoryKey,
        stockQuantity: 0,
        soldUnits: 0,
        returnedUnits: 0,
        netSoldUnits: 0,
        remainingUnits: 0,
        revenue: 0,
        inventoryValue: 0,
        remainingValue: 0,
        returnRate: 0,
        sellThroughRate: 0,
      };

    currentCategory.stockQuantity += metric.stockQuantity;
    currentCategory.soldUnits += metric.soldUnits;
    currentCategory.returnedUnits += metric.returnedUnits;
    currentCategory.netSoldUnits += metric.netSoldUnits;
    currentCategory.remainingUnits += metric.remainingUnits;
    currentCategory.revenue += metric.revenue;
    currentCategory.inventoryValue += metric.inventoryValue;
    currentCategory.remainingValue += metric.remainingValue;
    categoryMetrics.set(categoryKey, currentCategory);
  });

  const categories = [...categoryMetrics.values()]
    .map((category) => ({
      ...category,
      returnRate: category.soldUnits ? category.returnedUnits / category.soldUnits : 0,
      sellThroughRate: category.stockQuantity ? category.netSoldUnits / category.stockQuantity : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const productsSummary = [...productMetrics.values()].sort((a, b) => b.revenue - a.revenue);
  const productTrends = [...productTrendMap.values()]
    .map((trend) => {
      const metric = productMetrics.get(trend.productId);
      return {
        ...trend,
        soldUnits: metric?.soldUnits || 0,
        revenue: metric?.revenue || 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const remainingInventoryUnits = productsSummary.reduce((sum, item) => sum + item.remainingUnits, 0);
  const remainingInventoryValue = productsSummary.reduce((sum, item) => sum + item.remainingValue, 0);

  return {
    period: {
      key: `${range.amount}-${range.unit}`,
      label: range.label,
      amount: range.amount,
      unit: range.unit,
      days: range.days,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
    },
    filters: {
      category: normalizedCategory === 'all' ? 'all' : filterOptions.categories.find((item) => item.toLowerCase() === normalizedCategory) || 'all',
      material: normalizedMaterial === 'all' ? 'all' : filterOptions.materials.find((item) => item.toLowerCase() === normalizedMaterial) || 'all',
      options: filterOptions,
    },
    overview: {
      revenue: formatCurrency(totalRevenue),
      soldUnits: totalSoldUnits,
      returnedUnits: totalReturnedUnits,
      returnRate: totalSoldUnits ? totalReturnedUnits / totalSoldUnits : 0,
      inventoryUnits: totalInventoryUnits,
      inventoryValue: formatCurrency(totalInventoryValue),
      remainingInventoryUnits,
      remainingInventoryValue: formatCurrency(remainingInventoryValue),
      sellThroughRate: totalInventoryUnits ? (totalSoldUnits - totalReturnedUnits) / totalInventoryUnits : 0,
      orderCount,
    },
    trends: {
      daily: dailySeries,
      weekly: weeklySeries,
    },
    categories,
    products: productsSummary,
    productTrends,
    lowStockProducts: productsSummary.filter((item) => item.remainingUnits <= 5).slice(0, 8),
  };
};
