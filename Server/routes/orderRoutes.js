import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { buildAdminAnalytics } from '../utils/adminAnalytics.js';
import {
  cancelShiprocketShipment,
  createShiprocketReturnShipment,
  createShiprocketShipment,
  refreshShiprocketShipment,
} from '../utils/shiprocket.js';
import { protect, admin, optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

const getRazorpayCredentials = () => ({
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
});

const isRazorpayConfigured = () => {
  const { keyId, keySecret } = getRazorpayCredentials();
  return Boolean(keyId && keySecret);
};

const createRazorpayOrder = async ({ amount, currency, receipt, notes }) => {
  const { keyId, keySecret } = getRazorpayCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      notes,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.description || 'Failed to create Razorpay order');
  }

  return data;
};

const verifyRazorpaySignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const { keySecret } = getRazorpayCredentials();

  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  return generatedSignature === razorpaySignature;
};

const findOrderItemById = (order, itemId) =>
  order.orderItems.find((item) => String(item._id) === String(itemId));

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeString = (value, fallback = '') => String(value ?? fallback).trim();
const GUEST_USER_PREFIX = 'guest:';
const ORDER_DRAFT_EXPIRY = '30m';

const buildOrderRouteError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeShippingAddress = (shippingAddress = {}) => ({
  fullName: normalizeString(shippingAddress.fullName),
  email: normalizeEmail(shippingAddress.email),
  phone: normalizeString(shippingAddress.phone),
  address: normalizeString(shippingAddress.address),
  city: normalizeString(shippingAddress.city),
  state: normalizeString(shippingAddress.state),
  postalCode: normalizeString(shippingAddress.postalCode),
  country: normalizeString(shippingAddress.country || 'India'),
});

const validateShippingAddress = (shippingAddress) => {
  const requiredFields = ['fullName', 'email', 'phone', 'address', 'city', 'state', 'postalCode', 'country'];
  const missingFields = requiredFields.filter((field) => !normalizeString(shippingAddress[field]));

  if (missingFields.length) {
    throw buildOrderRouteError(`Delivery address is incomplete. Missing: ${missingFields.join(', ')}`, 400);
  }
};

const buildGuestUserId = () => `${GUEST_USER_PREFIX}${crypto.randomUUID()}`;

const createOrderDraftToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ORDER_DRAFT_EXPIRY,
  });

const verifyOrderDraftToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

const aggregateReservedQuantities = (orderItems = []) => {
  const quantities = new Map();

  orderItems.forEach((item) => {
    const productId = String(item.product || '').trim();
    if (!productId) {
      return;
    }

    const current = quantities.get(productId) || 0;
    quantities.set(productId, current + (Number(item.qty) || 0));
  });

  return quantities;
};

const releaseReservedInventory = async (reservations = []) => {
  if (!reservations.length) {
    return;
  }

  await Promise.all(
    reservations.map(({ productId, quantity }) =>
      Product.findByIdAndUpdate(productId, {
        $inc: { stockQuantity: quantity },
      }),
    ),
  );
};

const reserveInventoryForOrder = async (orderItems = []) => {
  const aggregatedReservations = aggregateReservedQuantities(orderItems);
  const completedReservations = [];

  try {
    for (const [productId, quantity] of aggregatedReservations.entries()) {
      const reservedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          stockQuantity: { $gte: quantity },
        },
        {
          $inc: { stockQuantity: -quantity },
        },
        { new: true },
      );

      if (!reservedProduct) {
        throw buildOrderRouteError('One or more pieces are now out of stock. Please refresh your bag and try again.', 409);
      }

      completedReservations.push({ productId, quantity });
    }

    return completedReservations;
  } catch (error) {
    await releaseReservedInventory(completedReservations);
    throw error;
  }
};

