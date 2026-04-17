import { LUXURY_PRODUCTS, normalizeProduct } from '../data/products';

export const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://maison-heera-server.onrender.com';
const LOCAL_DEMO_MODE_ENABLED =
  String(import.meta.env.VITE_ENABLE_LOCAL_FALLBACK ?? (import.meta.env.DEV ? 'true' : 'false')).toLowerCase() === 'true';

export const CATALOG_UPDATED_EVENT = 'maison-heera:catalog-updated';

const LOCAL_PRODUCTS_KEY = 'maison-heera.local-products';
const LOCAL_USERS_KEY = 'maison-heera.local-users';
const LOCAL_ORDERS_KEY = 'maison-heera.local-orders';
const LOCAL_AUTH_OTPS_KEY = 'maison-heera.auth-otps';
const LOCAL_PASSWORD_RESETS_KEY = 'maison-heera.password-resets';
const USER_STORAGE_KEY = 'userInfo';
const EMPTY_ARRAY = [];

const DEFAULT_LOCAL_USERS = [
  {
    _id: 'local-admin',
    name: 'Maison Admin',
    email: 'admin@maisonheera.com',
    password: 'admin123',
    isAdmin: true,
    addresses: [],
    token: 'local-admin-session',
  },
];

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  try {
    if (!window.localStorage.getItem('maison-heera-cache-bust-v1')) {
      window.localStorage.removeItem('maison-heera.local-products');
      window.localStorage.setItem('maison-heera-cache-bust-v1', 'true');
    }
  } catch {
    // Ignore storage errors
  }
}


