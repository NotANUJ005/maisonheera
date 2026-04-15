import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animations';

export const ScrollReveal = ({ children }) => (
  <motion.div initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.2 }} variants={fadeInUp}>
    {children}
  </motion.div>
);