const buildCanonicalOrderPayload = async ({
  orderItems = [],
  shippingAddress,
  paymentMethod,
  notes,
  authenticatedUserId,
}) => {
  if (!Array.isArray(orderItems) || !orderItems.length) {
    throw buildOrderRouteError('Your bag is empty.', 400);
  }

  const normalizedShippingAddress = normalizeShippingAddress(shippingAddress);
  validateShippingAddress(normalizedShippingAddress);

  const normalizedItems = orderItems.map((item) => ({
    productId: String(item?.product || item?.id || '').trim(),
    qty: Number.parseInt(item?.qty, 10),
  }));

  if (normalizedItems.some((item) => !item.productId || !Number.isFinite(item.qty) || item.qty < 1)) {
    throw buildOrderRouteError('Each order item must include a valid product and quantity.', 400);
  }

  const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
  if (uniqueProductIds.some((productId) => !mongoose.Types.ObjectId.isValid(productId))) {
    throw buildOrderRouteError('One or more selected pieces are invalid.', 400);
  }

  const products = await Product.find({ _id: { $in: uniqueProductIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  if (productMap.size !== uniqueProductIds.length) {
    throw buildOrderRouteError('One or more selected pieces are no longer available.', 400);
  }

  const requestedQuantities = aggregateReservedQuantities(
    normalizedItems.map((item) => ({ product: item.productId, qty: item.qty })),
  );

  requestedQuantities.forEach((quantity, productId) => {
    const product = productMap.get(productId);
    if (!product || product.stockQuantity < quantity) {
      throw buildOrderRouteError(`${product?.name || 'A selected piece'} does not have enough remaining stock.`, 409);
    }
  });

  const canonicalOrderItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);

    return {
      name: product.name,
      qty: item.qty,
      image: product.image,
      price: Number(product.price),
      product: String(product._id),
    };
  });

  return {
    user: authenticatedUserId || buildGuestUserId(),
    orderItems: canonicalOrderItems,
    shippingAddress: normalizedShippingAddress,
    paymentMethod: normalizeString(paymentMethod || 'offline').toLowerCase(),
    notes: normalizeString(notes),
    totalPrice: canonicalOrderItems.reduce((sum, item) => sum + item.price * item.qty, 0),
  };
};

const buildShipmentErrorState = (order, message) => ({
  provider: 'shiprocket',
  shiprocketOrderId: '',
  shipmentId: '',
  awbCode: '',
  courierCompanyId: undefined,
  courierName: '',
  pickupLocation: '',
  pickupTokenNumber: '',
  pickupScheduledDate: '',
  labelUrl: '',
  manifestUrl: '',
  currentStatus: 'Shipment booking pending',
  trackingStage: 'creation-failed',
  trackingEvents: [
    {
      date: new Date().toISOString(),
      status: 'SHIPMENT_PENDING',
      activity: message,
      location: '',
      statusCode: 'shipment-pending',
      statusLabel: 'SHIPMENT PENDING',
    },
  ],
  lastSyncedAt: new Date(),
  error: message,
  cod: String(order?.paymentMethod || '').toLowerCase() === 'cod',
});

const attachShipmentToOrder = async (order) => {
  try {
    const shipment = await createShiprocketShipment(order.toObject());
    order.shipment = shipment;
  } catch (error) {
    order.shipment = buildShipmentErrorState(order, error.message || 'Shipment could not be created.');
  }

  await order.save();
  return order;
};

const refreshOrderShipment = async (order) => {
  if (!order?.shipment?.provider) {
    return order;
  }

  try {
    order.shipment = await refreshShiprocketShipment(order.shipment);

    if (order.shipment?.trackingStage === 'delivered' && order.orderStatus !== 'returned') {
      order.orderStatus = 'delivered';
    }
  } catch (error) {
    const currentShipment =
      typeof order.shipment?.toObject === 'function' ? order.shipment.toObject() : { ...(order.shipment || {}) };
    order.shipment = {
      ...currentShipment,
      lastSyncedAt: new Date(),
      error: error.message || 'Tracking refresh failed.',
    };
  }

  await order.save();
  return order;
};

