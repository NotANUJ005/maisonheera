import React, { useEffect, useState } from 'react';
import { LUXURY_PRODUCTS } from '../../data/products';

export const ImageWithFallback = ({ src, fallbackCategory, alt, className, ...props }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (hasError) return;

    setHasError(true);

    const fallbacks = LUXURY_PRODUCTS.filter(
      (product) => product.category === fallbackCategory && product.image !== src,
    );

    if (fallbacks.length > 0) {
      const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      setImgSrc(randomFallback.image);
      return;
    }

    setImgSrc(LUXURY_PRODUCTS[0]?.image || src);
  };

  return <img src={imgSrc} alt={alt || ''} className={className} onError={handleError} {...props} />;
};
