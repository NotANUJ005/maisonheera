import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';

export const Contact = ({ notify }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const inquiries = JSON.parse(localStorage.getItem('maison-heera.inquiries') || '[]');
    inquiries.unshift({
      ...formData,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('maison-heera.inquiries', JSON.stringify(inquiries));
    setFormData({ name: '', email: '', message: '' });
    notify({
      title: 'Inquiry received',
      message: 'Our client services team will respond shortly.',
      tone: 'success',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="pt-24 pb-20 px-4 md:px-12 max-w-6xl mx-auto min-h-screen"
    >
      <div className="relative w-full h-[40vh] md:h-[50vh] flex items-center justify-center overflow-hidden mb-16 rounded-[2rem] shadow-xl text-center">
        <div className="absolute inset-0 bg-stone-900/50 z-10 transition-opacity duration-700 hover:bg-stone-900/40" />
        <img 
          src="https://images.unsplash.com/photo-1543003588-4660d5bfa1ec?q=80&w=2000&auto=format&fit=crop" 
          alt="Boutique" 
          className="absolute inset-0 w-full h-full object-cover transform scale-105 transition-transform duration-10000 hover:scale-100"
        />
        <div className="relative z-20 px-4">
          <h1 className="text-4xl md:text-6xl font-serif text-white mb-6 drop-shadow-md">Contact Us</h1>
          <div className="w-16 h-px bg-white/60 mx-auto mb-6" />
          <p className="text-white uppercase tracking-[0.3em] text-xs font-light drop-shadow">We are here to assist you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-serif mb-6 border-b border-stone-200 pb-2">Client Services</h2>
          <p className="text-stone-600 font-light leading-relaxed mb-8">
            Our dedicated team of advisors is available to assist you with inquiries regarding our collections, custom commissions, or aftercare services.
          </p>

          <div className="space-y-6 text-sm">
            <div>
              <span className="block text-stone-400 tracking-widest uppercase text-xs mb-1">Email</span>
              <a href="mailto:concierge@maisonheera.com" className="text-stone-900 border-b border-stone-900 pb-0.5 hover:text-stone-500 hover:border-stone-500 transition-colors">
                concierge@maisonheera.com
              </a>
            </div>
            <div>
              <span className="block text-stone-400 tracking-widest uppercase text-xs mb-1">Phone</span>
              <a href="tel:+442071234567" className="text-stone-900">+44 20 7123 4567</a>
            </div>
            <div>
              <span className="block text-stone-400 tracking-widest uppercase text-xs mb-1">Hours</span>
              <p className="text-stone-900">Monday - Friday, 9:00 AM - 6:00 PM GMT</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-serif mb-6 border-b border-stone-200 pb-2">Send an Inquiry</h2>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="relative">
              <input
                type="text"
                required
                placeholder=" "
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none text-stone-900"
              />
              <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                Full Name
              </label>
            </div>
            <div className="relative">
              <input
                type="email"
                required
                placeholder=" "
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none text-stone-900"
              />
              <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                Email Address
              </label>
            </div>
            <div className="relative mt-2">
              <textarea
                required
                rows={4}
                placeholder=" "
                value={formData.message}
                onChange={(event) => setFormData((prev) => ({ ...prev, message: event.target.value }))}
                className="w-full bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-stone-900 transition-colors peer rounded-none text-stone-900 resize-none"
              />
              <label className="absolute left-0 top-2 text-stone-400 text-sm uppercase tracking-widest pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-[10px] peer-valid:-top-4 peer-valid:text-[10px] peer-focus:text-stone-900">
                Your Message
              </label>
            </div>
            <Button type="submit" className="w-full mt-4 py-4 uppercase tracking-[0.2em] text-xs">
              Send Message
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};
