import mongoose from 'mongoose';

const shipmentEventSchema = new mongoose.Schema(
  {
    date: String,
    status: String,
    activity: String,
    location: String,
    statusCode: String,
    statusLabel: String,
  },
  { _id: false },
);

const shipmentSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: '',
    },
    shiprocketOrderId: String,
    shipmentId: String,
    awbCode: String,
    courierCompanyId: Number,
    courierName: String,
    pickupLocation: String,
    pickupTokenNumber: String,
    pickupScheduledDate: String,
    labelUrl: String,
    manifestUrl: String,
    currentStatus: String,
    trackingStage: String,
    trackingEvents: [shipmentEventSchema],
    lastSyncedAt: Date,
    error: String,
    cod: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
    },
    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: {
          type: String,
          required: true,
        },
        feedback: {
          rating: { type: Number, min: 1, max: 5 },
          comment: { type: String, default: '' },
          submittedAt: Date,
        },
        returnStatus: {
          type: String,
          default: 'none',
        },
        returnReason: {
          type: String,
          default: '',
        },
        returnRequestedAt: Date,
        returnedAt: Date,
        returnShipment: shipmentSchema,
      },
    ],
    shippingAddress: {
      fullName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    paymentMethod: {
      type: String,
      default: 'offline',
    },
    paymentResult: {
      provider: String,
      orderId: String,
      paymentId: String,
      signature: String,
      status: String,
    },
    notes: {
      type: String,
      default: '',
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    orderStatus: {
      type: String,
      default: 'created',
    },
    shipment: shipmentSchema,
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
