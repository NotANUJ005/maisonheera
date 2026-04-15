import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb+srv://Anuj01:realAnuj@maisenheera.quuzr0g.mongodb.net/MaisonHeera?retryWrites=true&w=majority');
  const Product = mongoose.model('Product', new mongoose.Schema({ name: String, image: String }, { strict: false }));
  await Product.updateOne({ name: 'Lumière Diamond Ring' }, { $set: { image: '/lumiere_ring.png' } });
  console.log('Updated db');
  mongoose.connection.getClient().close();
}

run();
