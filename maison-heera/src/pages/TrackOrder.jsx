import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPinHouse, PackageCheck, ScanSearch, Truck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { lookupOrderTracking } from '../utils/api';

export const TrackOrder = ({ initialOrderId = '', userInfo, onNavigate, notify }) => {
  const [lookupValue, setLookupValue] = useState(initialOrderId || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  useEffect(() => {
    setLookupValue(initialOrderId || '');
  }, [initialOrderId]);

  useEffect(() => {
    if (!email && userInfo?.email) {
      setEmail(userInfo.email);
    }
  }, [email, userInfo?.email]);

  const loadTracking = async ({ silent = false } = {}) => {
    setIsLoading(true);
    setError('');

    try {
      const trackedOrder = await lookupOrderTracking({
        orderId: lookupValue,
        email,
        user: userInfo,
      });
      setOrder(trackedOrder);

      if (!silent) {
        notify?.({
          title: 'Tracking updated',
          message: 'The latest shipment details are now visible below.',
          tone: 'success',
        });
      }
    } catch (trackingError) {
      setOrder(null);
      setError(trackingError.message || 'We could not load tracking details right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialOrderId || isLoading) {
      return;
    }

    if (userInfo?._id || email.trim()) {
      loadTracking({ silent: true });
    }
  }, [initialOrderId, userInfo?._id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await loadTracking();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="pt-32 pb-24 px-6 md:px-12 max-w-6xl mx-auto min-h-screen"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-400">Post-purchase tracking</p>
          <h1 className="mt-3 text-4xl font-serif text-stone-900 md:text-5xl">Track Your Order</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-500">
            Use your Maison Heera order ID or AWB to follow the shipment timeline, courier assignment,
            and delivery progress in one place.
          </p>
        </div>
        <Button variant="secondary" onClick={() => onNavigate?.({ view: 'shop' })}>
          Continue Shopping
        </Button>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm"
        >
          <h2 className="text-2xl font-serif text-stone-900">Find a shipment</h2>
          <p className="mt-3 text-sm text-stone-500">
            Signed-in clients can track directly. For public lookup, add the email used at checkout.
          </p>

          <div className="mt-8 grid gap-5">
            <label className="block text-sm text-stone-600">
              <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                Order ID or AWB
              </span>
              <input
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                placeholder="Paste the full order ID or air waybill number"
                required
              />
            </label>

            {!userInfo && (
              <label className="block text-sm text-stone-600">
                <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                  Checkout Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                  placeholder="you@example.com"
                  required
                />
              </label>
            )}

            {error && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Refreshing Tracking...' : 'Track Order'}
            </Button>
          </div>
        </form>

        <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          {order ? (
            <div>
              <div className="flex flex-col gap-4 border-b border-stone-100 pb-6 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Tracking summary</p>
                  <h2 className="mt-3 text-2xl font-serif text-stone-900">{order.shipment?.currentStatus || 'Order confirmed'}</h2>
                  <p className="mt-3 text-sm text-stone-500">Order ID: {order._id}</p>
                </div>
                <div className="rounded-full bg-stone-100 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-stone-700">
                  {String(order.shipment?.trackingStage || 'order-confirmed').replace(/-/g, ' ')}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-center gap-2 text-stone-900">
                    <Truck size={16} />
                    <span className="text-sm font-semibold">Courier</span>
                  </div>
                  <p className="mt-3 text-sm text-stone-700">{order.shipment?.courierName || 'Awaiting courier assignment'}</p>
                  {order.shipment?.awbCode && (
                    <p className="mt-2 text-sm text-stone-500">AWB: {order.shipment.awbCode}</p>
                  )}
                  {order.shipment?.pickupScheduledDate && (
                    <p className="mt-2 text-sm text-stone-500">
                      Pickup: {new Date(order.shipment.pickupScheduledDate).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-center gap-2 text-stone-900">
                    <MapPinHouse size={16} />
                    <span className="text-sm font-semibold">Destination</span>
                  </div>
                  <p className="mt-3 text-sm text-stone-700">{order.shippingAddress?.fullName}</p>
                  <p className="mt-2 text-sm text-stone-500">{order.shippingAddress?.address}</p>
                  <p className="text-sm text-stone-500">
                    {order.shippingAddress?.city}, {order.shippingAddress?.state}, {order.shippingAddress?.postalCode}
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-center gap-2 text-stone-900">
                    <PackageCheck size={16} />
                    <span className="text-sm font-semibold">Order details</span>
                  </div>
                  <p className="mt-3 text-sm text-stone-700">
                    Total: Rs. {Number(order.totalPrice || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    Payment: {String(order.paymentMethod || 'prepaid').replace(/-/g, ' ')}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    Placed: {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="flex items-center gap-2 text-stone-900">
                    <ScanSearch size={16} />
                    <span className="text-sm font-semibold">Shipment notes</span>
                  </div>
                  <p className="mt-3 text-sm text-stone-700">
                    {order.shipment?.error
                      ? order.shipment.error
                      : 'Tracking is being kept current from the shipment provider.'}
                  </p>
                  {order.shipment?.pickupTokenNumber && (
                    <p className="mt-2 text-sm text-stone-500">
                      Pickup Ref: {order.shipment.pickupTokenNumber}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 rounded-[2rem] border border-stone-200 bg-stone-50 p-6">
                <h3 className="text-xl font-serif text-stone-900">Tracking timeline</h3>
                <div className="mt-6 space-y-4">
                  {(order.shipment?.trackingEvents || []).length ? (
                    order.shipment.trackingEvents.map((event, index) => (
                      <div
                        key={`${event.date}-${event.status}-${index}`}
                        className="rounded-[1.5rem] border border-stone-200 bg-white px-5 py-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-stone-900">
                              {event.statusLabel || event.activity || event.status}
                            </p>
                            {event.activity && (
                              <p className="mt-1 text-sm text-stone-500">{event.activity}</p>
                            )}
                          </div>
                          <div className="text-xs uppercase tracking-[0.2em] text-stone-400">
                            {event.date ? new Date(event.date).toLocaleString() : 'Pending'}
                          </div>
                        </div>
                        {event.location && (
                          <p className="mt-2 text-sm text-stone-500">{event.location}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">
                      Tracking events will appear here as the courier updates the shipment.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[24rem] items-center justify-center rounded-[1.5rem] bg-stone-50 px-6 text-center text-sm leading-7 text-stone-500">
              Enter your order details to see courier assignment, AWB status, pickup schedule, and the delivery timeline.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
