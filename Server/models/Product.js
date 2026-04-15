import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    material: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    image: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    imageOriginalUrl: String,
    type: {
      type: String,
      enum: {
        values: ['product', 'prestige'],
        message: '{VALUE} is not a valid type',
      },
      required: true,
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    collection: {
      type: String,
      default: 'Archive',
    },
    tier: {
      type: String,
      default: 'Signature',
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockQuantity: {
      type: Number,
      default: 25,
      min: [0, 'Stock cannot be negative'],
    },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

export default Product;
