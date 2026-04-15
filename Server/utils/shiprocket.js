const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_REFRESH_BUFFER_MS = 1000 * 60 * 30;
const DEFAULT_DIMENSIONS = {
  mode: 'Surface',
  weight: 0.5,
  length: 20,
  breadth: 15,
  height: 8,
};

let shiprocketTokenCache = {
  token: '',
  expiresAt: 0,
};

const buildShiprocketError = (message, status = 500, data = null) => {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  return error;
};

const cleanString = (value, fallback = '') => String(value ?? fallback).trim();

const normalizeState = (value) => {
  const state = cleanString(value);

  if (!state) {
    return '';
  }

  if (/^gujrat$/i.test(state)) {
    return 'Gujarat';
  }

  return state.replace(/\s+/g, ' ');
};

const sanitizePhoneNumber = (value) => cleanString(value).replace(/\D/g, '');

const splitFullName = (fullName) => {
  const parts = cleanString(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Maison',
    lastName: parts.slice(1).join(' '),
  };
};

const formatShiprocketDate = (value = new Date()) => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value || '00';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}`;
};

const buildTrackingStage = (status = '') => {
  const normalized = cleanString(status).toLowerCase();

  if (!normalized) return 'shipment-created';
  if (normalized.includes('deliver')) return 'delivered';
  if (normalized.includes('out for delivery')) return 'out-for-delivery';
  if (normalized.includes('transit')) return 'in-transit';
  if (normalized.includes('destination')) return 'destination-hub';
  if (normalized.includes('pickup')) return 'pickup-requested';
  if (normalized.includes('ship')) return 'shipped';
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('return')) return 'returned';
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'shipment-created';
};

const buildInitialTrackingEvents = (order, shipmentPayload) => {
  const cityLine = [cleanString(order?.shippingAddress?.city), normalizeState(order?.shippingAddress?.state)]
    .filter(Boolean)
    .join(', ');
  const orderCreatedAt = order?.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString();
  const events = [
    {
      date: orderCreatedAt,
      status: 'ORDER_CREATED',
      activity: order?.paymentMethod === 'cod' ? 'Order confirmed with cash on delivery.' : 'Payment verified and order confirmed.',
      location: cityLine,
      statusCode: order?.paymentMethod === 'cod' ? 'created' : 'paid',
      statusLabel: 'ORDER CONFIRMED',
    },
  ];

  if (shipmentPayload?.awb_code) {
    events.push({
      date: orderCreatedAt,
      status: 'AWB_ASSIGNED',
      activity: `Shipment booked with ${shipmentPayload.courier_name || 'Shiprocket courier network'}.`,
      location: cityLine,
      statusCode: 'awb-assigned',
      statusLabel: 'AWB ASSIGNED',
    });
  }

  if (shipmentPayload?.pickup_scheduled_date) {
    events.push({
      date: shipmentPayload.pickup_scheduled_date,
      status: 'PICKUP_REQUESTED',
      activity: 'Pickup has been requested from the pickup location.',
      location: cleanString(shipmentPayload.courier_name),
      statusCode: 'pickup-requested',
      statusLabel: 'PICKUP REQUESTED',
    });
  }

  return events;
};

const buildTrackingEventsFromShiprocket = (trackingData, fallbackEvents = []) => {
  const activities = Array.isArray(trackingData?.shipment_track_activities)
    ? trackingData.shipment_track_activities
    : [];

  if (!activities.length) {
    return fallbackEvents;
  }

  return activities.map((activity) => ({
    date: cleanString(activity.date),
    status: cleanString(activity.status),
    activity: cleanString(activity.activity),
    location: cleanString(activity.location),
    statusCode: cleanString(activity['sr-status']),
    statusLabel: cleanString(activity['sr-status-label']),
  }));
};

const normalizeShipmentPayload = (shipmentPayload = {}, fallback = {}) => ({
  provider: fallback.provider || 'shiprocket',
  shiprocketOrderId: cleanString(shipmentPayload.order_id || fallback.shiprocketOrderId),
  shipmentId: cleanString(shipmentPayload.shipment_id || fallback.shipmentId),
  awbCode: cleanString(shipmentPayload.awb_code || fallback.awbCode),
  courierCompanyId:
    Number(shipmentPayload.courier_company_id || fallback.courierCompanyId || 0) || undefined,
  courierName: cleanString(shipmentPayload.courier_name || fallback.courierName),
  pickupLocation: cleanString(fallback.pickupLocation),
  pickupTokenNumber: cleanString(shipmentPayload.pickup_token_number || fallback.pickupTokenNumber),
  pickupScheduledDate: cleanString(shipmentPayload.pickup_scheduled_date || fallback.pickupScheduledDate),
  labelUrl: cleanString(shipmentPayload.label_url || fallback.labelUrl),
  manifestUrl: cleanString(shipmentPayload.manifest_url || fallback.manifestUrl),
  currentStatus: cleanString(fallback.currentStatus),
  trackingStage: cleanString(fallback.trackingStage),
  trackingEvents: Array.isArray(fallback.trackingEvents) ? fallback.trackingEvents : [],
  lastSyncedAt: fallback.lastSyncedAt || new Date(),
  error: cleanString(fallback.error),
  cod: Boolean(fallback.cod),
});

const getShiprocketConfig = () => ({
  email: cleanString(process.env.SHIPROCKET_EMAIL),
  password: cleanString(process.env.SHIPROCKET_PASSWORD),
  pickupLocation: cleanString(process.env.SHIPROCKET_PICKUP_LOCATION || 'Maison Heera'),
  pickupName: cleanString(process.env.SHIPROCKET_PICKUP_NAME || 'Maison Heera'),
  pickupEmail: cleanString(process.env.SHIPROCKET_PICKUP_EMAIL || process.env.SHIPROCKET_EMAIL),
  pickupPhone: sanitizePhoneNumber(process.env.SHIPROCKET_PICKUP_PHONE),
  pickupAddress: cleanString(process.env.SHIPROCKET_PICKUP_ADDRESS),
  pickupAddress2: cleanString(process.env.SHIPROCKET_PICKUP_ADDRESS_2),
  pickupCity: cleanString(process.env.SHIPROCKET_PICKUP_CITY),
  pickupState: normalizeState(process.env.SHIPROCKET_PICKUP_STATE),
  pickupCountry: cleanString(process.env.SHIPROCKET_PICKUP_COUNTRY || 'India'),
  pickupPinCode: cleanString(process.env.SHIPROCKET_PICKUP_PINCODE),
  mode: cleanString(process.env.SHIPROCKET_MODE || DEFAULT_DIMENSIONS.mode),
  defaultWeight: Number(process.env.SHIPROCKET_DEFAULT_WEIGHT || DEFAULT_DIMENSIONS.weight),
  defaultLength: Number(process.env.SHIPROCKET_DEFAULT_LENGTH || DEFAULT_DIMENSIONS.length),
  defaultBreadth: Number(process.env.SHIPROCKET_DEFAULT_BREADTH || DEFAULT_DIMENSIONS.breadth),
  defaultHeight: Number(process.env.SHIPROCKET_DEFAULT_HEIGHT || DEFAULT_DIMENSIONS.height),
});

export const isShiprocketConfigured = () => {
  const config = getShiprocketConfig();

  return Boolean(
    config.email &&
      config.password &&
      config.pickupLocation &&
      config.pickupName &&
      config.pickupEmail &&
      config.pickupPhone &&
      config.pickupAddress &&
      config.pickupCity &&
      config.pickupState &&
      config.pickupCountry &&
      config.pickupPinCode,
  );
};

const getShiprocketToken = async () => {
  if (
    shiprocketTokenCache.token &&
    shiprocketTokenCache.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS
  ) {
    return shiprocketTokenCache.token;
  }

  const config = getShiprocketConfig();
  if (!config.email || !config.password) {
    throw buildShiprocketError('Shiprocket credentials are not configured on the server.', 503);
  }

  const response = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.token) {
    throw buildShiprocketError(data?.message || 'Shiprocket authentication failed.', response.status, data);
  }

  shiprocketTokenCache = {
    token: data.token,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8,
  };

  return shiprocketTokenCache.token;
};

const shiprocketRequest = async (
  path,
  { method = 'GET', body, query, retryOnUnauthorized = true } = {},
) => {
  const token = await getShiprocketToken();
  const url = new URL(path.startsWith('http') ? path : `${SHIPROCKET_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (response.status === 401 && retryOnUnauthorized) {
    shiprocketTokenCache = { token: '', expiresAt: 0 };
    return shiprocketRequest(path, { method, body, query, retryOnUnauthorized: false });
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.errors?.message ||
      (typeof data?.errors === 'object' ? Object.values(data.errors).flat().join(', ') : '') ||
      `Shiprocket request failed with ${response.status}`;
    throw buildShiprocketError(message, response.status, data);
  }

  return data;
};

