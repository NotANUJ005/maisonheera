import { create } from 'zustand';

const readStorage = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const useStore = create((set, get) => ({
  cartItems: readStorage('maison-heera.cart', []),
  wishlistItems: readStorage('maison-heera.wishlist', []),
  userInfo: readStorage('userInfo', null),
  isCartOpen: false,
  isAccountOpen: false,
  toasts: [],

  setCartItems: (items) => set({ cartItems: items }),
  setWishlistItems: (items) => set({ wishlistItems: items }),
  setUserInfo: (info) => set({ userInfo: info }),
  setIsCartOpen: (isOpen) => set({ isCartOpen: isOpen }),
  setIsAccountOpen: (isOpen) => set({ isAccountOpen: isOpen }),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  notify: ({ title, message, tone = 'info' }) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [...state.toasts, { id, title, message, tone }] }));
    window.setTimeout(() => get().dismissToast(id), 4000);
  },

  addToCart: (product, size) => {
    set((state) => {
      const existing = state.cartItems.find(
        (item) => item.id === product.id && item.selectedSize === size
      );
      if (existing) {
        get().notify({
          title: 'Added to bag',
          message: `${product.name} quantity increased in your shopping bag.`,
          tone: 'success',
        });
        get().setIsCartOpen(true);
        return {
          cartItems: state.cartItems.map((item) =>
            item.id === product.id && item.selectedSize === size
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }
      get().notify({
        title: 'Added to bag',
        message: `${product.name} has been added to your shopping bag.`,
        tone: 'success',
      });
      get().setIsCartOpen(true);
      return {
        cartItems: [...state.cartItems, { ...product, selectedSize: size, quantity: 1 }],
      };
    });
  },

  removeFromCart: (productId, size) => {
    const state = get();
    const item = state.cartItems.find((p) => p.id === productId && p.selectedSize === size);
    if (item) {
      state.notify({
        title: 'Removed from bag',
        message: `${item.name} has been removed from your shopping bag.`,
        tone: 'info',
      });
    }
    set((s) => ({
      cartItems: s.cartItems.filter(
        (i) => !(i.id === productId && i.selectedSize === size)
      ),
    }));
  },

  updateQuantity: (productId, size, num) => {
    set((state) => ({
      cartItems: state.cartItems.map((item) => {
        if (item.id === productId && item.selectedSize === size) {
          return { ...item, quantity: Math.max(1, item.quantity + num) };
        }
        return item;
      }),
    }));
  },

  toggleWishlist: (product) => {
    set((state) => {
      const exists = state.wishlistItems.some((item) => item.id === product.id);
      if (exists) {
        get().notify({
          title: 'Removed from wishlist',
          message: `${product.name} has been removed from your saved pieces.`,
          tone: 'info',
        });
        return {
          wishlistItems: state.wishlistItems.filter((item) => item.id !== product.id),
        };
      }
      get().notify({
        title: 'Saved to wishlist',
        message: `${product.name} is now saved to your wishlist.`,
        tone: 'success',
      });
      return {
        wishlistItems: [...state.wishlistItems, product],
      };
    });
  },
}));
