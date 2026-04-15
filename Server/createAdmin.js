import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@maisonheera.com' });
    
    if (adminExists) {
      // update to make sure it's an admin and change password
      adminExists.isAdmin = true;
      adminExists.password = 'SecureAdmin!23'; 
      await adminExists.save();
      console.log('Admin user updated and password reset successfully!');
      process.exit();
    }

    const user = new User({
      name: 'Super Admin',
      email: 'admin@maisonheera.com',
      password: 'SecureAdmin!23',
      isAdmin: true,
    });

    await user.save();
    console.log('Admin user created successfully!');
    process.exit();
  } catch (error) {
    console.error('Error with admin operations:', error);
    process.exit(1);
  }
};

createAdmin();
