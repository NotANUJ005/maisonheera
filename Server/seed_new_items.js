import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

const newProducts = [
  {
    name: "The Emerald Gala",
    price: 45000000,
    description: "An unbelievable culmination of craftsmanship. A cascade of flawless Colombian emeralds and brilliant-cut diamonds, meticulously set in platinum. The pinnacle of the Maison Heera legacy.",
    category: "Necklace",
    image: "/uploads/emerald.png",
    rating: 5,
    numReviews: 14,
    countInStock: 1,
    type: "prestige"
  },
  {
    name: "Sapphire Ocean Heirloom",
    price: 32000000,
    description: "A colossal deep blue sapphire extracted from the finest mines, gracefully encased in an intricate halo of rare diamonds.",
    category: "Ring",
    image: "/uploads/sapphire.png",
    rating: 5,
    numReviews: 8,
    countInStock: 2,
    type: "prestige"
  },
  {
    name: "Ruby Empress Tiara",
    price: 68000000,
    description: "Commissioned for royalty. A breathtaking lattice of platinum hosting pristine pigeon-blood rubies and thousands of masterfully cut diamonds.",
    category: "Tiara",
    image: "/uploads/ruby.png",
    rating: 5,
    numReviews: 3,
    countInStock: 1,
    type: "prestige"
  }
];

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected for seeding new prestige items.');
    const inserted = await Product.insertMany(newProducts);
    console.log(`Inserted ${inserted.length} new luxury products.`);
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error('Error seeding data:', err);
    process.exit(1);
  });
