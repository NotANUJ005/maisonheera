import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { ScrollReveal } from '../ui/ScrollReveal';

const clampIndex = (index, length) => {
  if (!length) {
    return 0;
  }

  return ((index % length) + length) % length;
};

const buildFanCardStyle = ({ index, count, hoveredIndex, activeIndex }) => {
  let offset = index - activeIndex;

  // Wrap the index offsets to naturally flow the carousel from both ends
  if (offset > count / 2) offset -= count;
  if (offset < -count / 2) offset += count;

  // The 3D Panorama Layout Constraints adjusted for Side-by-Side look
  const baseSpacing = window.innerWidth < 768 ? 120 : 150;
  const x = offset * baseSpacing;

  // The Panorama cylinder rotation
  const rotateY = offset * -18; // Negative means the left items face inward to the right

  // Pushing outer items deep into Z-space
  const absOffset = Math.abs(offset);
  const translateZ = absOffset * -120;

  const isActive = offset === 0;
  const isHovered = index === hoveredIndex;

  // Vertical alignment
  const y = isActive ? -25 : isHovered ? -15 : absOffset * 8;

  // Visual scaling and depth
  const scale = isActive ? 1.1 : isHovered ? 1.05 : 0.95 - (absOffset * 0.05);
  const opacity = absOffset > 3 ? 0 : 1 - (absOffset * 0.2);
  const zIndex = 50 - absOffset;
  const brightness = isActive ? 1 : isHovered ? 0.95 : 0.6 - (absOffset * 0.1);

  return {
    rotateY,
    translateZ,
    x,
    y,
    scale,
    zIndex,
    brightness,
    opacity,
  };
};