const findTrackableOrder = async (lookupValue) => {
  const normalized = String(lookupValue || '').trim();

  if (!normalized) {
    return null;
  }

  if (/^[a-f\d]{24}$/i.test(normalized)) {
    const byId = await Order.findById(normalized);
    if (byId) {
      return byId;
    }
  }

  return Order.findOne({
    $or: [
      { 'shipment.awbCode': normalized },
      { 'shipment.shiprocketOrderId': normalized },
    ],
  });
};

const hasTrackingAccess = (order, { userId, email }) => {
  if (userId && String(order.user) === String(userId)) {
    return true;
  }

  if (email && normalizeEmail(order.shippingAddress?.email) === normalizeEmail(email)) {
    return true;
  }

  return false;
};

const buildManualShipmentEvent = ({ status, activity, location = '', statusCode, statusLabel }) => ({
  date: new Date().toISOString(),
  status,
  activity,
  location,
  statusCode,
  statusLabel,
});

const prependShipmentEvent = (shipment, event) => [event, ...(Array.isArray(shipment?.trackingEvents) ? shipment.trackingEvents : [])];

const buildReturnShipmentErrorState = (item, message) => ({
  provider: 'shiprocket-return',
  shiprocketOrderId: '',
  shipmentId: '',
  awbCode: '',
  courierCompanyId: undefined,
  courierName: '',
  pickupLocation: '',
  pickupTokenNumber: '',
  pickupScheduledDate: '',
  labelUrl: '',
  manifestUrl: '',
  currentStatus: 'Return shipment pending',
  trackingStage: 'return-creation-failed',
  trackingEvents: [
    {
      date: new Date().toISOString(),
      status: 'RETURN_PENDING',
      activity: message,
      location: '',
      statusCode: 'return-pending',
      statusLabel: 'RETURN PENDING',
    },
  ],
  lastSyncedAt: new Date(),
  error: message,
  cod: false,
});

router.get('/payment/config', (req, res) => {
  const { keyId } = getRazorpayCredentials();

  res.json({
    provider: 'razorpay',
    enabled: isRazorpayConfigured(),
    keyId: keyId || null,
    currency: 'INR',
  });
});

