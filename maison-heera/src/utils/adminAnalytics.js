const DEFAULT_STOCK_QUANTITY = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PERIOD_PRESETS = {
  '7d': { key: '7d', amount: 7, unit: 'day' },
  '14d': { key: '14d', amount: 14, unit: 'day' },
  '30d': { key: '30d', amount: 30, unit: 'day' },
  '90d': { key: '90d', amount: 90, unit: 'day' },
};

const RANGE_UNITS = new Set(['day', 'week', 'month', 'year']);
export const DEFAULT_ANALYTICS_RANGE = { amount: 30, unit: 'day' };

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

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

export const resolveAnalyticsRange = ({ periodKey, rangeAmount, rangeUnit } = {}) => {
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

const createPeriodSeries = (type, count) => {
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

const updateSeries = (series, type, date, values) => {
  const key = type === 'daily' ? toDateKey(date) : toDateKey(getWeekStart(date));
  const entry = series.find((item) => item.key === key);
  if (!entry) return;
  entry.soldUnits += values.soldUnits || 0;
  entry.returnedUnits += values.returnedUnits || 0;
  entry.revenue += values.revenue || 0;
  entry.orderCount += values.orderCount || 0;
  entry.returnedOrderCount += values.returnedOrderCount || 0;
};

export const buildAdminAnalytics = ({ products = [], orders = [], periodKey, rangeAmount, rangeUnit, filters = {} } = {}) => {
  const range = resolveAnalyticsRange({ periodKey, rangeAmount, rangeUnit });
  const productMap = new Map();
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

  products.forEach((product) => {
    const keys = [product._id, product.id, slugify(product.name)].filter(Boolean);
    keys.forEach((key) => {
      productMap.set(String(key), product);
    });
  });

  const daily = createPeriodSeries('daily', range.days);
  const weekly = createPeriodSeries('weekly', Math.max(Math.ceil(range.days / 7), 1));
  const productMetrics = new Map();
  const productTrendMap = new Map();

  const ensureMetric = (productLike, fallbackId) => {
    const id = String(productLike?._id || productLike?.id || fallbackId || slugify(productLike?.name || 'product'));
    if (!productMetrics.has(id)) {
      productMetrics.set(id, {
        productId: id,
        name: productLike?.name || 'Unknown product',
        category: productLike?.category || 'Uncategorized',
        material: productLike?.material || 'Unspecified',
        price: Number(productLike?.price) || 0,
        stockQuantity: Number(productLike?.stockQuantity) || DEFAULT_STOCK_QUANTITY,
        soldUnits: 0,
        returnedUnits: 0,
        netSoldUnits: 0,
        allTimeNetSoldUnits: 0,
        revenue: 0,
        remainingUnits: Number(productLike?.stockQuantity) || DEFAULT_STOCK_QUANTITY,
        remainingValue: 0,
        returnRate: 0,
        sellThroughRate: 0,
      });
    }
    return productMetrics.get(id);
  };

  const ensureProductTrend = (productLike, fallbackId) => {
    const id = String(productLike?._id || productLike?.id || fallbackId || slugify(productLike?.name || 'product'));
    if (!productTrendMap.has(id)) {
      productTrendMap.set(id, {
        productId: id,
        name: productLike?.name || 'Unknown product',
        category: productLike?.category || 'Uncategorized',
        daily: createPeriodSeries('daily', range.days),
        weekly: createPeriodSeries('weekly', Math.max(Math.ceil(range.days / 7), 1)),
      });
    }
    return productTrendMap.get(id);
  };

  products.forEach((product) => {
    if (matchesFilters(product)) {
      ensureMetric(product, product._id);
      ensureProductTrend(product, product._id);
    }
  });

  let orderCount = 0;

  orders.forEach((order) => {
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const isCancelled = order.orderStatus === 'cancelled';
    const isReturned = order.orderStatus === 'returned';
    const isInSelectedRange = createdAt >= range.startDate && createdAt <= range.endDate;

    if (isInSelectedRange) {
      orderCount += 1;
      updateSeries(daily, 'daily', createdAt, {
        orderCount: 1,
        returnedOrderCount: isReturned ? 1 : 0,
      });
      updateSeries(weekly, 'weekly', createdAt, {
        orderCount: 1,
        returnedOrderCount: isReturned ? 1 : 0,
      });
    }

    (order.orderItems || []).forEach((item) => {
      const matchedProduct =
        productMap.get(String(item.product)) ||
        productMap.get(slugify(item.name)) || {
          _id: item.product,
          name: item.name,
          category: 'Uncategorized',
          material: 'Unspecified',
          price: Number(item.price) || 0,
          stockQuantity: DEFAULT_STOCK_QUANTITY,
        };

      if (!matchesFilters(matchedProduct)) {
        return;
      }

      const metric = ensureMetric(matchedProduct, item.product);
      const trend = ensureProductTrend(matchedProduct, item.product);
      const qty = Number(item.qty) || 0;
      const soldUnits = isCancelled ? 0 : qty;
      const returnedUnits = isReturned ? qty : 0;
      const revenue = isCancelled || isReturned ? 0 : qty * Number(item.price || 0);
      const netUnits = Math.max(soldUnits - returnedUnits, 0);

      metric.allTimeNetSoldUnits += netUnits;

      if (!isInSelectedRange) {
        return;
      }

      metric.soldUnits += soldUnits;
      metric.returnedUnits += returnedUnits;
      metric.revenue += revenue;

      updateSeries(daily, 'daily', createdAt, { soldUnits, returnedUnits, revenue });
      updateSeries(weekly, 'weekly', createdAt, { soldUnits, returnedUnits, revenue });
      updateSeries(trend.daily, 'daily', createdAt, { soldUnits, returnedUnits, revenue });
      updateSeries(trend.weekly, 'weekly', createdAt, { soldUnits, returnedUnits, revenue });
    });
  });

  const categories = new Map();
  let inventoryUnits = 0;
  let inventoryValue = 0;
  let soldUnits = 0;
  let returnedUnits = 0;
  let revenue = 0;

  [...productMetrics.values()].forEach((metric) => {
    metric.netSoldUnits = Math.max(metric.soldUnits - metric.returnedUnits, 0);
    metric.remainingUnits = Math.max(metric.stockQuantity - metric.allTimeNetSoldUnits, 0);
    metric.remainingValue = metric.remainingUnits * metric.price;
    metric.returnRate = metric.soldUnits ? metric.returnedUnits / metric.soldUnits : 0;
    metric.sellThroughRate = metric.stockQuantity ? metric.netSoldUnits / metric.stockQuantity : 0;

    inventoryUnits += metric.stockQuantity;
    inventoryValue += metric.stockQuantity * metric.price;
    soldUnits += metric.soldUnits;
    returnedUnits += metric.returnedUnits;
    revenue += metric.revenue;

    const category = categories.get(metric.category) || {
      name: metric.category,
      stockQuantity: 0,
      soldUnits: 0,
      returnedUnits: 0,
      netSoldUnits: 0,
      remainingUnits: 0,
      revenue: 0,
      remainingValue: 0,
      returnRate: 0,
      sellThroughRate: 0,
    };

    category.stockQuantity += metric.stockQuantity;
    category.soldUnits += metric.soldUnits;
    category.returnedUnits += metric.returnedUnits;
    category.netSoldUnits += metric.netSoldUnits;
    category.remainingUnits += metric.remainingUnits;
    category.revenue += metric.revenue;
    category.remainingValue += metric.remainingValue;
    categories.set(metric.category, category);
  });

  const categorySummary = [...categories.values()]
    .map((category) => ({
      ...category,
      returnRate: category.soldUnits ? category.returnedUnits / category.soldUnits : 0,
      sellThroughRate: category.stockQuantity ? category.netSoldUnits / category.stockQuantity : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const productSummary = [...productMetrics.values()].sort((a, b) => b.revenue - a.revenue);
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
      revenue,
      soldUnits,
      returnedUnits,
      returnRate: soldUnits ? returnedUnits / soldUnits : 0,
      inventoryUnits,
      inventoryValue,
      remainingInventoryUnits: productSummary.reduce((sum, item) => sum + item.remainingUnits, 0),
      remainingInventoryValue: productSummary.reduce((sum, item) => sum + item.remainingValue, 0),
      sellThroughRate: inventoryUnits ? (soldUnits - returnedUnits) / inventoryUnits : 0,
      orderCount,
    },
    trends: {
      daily,
      weekly,
    },
    categories: categorySummary,
    products: productSummary,
    productTrends,
    lowStockProducts: productSummary.filter((item) => item.remainingUnits <= 5).slice(0, 8),
  };
};
