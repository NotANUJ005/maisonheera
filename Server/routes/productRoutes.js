import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { isLocalImagePath, persistRemoteImage } from '../utils/imageStorage.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productUploadsDir = path.resolve(__dirname, '..', 'uploads', 'products');

fs.mkdirSync(productUploadsDir, { recursive: true });

const slugify = (value) =>
  String(value || 'product')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, productUploadsDir);
    },
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname) || '.jpg';
      const productName = req.body?.name || 'product';
      callback(null, `${slugify(productName)}-${Date.now()}${extension.toLowerCase()}`);
    },
  }),
  fileFilter: (_req, file, callback) => {
    if (file.mimetype?.startsWith('image/')) {
      callback(null, true);
      return;
    }

    callback(new Error('Only image files can be uploaded.'));
  },
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const handleProductUpload = (req, res, next) => {
  imageUpload.single('imageFile')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    res.status(400).json({
      message: error.message || 'Product image upload failed.',
    });
  });
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'on', 'yes'].includes(String(value || '').trim().toLowerCase());
};

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

const buildIncomingProductPayload = (body = {}, file = null) => ({
  ...body,
  price: Number(body.price),
  stockQuantity: Number(body.stockQuantity),
  featured: parseBoolean(body.featured),
  image: file ? `/uploads/products/${file.filename}` : body.image,
  imageOriginalUrl: file ? `/uploads/products/${file.filename}` : body.imageOriginalUrl,
});

router.get('/', async (req, res) => {
  try {
    const products = await Product.find({}).lean();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
});

router.post('/', protect, admin, handleProductUpload, async (req, res) => {
  try {
    const preparedProduct = await prepareProductPayload(buildIncomingProductPayload(req.body, req.file));
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
