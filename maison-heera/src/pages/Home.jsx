import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ScrollReveal } from '../components/ui/ScrollReveal';
import { ImageWithFallback } from '../components/ui/ImageWithFallback';
import { AnimatedHeroBg } from '../components/sections/AnimatedHeroBg';
import { PrestigeCollection } from '../components/sections/PrestigeCollection';
import { ShopByCategories } from '../components/sections/ShopByCategories';
import { MaterialCollections } from '../components/sections/MaterialCollections';
import { fadeInUp, staggerContainer } from '../utils/animations';

export const Home = ({
  setCurrentView,
  addToCart,
  onViewDetail,
  cartItems,
  onCategoryClick,
  onMaterialClick,
  productsData,
  prestigeData,
  categories,
  materials,
}) => {
  return (
    <motion.div initial="initial" animate="animate" exit={{ opacity: 0 }}>
      <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <AnimatedHeroBg productsData={productsData} />
        <div className="relative z-10 text-center px-6">
          <motion.span
            variants={fadeInUp}
            transition={{ delay: 0.5 }}
            className="text-stone-300 text-xs md:text-sm uppercase tracking-[0.4em] mb-6 block"
          >
            Est. 1924 - London
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            transition={{ delay: 0.7 }}
            className="text-5xl md:text-8xl font-serif text-white mb-10 max-w-5xl leading-tight"
          >
            A Legacy of <br />
            <span className="italic font-light">Pure Brilliance</span>
          </motion.h2>
          <motion.div variants={fadeInUp} transition={{ delay: 1 }}>
            <Button variant="outline" onClick={() => setCurrentView('shop')}>
              Explore Creations
            </Button>
          </motion.div>
        </div>
      </section>

      <PrestigeCollection
        onViewDetail={onViewDetail}
        onSeeAll={() => setCurrentView('prestige-shop')}
        prestigeData={prestigeData}
      />

      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-20">
            <h3 className="text-4xl font-serif text-stone-900 mb-6">The High Jewelry Collection</h3>
            <div className="w-20 h-px bg-stone-300 mx-auto mb-6" />
            <p className="text-stone-500 max-w-2xl mx-auto font-light leading-relaxed">
              Where heritage meets contemporary design. Each piece tells a story of meticulous
              craftsmanship.
            </p>
          </div>
        </ScrollReveal>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-12"
        >
          {productsData.slice(0, 3).map((product) => {
            const cartItem = cartItems.find((item) => item.id === product.id);

            return (
              <motion.div
                key={product.id}
                variants={fadeInUp}
                className="group cursor-pointer block focus-within:ring-1 focus-within:ring-stone-900 focus-within:ring-offset-4"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-stone-100 mb-6">
                  <ImageWithFallback
                    src={product.image}
                    fallbackCategory={product.category}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500 flex flex-col items-center justify-center gap-4">
                    <button
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        addToCart(product);
                      }}
                      aria-label={`Add ${product.name} to bag`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 bg-white text-stone-900 px-6 py-3 uppercase text-xs tracking-widest transition-all duration-300 translate-y-4 group-hover:translate-y-0 focus:translate-y-0"
                    >
                      {cartItem ? `Added to Bag (${cartItem.quantity})` : 'Add to Bag'}
                    </button>
                    <button
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onViewDetail(product);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-white border-b border-white pb-1 uppercase text-[10px] tracking-[0.3em] font-semibold transition-all duration-300 translate-y-4 group-hover:translate-y-0 focus:translate-y-0"
                    >
                      Discover More
                    </button>
                  </div>
                </div>
                <h4 className="font-serif text-xl text-stone-900 mb-2">{product.name}</h4>
                <div className="flex justify-between items-center">
                  <p className="text-stone-500 tracking-widest text-sm">
                    Rs. {product.price.toLocaleString('en-IN')}
                  </p>
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <Star size={12} className={product.rating ? 'fill-stone-400' : ''} />
                    {product.rating ? `${product.rating}${product.ratingCount ? ` (${product.ratingCount})` : ''}` : 'No ratings yet'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <ShopByCategories onCategoryClick={onCategoryClick} categories={categories} />
      <MaterialCollections onMaterialClick={onMaterialClick} materials={materials} />
    </motion.div>
  );
};
