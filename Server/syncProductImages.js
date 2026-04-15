import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import { isLocalImagePath, persistRemoteImage } from './utils/imageStorage.js';

dotenv.config();

const findFallbackImage = async (product) => {
  const matchers = [
    { category: product.category, image: { $regex: '^/uploads/' } },
    { type: product.type, image: { $regex: '^/uploads/' } },
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

const syncProductImages = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    const products = await Product.find({});
    console.log(`Found ${products.length} products to inspect`);

    let updatedCount = 0;
    let fallbackCount = 0;

    for (const product of products) {
      if (!product.image || isLocalImagePath(product.image)) {
        continue;
      }

      try {
        const imagePayload = await persistRemoteImage({
          imageUrl: product.image,
          productName: product.name,
        });

        product.image = imagePayload.image;
        product.imageOriginalUrl = imagePayload.imageOriginalUrl;
        await product.save();
        updatedCount += 1;
        console.log(`Synced image for ${product.name}`);
      } catch (error) {
        const fallbackImage = await findFallbackImage(product);

        if (fallbackImage) {
          product.imageOriginalUrl = product.image;
          product.image = fallbackImage;
          await product.save();
          fallbackCount += 1;
          console.log(`Applied fallback image for ${product.name}`);
        } else {
          console.error(`Failed to sync image for ${product.name}:`, error.message);
        }
      }
    }

    console.log(`Image sync complete. Downloaded ${updatedCount} products and applied ${fallbackCount} fallbacks.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Image sync failed:', error);
    process.exit(1);
  }
};

syncProductImages();
