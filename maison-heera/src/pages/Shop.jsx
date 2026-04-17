import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, ShoppingCart, Heart, Star, ArrowUpRight, Search, SlidersHorizontal, ArrowDownWideNarrow, X } from 'lucide-react';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';
import { ScrollReveal } from '../components/ui/ScrollReveal';

export const Shop = ({
  addToCart,
  searchQuery,
  setSearchQuery,
  onViewDetail,
  cartItems,
  wishlistItems,
  toggleWishlist,
  activeCategoryFilter,
  setActiveCategoryFilter,
  activeMaterialFilter,
  setActiveMaterialFilter,
  itemsData,
  title,
}) => {
  const [sortBy, setSortBy] = useState('default');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMobileSortOpen, setIsMobileSortOpen] = useState(false);

  const categories = useMemo(() => ['All', ...new Set(itemsData.map((item) => item.category))], [itemsData]);
  const materials = useMemo(() => ['All', ...new Set(itemsData.map((item) => item.material))], [itemsData]);
  const hasActiveFilters = activeCategoryFilter !== 'All' || activeMaterialFilter !== 'All' || sortBy !== 'default';
  const activeFilterCount = Number(activeCategoryFilter !== 'All') + Number(activeMaterialFilter !== 'All') + Number(sortBy !== 'default');

  const filteredProducts = useMemo(() => {
    const normalizedQueryTerms = searchQuery
      .toLowerCase()
      .trim()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);

    return itemsData
      .filter((item) => {
        if (activeCategoryFilter !== 'All' && item.category !== activeCategoryFilter) return false;
        if (activeMaterialFilter !== 'All' && item.material !== activeMaterialFilter) return false;

        if (normalizedQueryTerms.length) {
          const searchableWords = [
            item.name,
            item.category,
            item.material,
            item.collection,
            item.tier,
            item.description,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const searchableTokens = searchableWords.split(/[^a-z0-9]+/i).filter(Boolean);

          const matchesAllTerms = normalizedQueryTerms.every((term) =>
            searchableTokens.some((token) => token.startsWith(term)),
          );

          if (!matchesAllTerms) {
            return false;
          }
        }

        return true;
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return Number(b.featured) - Number(a.featured);
      });
  }, [activeCategoryFilter, activeMaterialFilter, itemsData, searchQuery, sortBy]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto"
    >
      <h2 className="text-5xl font-serif text-center mb-6">{title}</h2>

      {searchQuery && (
        <p className="text-center text-stone-500 mb-10 text-sm tracking-wide">
          Showing results for <span className="font-bold text-stone-900">"{searchQuery}"</span>
        </p>
      )}

      <div className="mb-6 grid gap-3 md:hidden">
        <div className="flex items-center gap-3 rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <Search size={16} className="text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search rings, pendants, platinum..."
            className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="flex h-6 w-6 items-center justify-center text-stone-400 transition hover:text-stone-900"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsMobileFiltersOpen((prev) => !prev);
              setIsMobileSortOpen(false);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-stone-900 shadow-sm"
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] tracking-normal text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileSortOpen((prev) => !prev);
              setIsMobileFiltersOpen(false);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-stone-900 shadow-sm"
          >
            <ArrowDownWideNarrow size={14} />
            Sort
          </button>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {activeCategoryFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('All')}
                className="rounded-full bg-stone-100 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-stone-700"
              >
                {activeCategoryFilter} ×
              </button>
            )}
            {activeMaterialFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setActiveMaterialFilter('All')}
                className="rounded-full bg-stone-100 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-stone-700"
              >
                {activeMaterialFilter} ×
              </button>
            )}
            {sortBy !== 'default' && (
              <button
                type="button"
                onClick={() => setSortBy('default')}
                className="rounded-full bg-stone-100 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-stone-700"
              >
                {sortBy === 'price-low' ? 'Price Low-High' : sortBy === 'price-high' ? 'Price High-Low' : 'Name'} ×
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveCategoryFilter('All');
                setActiveMaterialFilter('All');
                setSortBy('default');
              }}
              className="rounded-full border border-stone-300 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-stone-900"
            >
              Clear All
            </button>
          </div>
        )}

        {isMobileFiltersOpen && (
          <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-500">Filters</p>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="text-xs uppercase tracking-[0.2em] text-stone-400"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Category</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategoryFilter(category)}
                    className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                      activeCategoryFilter === category
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {category === 'All' ? 'All Categories' : category}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">Material</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {materials.map((material) => (
                  <button
                    key={material}
                    type="button"
                    onClick={() => setActiveMaterialFilter(material)}
                    className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                      activeMaterialFilter === material
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {material === 'All' ? 'All Materials' : material}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isMobileSortOpen && (
          <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-stone-500">Sort</p>
              <button
                type="button"
                onClick={() => setIsMobileSortOpen(false)}
                className="text-xs uppercase tracking-[0.2em] text-stone-400"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                { value: 'default', label: 'Featured' },
                { value: 'price-low', label: 'Price: Low to High' },
                { value: 'price-high', label: 'Price: High to Low' },
                { value: 'name', label: 'Name' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSortBy(option.value);
                    setIsMobileSortOpen(false);
                  }}
                  className={`rounded-[1.1rem] border px-4 py-3 text-left text-sm transition-colors ${
                    sortBy === option.value
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 pb-6 border-b border-stone-200 mt-8">
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <span className="flex items-center gap-2 text-stone-500 uppercase text-xs tracking-widest font-semibold mr-2">
            <Filter size={14} /> Filters:
          </span>
          <select
            aria-label="Filter by Category"
            className="bg-transparent border border-stone-300 text-xs px-3 py-2 uppercase tracking-wider focus:outline-none focus:border-stone-900 transition-colors cursor-pointer rounded-none"
            value={activeCategoryFilter}
            onChange={(event) => setActiveCategoryFilter(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'All' ? 'All Categories' : category}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by Material"
            className="bg-transparent border border-stone-300 text-xs px-3 py-2 uppercase tracking-wider focus:outline-none focus:border-stone-900 transition-colors cursor-pointer rounded-none"
            value={activeMaterialFilter}
            onChange={(event) => setActiveMaterialFilter(event.target.value)}
          >
            {materials.map((material) => (
              <option key={material} value={material}>
                {material === 'All' ? 'All Materials' : material}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setActiveCategoryFilter('All');
              setActiveMaterialFilter('All');
              setSortBy('default');
            }}
            disabled={!hasActiveFilters}
            className={`text-xs uppercase tracking-widest pb-1 border-b transition-colors ${
              hasActiveFilters
                ? 'border-stone-900 text-stone-900 hover:text-stone-500 hover:border-stone-500'
                : 'border-transparent text-stone-300 cursor-not-allowed'
            }`}
          >
            Clear Filters
          </button>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <span className="text-stone-500 uppercase text-xs tracking-widest font-semibold">Sort:</span>
          <select
            aria-label="Sort products"
            className="bg-transparent border border-stone-300 text-xs px-3 py-2 uppercase tracking-wider focus:outline-none focus:border-stone-900 transition-colors cursor-pointer rounded-none"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="default">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const cartItem = cartItems.find((item) => item.id === product.id);
            const inWishlist = wishlistItems.some((item) => item.id === product.id);

            return (
              <ScrollReveal key={product.id}>
                <article className="group rounded-[2rem] border border-stone-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <button type="button" onClick={() => onViewDetail(product)} className="block w-full text-left">
                    <div className="relative aspect-[4/5] bg-stone-100 mb-4 overflow-hidden rounded-[1.5rem]">
                      <ImageWithFallback
                        src={product.image}
                        fallbackCategory={product.category}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        alt={product.name}
                      />
                      <div className="absolute top-4 left-4 flex gap-2">
                        <span className="bg-white/90 backdrop-blur-sm text-stone-900 text-[9px] uppercase tracking-widest px-2 py-1 shadow-sm rounded-full">
                          {product.collection}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button type="button" onClick={() => onViewDetail(product)} className="text-left">
                        <h5 className="font-serif text-lg text-stone-900 line-clamp-1 mb-1">{product.name}</h5>
                      </button>
                      <p className="text-stone-500 text-sm tracking-wide">
                        Rs. {product.price.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] tracking-widest text-stone-400 shrink-0 pt-1">
                      <Star size={10} className={product.rating ? 'fill-stone-400' : ''} />
                      {product.rating ? `${product.rating}${product.ratingCount ? ` (${product.ratingCount})` : ''}` : 'No ratings yet'}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      aria-label={`Add ${product.name} to cart`}
                      className="flex-1 flex items-center justify-center gap-2 rounded-full border border-stone-200 py-3 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold text-stone-900 hover:bg-stone-50 transition-colors"
                    >
                      <ShoppingCart size={14} />
                      <span>{cartItem ? `In Cart (${cartItem.quantity})` : 'Add to Cart'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(product)}
                      aria-label={`Toggle ${product.name} in wishlist`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      <Heart
                        size={16}
                        className={
                          inWishlist ? 'fill-rose-500 text-rose-500' : 'text-stone-900'
                        }
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewDetail(product)}
                      aria-label={`View ${product.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-900 transition hover:bg-stone-900 hover:text-white"
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </article>
              </ScrollReveal>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-stone-400 text-lg font-serif">No pieces found matching your criteria.</p>
            <button
              type="button"
              onClick={() => {
                setActiveCategoryFilter('All');
                setActiveMaterialFilter('All');
                setSortBy('default');
              }}
              className="mt-4 text-xs uppercase tracking-widest text-stone-900 border-b border-stone-900 pb-1"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