const readArray = (key, fallback = []) => {
  if (!isBrowser) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeArray = (key, value) => {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeAddress = (address, index = 0) => ({
  _id: address._id || `local-address-${Date.now()}-${index}`,
  label: address.label || `Address ${index + 1}`,
  fullName: address.fullName || '',
  email: address.email || '',
  phone: address.phone || '',
  address: address.address || '',
  city: address.city || '',
  state: address.state || '',
  postalCode: address.postalCode || '',
  country: address.country || '',
  isDefault: Boolean(address.isDefault),
});

const ensureDefaultAddress = (addresses = []) => {
  if (!addresses.length) return [];
  const normalized = addresses.map((address, index) => normalizeAddress(address, index));
  if (!normalized.some((address) => address.isDefault)) {
    normalized[0].isDefault = true;
  }
  return normalized;
};

const normalizeOrderItem = (item, index = 0) => ({
  _id: item._id || `local-order-item-${Date.now()}-${index}`,
  name: item.name || '',
  qty: Number(item.qty) || 0,
  image: resolveMediaUrl(item.image),
  price: Number(item.price) || 0,
  product: item.product || item.id || '',
  feedback: item.feedback
    ? {
        rating: Number(item.feedback.rating) || 0,
        comment: item.feedback.comment || '',
        submittedAt: item.feedback.submittedAt || new Date().toISOString(),
      }
    : null,
  returnStatus: item.returnStatus || 'none',
  returnReason: item.returnReason || '',
  returnRequestedAt: item.returnRequestedAt || null,
  returnedAt: item.returnedAt || null,
  returnShipment: item.returnShipment ? normalizeShipment(item.returnShipment, item) : null,
});

const normalizeShipmentEvent = (event, index = 0) => ({
  date: event?.date || new Date().toISOString(),
  status: event?.status || `STATUS_${index + 1}`,
  activity: event?.activity || '',
  location: event?.location || '',
  statusCode: event?.statusCode || '',
  statusLabel: event?.statusLabel || '',
});

const normalizeShipment = (shipment, order = {}) => {
  const fallbackEvents = [
    {
      date: order.createdAt || new Date().toISOString(),
      status: 'ORDER_CONFIRMED',
      activity:
        String(order.paymentMethod || '').toLowerCase() === 'cod'
          ? 'Your order has been confirmed and is awaiting dispatch.'
          : 'Your payment has been confirmed and the order is being prepared.',
      location: [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', '),
      statusCode: 'confirmed',
      statusLabel: 'ORDER CONFIRMED',
    },
  ];

  const events = Array.isArray(shipment?.trackingEvents) && shipment.trackingEvents.length
    ? shipment.trackingEvents.map((event, index) => normalizeShipmentEvent(event, index))
    : fallbackEvents.map((event, index) => normalizeShipmentEvent(event, index));

  return {
    provider: shipment?.provider || 'local-demo',
    shiprocketOrderId: shipment?.shiprocketOrderId || '',
    shipmentId: shipment?.shipmentId || '',
    awbCode: shipment?.awbCode || '',
    courierCompanyId: shipment?.courierCompanyId || null,
    courierName: shipment?.courierName || '',
    pickupLocation: shipment?.pickupLocation || '',
    pickupTokenNumber: shipment?.pickupTokenNumber || '',
    pickupScheduledDate: shipment?.pickupScheduledDate || '',
    labelUrl: shipment?.labelUrl || '',
    manifestUrl: shipment?.manifestUrl || '',
    currentStatus: shipment?.currentStatus || 'Order confirmed',
    trackingStage: shipment?.trackingStage || 'order-confirmed',
    trackingEvents: events,
    lastSyncedAt: shipment?.lastSyncedAt || order.createdAt || new Date().toISOString(),
    error: shipment?.error || '',
    cod: Boolean(shipment?.cod ?? String(order.paymentMethod || '').toLowerCase() === 'cod'),
  };
};

const normalizeOrderRecord = (order) => ({
  ...order,
  orderItems: (order.orderItems || []).map((item, index) => normalizeOrderItem(item, index)),
  shippingAddress: normalizeAddress(order.shippingAddress || {}, 0),
  shipment: normalizeShipment(order.shipment, order),
});

const buildFeedbackSummaryMap = (orders = []) => {
  const summaryMap = new Map();

  orders.forEach((order) => {
    (order.orderItems || []).forEach((item) => {
      const productId = String(item.product || item.id || '');
      const rating = Number(item.feedback?.rating);

      if (!productId || !rating) {
        return;
      }

      const current = summaryMap.get(productId) || { ratingTotal: 0, ratingCount: 0 };
      current.ratingTotal += rating;
      current.ratingCount += 1;
      summaryMap.set(productId, current);
    });
  });

  return summaryMap;
};

const applyFeedbackSummariesToCatalog = (items, orders = []) => {
  const feedbackSummaryMap = buildFeedbackSummaryMap(orders);

  return items.map((item) => {
    const existingCount = Math.max(Number(item.ratingCount) || 0, 0);
    const existingTotal = existingCount > 0 ? Number(item.rating || 0) * existingCount : 0;
    const localSummary = feedbackSummaryMap.get(String(item.id || item._id || '')) || {
      ratingTotal: 0,
      ratingCount: 0,
    };
    const ratingCount = existingCount + localSummary.ratingCount;
    const ratingTotal = existingTotal + localSummary.ratingTotal;

    return {
      ...item,
      rating: ratingCount ? Number((ratingTotal / ratingCount).toFixed(1)) : null,
      ratingCount,
    };
  });
};

export const resolveMediaUrl = (value) => {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  // Only prefix backend uploads with the API URL. Let frontend handle local public assets.
  if (value.startsWith('/uploads/')) return `${API_BASE_URL}${value}`;
  return value;
};

const mergeById = (items) => {
  const merged = new Map();

  items.forEach((item, index) => {
    const normalized = normalizeProduct(item, index);
    normalized.image = resolveMediaUrl(normalized.image);
    merged.set(normalized.id, normalized);
  });

  return [...merged.values()];
};

const dispatchCatalogUpdate = () => {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
};

export const requestCatalogRefresh = () => {
  dispatchCatalogUpdate();
};

const getStoredUser = () => {
  if (!isBrowser) return null;

  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveStoredUser = (user) => {
  if (!isBrowser) return user;

  const normalizedUser = user
    ? {
        ...user,
        addresses: ensureDefaultAddress(user.addresses || []),
      }
    : null;

  if (normalizedUser && isLocalSessionUser(normalizedUser)) {
    upsertLocalUserRecord(normalizedUser);
  }

  if (normalizedUser) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }

  return normalizedUser;
};

export const isLocalSessionUser = (user) =>
  Boolean(user?._id?.startsWith('local-') || user?.token?.startsWith('local-'));

export const isLocalDemoModeEnabled = () => LOCAL_DEMO_MODE_ENABLED;

export const resolveApiUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const shouldUseLocalFallback = (status, error) =>
  LOCAL_DEMO_MODE_ENABLED &&
  (status >= 500 || Boolean(error && /fetch|network|failed/i.test(error.message)));

export const jsonRequest = async (path, options = {}) => {
  const currentUser = getStoredUser();
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
  };

  if (!isFormDataBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.includeAuth !== false && currentUser?.token && !headers.Authorization) {
    headers.Authorization = `Bearer ${currentUser.token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(resolveApiUrl(path), config);
  const text = await response.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};

export const getLocalCatalog = () =>
  applyFeedbackSummariesToCatalog(
    mergeById([...LUXURY_PRODUCTS, ...readArray(LOCAL_PRODUCTS_KEY)]),
    getAllLocalOrders(),
  );

export const loadCatalog = async () => {
  const localProducts = readArray(LOCAL_PRODUCTS_KEY);
  const localOrders = getAllLocalOrders();

  try {
    const response = await jsonRequest('/api/products', { includeAuth: false });
    if (!response.ok) {
      throw new Error(response.data?.message || `Products request failed with ${response.status}`);
    }

    return applyFeedbackSummariesToCatalog(mergeById([...(response.data || []), ...localProducts]), localOrders);
  } catch {
    return applyFeedbackSummariesToCatalog(mergeById([...LUXURY_PRODUCTS, ...localProducts]), localOrders);
  }
};

export const saveLocalProduct = (product) => {
  const localProducts = readArray(LOCAL_PRODUCTS_KEY);
  const normalized = normalizeProduct({
    ...product,
    id: product.id || product._id || `local-product-${Date.now()}`,
  });

  const nextProducts = [...localProducts.filter((item) => (item.id || item._id) !== normalized.id), normalized];
  writeArray(LOCAL_PRODUCTS_KEY, nextProducts);
  dispatchCatalogUpdate();

  return normalized;
};

export const saveLocalProducts = (products) => {
  const stampedProducts = products.map((product, index) => ({
    ...product,
    id: product.id || product._id || `local-product-${Date.now()}-${index}`,
  }));

  stampedProducts.forEach((product) => saveLocalProduct(product));
};

export const getAllLocalOrders = () => readArray(LOCAL_ORDERS_KEY).map((order) => normalizeOrderRecord(order));

const getLocalUsers = () => {
  const users = readArray(LOCAL_USERS_KEY);
  if (users.length > 0) return users;

  writeArray(LOCAL_USERS_KEY, DEFAULT_LOCAL_USERS);
  return DEFAULT_LOCAL_USERS;
};

const writeLocalUsers = (users) => {
  writeArray(LOCAL_USERS_KEY, users);
};

const getLocalAuthOtps = () => readArray(LOCAL_AUTH_OTPS_KEY);

const writeLocalAuthOtps = (entries) => {
  writeArray(LOCAL_AUTH_OTPS_KEY, entries);
};

const getLocalPasswordResets = () => readArray(LOCAL_PASSWORD_RESETS_KEY);

const writeLocalPasswordResets = (entries) => {
  writeArray(LOCAL_PASSWORD_RESETS_KEY, entries);
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profilePicture: user.profilePicture || '',
  isAdmin: Boolean(user.isAdmin),
  addresses: ensureDefaultAddress(user.addresses || []),
  token: user.token || `local-session-${user._id}`,
});

const upsertLocalUserRecord = (user) => {
  if (!user) {
    return user;
  }

  const users = getLocalUsers();
  const existingIndex = users.findIndex(
    (item) => item._id === user._id || item.email?.toLowerCase() === user.email?.toLowerCase(),
  );

  const nextRecord = {
    password: users[existingIndex]?.password || user.password || '',
    ...users[existingIndex],
    ...user,
    email: user.email?.trim().toLowerCase() || users[existingIndex]?.email || '',
    name: user.name?.trim() || users[existingIndex]?.name || 'Maison Client',
    addresses: ensureDefaultAddress(user.addresses || users[existingIndex]?.addresses || []),
    token: user.token || users[existingIndex]?.token || `local-session-${user._id}`,
  };

  const nextUsers =
    existingIndex === -1
      ? [...users, nextRecord]
      : users.map((item, index) => (index === existingIndex ? nextRecord : item));

  writeLocalUsers(nextUsers);
  return nextRecord;
};

const generateLocalOtpCode = () =>
  `${Math.floor(100000 + Math.random() * 900000)}`;

const normalizeOtpCode = (value) => String(value || '').replace(/\D/g, '').slice(0, 6);

const createLocalOtpChallenge = ({ email, purpose, payload = {} }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = generateLocalOtpCode();
  const otpEntries = getLocalAuthOtps().filter(
    (entry) => !(entry.email === normalizedEmail && entry.purpose === purpose),
  );

  otpEntries.push({
    email: normalizedEmail,
    purpose,
    otp,
    payload,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  });

  writeLocalAuthOtps(otpEntries);

  return {
    message: 'OTP generated for local/demo mode.',
    developmentOtp: otp,
  };
};

const consumeLocalOtpChallenge = ({ email, purpose, otp }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = normalizeOtpCode(otp);
  const otpEntries = getLocalAuthOtps();
  const match = otpEntries.find(
    (entry) =>
      entry.email === normalizedEmail &&
      entry.purpose === purpose &&
      entry.otp === normalizedOtp &&
      new Date(entry.expiresAt).getTime() > Date.now(),
  );

  if (!match) {
    throw new Error('OTP is invalid or has expired.');
  }

  writeLocalAuthOtps(
    otpEntries.filter(
      (entry) => !(entry.email === normalizedEmail && entry.purpose === purpose && entry.otp === normalizedOtp),
    ),
  );

  return match.payload || {};
};

export const registerLocalUser = ({ name, email, password }) => {
  const users = getLocalUsers();
  const normalizedEmail = email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('User already exists');
  }

  const newUser = {
    _id: `local-user-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    password,
    isAdmin: false,
    addresses: [],
    token: `local-session-${Date.now()}`,
  };

  writeLocalUsers([...users, newUser]);
  return sanitizeUser(newUser);
};

export const loginLocalUser = ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getLocalUsers().find((item) => item.email.toLowerCase() === normalizedEmail);

  if (!user || user.password !== password) {
    throw new Error('Invalid email or password');
  }

  return sanitizeUser(user);
};

