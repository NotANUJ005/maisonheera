import React from 'react';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { ScrollReveal } from '../ui/ScrollReveal';

export const ShopByCategories = ({ onCategoryClick, categories }) => (
  <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
    <ScrollReveal>
      <div className="text-center mb-16">
        <h3 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4">Find Your Perfect Match</h3>
        <p className="text-stone-500 font-light text-lg">Shop by Categories</p>
      </div>
    </ScrollReveal>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
      {categories.map((category) => (
        <ScrollReveal key={category.id}>
          <button
            onClick={() => onCategoryClick(category.name)}
            className="w-full group cursor-pointer flex flex-col items-center focus:outline-none focus:ring-1 focus:ring-stone-900 focus:ring-offset-4 text-left"
          >
            <div className="w-full aspect-square overflow-hidden bg-stone-100 mb-6 shadow-sm">
              <ImageWithFallback
                src={category.image}
                fallbackCategory={category.name}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>
            <h5 className="font-serif text-sm md:text-base tracking-widest uppercase text-stone-900 group-hover:text-stone-600 transition-colors w-full text-center">
              {category.name}
            </h5>
          </button>
        </ScrollReveal>
      ))}
    </div>
  </section>
);