const getPickupLocations = async () => {
  const data = await shiprocketRequest('/settings/company/pickup');
  return Array.isArray(data?.data?.shipping_address) ? data.data.shipping_address : [];
};

const buildShipmentDimensions = (order) => {
  const config = getShiprocketConfig();
  const totalUnits = (order?.orderItems || []).reduce((sum, item) => sum + Math.max(Number(item.qty) || 0, 1), 0);
  const weight = Math.max(config.defaultWeight || DEFAULT_DIMENSIONS.weight, Number((totalUnits * 0.15).toFixed(2)) || 0);

  return {
    weight,
    length: config.defaultLength || DEFAULT_DIMENSIONS.length,
    breadth: config.defaultBreadth || DEFAULT_DIMENSIONS.breadth,
    height: config.defaultHeight || DEFAULT_DIMENSIONS.height,
    mode: config.mode || DEFAULT_DIMENSIONS.mode,
  };
};

const getBestCourier = async (order, dimensions) => {
  const deliveryPostcode = cleanString(order?.shippingAddress?.postalCode);
  const isCod = cleanString(order?.paymentMethod).toLowerCase() === 'cod' ? 1 : 0;
  const config = getShiprocketConfig();

  const data = await shiprocketRequest('/courier/serviceability/', {
    query: {
      pickup_postcode: config.pickupPinCode,
      delivery_postcode: deliveryPostcode,
      cod: isCod,
      weight: dimensions.weight,
      length: dimensions.length,
      breadth: dimensions.breadth,
      height: dimensions.height,
      declared_value: Math.round(Number(order?.totalPrice) || 0),
      mode: dimensions.mode,
    },
  });

  const couriers = Array.isArray(data?.data?.available_courier_companies)
    ? data.data.available_courier_companies
    : [];

  const candidates = couriers
    .filter((courier) => !courier?.blocked)
    .sort((left, right) => {
      const leftPickup = String(left?.pickup_availability || '0') === '1' ? 1 : 0;
      const rightPickup = String(right?.pickup_availability || '0') === '1' ? 1 : 0;
      if (rightPickup !== leftPickup) return rightPickup - leftPickup;

      const leftRate = Number(left?.rate || left?.freight_charge || 0);
      const rightRate = Number(right?.rate || right?.freight_charge || 0);
      if (leftRate !== rightRate) return leftRate - rightRate;

      return Number(right?.rating || 0) - Number(left?.rating || 0);
    });

  if (!candidates.length) {
    throw buildShiprocketError('No Shiprocket courier is serviceable for this destination.', 422, data);
  }

  return candidates[0];
};