export const requestLocalRegistrationOtp = ({ name, email, password }) => {
  const users = getLocalUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!name?.trim() || !normalizedEmail || !password || !passwordRegex.test(password)) {
    throw new Error('Name, email, and a strong password are required.');
  }

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('User already exists');
  }

  return createLocalOtpChallenge({
    email: normalizedEmail,
    purpose: 'register',
    payload: {
      name: name.trim(),
      password,
    },
  });
};

export const verifyLocalRegistrationOtp = ({ email, otp }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = consumeLocalOtpChallenge({
    email: normalizedEmail,
    purpose: 'register',
    otp,
  });

  return registerLocalUser({
    name: payload.name,
    email: normalizedEmail,
    password: payload.password,
  });
};

export const requestLocalLoginOtp = ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getLocalUsers().find((item) => item.email.toLowerCase() === normalizedEmail);

  if (!user || user.password !== password) {
    throw new Error('Invalid email or password');
  }

  return createLocalOtpChallenge({
    email: normalizedEmail,
    purpose: 'login',
  });
};

export const verifyLocalLoginOtp = ({ email, otp }) => {
  const normalizedEmail = email.trim().toLowerCase();

  consumeLocalOtpChallenge({
    email: normalizedEmail,
    purpose: 'login',
    otp,
  });

  return loginLocalUser({
    email: normalizedEmail,
    password: getLocalUsers().find((item) => item.email.toLowerCase() === normalizedEmail)?.password,
  });
};

