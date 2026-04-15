import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PreLoader } from './components/ui/PreLoader';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/layout/CartDrawer';
import { AccountDrawer } from './components/layout/AccountDrawer';
import { ToastRegion } from './components/ui/ToastRegion';
const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Shop = React.lazy(() => import('./pages/Shop').then(m => ({ default: m.Shop })));
const PrestigeDetail = React.lazy(() => import('./pages/PrestigeDetail').then(m => ({ default: m.PrestigeDetail })));
const AccountDashboard = React.lazy(() => import('./pages/AccountDashboard').then(m => ({ default: m.AccountDashboard })));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const About = React.lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const Contact = React.lazy(() => import('./pages/Contact').then(m => ({ default: m.Contact })));
const Checkout = React.lazy(() => import('./pages/Checkout').then(m => ({ default: m.Checkout })));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const TrackOrder = React.lazy(() => import('./pages/TrackOrder').then(m => ({ default: m.TrackOrder })));
import { PRODUCTS, PRESTIGE_ITEMS, splitCatalogByType } from './data/products';
import { CATALOG_UPDATED_EVENT, getPendingFeedbackItems, jsonRequest, loadCatalog, loadUserOrders, saveStoredUser } from './utils/api';
import { buildRoutePath, parseRoute } from './utils/navigation';
import { useStore } from './store/useStore';

