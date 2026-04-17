import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ScrollReveal } from '../components/ui/ScrollReveal';

export const About = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-24 pb-20 px-4 md:px-12 max-w-6xl mx-auto min-h-screen">
      <ScrollReveal>
        <div className="relative w-full h-[50vh] md:h-[70vh] flex items-center justify-center overflow-hidden mb-20 rounded-[2rem] shadow-xl bg-stone-900">
          <div className="absolute inset-0 bg-stone-900/40 z-10 transition-opacity duration-700 hover:bg-stone-900/30" />
          <img 
            src="https://images.unsplash.com/photo-1535632787350-4e68eefc5fac?q=80&w=2000&auto=format&fit=crop" 
            alt="Maison Heera Atelier" 
            className="absolute inset-0 w-full h-full object-cover transform scale-105 transition-transform duration-10000 hover:scale-100"
          />
          <div className="relative z-20 text-center px-4">
             <h1 className="text-5xl md:text-7xl font-serif text-white mb-6 tracking-wide drop-shadow-md">Our Heritage</h1>
             <div className="w-16 h-px bg-white/60 mx-auto mb-6" />
             <p className="text-white uppercase tracking-[0.3em] text-xs md:text-sm font-light drop-shadow">A Century of Brilliance</p>
          </div>
        </div>
      </ScrollReveal>

      <div className="max-w-4xl mx-auto space-y-20">
        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-stone-600 font-light leading-relaxed text-lg md:text-xl text-left">
              <h2 className="text-3xl font-serif text-stone-900 mb-4">The Beginning</h2>
              <p>
                Established in 1924 in the heart of London, Maison Heera began as an intimate atelier dedicated to the art of fine jewelry. For nearly a century, we have preserved the delicate intersection between timeless heritage and contemporary design, crafting pieces that transcend generations.
              </p>
            </div>
            <div className="h-[400px] rounded-[2rem] overflow-hidden shadow-lg border border-stone-200">
               <img src="https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=1000&auto=format&fit=crop" alt="Vintage craftsmanship" className="w-full h-full object-cover" />
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="h-[400px] rounded-[2rem] overflow-hidden shadow-lg border border-stone-200 order-2 md:order-1">
               <img src="https://images.unsplash.com/photo-1611085583191-a3b181a88401?q=80&w=1000&auto=format&fit=crop" alt="Master artisans" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-6 text-stone-600 font-light leading-relaxed text-lg md:text-xl text-left order-1 md:order-2">
               <h2 className="text-3xl font-serif text-stone-900 mb-4">Master Craftsmanship</h2>
              <p>
                Our master artisans hand-select every gemstone, from the deepest sapphires to the most brilliant diamonds, ensuring each creation resonates with unparalleled purity and brilliance. Beyond exquisite craftsmanship, Maison Heera represents a philosophy where luxury is intimate, personal, and forever.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto p-12 bg-stone-50 rounded-[2rem] border border-stone-200 shadow-inner">
             <h2 className="text-2xl font-serif text-stone-900 mb-6 italic">"A Legacy of Light"</h2>
            <p className="text-stone-600 font-light leading-relaxed text-lg">
              Whether it is an heirloom from The Archive or a custom commission from our Prestige Collection, every design carrying the hallmark of Maison Heera is an enduring testament to love, art, and the natural beauty of the earth.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </motion.div>
  );
};