export const requestLocalPasswordResetOtp = (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getLocalUsers().find((item) => item.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return {
      message: 'If an account exists for that email, a reset OTP is now available.',
    };
  }

  return createLocalOtpChallenge({
    email: normalizedEmail,
    purpose: 'password_reset',
    payload: {
      userId: user._id,
    },
  });
};

export const verifyLocalPasswordResetOtp = ({ email, otp, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!password || !passwordRegex.test(password)) {
    throw new Error('Password must be at least 8 chars with uppercase, lowercase, number, and special char.');
  }

  const payload = consumeLocalOtpChallenge({
    email: normalizedEmail,
    purpose: 'password_reset',
    otp,
  });

  updateLocalUser(payload.userId, (user) => ({
    ...user,
    password,
  }));

  return {
    message: 'Password updated successfully.',
  };
};

const updateLocalUser = (userId, updater) => {
  const users = getLocalUsers();
  let index = users.findIndex((user) => user._id === userId);

  if (index === -1) {
    const storedUser = getStoredUser();
    if (storedUser?._id === userId) {
      upsertLocalUserRecord(storedUser);
      index = getLocalUsers().findIndex((user) => user._id === userId);
    }
  }

  if (index === -1) {
    throw new Error('User not found');
  }

  const updatedUser = updater({ ...users[index], addresses: ensureDefaultAddress(users[index].addresses || []) });
  users[index] = updatedUser;
  writeLocalUsers(users);
  return sanitizeUser(updatedUser);
};

export const addLocalAddress = (userId, address) =>
  updateLocalUser(userId, (user) => {
    const nextAddresses = ensureDefaultAddress(user.addresses || []);
    if (address.isDefault || nextAddresses.length === 0) {
      nextAddresses.forEach((item) => {
        item.isDefault = false;
      });
    }

    nextAddresses.push(
      normalizeAddress(
        {
          ...address,
          _id: `local-address-${Date.now()}`,
          isDefault: Boolean(address.isDefault) || nextAddresses.length === 0,
        },
        nextAddresses.length,
      ),
    );

    return {
      ...user,
      addresses: ensureDefaultAddress(nextAddresses),
    };
  });

export const setLocalDefaultAddress = (userId, addressId) =>
  updateLocalUser(userId, (user) => ({
    ...user,
    addresses: ensureDefaultAddress(user.addresses || []).map((address) => ({
      ...address,
      isDefault: address._id === addressId,
    })),
  }));

export const deleteLocalAddress = (userId, addressId) =>
  updateLocalUser(userId, (user) => ({
    ...user,
    addresses: ensureDefaultAddress((user.addresses || []).filter((address) => address._id !== addressId)),
  }));

export const updateLocalProfile = (userId, profile) =>
  updateLocalUser(userId, (user) => ({
    ...user,
    name: profile.name?.trim() || user.name,
    email: profile.email?.trim().toLowerCase() || user.email,
    profilePicture: profile.profilePicture !== undefined ? profile.profilePicture : user.profilePicture,
    password: profile.password ? profile.password : user.password,
    addresses: ensureDefaultAddress(user.addresses || []),
  }));

