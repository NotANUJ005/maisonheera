

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/product.js';

dotenv.config();

// paste your collections array here
const MAISON_DATA = {
  collections: [
    {
      type: "product",
      name: "Lumière Diamond Ring",
      price: 350000,
      category: "Rings",
      material: "Platinum",
      featured: true,
      description: "An exquisite platinum ring featuring a brilliant-cut diamond.",
      image: "/lumiere_ring.png"
    },
    {
      type: "product",
      name: "Heritage Gold Pendant",
      price: 125000,
      category: "Pendants",
      material: "Gold",
      featured: true,
      description: "A timeless gold pendant crafted with heritage detailing.",
      image: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Étoile Drop Earrings",
      price: 210000,
      category: "Earrings",
      material: "White Gold",
      featured: true,
      description: "Refined drop earrings crafted in luminous white gold.",
      image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Royale Pearl Bracelet",
      price: 85000,
      category: "Bracelets",
      material: "Rose Gold",
      featured: false,
      description: "Elegant pearl bracelet set in rose gold.",
      image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Vintage Solitaire Ring",
      price: 420000,
      category: "Rings",
      material: "Gold",
      featured: false,
      description: "A classic solitaire ring in polished gold.",
      image: "https://images.unsplash.com/photo-1602752250013-05b63b400976?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Sapphire Halo Necklace",
      price: 540000,
      category: "Necklaces",
      material: "Platinum",
      featured: true,
      description: "A sapphire centerpiece surrounded by a radiant diamond halo.",
      image: "/sapphire_necklace.png"
    },
    {
      type: "product",
      name: "Aurora Diamond Studs",
      price: 185000,
      category: "Earrings",
      material: "Diamond",
      featured: true,
      description: "Classic diamond studs crafted for timeless brilliance and everyday sophistication.",
      image: "https://images.unsplash.com/photo-1588444650733-d99b0d5f02c1?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Regal Ruby Pendant",
      price: 295000,
      category: "Pendants",
      material: "Gold",
      featured: false,
      description: "A vivid Burmese ruby set in rich 18k gold with intricate detailing.",
      image: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca6?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Serenity Diamond Bracelet",
      price: 375000,
      category: "Bracelets",
      material: "White Gold",
      featured: true,
      description: "Delicate white gold bracelet adorned with precision-set diamonds.",
      image: "https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Eternal Promise Ring",
      price: 260000,
      category: "Rings",
      material: "Platinum",
      featured: false,
      description: "A refined platinum band symbolizing everlasting commitment.",
      image: "https://images.unsplash.com/photo-1603561596112-0a132b757442?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Velvet Emerald Drops",
      price: 430000,
      category: "Earrings",
      material: "Gold",
      featured: true,
      description: "Emerald drop earrings radiating royal charm and sophistication.",
      image: "https://images.unsplash.com/photo-1599643478273-7a3cfc5c2a1a?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "product",
      name: "Noir Onyx Necklace",
      price: 190000,
      category: "Necklaces",
      material: "Silver",
      featured: false,
      description: "A bold black onyx pendant suspended from a sleek silver chain.",
      image: "https://images.unsplash.com/photo-1599643478323-5cde1c7aaf7f?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Crown of Versailles",
      price: 18500000,
      category: "High Jewelry",
      material: "Diamond",
      featured: false,
      description: "A regal tiara composed of 60 carats of flawless diamonds in platinum latticework.",
      image: "https://images.unsplash.com/photo-1588444650700-6b1c9d7b8e63?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Scarlet Majesty Necklace",
      price: 14200000,
      category: "High Jewelry",
      material: "Gold",
      featured: false,
      description: "An extraordinary ruby necklace inspired by royal European courts.",
      image: "/ruby_necklace.png"
    },
    {
      type: "prestige",
      name: "Ocean Whisper Sapphire Set",
      price: 16800000,
      category: "High Jewelry",
      material: "White Gold",
      featured: false,
      description: "A majestic sapphire necklace and earrings set reminiscent of deep ocean hues.",
      image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Golden Dynasty Cuff",
      price: 9800000,
      category: "High Jewelry",
      material: "Gold",
      featured: false,
      description: "A handcrafted gold cuff inspired by ancient imperial artistry.",
      image: "https://images.unsplash.com/photo-1611591437428-5f0b2d6e7f9c?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Eclipse Black Diamond Ring",
      price: 11200000,
      category: "High Jewelry",
      material: "Platinum",
      featured: false,
      description: "A rare black diamond centerpiece radiating celestial mystery.",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "The Imperial Emerald",
      price: 8500000,
      category: "High Jewelry",
      material: "Platinum",
      featured: false,
      description: "Museum-quality emerald masterpiece set in flawless platinum.",
      image: "https://images.unsplash.com/photo-1614164185128-e4ec99c436d7?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Celestial Diamond Choker",
      price: 12500000,
      category: "High Jewelry",
      material: "Diamond",
      featured: false,
      description: "Over 40 carats of internally flawless diamonds.",
      image: "https://images.unsplash.com/photo-1599643478524-fb66f70362f6?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Midnight Sapphire Tiara",
      price: 6800000,
      category: "High Jewelry",
      material: "White Gold",
      featured: false,
      description: "A royal tiara crowned with a breathtaking Kashmir sapphire.",
      image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80"
    },
    {
      type: "prestige",
      name: "Opaline Dream Ring",
      price: 4200000,
      category: "High Jewelry",
      material: "Platinum",
      featured: false,
      description: "A rare black Australian opal surrounded by a diamond halo.",
      image: "https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&w=800&q=80"
    }
  ]
};

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    await Product.deleteMany();
    console.log("Old products removed");

    await Product.insertMany(MAISON_DATA.collections);
    console.log("New products inserted");

    await mongoose.connection.close();
    console.log("Connection closed");

    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
}

seedDatabase();