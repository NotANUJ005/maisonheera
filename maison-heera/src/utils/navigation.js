const DEFAULT_ROUTE = {
  view: 'home',
};

const sanitizeView = (view) => {
  const allowedViews = new Set([
    'home',
    'shop',
    'prestige-shop',
    'product-detail',
    'reset-password',
    'account',
    'admin',
    'about',
    'contact',
    'checkout',
    'track-order',
  ]);

  return allowedViews.has(view) ? view : 'home';
};

export const normalizeRoute = (route = DEFAULT_ROUTE) => {
  const view = sanitizeView(route.view);
  const normalized = { view };

  if (view === 'product-detail' && route.productId) {
    normalized.productId = route.productId;
    normalized.from = route.from || 'shop';
  }

  if (view === 'reset-password' && route.token) {
    normalized.token = route.token;
  }

  if (view === 'track-order' && route.orderId) {
    normalized.orderId = route.orderId;
  }

  return normalized;
};

export const parseRoute = (pathWithSearch) => {
  if (!pathWithSearch || pathWithSearch === '/') return DEFAULT_ROUTE;

  const [pathPart, queryPart] = pathWithSearch.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart || '');

  if (segments[0] === 'product' && segments[1]) {
    return normalizeRoute({
      view: 'product-detail',
      productId: decodeURIComponent(segments[1]),
      from: query.get('from') || 'shop',
    });
  }

  if (segments[0] === 'reset-password') {
    return normalizeRoute({
      view: 'reset-password',
      token: query.get('token') || '',
    });
  }

  if (segments[0] === 'track-order') {
    return normalizeRoute({
      view: 'track-order',
      orderId: query.get('orderId') || '',
    });
  }

  return normalizeRoute({ view: segments[0] || 'home' });
};

export const buildRoutePath = (route) => {
  const normalized = normalizeRoute(route);

  if (normalized.view === 'home') {
    return '/';
  }

  if (normalized.view === 'product-detail' && normalized.productId) {
    const params = new URLSearchParams();
    if (normalized.from) params.set('from', normalized.from);
    const query = params.toString();
    return `/product/${encodeURIComponent(normalized.productId)}${query ? `?${query}` : ''}`;
  }

  if (normalized.view === 'reset-password') {
    const params = new URLSearchParams();
    if (normalized.token) params.set('token', normalized.token);
    const query = params.toString();
    return `/reset-password${query ? `?${query}` : ''}`;
  }

  if (normalized.view === 'track-order') {
    const params = new URLSearchParams();
    if (normalized.orderId) params.set('orderId', normalized.orderId);
    const query = params.toString();
    return `/track-order${query ? `?${query}` : ''}`;
  }

  return `/${normalized.view}`;
};