export const requestLocalPasswordReset = (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getLocalUsers().find((item) => item.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return {
      message: 'If an account exists for that email, reset instructions are now available.',
    };
  }

  const resetToken = `local-reset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  const resets = getLocalPasswordResets().filter((entry) => entry.userId !== user._id);

  resets.push({
    token: resetToken,
    userId: user._id,
    expiresAt,
  });

  writeLocalPasswordResets(resets);

  return {
    message: 'A password reset link has been generated for this local account.',
    developmentResetToken: resetToken,
  };
};

export const validateLocalPasswordReset = (token) =>
  getLocalPasswordResets().some(
    (entry) => entry.token === token && new Date(entry.expiresAt).getTime() > Date.now(),
  );

export const resetLocalPassword = (token, password) => {
  const resets = getLocalPasswordResets();
  const resetEntry = resets.find((entry) => entry.token === token);

  if (!resetEntry || new Date(resetEntry.expiresAt).getTime() <= Date.now()) {
    throw new Error('This password reset link is invalid or has expired.');
  }

  const nextUser = updateLocalUser(resetEntry.userId, (user) => ({
    ...user,
    password,
  }));

  writeLocalPasswordResets(resets.filter((entry) => entry.token !== token));
  return nextUser;
};

const updateLocalOrderRecord = (userId, orderId, updater) => {
  const orders = getAllLocalOrders();
  const orderIndex = orders.findIndex((order) => order._id === orderId && order.user === userId);

  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const updatedOrder = normalizeOrderRecord(updater(orders[orderIndex]));
  const nextOrders = orders.map((order, index) => (index === orderIndex ? updatedOrder : order));
  writeArray(LOCAL_ORDERS_KEY, nextOrders);
  return updatedOrder;
};

const updateAdminLocalOrderRecord = (orderId, updater) => {
  const orders = getAllLocalOrders();
  const orderIndex = orders.findIndex((order) => order._id === orderId);

  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const updatedOrder = normalizeOrderRecord(updater(orders[orderIndex]));
  const nextOrders = orders.map((order, index) => (index === orderIndex ? updatedOrder : order));
  writeArray(LOCAL_ORDERS_KEY, nextOrders);
  return updatedOrder;
};

export const createLocalOrder = ({ orderItems, totalPrice, userId, shippingAddress, paymentMethod, notes }) => {
  const orders = readArray(LOCAL_ORDERS_KEY);
  const timestamp = Date.now();
  const createdAt = new Date().toISOString();
  const newOrder = normalizeOrderRecord({
    _id: `local-order-${Date.now()}`,
    user: userId,
    orderItems: (orderItems || []).map((item, index) => ({
      ...item,
      _id: item._id || `local-order-item-${timestamp}-${index}`,
      feedback: item.feedback || null,
      returnStatus: item.returnStatus || 'none',
      returnReason: item.returnReason || '',
      returnRequestedAt: item.returnRequestedAt || null,
      returnedAt: item.returnedAt || null,
    })),
    totalPrice,
    shippingAddress,
    paymentMethod,
    notes,
    orderStatus: paymentMethod === 'razorpay' ? 'paid' : 'created',
    isPaid: paymentMethod === 'razorpay',
    paidAt: paymentMethod === 'razorpay' ? new Date().toISOString() : null,
    createdAt,
    shipment: {
      provider: 'local-demo',
      currentStatus: 'Order confirmed',
      trackingStage: 'order-confirmed',
      trackingEvents: [
        {
          date: createdAt,
          status: 'ORDER_CONFIRMED',
          activity:
            paymentMethod === 'cod'
              ? 'Order confirmed with cash on delivery. Dispatch updates will appear here.'
              : 'Payment captured and order confirmed. Dispatch updates will appear here.',
          location: [shippingAddress?.city, shippingAddress?.state].filter(Boolean).join(', '),
          statusCode: paymentMethod === 'cod' ? 'created' : 'paid',
          statusLabel: 'ORDER CONFIRMED',
        },
      ],
      lastSyncedAt: createdAt,
      cod: paymentMethod === 'cod',
    },
  });

  writeArray(LOCAL_ORDERS_KEY, [newOrder, ...orders]);
  return newOrder;
};

export const getLocalOrders = (userId) =>
  getAllLocalOrders().filter((order) => order.user === userId);

export const loadUserOrders = async (user) => {
  if (!user?._id) {
    return [];
  }

  if (isLocalSessionUser(user)) {
    return getLocalOrders(user._id);
  }

  try {
    const response = await jsonRequest(`/api/orders/myorders/${user._id}`);
    if (!response.ok) {
      if (!shouldUseLocalFallback(response.status)) {
        throw new Error(response.data?.message || 'Could not load orders');
      }

      throw new Error('Temporary server issue');
    }

    return Array.isArray(response.data) ? response.data.map((order) => normalizeOrderRecord(order)) : [];
  } catch (error) {
    if (LOCAL_DEMO_MODE_ENABLED) {
      return getLocalOrders(user._id);
    }

    throw error;
  }
};

export const requestAuthOtp = async ({ purpose, name = '', email, mobileNumber = '', password = '', otpMethod = 'sms' }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (purpose === 'login') {
    const response = await jsonRequest('/api/users/login/request-otp', {
      method: 'POST',
      includeAuth: false,
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    });

    if (!response.ok) {
      if (LOCAL_DEMO_MODE_ENABLED) {
        try {
          return requestLocalLoginOtp({ email: normalizedEmail, password });
        } catch {
          if (!shouldUseLocalFallback(response.status)) {
            throw new Error(response.data?.message || 'Could not send login OTP');
          }
        }
      } else {
        throw new Error(response.data?.message || 'Could not send login OTP');
      }
    }

    return response.data;
  }

  if (purpose === 'register') {
    const response = await jsonRequest('/api/users/register/request-otp', {
      method: 'POST',
      includeAuth: false,
      body: JSON.stringify({
        name: String(name || '').trim(),
        email: normalizedEmail,
        mobileNumber: String(mobileNumber || '').trim(),
        password,
        otpMethod,
      }),
    });

    if (!response.ok) {
      if (LOCAL_DEMO_MODE_ENABLED) {
        try {
          return requestLocalRegistrationOtp({ name: String(name || '').trim(), email: normalizedEmail, password });
        } catch {
          if (!shouldUseLocalFallback(response.status)) {
            throw new Error(response.data?.message || 'Could not send registration OTP');
          }
        }
      } else {
        throw new Error(response.data?.message || 'Could not send registration OTP');
      }
    }

    return response.data;
  }

  const response = await jsonRequest('/api/users/forgot-password/request-otp', {
    method: 'POST',
    includeAuth: false,
    body: JSON.stringify({
      email: normalizedEmail,
    }),
  });

  if (!response.ok) {
    if (LOCAL_DEMO_MODE_ENABLED) {
      try {
        return requestLocalPasswordResetOtp(normalizedEmail);
      } catch {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Could not send password reset OTP');
        }
      }
    } else {
      throw new Error(response.data?.message || 'Could not send password reset OTP');
    }
  }

  return response.data;
};

export const verifyAuthOtp = async ({ purpose, email, otp, password = '' }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedOtp = normalizeOtpCode(otp);

  if (purpose === 'login') {
    const response = await jsonRequest('/api/users/login/verify-otp', {
      method: 'POST',
      includeAuth: false,
      body: JSON.stringify({
        email: normalizedEmail,
        otp: normalizedOtp,
      }),
    });

    if (!response.ok) {
      if (LOCAL_DEMO_MODE_ENABLED) {
        try {
          return verifyLocalLoginOtp({ email: normalizedEmail, otp: normalizedOtp });
        } catch {
          if (!shouldUseLocalFallback(response.status)) {
            throw new Error(response.data?.message || 'Could not verify login OTP');
          }
        }
      } else {
        throw new Error(response.data?.message || 'Could not verify login OTP');
      }
    }

    return response.data;
  }

  if (purpose === 'register') {
    const response = await jsonRequest('/api/users/register/verify-otp', {
      method: 'POST',
      includeAuth: false,
      body: JSON.stringify({
        email: normalizedEmail,
        otp: normalizedOtp,
        otpEmail: normalizedOtp,
      }),
    });

    if (!response.ok) {
      if (LOCAL_DEMO_MODE_ENABLED) {
        try {
          return verifyLocalRegistrationOtp({ email: normalizedEmail, otp: normalizedOtp });
        } catch {
          if (!shouldUseLocalFallback(response.status)) {
            throw new Error(response.data?.message || 'Could not verify registration OTP');
          }
        }
      } else {
        throw new Error(response.data?.message || 'Could not verify registration OTP');
      }
    }

    return response.data;
  }

  const response = await jsonRequest('/api/users/forgot-password/verify-otp', {
    method: 'POST',
    includeAuth: false,
    body: JSON.stringify({
      email: normalizedEmail,
      otp: normalizedOtp,
      password,
    }),
  });

  if (!response.ok) {
    if (LOCAL_DEMO_MODE_ENABLED) {
      try {
        return verifyLocalPasswordResetOtp({ email: normalizedEmail, otp: normalizedOtp, password });
      } catch {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Could not verify password reset OTP');
        }
      }
    } else {
      throw new Error(response.data?.message || 'Could not verify password reset OTP');
    }
  }

  return response.data;
};

export const loadAdminShipmentOrders = async (user) => {
  if (isLocalSessionUser(user)) {
    return getAllLocalOrders().sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  const response = await jsonRequest('/api/orders/admin/shipments');

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not load shipment orders');
    }

    return getAllLocalOrders().sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  return Array.isArray(response.data) ? response.data.map((order) => normalizeOrderRecord(order)) : [];
};

export const refreshAdminShipment = async ({ user, orderId }) => {
  if (isLocalSessionUser(user)) {
    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      shipment: {
        ...(order.shipment || {}),
        currentStatus: order.shipment?.currentStatus || 'Order confirmed',
        lastSyncedAt: new Date().toISOString(),
        error: '',
      },
    }));
  }

  const response = await jsonRequest(`/api/orders/admin/${orderId}/shipment/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not refresh shipment');
    }

    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      shipment: {
        ...(order.shipment || {}),
        lastSyncedAt: new Date().toISOString(),
        error: '',
      },
    }));
  }

  return normalizeOrderRecord(response.data);
};

