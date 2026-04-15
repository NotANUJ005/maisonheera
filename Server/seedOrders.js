import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import Product from './models/Product.js';
import User from './models/User.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const STATUSES = ['created', 'processing', 'shipped', 'delivered', 'cancelled'];
const RETURN_STATUSES = ['none', 'none', 'none', 'requested', 'pickup-scheduled', 'received', 'completed'];

const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateFakeOrders = async () => {
  await connectDB();

  // Clean existing orders
  await Order.deleteMany({});
  console.log('Existing orders removed.');

  const products = await Product.find({});
  const users = await User.find({});

  if (products.length === 0 || users.length === 0) {
    console.log('Ensure you have users and products in the DB first.');
    process.exit(1);
  }

  const dummyUserIds = users.filter((u) => !u.isAdmin).map((u) => u._id.toString());
  if (dummyUserIds.length === 0) dummyUserIds.push(users[0]._id.toString());

  const ordersToInsert = [];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const numOrders = 150; // Enough to populate charts
  
  for (let i = 0; i < numOrders; i++) {
    const orderDate = randomDate(oneYearAgo, new Date());
    const isPaid = Math.random() > 0.1; // 90% chance paid
    const status = isPaid ? getRandomElement(STATUSES.slice(1)) : 'created';
    
    // Pick 1-3 random products
    const orderItemsCount = getRandomInt(1, 3);
    const orderItems = [];
    let totalPrice = 0;

    for (let j = 0; j < orderItemsCount; j++) {
      const p = getRandomElement(products);
      const qty = getRandomInt(1, 2);
      
      const itemStatus = status === 'delivered' ? getRandomElement(RETURN_STATUSES) : 'none';
      
      orderItems.push({
        name: p.name,
        qty,
        image: p.image,
        price: p.price,
        product: p._id.toString(),
        returnStatus: itemStatus,
        returnReason: itemStatus !== 'none' ? 'Changed my mind' : '',
        returnRequestedAt: itemStatus !== 'none' ? randomDate(orderDate, new Date()) : null,
      });
      totalPrice += p.price * qty;
    }

    ordersToInsert.push({
      user: getRandomElement(dummyUserIds),
      orderItems,
      shippingAddress: {
        fullName: 'Demo Customer',
        email: 'demo@example.com',
        phone: '+1 555-0100',
        address: '123 Fake St',
        city: 'Metropolis',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      paymentMethod: Math.random() > 0.2 ? 'razorpay' : 'cod',
      totalPrice,
      isPaid,
      paidAt: isPaid ? orderDate : null,
      orderStatus: status,
      createdAt: orderDate,
      updatedAt: randomDate(orderDate, new Date()),
    });
  }

  try {
    await Order.insertMany(ordersToInsert);
    console.log(`${numOrders} demo orders successfully inserted!`);
    process.exit();
  } catch (error) {
    console.error(`Error inserting orders: ${error.message}`);
    process.exit(1);
  }
};

generateFakeOrders();
