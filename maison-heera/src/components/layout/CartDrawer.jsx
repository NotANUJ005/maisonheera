import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Plus, Minus, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { Button } from '../ui/Button';

export const CartDrawer = ({
  isOpen,
  onClose,
  cartItems,
  removeFromCart,
  updateQuantity,
  clearCart,
  onCheckout,
  notify,
}) => {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleClearCart = () => {
    clearCart();
    notify({
      title: 'Bag cleared',
      message: 'Your shopping bag has been emptied.',
      tone: 'info',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[101] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.4 }}
            className="fixed right-0 top-0 h-full w-full md:w-[470px] bg-white z-[102] shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Shopping Cart"
          >
            <div className="p-6 border-b border-stone-200 flex justify-between items-center">
              <h3 className="font-serif text-2xl">Your Bag</h3>
              <div className="flex items-center gap-4">
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-rose-500 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button type="button" aria-label="Close Cart" onClick={onClose} className="p-2 hover:bg-stone-100 rounded-none transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="border-b border-stone-100 bg-stone-50 px-6 py-4 text-sm text-stone-500">
              Complimentary insured delivery and signature verification are included on every order.
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col gap-6 [mask-image:linear-gradient(to_bottom,white_85%,transparent_100%)]">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400">
                  <ShoppingBag size={48} className="mb-4 opacity-20" />
                  <p className="uppercase tracking-widest text-xs">Your bag is empty</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 items-center">
                    <ImageWithFallback
                      src={item.image}
                      fallbackCategory={item.category}
                      alt={item.name}
                      className="w-20 h-24 object-cover bg-stone-100 rounded-2xl"
                    />
                    <div className="flex-1">
                      <h4 className="font-serif text-lg leading-tight mb-1">{item.name}</h4>
                      <p className="text-stone-500 text-sm mb-3">Rs. {item.price.toLocaleString('en-IN')}</p>
                      <div className="flex items-center gap-3 border border-stone-200 w-max px-3 py-1 rounded-full">
                        <button type="button" aria-label="Decrease quantity" onClick={() => updateQuantity(item.id, -1)} className="hover:opacity-50">
                          <Minus size={14} />
                        </button>
                        <span className="text-sm w-4 text-center">{item.quantity}</span>
                        <button type="button" aria-label="Increase quantity" onClick={() => updateQuantity(item.id, 1)} className="hover:opacity-50">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove item"
                      onClick={() => removeFromCart(item.id)}
                      className="text-stone-400 hover:text-rose-500 transition-colors self-start p-2"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-6 border-t border-stone-200 bg-stone-50">
                <div className="flex justify-between items-center mb-2 text-sm text-stone-500">
                  <span>Subtotal</span>
                  <span>Rs. {total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center mb-6 font-serif text-xl">
                  <span>Total</span>
                  <span>Rs. {total.toLocaleString('en-IN')}</span>
                </div>
                <Button className="w-full flex items-center justify-center gap-2" onClick={onCheckout}>
                  Proceed to Checkout <ArrowRight size={14} />
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