export const cancelAdminShipment = async ({ user, orderId }) => {
  if (isLocalSessionUser(user)) {
    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      orderStatus: 'shipment-cancelled',
      shipment: {
        ...(order.shipment || {}),
        currentStatus: 'Shipment cancelled',
        trackingStage: 'cancelled',
        error: '',
        lastSyncedAt: new Date().toISOString(),
        trackingEvents: [
          {
            date: new Date().toISOString(),
            status: 'SHIPMENT_CANCELLED',
            activity: 'Shipment cancelled by admin in demo mode.',
            location: [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', '),
            statusCode: 'cancelled',
            statusLabel: 'SHIPMENT CANCELLED',
          },
          ...((order.shipment?.trackingEvents || []).map((event, index) => normalizeShipmentEvent(event, index))),
        ],
      },
    }));
  }

  const response = await jsonRequest(`/api/orders/admin/${orderId}/shipment/cancel`, {
    method: 'POST',
  });

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not cancel shipment');
    }

    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      orderStatus: 'shipment-cancelled',
      shipment: {
        ...(order.shipment || {}),
        currentStatus: 'Shipment cancelled',
        trackingStage: 'cancelled',
        error: '',
        lastSyncedAt: new Date().toISOString(),
      },
    }));
  }

  return normalizeOrderRecord(response.data);
};