const validateShippingAddress = (shippingAddress = {}) => {
  const requiredFields = ['fullName', 'email', 'phone', 'address', 'city', 'state', 'postalCode', 'country'];
  const missing = requiredFields.filter((field) => !cleanString(shippingAddress[field]));

  if (missing.length) {
    throw buildShiprocketError(
      `Shipping address is incomplete for shipment creation. Missing: ${missing.join(', ')}`,
      400,
    );
  }

  const phone = sanitizePhoneNumber(shippingAddress.phone);
  if (phone.length < 10) {
    throw buildShiprocketError('Shipping phone number must include at least 10 digits for shipment creation.', 400);
  }
};

export const createShiprocketShipment = async (order) => {
  if (!isShiprocketConfigured()) {
    throw buildShiprocketError('Shiprocket is not configured on the server.', 503);
  }

  validateShippingAddress(order?.shippingAddress);

  const config = getShiprocketConfig();
  const pickupLocations = await getPickupLocations();
  const hasPickupLocation = pickupLocations.some(
    (location) =>
      cleanString(location?.pickup_location).toLowerCase() === config.pickupLocation.toLowerCase(),
  );
  const dimensions = buildShipmentDimensions(order);
  const courier = await getBestCourier(order, dimensions);
  const { firstName, lastName } = splitFullName(order.shippingAddress.fullName);
  const phone = sanitizePhoneNumber(order.shippingAddress.phone);

  const payload = {
    mode: dimensions.mode,
    request_pickup: true,
    print_label: false,
    generate_manifest: false,
    courier_id: courier?.courier_company_id,
    order_id: `MH-${order._id}`,
    order_date: formatShiprocketDate(order.createdAt || new Date()),
    pickup_location: config.pickupLocation,
    comment: cleanString(order.notes),
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: cleanString(order.shippingAddress.address),
    billing_address_2: '',
    billing_city: cleanString(order.shippingAddress.city),
    billing_pincode: cleanString(order.shippingAddress.postalCode),
    billing_state: normalizeState(order.shippingAddress.state),
    billing_country: cleanString(order.shippingAddress.country || 'India'),
    billing_email: cleanString(order.shippingAddress.email),
    billing_phone: phone,
    shipping_is_billing: true,
    order_items: (order.orderItems || []).map((item, index) => ({
      name: cleanString(item.name || `Maison Heera Item ${index + 1}`),
      sku: cleanString(item.product || `maison-heera-${index + 1}`),
      units: Math.max(Number(item.qty) || 1, 1),
      selling_price: Number(item.price) || 0,
      discount: 0,
      tax: 0,
      hsn: '',
    })),
    payment_method: cleanString(order.paymentMethod).toLowerCase() === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: Number(order.totalPrice) || 0,
    length: dimensions.length,
    breadth: dimensions.breadth,
    height: dimensions.height,
    weight: dimensions.weight,
  };

  if (!hasPickupLocation) {
    payload.vendor_details = {
      pickup_location: config.pickupLocation,
      name: config.pickupName,
      email: config.pickupEmail,
      phone: config.pickupPhone,
      address: config.pickupAddress,
      address_2: config.pickupAddress2,
      city: config.pickupCity,
      state: config.pickupState,
      country: config.pickupCountry,
      pin_code: config.pickupPinCode,
    };
  }

  const data = await shiprocketRequest('/shipments/create/forward-shipment', {
    method: 'POST',
    body: payload,
  });

  const shipmentPayload = data?.payload || {};
  if (Number(data?.status) !== 1 || !shipmentPayload?.shipment_id) {
    throw buildShiprocketError(data?.message || 'Shiprocket could not create the shipment.', 422, data);
  }

  return normalizeShipmentPayload(shipmentPayload, {
    provider: 'shiprocket',
    courierCompanyId: courier?.courier_company_id,
    courierName: courier?.courier_name,
    pickupLocation: config.pickupLocation,
    currentStatus: shipmentPayload.pickup_generated ? 'Pickup requested' : 'Shipment created',
    trackingStage: shipmentPayload.pickup_generated ? 'pickup-requested' : 'shipment-created',
    trackingEvents: buildInitialTrackingEvents(order, shipmentPayload),
    lastSyncedAt: new Date(),
    error: '',
    cod: cleanString(order.paymentMethod).toLowerCase() === 'cod',
  });
};

