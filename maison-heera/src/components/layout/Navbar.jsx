import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';

export const Navbar = ({
  currentView,
  onNavigate,
  onOpenCart,
  onOpenAccount,
  cartItemCount,
  searchQuery,
  setSearchQuery,
  allItems = [],
  isAdmin,
  userInfo,
}) => {
  const navItems = [
    { label: 'Home', view: 'home' },
    { label: 'Collections', view: 'shop' },
    { label: 'About Us', view: 'about' },
    { label: 'Contact', view: 'contact' },
    { label: 'Orders & Returns', view: userInfo ? 'account' : 'track-order' },
  ];

  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const searchResults = (allItems || [])
    .filter((item) => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 4);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isLight = currentView === 'home' && !isScrolled;

  const handleNavigate = (view) => {
    onNavigate({ view });
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        !isLight ? 'bg-white/90 py-5 shadow-sm backdrop-blur-md' : 'bg-transparent py-5 md:py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center gap-4">
        <button
          type="button"
          aria-label="Open navigation menu"
          className={`md:hidden ${isLight ? 'text-white' : 'text-stone-900'}`}
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <button
          className={`flex-1 text-left font-serif text-xl md:text-2xl tracking-[0.3em] uppercase cursor-pointer ${
            isLight ? 'text-white' : 'text-stone-900'
          }`}
          onClick={() => handleNavigate('home')}
        >
          Maison Heera
        </button>

        <nav
          className={`hidden md:flex gap-6 lg:gap-10 text-[10px] uppercase tracking-[0.2em] font-bold items-center ${
            isLight ? 'text-white' : 'text-stone-900'
          }`}
        >
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => handleNavigate(item.view)}
              className={`relative z-10 py-1 transition-all duration-300 ${
                currentView === item.view ? 'text-stone-900 border-b border-stone-900' : 'opacity-60 hover:opacity-100'
              } ${isLight && currentView === item.view ? 'text-white border-white' : ''} ${isLight && currentView !== item.view ? 'text-white opacity-70 hover:opacity-100' : ''}`}
            >
              {item.label}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => handleNavigate('admin')}
              className={`relative z-10 py-1 transition-all duration-300 text-rose-700 ${
                currentView === 'admin' ? 'border-b border-rose-700 opacity-100' : 'opacity-60 hover:opacity-100'
              }`}
            >
              Admin
            </button>
          )}
        </nav>

        <div className={`flex gap-4 md:ml-6 md:border-l md:pl-6 items-center ${isLight ? 'md:border-white/30' : 'md:border-stone-300'}`}>
          <div className="relative hidden md:block">
            <div
              className={`flex items-center overflow-hidden rounded-full border transition-all duration-300 ${
                isSearchExpanded ? 'w-[280px] px-3 py-2 bg-white/10 backdrop-blur' : 'w-10 justify-center px-0 py-2'
              } ${
                isSearchExpanded
                  ? isLight
                    ? 'border-white/50 text-white'
                    : 'border-stone-300 bg-white shadow-sm text-stone-900'
                  : isLight
                    ? 'border-transparent text-white hover:bg-white/10'
                    : 'border-transparent text-stone-900 hover:bg-stone-100'
              }`}
            >
              <button
                type="button"
                aria-label="Toggle search"
                aria-expanded={isSearchExpanded}
                className="flex h-5 w-5 shrink-0 items-center justify-center pointer-events-auto cursor-pointer z-10"
                onClick={() => {
                  if (isSearchExpanded && !searchQuery) {
                    setIsSearchExpanded(false);
                  } else {
                    setIsSearchExpanded(true);
                  }
                }}
              >
                <Search
                  size={18}
                  strokeWidth={1.5}
                  className="transition-opacity hover:opacity-75"
                />
              </button>

              <AnimatePresence>
                {isSearchExpanded && (
                  <motion.input
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    autoFocus
                    type="text"
                    placeholder="Search pieces..."
                    className={`bg-transparent outline-none border-none text-[10px] tracking-widest uppercase ml-3 w-full ${
                      isLight ? 'text-white placeholder:text-white/50' : 'text-stone-900 placeholder:text-stone-400'
                    }`}
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim() !== '') {
                        onNavigate({ view: 'shop' });
                        setIsSearchExpanded(false);
                      }
                    }}
                  />
                )}
              </AnimatePresence>

              {isSearchExpanded && searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center transition-opacity hover:opacity-50"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchExpanded(false);
                  }}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {isSearchExpanded && searchQuery.trim() && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full mt-3 w-[320px] right-0 rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden z-50 text-stone-900"
                >
                  <div className="px-4 py-3 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                    <span className="text-[9px] uppercase tracking-[0.2em] font-semibold text-stone-500">Suggestions</span>
                    <button 
                      onClick={() => {
                        onNavigate({ view: 'shop' });
                        setIsSearchExpanded(false);
                      }}
                      className="text-[9px] uppercase tracking-[0.2em] text-stone-900 font-bold hover:opacity-70 transition-opacity"
                    >
                      See All
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate({ view: 'product-detail', productId: item.id, from: 'shop' });
                          setIsSearchExpanded(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0 cursor-pointer"
                      >
                        <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-md bg-stone-100" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-serif font-semibold truncate text-stone-900">{item.name}</p>
                          <p className="text-[10px] text-stone-500 tracking-wider truncate uppercase">{item.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            aria-label="Open shopping cart"
            aria-controls="cart-drawer"
            onClick={onOpenCart}
            className={`relative shrink-0 ${isLight ? 'text-white' : 'text-stone-900'}`}
          >
            <ShoppingBag size={18} strokeWidth={1.5} className="cursor-pointer hover:opacity-50 transition-opacity" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] min-w-4 h-4 px-1 flex items-center justify-center rounded-full shadow-sm">
                {cartItemCount}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="Open account menu"
            aria-controls="account-drawer"
            onClick={onOpenAccount}
            className={`shrink-0 ml-1 ${isLight ? 'text-white' : 'text-stone-900'}`}
          >
            <User size={18} strokeWidth={1.5} className="cursor-pointer hover:opacity-50 transition-opacity" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-4 mt-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl md:hidden"
          >
            <div className="space-y-4 border-b border-stone-100 pb-5">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => handleNavigate(item.view)}
                  className={`block w-full text-left text-sm font-semibold uppercase tracking-[0.25em] ${
                    currentView === item.view ? 'text-rose-600' : 'text-stone-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => handleNavigate('admin')}
                  className="block w-full text-left text-sm font-semibold uppercase tracking-[0.25em] text-rose-600"
                >
                  Admin Dashboard
                </button>
              )}
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-stone-50 px-4 py-3">
              <label className="block text-[10px] uppercase tracking-[0.25em] text-stone-400">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  if (event.target.value.trim()) onNavigate({ view: 'shop' });
                }}
                placeholder="Diamond ring, pendant, white gold..."
                className="mt-2 w-full bg-transparent text-sm text-stone-900 outline-none"
              />
            </div>

            <div className="mt-5 text-sm text-stone-500">
              {userInfo ? `Signed in as ${userInfo.name}` : 'Sign in to track orders, save favorites, and check out faster.'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
