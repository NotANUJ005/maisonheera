export const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.6, 0.05, 0.01, 0.9] }
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export const loaderVariants = {
  initial: { opacity: 1 },
  exit: { 
    opacity: 0,
    transition: { duration: 1, ease: "easeInOut", when: "afterChildren" }
  }
};

export const logoTextVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" }
  }
};