export const refreshShiprocketShipment = async (shipment = {}) => {
  if (!shipment?.provider || shipment.provider !== 'shiprocket') {
    return shipment;
  }

  if (!isShiprocketConfigured()) {
    return shipment;
  }

  let trackingResponse = null;

  if (cleanString(shipment.awbCode)) {
    trackingResponse = await shiprocketRequest(`/courier/track/awb/${encodeURIComponent(cleanString(shipment.awbCode))}`);
  } else if (cleanString(shipment.shipmentId)) {
    trackingResponse = await shiprocketRequest(
      `/courier/track/shipment/${encodeURIComponent(cleanString(shipment.shipmentId))}`,
    );
  } else {
    return shipment;
  }

  const trackingData = trackingResponse?.tracking_data || {};
  const trackEntry = Array.isArray(trackingData.shipment_track) ? trackingData.shipment_track[0] : null;
  const trackingEvents = buildTrackingEventsFromShiprocket(trackingData, shipment.trackingEvents || []);
  const currentStatus =
    cleanString(trackEntry?.current_status) ||
    cleanString(trackingEvents[0]?.statusLabel) ||
    cleanString(shipment.currentStatus) ||
    'Shipment created';

  return {
    ...shipment,
    shiprocketOrderId: cleanString(trackEntry?.order_id || shipment.shiprocketOrderId),
    shipmentId: cleanString(trackEntry?.shipment_id || shipment.shipmentId),
    awbCode: cleanString(trackEntry?.awb_code || shipment.awbCode),
    courierCompanyId:
      Number(trackEntry?.courier_company_id || shipment.courierCompanyId || 0) || shipment.courierCompanyId,
    courierName: cleanString(trackEntry?.courier_name || shipment.courierName),
    currentStatus,
    trackingStage: buildTrackingStage(
      cleanString(trackingEvents[0]?.statusLabel || trackEntry?.current_status || shipment.currentStatus),
    ),
    trackingEvents,
    lastSyncedAt: new Date(),
    error: '',
  };
};

