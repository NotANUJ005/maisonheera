import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeIndianRupee, LockKeyhole, MapPinHouse, Wallet } from 'lucide-react';
import { Button } from '../components/ui/Button';
import {
  addLocalAddress,
  createLocalOrder,
  EMPTY_ARRAY,
  isLocalDemoModeEnabled,
  isLocalSessionUser,
  jsonRequest,
  saveStoredUser,
  shouldUseLocalFallback,
} from '../utils/api';

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-js';

const buildBlankAddressForm = (userInfo) => ({
  addressLabel: '',
  fullName: userInfo?.name || '',
  email: userInfo?.email || '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  paymentMethod: 'razorpay',
  notes: '',
});

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });

const sanitizeShippingAddress = (address, fallbackUser) => ({
  label: address?.label || '',
  fullName: address?.fullName?.trim() || fallbackUser?.name || '',
  email: address?.email?.trim() || fallbackUser?.email || '',
  phone: address?.phone?.trim() || '',
  address: address?.address?.trim() || '',
  city: address?.city?.trim() || '',
  state: address?.state?.trim() || '',
  postalCode: address?.postalCode?.trim() || '',
  country: address?.country?.trim() || 'India',
});

const isShippingAddressComplete = (address) =>
  Boolean(
      address.fullName &&
      address.email &&
      address.phone &&
      address.address &&
      address.city &&
      address.state &&
      address.postalCode &&
      address.country,
  );

