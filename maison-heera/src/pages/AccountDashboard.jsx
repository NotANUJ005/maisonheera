import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import {
  addLocalAddress,
  deleteLocalAddress,
  getPendingFeedbackItems,
  isLocalSessionUser,
  jsonRequest,
  requestOrderItemReturn,
  saveStoredUser,
  setLocalDefaultAddress,
  submitOrderItemFeedback,
  shouldUseLocalFallback,
  updateLocalProfile,
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
} from '../utils/api';
import { Button } from '../components/ui/Button';

const buildEmptyAddressForm = (userInfo) => ({
  label: '',
  fullName: userInfo?.name || '',
  email: userInfo?.email || '',
  phone: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  isDefault: false,
});

export const AccountDashboard = ({
  activeTab,
  setActiveTab,
  wishlistItems,
  toggleWishlist,
  userInfo,
  setUserInfo,
  notify,
  onViewDetail,
  onNavigate,
  orders = [],
  refreshOrders,
  userOrders,
  refreshUserOrders,
}) => {
  const resolvedOrders = orders.length ? orders : userOrders || [];
  const resolvedRefreshOrders = refreshOrders || refreshUserOrders;
  const [addressForm, setAddressForm] = useState(() => buildEmptyAddressForm(userInfo));
  const [editAddressId, setEditAddressId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: userInfo?.name || '',
    email: userInfo?.email || '',
    mobileNumber: userInfo?.mobileNumber || '',
    currentPassword: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [returnDrafts, setReturnDrafts] = useState({});
  const [feedbackLoadingKey, setFeedbackLoadingKey] = useState('');
  const [returnLoadingKey, setReturnLoadingKey] = useState('');
  const [qrCodeData, setQrCodeData] = useState(null);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  useEffect(() => {
    setProfileForm({
      name: userInfo?.name || '',
      email: userInfo?.email || '',
      mobileNumber: userInfo?.mobileNumber || '',
      currentPassword: '',
      password: '',
    });
  }, [userInfo?.email, userInfo?.name]);

  useEffect(() => {
    setAddressForm((prev) => ({
      ...prev,
      fullName: prev.fullName || userInfo?.name || '',
      email: prev.email || userInfo?.email || '',
    }));
  }, [userInfo?.email, userInfo?.name]);

  const tabs = [
    { id: 'orders', label: 'Order History' },
    { id: 'wishlist', label: 'Wishlist' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'details', label: 'Account Details' },
  ];

  if (!userInfo) {
    return (
      <div className="pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto min-h-screen">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-4xl font-serif text-stone-900">Sign in to access your account</h1>
          <p className="mt-4 text-stone-500">
            Your orders, saved pieces, and concierge requests will appear here once you log in.
          </p>
        </div>
      </div>
    );
  }

  const handleAddressChange = (event) => {
    const { name, value, type, checked } = event.target;
    setAddressForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setAddressError('');
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setProfileError('');
  };

  const handleEditAddress = (address) => {
    setEditAddressId(address._id);
    setAddressForm(address);
  };

  const handleAddressSave = async (event) => {
    event.preventDefault();
    setAddressLoading(true);
    setAddressError('');

    try {
      const endpoint = editAddressId ? `/api/users/addresses/${editAddressId}` : '/api/users/addresses';
      const method = editAddressId ? 'PUT' : 'POST';

      const response = await jsonRequest(endpoint, {
        method,
        body: JSON.stringify(addressForm),
      });

      if (!response.ok) {
        throw new Error(response.data?.message || 'Could not save address');
      }

      const nextUser = saveStoredUser(response.data);
      setUserInfo(nextUser);
      setAddressForm(buildEmptyAddressForm(nextUser));
      setEditAddressId(null);
      notify({
        title: 'Address saved',
        message: 'Your address book has been updated.',
        tone: 'success',
      });
    } catch (error) {
      setAddressError(error.message);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      const response = await jsonRequest(`/api/users/addresses/${addressId}/default`, {
        method: 'PUT',
      });

      if (!response.ok) {
        throw new Error(response.data?.message || 'Could not set default address');
      }

      const nextUser = saveStoredUser(response.data);
      setUserInfo(nextUser);
    } catch (error) {
      notify({
        title: 'Error setting default',
        message: error.message,
        tone: 'error',
      });
    }
  };

  const handleDeleteAddress = async (addressId) => {
    try {
      const response = await jsonRequest(`/api/users/addresses/${addressId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(response.data?.message || 'Could not delete address');
      }

      const nextUser = saveStoredUser(response.data);
      setUserInfo(nextUser);
      notify({
        title: 'Address removed',
        message: 'Your saved address has been deleted.',
        tone: 'info',
      });
    } catch (error) {
      notify({
        title: 'Error deleting address',
        message: error.message,
        tone: 'error',
      });
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setProfileLoading(true);
    setProfileError('');

    const payload = {
      name: profileForm.name,
      email: profileForm.email,
      mobileNumber: profileForm.mobileNumber,
      currentPassword: profileForm.currentPassword,
      password: profileForm.password,
    };

    try {
      const response = await jsonRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(response.data?.message || 'Could not update profile');
      }

      const nextUser = saveStoredUser(response.data);
      setUserInfo(nextUser);
      setProfileForm((prev) => ({ ...prev, currentPassword: '', password: '' }));
      notify({
        title: 'Profile updated',
        message: 'Your account details have been updated.',
        tone: 'success',
      });
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    try {
      setTwoFactorLoading(true);
      const res = await setupTwoFactor();
      setQrCodeData(res.qrCodeUrl);
    } catch (err) {
      notify({ title: 'Error', message: err.message, tone: 'error' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFactorToken) return;
    try {
      setTwoFactorLoading(true);
      const user = await verifyTwoFactor(twoFactorToken);
      setUserInfo(user);
      setQrCodeData(null);
      setTwoFactorToken('');
      notify({ title: 'Success', message: 'Authenticator App enabled.', tone: 'success' });
    } catch (err) {
      notify({ title: 'Error', message: err.message, tone: 'error' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      setTwoFactorLoading(true);
      const user = await disableTwoFactor();
      setUserInfo(user);
      notify({ title: 'Disabled', message: 'Authenticator App disabled.', tone: 'info' });
    } catch (err) {
      notify({ title: 'Error', message: err.message, tone: 'error' });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const buildItemKey = (orderId, itemId) => `${orderId}:${itemId}`;

  const pendingFeedbackCount = getPendingFeedbackItems(resolvedOrders).length;

  const handleFeedbackDraftChange = (orderId, itemId, field, value) => {
    const key = buildItemKey(orderId, itemId);
    setFeedbackDrafts((prev) => ({
      ...prev,
      [key]: {
        rating: prev[key]?.rating || '5',
        comment: prev[key]?.comment || '',
        [field]: value,
      },
    }));
  };

  const handleReturnDraftChange = (orderId, itemId, value) => {
    const key = buildItemKey(orderId, itemId);
    setReturnDrafts((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFeedbackSubmit = async (orderId, item) => {
    const key = buildItemKey(orderId, item._id);
    const draft = feedbackDrafts[key] || { rating: '5', comment: '' };
    const rating = Number(draft.rating);

    if (!rating || rating < 1 || rating > 5) {
      notify({
        title: 'Rating required',
        message: 'Choose a rating between 1 and 5 before saving feedback.',
        tone: 'error',
      });
      return;
    }

    setFeedbackLoadingKey(key);

    try {
      await submitOrderItemFeedback({
        user: userInfo,
        orderId,
        itemId: item._id,
        rating,
        comment: draft.comment || '',
      });

      await resolvedRefreshOrders?.();
      setFeedbackDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      notify({
        title: item.feedback?.rating ? 'Feedback updated' : 'Feedback saved',
        message: `Thanks for reviewing ${item.name}.`,
        tone: 'success',
      });
    } catch (error) {
      notify({
        title: 'Feedback not saved',
        message: error.message || 'We could not save your feedback right now.',
        tone: 'error',
      });
    } finally {
      setFeedbackLoadingKey('');
    }
  };

  const handleReturnSubmit = async (orderId, item) => {
    const key = buildItemKey(orderId, item._id);
    setReturnLoadingKey(key);

    try {
      await requestOrderItemReturn({
        user: userInfo,
        orderId,
        itemId: item._id,
        reason: returnDrafts[key] || '',
      });

      await resolvedRefreshOrders?.();
      setReturnDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      notify({
        title: 'Return requested',
        message: `${item.name} is now marked for return review.`,
        tone: 'info',
      });
    } catch (error) {
      notify({
        title: 'Return request failed',
        message: error.message || 'We could not open a return for this item right now.',
        tone: 'error',
      });
    } finally {
      setReturnLoadingKey('');
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4">My Account</h1>
        <p className="text-stone-500 text-sm tracking-widest uppercase">Welcome back, {userInfo.name}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-12 md:gap-24">
        <aside className="md:w-64 shrink-0">
          <nav className="flex flex-col gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  window.localStorage.setItem('maison-heera.account-tab', tab.id);
                }}
                className={`text-left text-xs uppercase tracking-widest font-semibold transition-colors ${
                  activeTab === tab.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'orders' && (
              <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-2xl font-serif mb-6 border-b border-stone-200 pb-4">Order History</h2>
                {pendingFeedbackCount > 0 && (
                  <div className="mb-6 rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
                    {pendingFeedbackCount === 1
                      ? 'One recently purchased piece is waiting for your feedback.'
                      : `${pendingFeedbackCount} recently purchased pieces are waiting for your feedback.`}
                  </div>
                )}
                {resolvedOrders.length > 0 ? (
                  <div className="space-y-6">
                    {resolvedOrders.map((order) => (
                      <div key={order._id} className="border border-stone-200 p-6 flex flex-col gap-4 rounded-[2rem] bg-white shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs tracking-widest uppercase text-stone-500">
                              Order ID: {order._id}
                            </span>
                            {order.shipment?.currentStatus && (
                              <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">
                                Shipment: {order.shipment.currentStatus}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <span className="text-xs tracking-widest uppercase text-stone-900 font-semibold text-right">
                              Rs. {Number(order.totalPrice || 0).toLocaleString('en-IN')}
                            </span>
                            <Button
                              variant="secondary"
                              className="px-4 py-2"
                              onClick={() => onNavigate?.({ view: 'track-order', orderId: order._id })}
                            >
                              Track Order
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-stone-400">
                          <span>Placed on: {new Date(order.createdAt).toLocaleDateString()}</span>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                            Status: {String(order.orderStatus || 'created').replace(/-/g, ' ')}
                          </span>
                          {order.shipment?.awbCode && (
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                              AWB: {order.shipment.awbCode}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {order.orderItems.map((item, index) => {
                            const itemKey = buildItemKey(order._id, item._id || `${index}`);
                            const feedbackDraft = feedbackDrafts[itemKey] || {
                              rating: String(item.feedback?.rating || 5),
                              comment: item.feedback?.comment || '',
                            };
                            const isReturnOpen = item.returnStatus === 'requested' || item.returnStatus === 'returned';

                            return (
                              <div key={`${order._id}-${item._id || index}`} className="rounded-[1.75rem] border border-stone-100 bg-stone-50 p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="flex gap-4 items-start">
                                    <img src={item.image} alt={item.name} className="w-20 h-24 object-cover bg-stone-100 rounded-2xl" />
                                    <div>
                                      <button type="button" onClick={() => onViewDetail({ id: item.product, name: item.name })} className="text-left">
                                        <h4 className="font-serif text-lg text-stone-900 hover:text-stone-600 transition-colors">{item.name}</h4>
                                      </button>
                                      <p className="text-stone-500 text-xs mt-1">
                                        Qty: {item.qty} x Rs. {Number(item.price || 0).toLocaleString('en-IN')}
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em]">
                                        {item.feedback?.rating ? (
                                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                                            Rated {item.feedback.rating}/5
                                          </span>
                                        ) : (
                                          <span className="rounded-full bg-stone-200 px-3 py-1 text-stone-700">
                                            Feedback pending
                                          </span>
                                        )}
                                        <span className={`rounded-full px-3 py-1 ${isReturnOpen ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-700'}`}>
                                          Return: {item.returnStatus === 'none' ? 'available' : item.returnStatus}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid gap-4 lg:w-[26rem]">
                                    <div className="rounded-[1.5rem] bg-white p-4">
                                      <div className="flex items-center justify-between gap-4">
                                        <h5 className="font-medium text-stone-900">Product Feedback</h5>
                                        {item.feedback?.submittedAt && (
                                          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">
                                            {new Date(item.feedback.submittedAt).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-4 grid gap-3">
                                        <select
                                          value={feedbackDraft.rating}
                                          onChange={(event) => handleFeedbackDraftChange(order._id, item._id, 'rating', event.target.value)}
                                          className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-900"
                                        >
                                          {[5, 4, 3, 2, 1].map((rating) => (
                                            <option key={rating} value={rating}>
                                              {rating} Stars
                                            </option>
                                          ))}
                                        </select>
                                        <textarea
                                          value={feedbackDraft.comment}
                                          onChange={(event) => handleFeedbackDraftChange(order._id, item._id, 'comment', event.target.value)}
                                          rows={3}
                                          placeholder="Share how the piece felt, looked, and arrived."
                                          className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-900"
                                        />
                                        <Button
                                          className="w-full"
                                          onClick={() => handleFeedbackSubmit(order._id, item)}
                                          disabled={feedbackLoadingKey === itemKey}
                                        >
                                          {feedbackLoadingKey === itemKey
                                            ? 'Saving Feedback...'
                                            : item.feedback?.rating
                                              ? 'Update Feedback'
                                              : 'Submit Feedback'}
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="rounded-[1.5rem] bg-white p-4">
                                      <div className="flex items-center justify-between gap-4">
                                        <h5 className="font-medium text-stone-900">Return Item</h5>
                                        {item.returnRequestedAt && (
                                          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">
                                            Requested {new Date(item.returnRequestedAt).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                      {item.returnStatus === 'none' ? (
                                        <div className="mt-4 grid gap-3">
                                          <textarea
                                            value={returnDrafts[itemKey] || ''}
                                            onChange={(event) => handleReturnDraftChange(order._id, item._id, event.target.value)}
                                            rows={3}
                                            placeholder="Optional: tell us why you want to return this item."
                                            className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-stone-900"
                                          />
                                          <Button
                                            variant="secondary"
                                            className="w-full"
                                            onClick={() => handleReturnSubmit(order._id, item)}
                                            disabled={returnLoadingKey === itemKey}
                                          >
                                            {returnLoadingKey === itemKey ? 'Requesting Return...' : 'Request Return'}
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4 text-sm text-stone-600">
                                          <p className="font-medium text-stone-900">
                                            {item.returnStatus === 'requested'
                                              ? 'Return request submitted'
                                              : 'This item has been returned'}
                                          </p>
                                          {item.returnReason && <p className="mt-2 text-stone-500">Reason: {item.returnReason}</p>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-stone-500 bg-stone-50 border border-stone-100 rounded-[2rem]">
                    <p>You have not placed any orders yet.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'wishlist' && (
              <motion.div key="wishlist" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-2xl font-serif mb-6 border-b border-stone-200 pb-4">Wishlist</h2>
                {wishlistItems.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wishlistItems.map((product) => (
                      <div key={product.id} className="relative aspect-[4/5] bg-stone-100 group overflow-hidden rounded-[2rem]">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                          <button
                            type="button"
                            onClick={() => onViewDetail(product)}
                            className="mb-3 bg-stone-900 text-white px-6 py-2 uppercase text-xs tracking-widest hover:bg-stone-800 transition-colors rounded-full"
                          >
                            View Piece
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleWishlist(product)}
                            className="bg-white text-stone-900 px-6 py-2 uppercase text-xs tracking-widest hover:bg-stone-100 transition-colors rounded-full"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="absolute bottom-4 left-4 text-white drop-shadow-md">
                          <button type="button" onClick={() => onViewDetail(product)} className="text-left">
                            <h5 className="font-serif text-lg">{product.name}</h5>
                          </button>
                          <p className="text-sm">Rs. {product.price.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-stone-500 bg-stone-50 border border-stone-100 rounded-[2rem]">
                    <p>Your wishlist is empty.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'addresses' && (
              <motion.div key="addresses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-2xl font-serif mb-6 border-b border-stone-200 pb-4">Saved Addresses</h2>
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    {userInfo.addresses?.length ? (
                      userInfo.addresses.map((address) => (
                        editAddressId === address._id ? (
                          <motion.div layout key={`edit-${address._id}`}>
                            <form onSubmit={handleAddressSave} className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm space-y-5">
                              <h3 className="font-serif text-2xl text-stone-900">Edit Address</h3>
                              {addressError && (
                                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                  {addressError}
                                </p>
                              )}
                              {[
                                { label: 'Label', name: 'label' },
                                { label: 'Full Name', name: 'fullName', required: true },
                                { label: 'Email', name: 'email', required: true },
                                { label: 'Phone', name: 'phone', required: true },
                                { label: 'Address', name: 'address', required: true },
                                { label: 'City', name: 'city', required: true },
                                { label: 'State', name: 'state', required: true },
                                { label: 'Postal Code', name: 'postalCode', required: true },
                                { label: 'Country', name: 'country', required: true },
                              ].map((field) => (
                                <label key={field.name} className="block text-sm text-stone-600">
                                  <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                                    {field.label}
                                  </span>
                                  <input
                                    name={field.name}
                                    value={addressForm[field.name]}
                                    onChange={handleAddressChange}
                                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                                    required={field.required}
                                  />
                                </label>
                              ))}
                              <label className="flex items-center gap-3 text-sm text-stone-600">
                                <input
                                  type="checkbox"
                                  name="isDefault"
                                  checked={addressForm.isDefault}
                                  onChange={handleAddressChange}
                                  className="h-4 w-4 accent-stone-900"
                                />
                                Set as default address
                              </label>
                              <Button type="submit" className="w-full" disabled={addressLoading}>
                                {addressLoading ? 'Saving...' : 'Update Address'}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={() => {
                                  setEditAddressId(null);
                                  setAddressForm(buildEmptyAddressForm(userInfo));
                                }}
                              >
                                Cancel Edit
                              </Button>
                            </form>
                          </motion.div>
                        ) : (
                        <motion.div layout key={address._id} className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="font-serif text-xl text-stone-900">{address.label || 'Saved Address'}</h3>
                                {address.isDefault && (
                                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-700">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="mt-3 text-sm text-stone-700">{address.fullName}</p>
                              <p className="mt-1 text-sm text-stone-500">{address.address}</p>
                              <p className="text-sm text-stone-500">
                                {address.city}, {address.state}, {address.postalCode}, {address.country}
                              </p>
                              {address.phone && <p className="mt-2 text-sm text-stone-500">{address.phone}</p>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {!address.isDefault && (
                                <Button variant="secondary" onClick={() => handleSetDefaultAddress(address._id)} className="px-4 py-2">
                                  Set Default
                                </Button>
                              )}
                              <Button variant="secondary" onClick={() => handleDeleteAddress(address._id)} className="px-4 py-2">
                                Delete
                              </Button>
                              <Button variant="secondary" onClick={() => handleEditAddress(address)} className="px-4 py-2">
                                Edit
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                        )
                      ))
                    ) : (
                      <div className="py-12 px-8 text-center text-stone-500 bg-stone-50 border border-stone-100 rounded-[2rem]">
                        <p>You have not saved any addresses yet.</p>
                        <p className="mt-3 text-sm">Add one now and it will be available during checkout.</p>
                      </div>
                    )}
                  </div>

                  {!editAddressId && (
                  <form onSubmit={handleAddressSave} className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm space-y-5 h-fit">
                    <h3 className="font-serif text-2xl text-stone-900">Add Address</h3>
                    {addressError && (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {addressError}
                      </p>
                    )}
                    {[
                      { label: 'Label', name: 'label' },
                      { label: 'Full Name', name: 'fullName', required: true },
                      { label: 'Email', name: 'email', required: true },
                      { label: 'Phone', name: 'phone', required: true },
                      { label: 'Address', name: 'address', required: true },
                      { label: 'City', name: 'city', required: true },
                      { label: 'State', name: 'state', required: true },
                      { label: 'Postal Code', name: 'postalCode', required: true },
                      { label: 'Country', name: 'country', required: true },
                    ].map((field) => (
                      <label key={field.name} className="block text-sm text-stone-600">
                        <span className="mb-2 block uppercase tracking-[0.25em] text-[10px] text-stone-400">
                          {field.label}
                        </span>
                        <input
                          name={field.name}
                          value={addressForm[field.name]}
                          onChange={handleAddressChange}
                          className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                          required={field.required}
                        />
                      </label>
                    ))}
                    <label className="flex items-center gap-3 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        name="isDefault"
                        checked={addressForm.isDefault}
                        onChange={handleAddressChange}
                        className="h-4 w-4 accent-stone-900"
                      />
                      Set as default address
                    </label>
                    <Button type="submit" className="w-full" disabled={addressLoading}>
                      {addressLoading ? 'Saving...' : editAddressId ? 'Update Address' : 'Save Address'}
                    </Button>
                    {editAddressId && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          setEditAddressId(null);
                          setAddressForm(buildEmptyAddressForm(userInfo));
                        }}
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </form>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'details' && (
              <motion.div key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <h2 className="text-2xl font-serif mb-6 border-b border-stone-200 pb-4">Account Details</h2>
                <form onSubmit={handleProfileSave} className="max-w-xl space-y-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
                  {profileError && (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {profileError}
                    </p>
                  )}
                  <label className="block text-sm text-stone-600">
                    <span className="mb-2 block text-xs uppercase tracking-widest text-stone-500">Full Name</span>
                    <input
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                      required
                    />
                  </label>
                  <label className="block text-sm text-stone-600">
                    <span className="mb-2 block text-xs uppercase tracking-widest text-stone-500">Email Address</span>
                    <input
                      type="email"
                      name="email"
                      value={profileForm.email}
                      onChange={handleProfileChange}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                      required
                    />
                  </label>
                  <label className="block text-sm text-stone-600">
                    <span className="mb-2 block text-xs uppercase tracking-widest text-stone-500">Mobile Number</span>
                    <input
                      type="text"
                      name="mobileNumber"
                      value={profileForm.mobileNumber}
                      onChange={handleProfileChange}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900"
                    />
                  </label>
                  <label className="block text-sm text-stone-600 relative">
                    <span className="mb-2 block text-xs uppercase tracking-widest text-stone-500">Current Password</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="currentPassword"
                      value={profileForm.currentPassword}
                      onChange={handleProfileChange}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900 pr-12"
                      placeholder="Required to set a new password..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-[38px] text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </label>
                  <label className="block text-sm text-stone-600 relative">
                    <span className="mb-2 block text-xs uppercase tracking-widest text-stone-500">New Password</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={profileForm.password}
                      onChange={handleProfileChange}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-900 pr-12"
                      placeholder="Leave blank to keep your current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-[38px] text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </label>
                  {userInfo.isAdmin && (
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-stone-500 mb-2">Client Tier</label>
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-700">
                        Internal Admin
                      </div>
                    </div>
                  )}
                  <Button type="submit" disabled={profileLoading}>
                    {profileLoading ? 'Saving...' : 'Save Account Details'}
                  </Button>
                </form>

                <div className="mt-12 max-w-xl space-y-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
                  <h3 className="font-serif text-2xl mb-4">Two-Factor Authentication</h3>
                  <p className="text-sm text-stone-600 mb-6">
                    Secure your account with an Authenticator App (like Google Authenticator).
                  </p>
                  
                  {userInfo.isTwoFactorEnabled ? (
                    <div className="flex flex-col gap-4">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        Authenticator App is enabled.
                      </div>
                      <Button variant="secondary" onClick={handleDisable2FA} disabled={twoFactorLoading}>
                        {twoFactorLoading ? 'Disabling...' : 'Disable 2FA'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {!qrCodeData ? (
                        <Button variant="secondary" onClick={handleSetup2FA} disabled={twoFactorLoading}>
                          {twoFactorLoading ? 'Loading...' : 'Setup Authenticator App'}
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-4 mt-2 border border-stone-200 p-6 rounded-[2rem] bg-stone-50">
                          <p className="text-sm text-stone-700">1. Scan this QR code with your Authenticator App.</p>
                          <img src={qrCodeData} alt="QR Code for 2FA" className="w-48 h-48 mx-auto" />
                          <p className="text-sm text-stone-700 mt-4">2. Enter the 6-digit code from the app.</p>
                          <input
                            type="text"
                            value={twoFactorToken}
                            onChange={(e) => setTwoFactorToken(e.target.value)}
                            placeholder="6-digit code"
                            className="w-full tracking-[0.35em] text-center rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-stone-900"
                            maxLength={6}
                          />
                          <Button onClick={handleVerify2FA} disabled={twoFactorLoading || twoFactorToken.length < 6}>
                            {twoFactorLoading ? 'Verifying...' : 'Verify and Enable'}
                          </Button>
                          <button onClick={() => setQrCodeData(null)} className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-900 mx-auto mt-2 block">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