export const markAdminShipmentDelivered = async ({ user, orderId }) => {
  if (isLocalSessionUser(user)) {
    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      orderStatus: 'delivered',
      shipment: {
        ...(order.shipment || {}),
        currentStatus: 'Delivered',
        trackingStage: 'delivered',
        error: '',
        lastSyncedAt: new Date().toISOString(),
        trackingEvents: [
          {
            date: new Date().toISOString(),
            status: 'DELIVERED',
            activity: 'Delivery marked complete by admin in demo mode.',
            location: [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', '),
            statusCode: 'delivered',
            statusLabel: 'DELIVERED',
          },
          ...((order.shipment?.trackingEvents || []).map((event, index) => normalizeShipmentEvent(event, index))),
        ],
      },
    }));
  }

  const response = await jsonRequest(`/api/orders/admin/${orderId}/shipment/mark-delivered`, {
    method: 'POST',
  });

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not mark shipment delivered');
    }

    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      orderStatus: 'delivered',
      shipment: {
        ...(order.shipment || {}),
        currentStatus: 'Delivered',
        trackingStage: 'delivered',
        error: '',
        lastSyncedAt: new Date().toISOString(),
      },
    }));
  }

  return normalizeOrderRecord(response.data);
};

export const createAdminReturnShipment = async ({ user, orderId, itemId }) => {
  if (isLocalSessionUser(user)) {
    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      orderStatus: 'return-requested',
      orderItems: (order.orderItems || []).map((item) =>
        item._id === itemId
          ? {
              ...item,
              returnStatus: 'pickup-scheduled',
              returnShipment: normalizeShipment(
                {
                  provider: 'local-demo-return',
                  currentStatus: 'Return pickup requested',
                  trackingStage: 'return-pickup-requested',
                  trackingEvents: [
                    {
                      date: new Date().toISOString(),
                      status: 'RETURN_PICKUP_REQUESTED',
                      activity: 'Return pickup scheduled in demo mode.',
                      location: [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', '),
                      statusCode: 'return-pickup-requested',
                      statusLabel: 'RETURN PICKUP REQUESTED',
                    },
                  ],
                  lastSyncedAt: new Date().toISOString(),
                },
                item,
              ),
            }
          : item,
      ),
    }));
  }

  const response = await jsonRequest(`/api/orders/admin/${orderId}/items/${itemId}/return-shipment`, {
    method: 'POST',
  });

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not create return shipment');
    }

    return updateAdminLocalOrderRecord(orderId, (order) => ({
      ...order,
      orderStatus: 'return-requested',
      orderItems: (order.orderItems || []).map((item) =>
        item._id === itemId
          ? {
              ...item,
              returnStatus: 'pickup-scheduled',
              returnShipment: normalizeShipment(
                {
                  provider: 'local-demo-return',
                  currentStatus: 'Return pickup requested',
                  trackingStage: 'return-pickup-requested',
                  lastSyncedAt: new Date().toISOString(),
                },
                item,
              ),
            }
          : item,
      ),
    }));
  }

  return normalizeOrderRecord(response.data);
};