export const PrestigeCollection = ({ onViewDetail, onSeeAll, prestigeData }) => {
  const [activeIndex, setActiveIndex] = useState(3);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const displayItems = useMemo(() => {
    const selected = [...prestigeData]
      .sort((a, b) => b.price - a.price)
      .slice(0, 6);

    return [
      ...selected,
      {
        id: 'see-all',
        isSeeAll: true,
        name: 'Discover the Archives',
        category: 'Prestige',
        description: 'Enter the complete archive of rare heirloom creations and high-jewelry statements.',
        image: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=800&q=80',
      },
    ];
  }, [prestigeData]);

  useEffect(() => {
    if (!displayItems.length || hoveredIndex !== null) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((previous) => clampIndex(previous + 1, displayItems.length));
    }, 3400);

    return () => window.clearInterval(interval);
  }, [displayItems.length, hoveredIndex]);

  const normalizedActiveIndex = clampIndex(activeIndex, displayItems.length);
  const activeItem = displayItems[normalizedActiveIndex];

  const openActiveItem = (item) => {
    if (!item) {
      return;
    }

    if (item.isSeeAll) {
      onSeeAll();
      return;
    }

    onViewDetail(item);
  };

  const handleItemClick = (item, index) => {
    if (index !== normalizedActiveIndex) {
      setActiveIndex(index);
      return;
    }

    openActiveItem(item);
  };

  return (
    <section className="relative overflow-hidden bg-stone-950 py-28 text-stone-50 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_32%),radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_38%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="text-center">
          <ScrollReveal>
            <span className="mb-4 block text-xs uppercase tracking-[0.4em] text-stone-400">
              The Pinnacle of Craft
            </span>
            <h3 className="text-4xl font-serif md:text-5xl">The Prestige Archives</h3>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-stone-400 md:text-base">
              A fan of rare masterpieces unfolding in a ceremonial arc. Hover to spread the collection, then select a
              piece to bring it forward.
            </p>
          </ScrollReveal>
        </div>

        <div className="relative mt-8 md:mt-16 pb-12 mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col md:flex-row overflow-hidden rounded-[2.5rem] border border-stone-800 bg-stone-900/60 shadow-[0_45px_120px_rgba(0,0,0,0.45)] backdrop-blur"
          >
            {/* Left Half: The 3D Panorama Showcase */}
            <div className="relative z-50 h-[300px] w-full md:w-[60%] md:h-[500px] pt-12 md:pt-0 [perspective:1200px] flex items-center justify-center">
              <div className="absolute inset-0 pointer-events-none [transform-style:preserve-3d]">
                {displayItems.map((item, index) => {
                  const presentation = buildFanCardStyle({
                    index,
                    count: displayItems.length,
                    hoveredIndex,
                    activeIndex: normalizedActiveIndex,
                  });

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onFocus={() => setHoveredIndex(index)}
                      onBlur={() => setHoveredIndex(null)}
                      onClick={() => handleItemClick(item, index)}
                      className="prestige-fan-card absolute top-1/2 left-1/2 focus:outline-none"
                      style={{
                        transform: `translate3d(calc(-50% + ${presentation.x}px), calc(-50% + ${presentation.y}px), ${presentation.translateZ}px) rotateY(${presentation.rotateY}deg) scale(${presentation.scale})`,
                        zIndex: presentation.zIndex,
                        opacity: presentation.opacity,
                        filter: `brightness(${presentation.brightness})`,
                      }}
                      aria-label={item.isSeeAll ? 'See all prestige items' : `View details for ${item.name}`}
                    >
                      <div
                        className={`w-[130px] overflow-hidden rounded-[1rem] border border-stone-700/70 bg-stone-900 p-2 shadow-[0_25px_60px_rgba(0,0,0,0.45)] transition-all duration-[1150ms] ease-out md:w-[220px] ${index === normalizedActiveIndex ? 'border-amber-300/60' : 'hover:border-stone-500'}`}
                      >
                        <div className="aspect-[4/6] overflow-hidden rounded-[0.75rem] bg-stone-900">
                          <ImageWithFallback
                            src={item.image}
                            fallbackCategory={item.category}
                            alt={item.name}
                            loading="lazy"
                            className={`h-full w-full object-cover transition-transform duration-[1400ms] ${item.isSeeAll ? 'grayscale-[0.15]' : ''}`}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Half: Active Item Details */}
            {activeItem && (
              <div className="relative z-40 bg-stone-950/40 w-full md:w-[40%] min-h-[380px] md:min-h-full py-8 md:py-16 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-stone-800/60">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeItem.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, position: 'absolute' }}
                    transition={{ duration: 0.4 }}
                    className="flex w-full flex-col items-center p-8 text-center md:px-12"
                  >
                    <div className="mb-6 h-[1px] w-12 bg-stone-600" />
                    <p className="text-[10px] uppercase tracking-[0.35em] text-stone-400">
                      {activeItem.isSeeAll ? 'Archive Gateway' : activeItem.category || 'Prestige'}
                    </p>
                    <h4 className="mt-4 text-3xl font-serif text-white md:text-5xl">{activeItem.name}</h4>
                    <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-stone-400 md:text-base">
                      {activeItem.description || 'An exceptional high-jewelry creation curated for the Maison Heera archives.'}
                    </p>

                    {!activeItem.isSeeAll && activeItem.price ? (
                      <p className="mt-6 text-sm uppercase tracking-[0.28em] text-amber-200">
                        Rs. {Number(activeItem.price).toLocaleString('en-IN')}
                      </p>
                    ) : null}

                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => openActiveItem(activeItem)}
                        className="inline-flex items-center justify-center rounded-full border border-stone-200/20 bg-white px-8 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-stone-950 transition-colors hover:bg-amber-200"
                      >
                        {activeItem.isSeeAll ? 'Explore All Archives' : 'Discover Piece'}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <style>
        {`
          .prestige-fan-card {
            transition:
              transform 1100ms cubic-bezier(0.22, 1, 0.36, 1),
              opacity 800ms ease,
              filter 800ms ease;
            will-change: transform, opacity, filter;
          }
        `}
      </style>
    </section>
  );
};
