import express from 'express';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { isLocalImagePath, persistRemoteImage } from '../utils/imageStorage.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

const findFallbackImage = async (product, resolvedType) => {
  const matchers = [
    { category: product.category, image: { $regex: '^/uploads/' } },
    { type: resolvedType, image: { $regex: '^/uploads/' } },
    { image: { $regex: '^/uploads/' } },
  ];

  for (const matcher of matchers) {
    if (matcher.category === undefined) {
      delete matcher.category;
    }

    const fallbackProduct = await Product.findOne(matcher).sort({ updatedAt: -1 }).lean();
    if (fallbackProduct?.image) {
      return fallbackProduct.image;
    }
  }

  return null;
};

const resolveProductImage = async (product, resolvedType) => {
  if (!product.image || isLocalImagePath(product.image)) {
    return {
      image: product.image,
      imageOriginalUrl: product.image,
    };
  }

  try {
    return await persistRemoteImage({
      imageUrl: product.image,
      productName: product.name,
    });
  } catch (error) {
    const fallbackImage = await findFallbackImage(product, resolvedType);
    if (fallbackImage) {
      return {
        image: fallbackImage,
        imageOriginalUrl: product.image,
      };
    }

    throw error;
  }
};

const prepareProductPayload = async (product) => {
  const resolvedType = product.type === 'prestige' ? 'prestige' : 'product';
  const imagePayload = await resolveProductImage(product, resolvedType);

  return {
    ...product,
    ...imagePayload,
    type: resolvedType,
    featured: Boolean(product.featured),
    stockQuantity: Number(product.stockQuantity) || 25,
    collection: product.collection || product.category || 'Archive',
    tier: product.tier || (resolvedType === 'prestige' ? 'Prestige' : 'Signature'),
    rating: Number(product.rating) || (resolvedType === 'prestige' ? 5 : 4.8),
  };
};

router.get('/', async (req, res) => {
  try {
    const products = await Product.find({}).lean();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
});

router.post('/', protect, admin, async (req, res) => {
  try {
    const preparedProduct = await prepareProductPayload(req.body);
    const newProduct = new Product(preparedProduct);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error while creating product' });
  }
});

router.post('/bulk', protect, admin, async (req, res) => {
  try {
    const products = req.body;

    if (!Array.isArray(products)) {
      return res.status(400).json({ message: 'Input must be a JSON array of products' });
    }

    const preparedProducts = await Promise.all(products.map((product) => prepareProductPayload(product)));
    const insertedProducts = await Product.insertMany(preparedProducts);
    return res.status(201).json({
      message: `${insertedProducts.length} products inserted successfully`,
      data: insertedProducts,
    });
  } catch (error) {
    console.error('Error bulk inserting products:', error);
    return res.status(500).json({ message: 'Server error while bulk inserting products' });
  }
});

export default router;