export const Checkout = ({
  cartItems,
  userInfo,
  setUserInfo,
  onOpenAccount,
  onNavigate,
  onOrderPlaced,
  notify,
}) => {
  const [formData, setFormData] = useState(() => buildBlankAddressForm(userInfo));
  const [addressMode, setAddressMode] = useState('new');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({
    provider: 'razorpay',
    enabled: false,
    keyId: null,
    currency: 'INR',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const savedAddresses = userInfo?.addresses || EMPTY_ARRAY;
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems],
  );
  const shipping = subtotal > 0 ? 0 : 0;
  const total = subtotal + shipping;

  const selectedSavedAddress = useMemo(() => {
    if (!savedAddresses.length) return null;

    return (
      savedAddresses.find((address) => address._id === selectedAddressId) ||
      savedAddresses.find((address) => address.isDefault) ||
      savedAddresses[0]
    );
  }, [savedAddresses, selectedAddressId]);

  const activeShippingAddress = useMemo(() => {
    if (addressMode === 'saved' && selectedSavedAddress) {
      return sanitizeShippingAddress(selectedSavedAddress, userInfo);
    }

    return sanitizeShippingAddress(formData, userInfo);
  }, [addressMode, formData, selectedSavedAddress, userInfo]);

  const orderItems = useMemo(
    () =>
      cartItems.map((item) => ({
        name: item.name,
        qty: item.quantity,
        image: item.image,
        price: item.price,
        product: item.id || item._id,
      })),
    [cartItems],
  );

  const buildOrderPayload = () => ({
    orderItems,
    totalPrice: total,
    userId: userInfo?._id,
    shippingAddress: activeShippingAddress,
    paymentMethod: formData.paymentMethod,
    notes: formData.notes,
  });

  useEffect(() => {
    const loadPaymentConfig = async () => {
      try {
        const response = await jsonRequest('/api/orders/payment/config');
        if (response.ok && response.data) {
          setPaymentConfig(response.data);
        }
      } catch {
        setPaymentConfig({
          provider: 'razorpay',
          enabled: false,
          keyId: null,
          currency: 'INR',
        });
      }
    };

    loadPaymentConfig();
  }, []);

  useEffect(() => {
    setFormData((prev) => {
      const nextFullName = prev.fullName || userInfo?.name || '';
      const nextEmail = prev.email || userInfo?.email || '';

      if (prev.fullName === nextFullName && prev.email === nextEmail) {
        return prev;
      }

      return {
        ...prev,
        fullName: nextFullName,
        email: nextEmail,
      };
    });
  }, [userInfo?.name, userInfo?.email]);

  useEffect(() => {
    if (savedAddresses.length) {
      const defaultAddress = savedAddresses.find((address) => address.isDefault) || savedAddresses[0];
      const hasSelectedAddress = savedAddresses.some((address) => address._id === selectedAddressId);

      if (!hasSelectedAddress) {
        setSelectedAddressId(defaultAddress._id);
        if (addressMode !== 'saved') {
          setAddressMode('saved');
        }
      }

      return;
    }

    if (selectedAddressId) {
      setSelectedAddressId('');
    }

    if (addressMode !== 'new') {
      setAddressMode('new');
    }
  }, [addressMode, savedAddresses, selectedAddressId]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const finalizeLocalOrder = (orderPayload) => {
    const localOrder = createLocalOrder(orderPayload);
    onOrderPlaced(localOrder);
    notify({
      title: 'Order saved locally',
      message: 'Checkout completed in demo mode while the payment gateway is unavailable.',
      tone: 'info',
    });
  };

  const persistAddressForFuture = async () => {
    if (!userInfo || addressMode !== 'new' || !saveNewAddress) {
      return;
    }

    const addressPayload = {
      label: formData.addressLabel?.trim() || `Address ${savedAddresses.length + 1}`,
      ...activeShippingAddress,
      isDefault: savedAddresses.length === 0,
    };

    if (isLocalSessionUser(userInfo)) {
      const nextUser = saveStoredUser(addLocalAddress(userInfo._id, addressPayload));
      setUserInfo(nextUser);
      notify({
        title: 'Address saved locally',
        message: 'The address was added to your local profile for future demo checkouts.',
        tone: 'info',
      });
      return;
    }

    try {
      const response = await jsonRequest('/api/users/addresses', {
        method: 'POST',
        body: JSON.stringify(addressPayload),
      });

      if (!response.ok) {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Could not save address');
        }

        throw new Error('Temporary server issue');
      }

      const nextUser = saveStoredUser(response.data);
      setUserInfo(nextUser);
      notify({
        title: 'Address saved',
        message: 'This delivery address is now available for future checkouts.',
        tone: 'success',
      });
    } catch (error) {
      if (isLocalDemoModeEnabled()) {
        try {
          const nextUser = saveStoredUser(addLocalAddress(userInfo._id, addressPayload));
          setUserInfo(nextUser);
          notify({
            title: 'Address saved locally',
            message: 'The address was added to your local profile for future demo checkouts.',
            tone: 'info',
          });
          return;
        } catch {
          // Fall through to the error notification below.
        }
      }

      notify({
        title: 'Address not saved',
        message:
          error.message || 'The order can continue, but we could not add this address to your profile.',
        tone: 'error',
      });
    }
  };

  const handleRazorpayCheckout = async (orderPayload) => {
    const createOrderResponse = await jsonRequest('/api/orders/payment/create-order', {
      method: 'POST',
      body: JSON.stringify({
        ...orderPayload,
      }),
    });

    if (!createOrderResponse.ok || !createOrderResponse.data?.id || !createOrderResponse.data?.checkoutToken) {
      throw new Error(createOrderResponse.data?.message || 'Unable to create payment order');
    }

    await loadRazorpayScript();

    await new Promise((resolve, reject) => {
      const razorpay = new window.Razorpay({
        key: paymentConfig.keyId,
        amount: createOrderResponse.data.amount,
        currency: createOrderResponse.data.currency,
        name: 'Maison Heera',
        description: 'Secure luxury checkout',
        order_id: createOrderResponse.data.id,
        image: 'https://checkout.razorpay.com/v1/checkout.js',
        prefill: {
          name: activeShippingAddress.fullName,
          email: activeShippingAddress.email,
          contact: activeShippingAddress.phone,
        },
        notes: {
          address: activeShippingAddress.address,
          city: activeShippingAddress.city,
        },
        theme: {
          color: '#1c1917',
        },
        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await jsonRequest('/api/orders/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                ...paymentResponse,
                checkoutToken: createOrderResponse.data.checkoutToken,
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error(verifyResponse.data?.message || 'Payment verification failed');
            }

            onOrderPlaced(verifyResponse.data);
            notify({
              title: 'Payment successful',
              message: 'Your Razorpay payment was verified and the order is confirmed.',
              tone: 'success',
            });
            resolve(true);
          } catch (verificationError) {
            reject(verificationError);
          }
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment was cancelled before completion'));
          },
        },
      });

      razorpay.on('payment.failed', (failure) => {
        reject(new Error(failure.error?.description || 'Payment failed'));
      });

      razorpay.open();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!cartItems.length) {
      setError('Your shopping bag is empty.');
      return;
    }

    if (!isShippingAddressComplete(activeShippingAddress)) {
      setError('Please select a complete delivery address before proceeding to payment.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const orderPayload = buildOrderPayload();

    try {
      await persistAddressForFuture();

      if (formData.paymentMethod === 'razorpay') {
        if (!paymentConfig.enabled || !paymentConfig.keyId) {
          throw new Error('Razorpay is not configured yet. Add the server keys to enable live checkout.');
        }

        await handleRazorpayCheckout(orderPayload);
        return;
      }

      const response = await jsonRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        if (!shouldUseLocalFallback(response.status)) {
          throw new Error(response.data?.message || 'Could not place order');
        }

        throw new Error('Temporary server issue');
      }

      onOrderPlaced(response.data);
      notify({
        title: 'Order confirmed',
        message: 'Your order has been placed successfully.',
        tone: 'success',
      });
    } catch (checkoutError) {
      const message = checkoutError?.message || '';
      const shouldFallbackToLocal =
        isLocalDemoModeEnabled() &&
        (/configured|network|sdk|unable|temporary|fetch/i.test(message) ||
          shouldUseLocalFallback(503, checkoutError));

      if (shouldFallbackToLocal && !/cancelled|failed/i.test(message)) {
        finalizeLocalOrder(orderPayload);
      } else {
        setError(checkoutError.message || 'Checkout failed');
        notify({
          title: 'Payment failed',
          message: checkoutError.message || 'Unable to complete the payment.',
          tone: 'error',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen"
    >
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-stone-400">Secure Checkout</p>
          <h1 className="mt-3 text-4xl font-serif text-stone-900 md:text-5xl">Complete your order</h1>
        </div>
        <Button variant="secondary" onClick={() => onNavigate({ view: 'shop' })}>
          Continue Shopping
        </Button>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-10">
          <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-6 border-b border-stone-100 pb-6">
              <div>
                <h2 className="text-2xl font-serif text-stone-900">Delivery details</h2>
                <p className="mt-2 text-sm text-stone-500">
                  {userInfo ? 'Orders are linked to your account for tracking, warranty, and aftercare.' : 'Checking out as a guest. You can create an account later to track this order.'}
                </p>
              </div>
              {!userInfo && (
                <Button variant="secondary" onClick={onOpenAccount}>
                  Sign In for Faster Checkout
                </Button>
              )}
            </div>

            {userInfo && savedAddresses.length > 0 && (
              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Choose a delivery address</p>
                    <p className="mt-1 text-sm text-stone-500">
                      Use a saved profile address or enter another one for this order.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant={addressMode === 'saved' ? 'primary' : 'secondary'}
                      onClick={() => setAddressMode('saved')}
                      className="px-5 py-2"
                    >
                      Saved address
                    </Button>
                    <Button
                      variant={addressMode === 'new' ? 'primary' : 'secondary'}
                      onClick={() => setAddressMode('new')}
                      className="px-5 py-2"
                    >
                      Use another
                    </Button>
                  </div>
                </div>

                {addressMode === 'saved' && (
                  <div className="mt-6 grid gap-4">
                    {savedAddresses.map((address) => {
                      const isActive = selectedSavedAddress?._id === address._id;

                      return (
                        <label
                          key={address._id}
                          className={`cursor-pointer rounded-[1.5rem] border p-5 transition ${
                            isActive
                              ? 'border-stone-900 bg-stone-950 text-white'
                              : 'border-stone-200 bg-stone-50 text-stone-900'
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedAddress"
                            value={address._id}
                            checked={isActive}
                            onChange={() => setSelectedAddressId(address._id)}
                            className="sr-only"
                          />
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <MapPinHouse size={18} className={isActive ? 'text-white' : 'text-stone-700'} />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold">{address.label || 'Saved address'}</p>
                                  {address.isDefault && (
                                    <span
                                      className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.25em] ${
                                        isActive ? 'bg-white/10 text-white/70' : 'bg-emerald-50 text-emerald-700'
                                      }`}
                                    >
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className={`mt-3 text-sm ${isActive ? 'text-white/75' : 'text-stone-600'}`}>
                                  {address.fullName}
                                </p>
                                <p className={`mt-1 text-sm ${isActive ? 'text-white/75' : 'text-stone-500'}`}>
                                  {address.address}
                                </p>
                                <p className={`text-sm ${isActive ? 'text-white/75' : 'text-stone-500'}`}>
                                  {address.city}, {address.state}, {address.postalCode}, {address.country}
                                </p>
                                {address.phone && (
                                  <p className={`mt-2 text-sm ${isActive ? 'text-white/70' : 'text-stone-500'}`}>
                                    {address.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {addressMode === 'new' && (
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <label className="block text-sm text-stone-600">
                  <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                    Address Label
                  </span>
                  <input
                    name="addressLabel"
                    type="text"
                    value={formData.addressLabel}
                    onChange={handleInputChange}
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                    placeholder="Home, Studio, Gifting..."
                  />
                </label>

                {[
                  { label: 'Full Name', name: 'fullName', type: 'text', required: true },
                  { label: 'Email', name: 'email', type: 'email', required: true },
                  { label: 'Phone', name: 'phone', type: 'text', required: true },
                  { label: 'Address', name: 'address', type: 'text', required: true, wide: true },
                  { label: 'City', name: 'city', type: 'text', required: true },
                  { label: 'State', name: 'state', type: 'text', required: true },
                  { label: 'Postal Code', name: 'postalCode', type: 'text', required: true },
                  { label: 'Country', name: 'country', type: 'text', required: true },
                ].map((field) => (
                  <label
                    key={field.name}
                    className={`block text-sm text-stone-600 ${field.wide ? 'md:col-span-2' : ''}`}
                  >
                    <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                      {field.label}
                    </span>
                    <input
                      name={field.name}
                      type={field.type}
                      value={formData[field.name]}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                      required={field.required}
                    />
                  </label>
                ))}

                {userInfo && (
                  <label className="md:col-span-2 flex items-center gap-3 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(event) => setSaveNewAddress(event.target.checked)}
                      className="h-4 w-4 accent-stone-900"
                    />
                    Save this address to my profile for future checkout
                  </label>
                )}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-serif text-stone-900">Payment and delivery</h2>
              <span
                className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em] ${
                  paymentConfig.enabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {paymentConfig.enabled ? 'Gateway Ready' : 'Gateway Setup Needed'}
              </span>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-1">
              {[
                {
                  id: 'razorpay',
                  label: 'Razorpay',
                  copy: paymentConfig.enabled
                    ? 'UPI, cards, netbanking, and wallets'
                    : 'Add Razorpay keys on the server to enable this',
                  icon: BadgeIndianRupee,
                },
                {
                  id: 'cod',
                  label: 'Cash on Delivery',
                  copy: 'Pay when the order reaches you. Tracking and shipment creation still begin immediately.',
                  icon: Wallet,
                },
              ].map((method) => {
                const Icon = method.icon;
                const active = formData.paymentMethod === method.id;

                return (
                  <label
                    key={method.id}
                    className={`cursor-pointer rounded-[1.5rem] border p-5 transition ${
                      active
                        ? 'border-stone-900 bg-stone-950 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={active}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <Icon size={18} />
                    <p className="mt-4 text-sm font-semibold">{method.label}</p>
                    <p className={`mt-2 text-sm ${active ? 'text-white/70' : 'text-stone-500'}`}>{method.copy}</p>
                  </label>
                );
              })}
            </div>

            <label className="mt-8 block text-sm text-stone-600">
              <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                Delivery Notes
              </span>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                className="w-full rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                placeholder="Share any concierge requests, gifting notes, or delivery instructions."
              />
            </label>
          </section>

          {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <Button type="submit" className="w-full py-4" disabled={isSubmitting}>
            {isSubmitting
              ? 'Processing...'
              : formData.paymentMethod === 'razorpay'
                ? 'Pay Securely with Razorpay'
                : 'Place Order'}
          </Button>
        </form>

        <aside className="h-fit rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-serif text-stone-900">Order summary</h2>
          <div className="mt-8 space-y-5">
            {cartItems.length ? (
              cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-20 w-16 rounded-2xl object-cover bg-stone-100"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg text-stone-900">{item.name}</p>
                    <p className="text-sm text-stone-500">Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-stone-900">
                    Rs. {(item.price * item.quantity).toLocaleString('en-IN')}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-stone-50 px-4 py-4 text-sm text-stone-500">
                Your bag is empty. Add a few pieces before checking out.
              </p>
            )}
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5 text-sm text-stone-600">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <MapPinHouse size={16} />
              <span>Delivery destination</span>
            </div>
            {isShippingAddressComplete(activeShippingAddress) ? (
              <div className="mt-3 space-y-1">
                <p className="text-stone-900">{activeShippingAddress.fullName}</p>
                <p>{activeShippingAddress.address}</p>
                <p>
                  {activeShippingAddress.city}, {activeShippingAddress.state}, {activeShippingAddress.postalCode},{' '}
                  {activeShippingAddress.country}
                </p>
                {activeShippingAddress.phone && <p>{activeShippingAddress.phone}</p>}
              </div>
            ) : (
              <p className="mt-2">Select a saved address or enter a new one to continue.</p>
            )}
          </div>

          <div className="mt-8 space-y-3 border-t border-stone-100 pt-6 text-sm">
            <div className="flex items-center justify-between text-stone-500">
              <span>Subtotal</span>
              <span>Rs. {subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-stone-500">
              <span>Insured Delivery</span>
              <span>{shipping === 0 ? 'Complimentary' : `Rs. ${shipping.toLocaleString('en-IN')}`}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-semibold text-stone-900">
              <span>Total</span>
              <span>Rs. {total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-stone-950 px-5 py-5 text-sm text-white">
            <p className="font-semibold">Maison assurance included</p>
            <p className="mt-2 text-white/70">
              Every order includes insured delivery, signature verification, and a certificate of authenticity.
            </p>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-5 text-sm text-stone-600">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <LockKeyhole size={16} />
              <span>Secure payment handling</span>
            </div>
            <p className="mt-2">
              Razorpay payments are verified on the server before confirmation, and COD orders are booked for shipment immediately after they are placed.
            </p>
          </div>
        </aside>
      </div>
    </motion.div>
  );
};
