import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, ShoppingCart, Heart } from 'lucide-react';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';
import { Button } from '../components/ui/Button';
import { submitOrderItemFeedback } from '../utils/api';

export const PrestigeDetail = ({
  item,
  onBack,
  addToCart,
  cartItems,
  wishlistItems,
  toggleWishlist,
  relatedItems = [],
  onViewRelated,
  userInfo,
  userOrders = [],
  refreshUserOrders,
  notify,
}) => {
  const [reviewForm, setReviewForm] = useState({ rating: '5', comment: '' });
  const [isSavingReview, setIsSavingReview] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [item?.id]);

  const cartItem = cartItems.find((product) => product.id === item?.id);
  const inWishlist = wishlistItems.some((product) => product.id === item?.id);

  const recommendations = useMemo(
    () => relatedItems.filter((product) => product.id !== item?.id).slice(0, 3),
    [item?.id, relatedItems],
  );

  const matchingPurchases = useMemo(
    () =>
      userOrders
        .flatMap((order) =>
          (order.orderItems || [])
            .filter((orderItem) => String(orderItem.product) === String(item?.id))
            .map((orderItem) => ({
              ...orderItem,
              orderId: order._id,
              orderStatus: order.orderStatus,
              orderCreatedAt: order.createdAt,
            })),
        )
        .sort((left, right) => new Date(right.orderCreatedAt).getTime() - new Date(left.orderCreatedAt).getTime()),
    [item?.id, userOrders],
  );

  const latestFeedback = matchingPurchases.find((purchase) => purchase.feedback?.rating) || null;
  const pendingFeedbackPurchase =
    matchingPurchases.find(
      (purchase) =>
        !purchase.feedback?.rating &&
        purchase.returnStatus !== 'returned' &&
        purchase.orderStatus !== 'cancelled',
    ) || null;

  useEffect(() => {
    if (pendingFeedbackPurchase) {
      setReviewForm({
        rating: '5',
        comment: '',
      });
    }
  }, [pendingFeedbackPurchase?.orderId, pendingFeedbackPurchase?._id]);

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!pendingFeedbackPurchase) {
      return;
    }

    setIsSavingReview(true);

    try {
      await submitOrderItemFeedback({
        user: userInfo,
        orderId: pendingFeedbackPurchase.orderId,
        itemId: pendingFeedbackPurchase._id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });
      await refreshUserOrders?.();
      notify?.({
        title: 'Feedback saved',
        message: `Thanks for reviewing ${item.name}.`,
        tone: 'success',
      });
    } catch (error) {
      notify?.({
        title: 'Feedback not saved',
        message: error.message || 'We could not save your feedback right now.',
        tone: 'error',
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  if (!item) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto min-h-screen"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-stone-500 hover:text-stone-900 transition-colors mb-12"
      >
        <ArrowLeft size={14} /> Back to Collection
      </button>

      <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:gap-24">
        <div className="w-full">
          <div className="aspect-[4/5] w-full bg-stone-100 overflow-hidden shadow-sm rounded-[2rem]">
            <ImageWithFallback
              src={item.image}
              fallbackCategory={item.category}
              alt={item.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-[2s]"
            />
          </div>
        </div>

        <div className="w-full flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-500 text-xs uppercase tracking-[0.3em]">
              {item.collection}
            </span>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-500 text-xs uppercase tracking-[0.3em]">
              {item.tier}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-stone-900 mb-6 leading-tight">
            {item.name}
          </h1>

          <div className="flex items-center gap-6 mb-10">
            <p className="text-xl md:text-2xl text-stone-500 tracking-wide">
              Rs. {item.price.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-2 text-stone-400 bg-stone-50 px-3 py-1 rounded-full">
              <Star size={14} className={item.rating ? 'fill-stone-400' : ''} />
              <span className="text-sm font-semibold tracking-wide">
                {item.rating ? `${item.rating} Rating${item.ratingCount ? ` (${item.ratingCount})` : ''}` : 'No ratings yet'}
              </span>
            </div>
          </div>

          <div className="w-12 h-px bg-stone-300 mb-10" />

          <p className="text-stone-600 font-light leading-relaxed text-lg mb-12">{item.description}</p>

          <div className="grid gap-4 rounded-[2rem] bg-stone-50 p-6 text-sm text-stone-600 mb-10">
            <div className="flex items-center justify-between gap-4">
              <span>Category</span>
              <span className="font-semibold text-stone-900">{item.category}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Material</span>
              <span className="font-semibold text-stone-900">{item.material}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Service</span>
              <span className="font-semibold text-stone-900">Insured delivery included</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button className="flex-1 flex justify-center items-center gap-2 py-4" onClick={() => addToCart(item)}>
              <ShoppingCart size={16} /> {cartItem ? `Added to Bag (${cartItem.quantity})` : 'Add to Bag'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => toggleWishlist(item)}
              className="flex-1 flex justify-center items-center gap-2 py-4"
            >
              <Heart size={16} className={inWishlist ? 'fill-rose-500 text-rose-500' : ''} />
              {inWishlist ? 'Saved' : 'Save to Wishlist'}
            </Button>
          </div>

          <div className="text-xs uppercase tracking-widest text-stone-400 space-y-3">
            <p>Included: Complimentary insured global shipping</p>
            <p>Included: Certificate of authenticity</p>
            <p>Included: Lifetime maintenance guarantee</p>
          </div>
        </div>
      </div>

      {userInfo && (pendingFeedbackPurchase || latestFeedback) && (
        <section className="mt-20 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">After Purchase</p>
              <h2 className="mt-4 text-3xl font-serif text-stone-900">Your Experience With This Piece</h2>
              <p className="mt-3 text-sm leading-7 text-stone-500">
                When you return to a purchased item, Maison Heera now invites you to share feedback so future visits feel more personal.
              </p>
            </div>
            {latestFeedback?.feedback?.submittedAt && (
              <div className="rounded-full bg-stone-100 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-stone-600">
                Last reviewed on {new Date(latestFeedback.feedback.submittedAt).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {pendingFeedbackPurchase ? (
              <form onSubmit={handleReviewSubmit} className="rounded-[1.75rem] bg-stone-50 p-6">
                <h3 className="text-xl font-serif text-stone-900">Share feedback for this purchase</h3>
                <p className="mt-2 text-sm text-stone-500">
                  Purchased on {new Date(pendingFeedbackPurchase.orderCreatedAt).toLocaleDateString()}
                </p>
                <div className="mt-5 grid gap-4">
                  <select
                    value={reviewForm.rating}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: event.target.value }))}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-900"
                  >
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} Stars
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                    rows={4}
                    placeholder="Tell us about the finish, fit, presentation, or delivery."
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-stone-900"
                  />
                  <Button type="submit" className="w-full" disabled={isSavingReview}>
                    {isSavingReview ? 'Saving Feedback...' : 'Submit Feedback'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="rounded-[1.75rem] bg-stone-50 p-6">
                <h3 className="text-xl font-serif text-stone-900">Feedback already shared</h3>
                <p className="mt-2 text-sm text-stone-500">
                  You have already reviewed this piece. You can update the note from your account orders anytime.
                </p>
              </div>
            )}

            {latestFeedback?.feedback ? (
              <div className="rounded-[1.75rem] border border-stone-200 p-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-stone-400">Your Latest Feedback</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-900">
                    {latestFeedback.feedback.rating}/5
                  </span>
                  <span className="text-sm text-stone-500">
                    Submitted on {new Date(latestFeedback.feedback.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-5 text-sm leading-7 text-stone-600">
                  {latestFeedback.feedback.comment || 'You saved a rating without a written note.'}
                </p>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-stone-200 p-6 text-sm text-stone-500">
                No feedback has been saved for this product yet from your account.
              </div>
            )}
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="mt-24">
          <h2 className="text-3xl font-serif text-stone-900 mb-8">You may also like</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {recommendations.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onViewRelated(product)}
                className="rounded-[2rem] border border-stone-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-stone-100">
                  <ImageWithFallback src={product.image} fallbackCategory={product.category} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
                </div>
                <p className="mt-4 font-serif text-xl text-stone-900">{product.name}</p>
                <p className="mt-1 text-sm text-stone-500">Rs. {product.price.toLocaleString('en-IN')}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};
