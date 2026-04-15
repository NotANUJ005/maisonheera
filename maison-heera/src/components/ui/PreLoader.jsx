import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { loaderVariants, logoTextVariants } from '../../utils/animations';

export const PreLoader = ({ setLoading }) => {
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, [setLoading]);

  return (
    <motion.div variants={loaderVariants} initial="initial" exit="exit" className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-stone-950 text-white">
      <div className="overflow-hidden mb-4">
        <motion.h1 variants={logoTextVariants} initial="initial" animate="animate" className="text-2xl md:text-3xl font-serif tracking-[0.5em] uppercase">
          Maison Heera
        </motion.h1>
      </div>
      <motion.div 
        initial={{ width: 0, opacity: 0 }} animate={{ width: "100px", opacity: 1 }} transition={{ delay: 0.5, duration: 1.5, ease: "easeInOut" }}
        className="h-[1px] bg-stone-500"
      />
    </motion.div>
  );
};