const ACCOUNT_TAB_STORAGE_KEY = 'maison-heera.account-tab';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const route = useMemo(() => parseRoute(location.pathname + location.search), [location.pathname, location.search]);
  
  const {
    cartItems, setCartItems,
    wishlistItems, setWishlistItems,
    userInfo, setUserInfo,
    isCartOpen, setIsCartOpen,
    isAccountOpen, setIsAccountOpen,
    toasts, dismissToast, notify,
    addToCart, removeFromCart, updateQuantity, toggleWishlist
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAccountTab, setActiveAccountTab] = useState(
    () => window.localStorage.getItem(ACCOUNT_TAB_STORAGE_KEY) || 'orders',
  );
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');
  const [activeMaterialFilter, setActiveMaterialFilter] = useState('All');
  const [productsData, setProductsData] = useState(PRODUCTS);
  const [prestigeData, setPrestigeData] = useState(PRESTIGE_ITEMS);
  const [userOrders, setUserOrders] = useState([]);
  const promptedUserRef = useRef(null);

  const currentView = route.view;
  const isAdmin = Boolean(userInfo?.isAdmin);

  const allItems = useMemo(() => [...productsData, ...prestigeData], [productsData, prestigeData]);

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === route.productId) || null,
    [allItems, route.productId],
  );

  const categories = useMemo(
    () =>
      [...new Map(productsData.map((item) => [item.category, { id: item.category, name: item.category, image: item.image }])).values()],
    [productsData],
  );

  const materials = useMemo(
    () =>
      [...new Map(productsData.map((item) => [item.material, { id: item.material, name: item.material, image: item.image }])).values()],
    [productsData],
  );

  const applyCatalog = (items) => {
    const catalog = splitCatalogByType(items);
    setProductsData(catalog.products);
    setPrestigeData(catalog.prestige);
  };

  const navigateTo = (nextRoute, options = {}) => {
    const nextPath = buildRoutePath(nextRoute);
    navigate(nextPath, { replace: options.replace });
  };

  const openProductDetail = (item, from = currentView === 'home' ? (item.type === 'prestige' ? 'prestige-shop' : 'shop') : currentView) => {
    navigateTo({
      view: 'product-detail',
      productId: item.id,
      from,
    });
  };

  useEffect(() => {
    let isMounted = true;

    const syncCatalog = async () => {
      const items = await loadCatalog();
      if (isMounted) {
        applyCatalog(items);
      }
    };

    const handleCatalogRefresh = () => {
      syncCatalog();
    };

    syncCatalog();
    window.addEventListener(CATALOG_UPDATED_EVENT, handleCatalogRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener(CATALOG_UPDATED_EVENT, handleCatalogRefresh);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('maison-heera.cart', JSON.stringify(cartItems));
    if (userInfo && userInfo.token) {
      jsonRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ cart: cartItems }),
      }).catch((err) => console.error('Silent cart sync failed:', err));
    }
  }, [cartItems, userInfo?.token]);

  useEffect(() => {
    window.localStorage.setItem('maison-heera.wishlist', JSON.stringify(wishlistItems));
    if (userInfo && userInfo.token) {
      jsonRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ wishlist: wishlistItems }),
      }).catch((err) => console.error('Silent wishlist sync failed:', err));
    }
  }, [wishlistItems, userInfo?.token]);

  useEffect(() => {
    saveStoredUser(userInfo);

    // Merge remote items on login if available
    if (userInfo && userInfo.token) {
      if (userInfo.cart && userInfo.cart.length > 0) {
        setCartItems(userInfo.cart);
      }
      if (userInfo.wishlist && userInfo.wishlist.length > 0) {
        setWishlistItems(userInfo.wishlist);
      }
    }
  }, [userInfo]);

  useEffect(() => {
    let isCancelled = false;

    if (!userInfo?._id) {
      setUserOrders([]);
      promptedUserRef.current = null;
      return undefined;
    }

    const syncOrders = async () => {
      try {
        const orders = await loadUserOrders(userInfo);
        if (isCancelled) {
          return;
        }

        setUserOrders(orders);

        if (promptedUserRef.current !== userInfo._id) {
          promptedUserRef.current = userInfo._id;
          const pendingFeedbackItems = getPendingFeedbackItems(orders);

          if (pendingFeedbackItems.length) {
            const firstPending = pendingFeedbackItems[0];
            notify({
              title: 'Share your feedback',
              message:
                pendingFeedbackItems.length === 1
                  ? `You can now review ${firstPending.name} from your recent purchase.`
                  : `You have ${pendingFeedbackItems.length} purchased pieces waiting for feedback.`,
              tone: 'info',
            });
          }
        }
      } catch {
        if (!isCancelled) {
          setUserOrders([]);
        }
      }
    };

    syncOrders();

    return () => {
      isCancelled = true;
    };
  }, [userInfo?._id, userInfo?.token]);

  const refreshUserOrders = async () => {
    if (!userInfo?._id) {
      setUserOrders([]);
      return [];
    }

    try {
      const orders = await loadUserOrders(userInfo);
      setUserOrders(orders);
      return orders;
    } catch (error) {
      setUserOrders([]);
      notify({
        title: 'Orders unavailable',
        message: error.message || 'We could not load your order history right now.',
        tone: 'error',
      });
      return [];
    }
  };

  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, activeAccountTab);
  }, [activeAccountTab]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route.view, route.productId, route.token, route.from, route.orderId]);

  useEffect(() => {
    if (currentView === 'product-detail' && route.productId && !selectedItem && allItems.length > 0) {
      navigateTo({ view: 'shop' }, { replace: true });
    }
  }, [allItems.length, currentView, route.productId, selectedItem]);

  useEffect(() => {
    if (currentView === 'admin' && !isAdmin) {
      navigateTo({ view: 'home' }, { replace: true });
      notify({
        title: 'Access limited',
        message: 'Admin tools are available only to signed-in admin users.',
        tone: 'error',
      });
    }
  }, [currentView, isAdmin]);



  const handleCategoryClick = (category) => {
    setActiveCategoryFilter(category);
    setActiveMaterialFilter('All');
    navigateTo({ view: 'shop' });
  };

  const handleMaterialClick = (material) => {
    setActiveMaterialFilter(material);
    setActiveCategoryFilter('All');
    navigateTo({ view: 'shop' });
  };

  const handleOrderPlaced = () => {
    setCartItems([]);
    setIsCartOpen(false);
    setActiveAccountTab('orders');
    navigateTo({ view: 'account' });
  };

  const handleLogout = () => {
    setUserInfo(null);
    setCartItems([]);
    setWishlistItems([]);
    window.localStorage.removeItem('userInfo');
    navigateTo({ view: 'home' }, { replace: true });
    notify({
      title: 'Logged Out',
      message: 'You have been securely logged out.',
      tone: 'info',
    });
  };

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const isSearchActive = searchQuery.trim().length > 0;

  useEffect(() => {
    if (!isSearchActive) return;

    if (activeCategoryFilter !== 'All') {
      setActiveCategoryFilter('All');
    }

    if (activeMaterialFilter !== 'All') {
      setActiveMaterialFilter('All');
    }
  }, [activeCategoryFilter, activeMaterialFilter, isSearchActive]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 font-sans selection:bg-stone-200 overflow-x-hidden">
      <AnimatePresence>
        {isLoading && <PreLoader key="loader" setLoading={setIsLoading} />}
      </AnimatePresence>

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        removeFromCart={removeFromCart}
        updateQuantity={updateQuantity}
        clearCart={() => setCartItems([])}
        onCheckout={() => {
          setIsCartOpen(false);
          navigateTo({ view: 'checkout' });
        }}
        notify={notify}
      />

      <AccountDrawer
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        userInfo={userInfo}
        setUserInfo={setUserInfo}
        onNavigate={navigateTo}
        setActiveAccountTab={setActiveAccountTab}
        notify={notify}
      />

      {!isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <Navbar
            currentView={currentView}
            onNavigate={navigateTo}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenAccount={() => setIsAccountOpen(true)}
            cartItemCount={totalCartItems}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            allItems={allItems}
            isAdmin={isAdmin}
            userInfo={userInfo}
          />
          <main className="pt-0 min-h-screen">
            <Suspense fallback={<PreLoader setLoading={() => {}} />}>
              <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                  <Route
                    path="/"
                    element={
                      <Home
                        setCurrentView={(view) => navigateTo({ view })}
                        addToCart={addToCart}
                        onViewDetail={(item) => openProductDetail(item, item.type === 'prestige' ? 'prestige-shop' : 'shop')}
                        cartItems={cartItems}
                        onCategoryClick={handleCategoryClick}
                        onMaterialClick={handleMaterialClick}
                        productsData={productsData}
                        prestigeData={prestigeData}
                        categories={categories}
                        materials={materials}
                      />
                    }
                  />
                  <Route
                    path="/shop"
                    element={
                      <Shop
                        addToCart={addToCart}
                        searchQuery={searchQuery}
                        onViewDetail={(item) => openProductDetail(item, 'shop')}
                        cartItems={cartItems}
                        wishlistItems={wishlistItems}
                        toggleWishlist={toggleWishlist}
                        activeCategoryFilter={activeCategoryFilter}
                        setActiveCategoryFilter={setActiveCategoryFilter}
                        activeMaterialFilter={activeMaterialFilter}
                        setActiveMaterialFilter={setActiveMaterialFilter}
                        itemsData={isSearchActive ? allItems : productsData}
                        title={isSearchActive ? 'Search Results' : 'The Archive'}
                      />
                    }
                  />
                  <Route
                    path="/prestige-shop"
                    element={
                      <Shop
                        addToCart={addToCart}
                        searchQuery={searchQuery}
                        onViewDetail={(item) => openProductDetail(item, 'prestige-shop')}
                        cartItems={cartItems}
                        wishlistItems={wishlistItems}
                        toggleWishlist={toggleWishlist}
                        activeCategoryFilter={activeCategoryFilter}
                        setActiveCategoryFilter={setActiveCategoryFilter}
                        activeMaterialFilter={activeMaterialFilter}
                        setActiveMaterialFilter={setActiveMaterialFilter}
                        itemsData={prestigeData}
                        title="The Prestige Archives"
                      />
                    }
                  />
                  <Route
                    path="/product/:productId"
                    element={
                      selectedItem ? (
                        <PrestigeDetail
                          item={selectedItem}
                          onBack={() => navigateTo({ view: route.from || 'shop' })}
                          addToCart={addToCart}
                          cartItems={cartItems}
                          wishlistItems={wishlistItems}
                          toggleWishlist={toggleWishlist}
                          relatedItems={selectedItem.type === 'prestige' ? prestigeData : productsData}
                          onViewRelated={(item) => openProductDetail(item, route.from || 'shop')}
                          userInfo={userInfo}
                          userOrders={userOrders}
                          refreshUserOrders={refreshUserOrders}
                          notify={notify}
                        />
                      ) : (
                        <div className="pt-32 text-center text-stone-50">Item not found.</div>
                      )
                    }
                  />
                  <Route
                    path="/checkout"
                    element={
                      <Checkout
                        cartItems={cartItems}
                        userInfo={userInfo}
                        setUserInfo={setUserInfo}
                        onOpenAccount={() => setIsAccountOpen(true)}
                        onNavigate={navigateTo}
                        onOrderPlaced={handleOrderPlaced}
                        notify={notify}
                      />
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <ResetPassword
                        token={route.token}
                        onNavigate={navigateTo}
                        notify={notify}
                      />
                    }
                  />
                  <Route
                    path="/track-order"
                    element={
                      <TrackOrder
                        initialOrderId={route.orderId}
                        userInfo={userInfo}
                        onNavigate={navigateTo}
                        notify={notify}
                      />
                    }
                  />
                  <Route
                    path="/account"
                    element={
                      <AccountDashboard
                        userInfo={userInfo}
                        setUserInfo={setUserInfo}
                        onLogout={handleLogout}
                        activeTab={activeAccountTab}
                        setActiveTab={setActiveAccountTab}
                        orders={userOrders}
                        refreshOrders={refreshUserOrders}
                        wishlistItems={wishlistItems}
                        toggleWishlist={toggleWishlist}
                        onViewDetail={(item) => {
                          const resolvedItem =
                            allItems.find((catalogItem) => catalogItem.id === item?.id || catalogItem._id === item?._id) ||
                            item;
                          openProductDetail(resolvedItem, 'account');
                        }}
                        onNavigate={navigateTo}
                        notify={notify}
                      />
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      isAdmin ? (
                        <AdminDashboard
                          userInfo={userInfo}
                          setCurrentView={(view) => navigateTo({ view })}
                          onLogout={handleLogout}
                          notify={notify}
                        />
                      ) : (
                        <div className="pt-32 text-center text-stone-50">Admin area securely locked.</div>
                      )
                    }
                  />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="*" element={<div className="pt-32 text-center text-stone-50 font-serif text-3xl">Page Not Found</div>} />
                </Routes>
              </AnimatePresence>
            </Suspense>
          </main>
          <Footer onNavigate={navigateTo} notify={notify} />
        </motion.div>
      )}
    </div>
  );
}