export const cancelShiprocketShipment = async (shipment = {}) => {
  const awbCode = cleanString(shipment.awbCode);

  if (!awbCode) {
    throw buildShiprocketError('This shipment does not have an AWB to cancel.', 400);
  }

  await shiprocketRequest('/orders/cancel/shipment/awbs', {
    method: 'POST',
    body: {
      awbs: [awbCode],
    },
  });

  return {
    ...shipment,
    currentStatus: 'Shipment cancelled',
    trackingStage: 'cancelled',
    lastSyncedAt: new Date(),
    error: '',
  };
};

export const createShiprocketReturnShipment = async (order, item) => {
  if (!isShiprocketConfigured()) {
    throw buildShiprocketError('Shiprocket is not configured on the server.', 503);
  }

  validateShippingAddress(order?.shippingAddress);

  const config = getShiprocketConfig();
  const dimensions = buildShipmentDimensions({
    orderItems: [{ qty: item?.qty || 1 }],
  });
  const { firstName, lastName } = splitFullName(order.shippingAddress.fullName);
  const phone = sanitizePhoneNumber(order.shippingAddress.phone);
  const returnOrderReference = `RET-${order._id}-${String(item?._id || '').slice(-6)}`.slice(0, 45);

  const payload = {
    order_id: returnOrderReference,
    order_date: formatShiprocketDate(new Date()),
    pickup_customer_name: firstName,
    pickup_last_name: lastName,
    company_name: 'Maison Heera',
    pickup_address: cleanString(order.shippingAddress.address),
    pickup_address_2: '',
    pickup_city: cleanString(order.shippingAddress.city),
    pickup_state: normalizeState(order.shippingAddress.state),
    pickup_country: cleanString(order.shippingAddress.country || 'India'),
    pickup_pincode: cleanString(order.shippingAddress.postalCode),
    pickup_email: cleanString(order.shippingAddress.email),
    pickup_phone: phone,
    pickup_isd_code: '91',
    shipping_customer_name: config.pickupName,
    shipping_last_name: '',
    shipping_address: config.pickupAddress,
    shipping_address_2: config.pickupAddress2,
    shipping_city: config.pickupCity,
    shipping_country: config.pickupCountry,
    shipping_pincode: config.pickupPinCode,
    shipping_state: config.pickupState,
    shipping_email: config.pickupEmail,
    shipping_isd_code: '91',
    shipping_phone: config.pickupPhone,
    order_items: [
      {
        sku: cleanString(item?.product || item?._id || 'return-item'),
        name: cleanString(item?.name || 'Maison Heera Return'),
        units: Math.max(Number(item?.qty) || 1, 1),
        selling_price: Number(item?.price) || 0,
        discount: 0,
      },
    ],
    payment_method: 'PREPAID',
    total_discount: 0,
    sub_total: (Number(item?.price) || 0) * Math.max(Number(item?.qty) || 1, 1),
    length: dimensions.length,
    breadth: dimensions.breadth,
    height: dimensions.height,
    weight: dimensions.weight,
    request_pickup: true,
  };

  const data = await shiprocketRequest('/shipments/create/return-shipment', {
    method: 'POST',
    body: payload,
  });

  const shipmentPayload = data?.payload || {};
  if (Number(data?.status) !== 1 || !shipmentPayload?.shipment_id) {
    throw buildShiprocketError(data?.message || 'Shiprocket could not create the return shipment.', 422, data);
  }

  return normalizeShipmentPayload(shipmentPayload, {
    provider: 'shiprocket-return',
    pickupLocation: config.pickupLocation,
    currentStatus: shipmentPayload.pickup_generated ? 'Return pickup requested' : 'Return initiated',
    trackingStage: shipmentPayload.pickup_generated ? 'return-pickup-requested' : 'return-created',
    trackingEvents: [
      {
        date: new Date().toISOString(),
        status: 'RETURN_CREATED',
        activity: `Reverse shipment created for ${cleanString(item?.name || 'item')}.`,
        location: [cleanString(order.shippingAddress.city), normalizeState(order.shippingAddress.state)].filter(Boolean).join(', '),
        statusCode: 'return-created',
        statusLabel: 'RETURN CREATED',
      },
      ...(shipmentPayload.pickup_scheduled_date
        ? [
            {
              date: cleanString(shipmentPayload.pickup_scheduled_date),
              status: 'RETURN_PICKUP_REQUESTED',
              activity: 'Customer return pickup has been scheduled.',
              location: cleanString(order.shippingAddress.city),
              statusCode: 'return-pickup-requested',
              statusLabel: 'RETURN PICKUP REQUESTED',
            },
          ]
        : []),
    ],
    lastSyncedAt: new Date(),
    error: '',
    cod: false,
  });
};
