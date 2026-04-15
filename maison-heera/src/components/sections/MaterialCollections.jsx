import React from 'react';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { ScrollReveal } from '../ui/ScrollReveal';

export const MaterialCollections = ({ onMaterialClick, materials }) => (
  <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
    <ScrollReveal>
      <div className="text-center mb-16">
        <h3 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4">Maison Heera World</h3>
        <p className="text-stone-500 font-light text-lg">A companion for every occasion</p>
      </div>
    </ScrollReveal>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {materials.map((material) => (
        <ScrollReveal key={material.id}>
          <button
            onClick={() => onMaterialClick(material.name)}
            className="group relative aspect-[4/3] md:h-[400px] w-full overflow-hidden cursor-pointer focus:outline-none focus:ring-1 focus:ring-stone-900 focus:ring-offset-4 text-left block"
          >
            <ImageWithFallback
              src={material.image}
              fallbackCategory={null}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />
            <div className="absolute bottom-10 w-full text-center">
              <h4 className="text-3xl font-serif text-white tracking-wider drop-shadow-md">{material.name}</h4>
            </div>
          </button>
        </ScrollReveal>
      ))}
    </div>
  </section>
);
