import React, { useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ImageWithFallback } from '../ui/ImageWithFallback';

export const AnimatedHeroBg = ({ productsData }) => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, -100]);

  const heroProducts = useMemo(() => {
    const featured = productsData.filter((product) => product.featured);
    const source = featured.length >= 6 ? featured : productsData;
    return source.slice(0, 6);
  }, [productsData]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-stone-950">
      <motion.div style={{ y: y1 }} className="absolute inset-0 opacity-50">
        <div className="grid grid-cols-3 gap-4 w-[120%] h-[120%] -ml-[10%] -mt-[5%]">
          {heroProducts.map((product, index) => (
            <motion.div
              key={product.id || index}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 0.4, scale: 1 }}
              transition={{ duration: 2, delay: index * 0.2 }}
              className="h-full w-full overflow-hidden"
            >
              <ImageWithFallback src={product.image} fallbackCategory={product.category} className="w-full h-full object-cover" />
            </motion.div>
          ))}
        </div>
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-stone-950/80" />
    </div>
  );
};