export const lookupOrderTracking = async ({ orderId, email = '', user = null }) => {
  const normalizedLookup = String(orderId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedLookup) {
    throw new Error('Enter your order ID or AWB to continue.');
  }

  if (LOCAL_DEMO_MODE_ENABLED || isLocalSessionUser(user)) {
    const localOrders = getAllLocalOrders();
    const matchingLocalOrder = localOrders.find(
      (order) =>
        order._id === normalizedLookup ||
        order.shipment?.awbCode === normalizedLookup ||
        order.shipment?.shiprocketOrderId === normalizedLookup,
    );

    if (matchingLocalOrder) {
      const hasAccess =
        (user?._id && matchingLocalOrder.user === user._id) ||
        (normalizedEmail && matchingLocalOrder.shippingAddress?.email?.toLowerCase() === normalizedEmail);

      if (!hasAccess) {
        throw new Error('This order could not be verified with the supplied account details.');
      }

      return matchingLocalOrder;
    }
  }

  const response = await jsonRequest('/api/orders/tracking/lookup', {
    method: 'POST',
    includeAuth: Boolean(user?.token),
    body: JSON.stringify({
      orderId: normalizedLookup,
      email: normalizedEmail,
    }),
  });

  if (!response.ok) {
    throw new Error(response.data?.message || 'We could not load tracking details right now.');
  }

  return normalizeOrderRecord(response.data);
};

export const getPendingFeedbackItems = (orders = []) =>
  orders.flatMap((order) =>
    (order.orderItems || [])
      .filter(
        (item) =>
          !item.feedback?.rating &&
          item.returnStatus !== 'returned' &&
          order.orderStatus !== 'cancelled',
      )
      .map((item) => ({
        orderId: order._id,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
        ...item,
      })),
  );

export const submitLocalOrderItemFeedback = ({ userId, orderId, itemId, rating, comment }) =>
  (() => {
    const updatedOrder = updateLocalOrderRecord(userId, orderId, (order) => ({
      ...order,
      orderItems: (order.orderItems || []).map((item) =>
        item._id === itemId
          ? {
              ...item,
              feedback: {
                rating: Number(rating),
                comment: String(comment || '').trim(),
                submittedAt: new Date().toISOString(),
              },
            }
          : item,
      ),
    }));
    dispatchCatalogUpdate();
    return updatedOrder;
  })();

export const requestLocalOrderItemReturn = ({ userId, orderId, itemId, reason }) =>
  updateLocalOrderRecord(userId, orderId, (order) => ({
    ...order,
    orderStatus: order.orderStatus === 'returned' ? 'returned' : 'return-requested',
    orderItems: (order.orderItems || []).map((item) =>
      item._id === itemId
        ? {
            ...item,
            returnStatus: item.returnStatus === 'returned' ? 'returned' : 'requested',
            returnReason: String(reason || '').trim(),
            returnRequestedAt: new Date().toISOString(),
          }
        : item,
    ),
  }));

export const submitOrderItemFeedback = async ({ user, orderId, itemId, rating, comment }) => {
  if (!user?._id) {
    throw new Error('Please sign in to leave feedback.');
  }

  if (isLocalSessionUser(user)) {
    return submitLocalOrderItemFeedback({ userId: user._id, orderId, itemId, rating, comment });
  }

  const response = await jsonRequest(`/api/orders/${orderId}/items/${itemId}/feedback`, {
    method: 'PUT',
    body: JSON.stringify({
      userId: user._id,
      rating,
      comment,
    }),
  });

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not save feedback');
    }

    return submitLocalOrderItemFeedback({ userId: user._id, orderId, itemId, rating, comment });
  }

  dispatchCatalogUpdate();
  return normalizeOrderRecord(response.data);
};

export const requestOrderItemReturn = async ({ user, orderId, itemId, reason }) => {
  if (!user?._id) {
    throw new Error('Please sign in to request a return.');
  }

  if (isLocalSessionUser(user)) {
    return requestLocalOrderItemReturn({ userId: user._id, orderId, itemId, reason });
  }

  const response = await jsonRequest(`/api/orders/${orderId}/items/${itemId}/return`, {
    method: 'PUT',
    body: JSON.stringify({
      userId: user._id,
      reason,
    }),
  });

  if (!response.ok) {
    if (!shouldUseLocalFallback(response.status)) {
      throw new Error(response.data?.message || 'Could not request a return');
    }

    return requestLocalOrderItemReturn({ userId: user._id, orderId, itemId, reason });
  }

  return normalizeOrderRecord(response.data);
};

export const googleLoginApi = async ({ credential }) => {
  const response = await jsonRequest('/api/users/google-login', {
    method: 'POST',
    includeAuth: false,
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    throw new Error(response.data?.message || 'Google login failed');
  }

  return saveStoredUser(response.data);
};

export const setupTwoFactor = async () => {
  const response = await jsonRequest('/api/users/2fa/setup', {
    method: 'POST',
  });
  if (!response.ok) throw new Error(response.data?.message || 'Failed to setup 2FA');
  return response.data;
};

export const verifyTwoFactor = async (token) => {
  const response = await jsonRequest('/api/users/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(response.data?.message || 'Failed to verify 2FA');
  return response.data;
};

export const disableTwoFactor = async () => {
  const response = await jsonRequest('/api/users/2fa', {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(response.data?.message || 'Failed to disable 2FA');
  return response.data;
};

export { EMPTY_ARRAY };