router.get('/admin/analytics', protect, admin, async (req, res) => {
  try {
    const periodKey = typeof req.query.period === 'string' ? req.query.period : undefined;
    const rangeAmount = typeof req.query.rangeAmount === 'string' ? req.query.rangeAmount : undefined;
    const rangeUnit = typeof req.query.rangeUnit === 'string' ? req.query.rangeUnit : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const material = typeof req.query.material === 'string' ? req.query.material : undefined;
    const [products, orders] = await Promise.all([
      Product.find({}).lean(),
      Order.find({}).lean(),
    ]);

    return res.json(buildAdminAnalytics({ products, orders, periodKey, rangeAmount, rangeUnit, filters: { category, material } }));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/payment/create-order', optionalProtect, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({ message: 'Razorpay credentials are not configured on the server' });
    }

    const canonicalOrder = await buildCanonicalOrderPayload({
      orderItems: req.body?.orderItems,
      shippingAddress: req.body?.shippingAddress,
      paymentMethod: 'razorpay',
      notes: req.body?.notes,
      authenticatedUserId: req.userId,
    });

    const razorpayOrder = await createRazorpayOrder({
      amount: Math.round(Number(canonicalOrder.totalPrice) * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        customer: canonicalOrder.shippingAddress.fullName,
        email: canonicalOrder.shippingAddress.email,
      },
    });

    const checkoutToken = createOrderDraftToken({
      ...canonicalOrder,
      razorpayOrderId: razorpayOrder.id,
    });

    return res.status(201).json({
      ...razorpayOrder,
      checkoutToken,
      totalPrice: canonicalOrder.totalPrice,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/payment/verify', optionalProtect, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({ message: 'Razorpay credentials are not configured on the server' });
    }

    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      checkoutToken,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !checkoutToken) {
      return res.status(400).json({ message: 'Missing Razorpay payment details' });
    }

    const isValidSignature = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValidSignature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    const canonicalOrder = verifyOrderDraftToken(checkoutToken);
    if (canonicalOrder.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ message: 'Checkout session does not match this Razorpay order.' });
    }

    const reservations = await reserveInventoryForOrder(canonicalOrder.orderItems);

    let createdOrder = null;

    try {
      const order = new Order({
        orderItems: canonicalOrder.orderItems,
        user: req.userId || canonicalOrder.user,
        totalPrice: canonicalOrder.totalPrice,
        shippingAddress: canonicalOrder.shippingAddress,
        paymentMethod: 'razorpay',
        notes: canonicalOrder.notes || '',
        paymentResult: {
          provider: 'razorpay',
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
          status: 'captured',
        },
        isPaid: true,
        paidAt: new Date(),
        orderStatus: 'paid',
      });

      createdOrder = await order.save();
      await attachShipmentToOrder(createdOrder);
      return res.status(201).json(createdOrder);
    } catch (error) {
      await releaseReservedInventory(reservations);
      throw error;
    }
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/', optionalProtect, async (req, res) => {
  try {
    const canonicalOrder = await buildCanonicalOrderPayload({
      orderItems: req.body?.orderItems,
      shippingAddress: req.body?.shippingAddress,
      paymentMethod: req.body?.paymentMethod,
      notes: req.body?.notes,
      authenticatedUserId: req.userId,
    });
    const reservations = await reserveInventoryForOrder(canonicalOrder.orderItems);

    try {
      const order = new Order({
        orderItems: canonicalOrder.orderItems,
        user: canonicalOrder.user,
        totalPrice: canonicalOrder.totalPrice,
        shippingAddress: canonicalOrder.shippingAddress,
        paymentMethod: canonicalOrder.paymentMethod || 'offline',
        notes: canonicalOrder.notes || '',
        paymentResult: null,
        isPaid: false,
        paidAt: null,
        orderStatus: canonicalOrder.paymentMethod === 'cod' ? 'confirmed' : 'created',
      });

      const createdOrder = await order.save();
      await attachShipmentToOrder(createdOrder);
      return res.status(201).json(createdOrder);
    } catch (error) {
      await releaseReservedInventory(reservations);
      throw error;
    }
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/tracking/lookup', optionalProtect, async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (!orderId?.trim()) {
      return res.status(400).json({ message: 'Order ID or AWB is required.' });
    }

    if (!req.userId && !email?.trim()) {
      return res.status(400).json({ message: 'Email is required for public tracking lookup.' });
    }

    const order = await findTrackableOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (!hasTrackingAccess(order, { userId: req.userId, email })) {
      return res.status(403).json({ message: 'You do not have access to track this order.' });
    }

    await refreshOrderShipment(order);
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/admin/shipments', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/admin/:orderId/shipment/refresh', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await refreshOrderShipment(order);
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/admin/:orderId/shipment/cancel', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.shipment?.awbCode) {
      return res.status(400).json({ message: 'This order does not have an active shipment to cancel.' });
    }

    const cancelledShipment = await cancelShiprocketShipment(
      typeof order.shipment.toObject === 'function' ? order.shipment.toObject() : order.shipment,
    );
    const destination = [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ');

    order.shipment = {
      ...cancelledShipment,
      trackingEvents: prependShipmentEvent(
        cancelledShipment,
        buildManualShipmentEvent({
          status: 'SHIPMENT_CANCELLED',
          activity: 'Shipment cancelled by admin before courier pickup.',
          location: destination,
          statusCode: 'cancelled',
          statusLabel: 'SHIPMENT CANCELLED',
        }),
      ),
      lastSyncedAt: new Date(),
      error: '',
    };
    order.orderStatus = 'shipment-cancelled';
    await order.save();

    return res.json(order);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/admin/:orderId/shipment/mark-delivered', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentShipment =
      typeof order.shipment?.toObject === 'function' ? order.shipment.toObject() : { ...(order.shipment || {}) };
    const destination = [order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ');

    order.shipment = {
      ...currentShipment,
      provider: currentShipment.provider || 'manual-admin',
      currentStatus: 'Delivered',
      trackingStage: 'delivered',
      trackingEvents: prependShipmentEvent(
        currentShipment,
        buildManualShipmentEvent({
          status: 'DELIVERED',
          activity: 'Delivery manually confirmed by admin.',
          location: destination,
          statusCode: 'delivered',
          statusLabel: 'DELIVERED',
        }),
      ),
      lastSyncedAt: new Date(),
      error: '',
    };
    order.isPaid = order.isPaid || String(order.paymentMethod).toLowerCase() === 'cod';
    order.paidAt = order.paidAt || new Date();
    order.orderStatus = 'delivered';
    await order.save();

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/admin/:orderId/items/:itemId/return-shipment', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const item = findOrderItemById(order, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    try {
      item.returnShipment = await createShiprocketReturnShipment(order.toObject(), item.toObject ? item.toObject() : item);
      item.returnStatus = 'pickup-scheduled';
    } catch (error) {
      item.returnShipment = buildReturnShipmentErrorState(item, error.message || 'Return shipment could not be created.');
      item.returnStatus = 'requested';
    }

    item.returnRequestedAt = item.returnRequestedAt || new Date();
    order.orderStatus = 'return-requested';
    order.markModified('orderItems');
    await order.save();

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:orderId/tracking', optionalProtect, async (req, res) => {
  try {
    const order = await findTrackableOrder(req.params.orderId);
    const { email } = req.query;

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (!hasTrackingAccess(order, { userId: req.userId, email })) {
      return res.status(403).json({ message: 'You do not have access to track this order.' });
    }

    await refreshOrderShipment(order);
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/:orderId/items/:itemId/feedback', protect, async (req, res) => {
  try {
    const { rating, comment = '' } = req.body;

    const normalizedRating = Number(rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: 'A rating between 1 and 5 is required' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (String(order.user) !== String(req.userId)) {
      return res.status(403).json({ message: 'You can only review your own orders' });
    }

    const item = findOrderItemById(order, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    const previousFeedback = item.feedback;
    const wasUpdating = Boolean(previousFeedback);
    const previousRating = wasUpdating ? previousFeedback.rating : 0;

    item.feedback = {
      rating: normalizedRating,
      comment: String(comment || '').trim(),
      submittedAt: new Date(),
    };

    const product = await Product.findById(item.product || item.id);
    if (product) {
      const currentRating = product.rating || 0;
      const currentCount = product.ratingCount || 0;
      let newCount, newTotal;
      if (wasUpdating) {
        newCount = currentCount === 0 ? 1 : currentCount;
        newTotal = (currentRating * currentCount) - previousRating + normalizedRating;
      } else {
        newCount = currentCount + 1;
        newTotal = (currentRating * currentCount) + normalizedRating;
      }
      product.ratingCount = newCount;
      product.rating = Number((newTotal / newCount).toFixed(1));
      await product.save();
    }

    order.markModified('orderItems');
    const updatedOrder = await order.save();
    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/:orderId/items/:itemId/return', protect, async (req, res) => {
  try {
    const { reason = '' } = req.body;

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (String(order.user) !== String(req.userId)) {
      return res.status(403).json({ message: 'You can only request returns for your own orders' });
    }

    const item = findOrderItemById(order, req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Order item not found' });
    }

    if (item.returnStatus === 'requested' || item.returnStatus === 'returned') {
      return res.status(400).json({ message: 'A return has already been opened for this item' });
    }

    item.returnStatus = 'requested';
    item.returnReason = String(reason || '').trim();
    item.returnRequestedAt = new Date();

    if (order.orderStatus !== 'returned') {
      order.orderStatus = 'return-requested';
    }

    order.markModified('orderItems');
    const updatedOrder = await order.save();
    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/myorders/:id', protect, async (req, res) => {
  try {
    if (req.params.id !== req.userId && !req.user?.isAdmin) {
      return res.status(403).json({ message: 'You can only access your own orders' });
    }

    const orders = await Order.find({ user: req.params.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
