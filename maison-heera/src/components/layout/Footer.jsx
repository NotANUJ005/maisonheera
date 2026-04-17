import React, { useState } from 'react';
import { Instagram, Facebook, Twitter, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: Instagram },
  { label: 'Facebook', href: 'https://www.facebook.com/', icon: Facebook },
  { label: 'Twitter', href: 'https://x.com/', icon: Twitter },
];

export const Footer = ({ onNavigate, notify, userInfo }) => {
  const [email, setEmail] = useState('');

  const quickLinks = [
    { label: 'Home', view: 'home' },
    { label: 'Collections', view: 'shop' },
    { label: 'Prestige', view: 'prestige-shop' },
    { label: 'Track Order', view: userInfo ? 'account' : 'track-order' },
    { label: 'About', view: 'about' },
    { label: 'Contact', view: 'contact' },
  ];

  const handleNewsletterSubmit = (event) => {
    event.preventDefault();
    if (!email.trim()) return;

    const existing = JSON.parse(localStorage.getItem('maison-heera.newsletter') || '[]');
    const next = [...new Set([...existing, email.trim().toLowerCase()])];
    localStorage.setItem('maison-heera.newsletter', JSON.stringify(next));
    setEmail('');
    notify({
      title: 'Subscribed',
      message: 'You will receive collection drops and concierge updates.',
      tone: 'success',
    });
  };

  return (
    <footer className="bg-stone-950 text-stone-400 px-6 py-20 md:px-12 border-t border-stone-900">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <h2 className="text-white font-serif text-2xl tracking-[0.3em] mb-6">MAISON HEERA</h2>
          <p className="max-w-md text-sm leading-7 text-stone-400">
            A high-jewelry house for collectors, celebratory gifting, and private client services.
            Every piece is curated with insured delivery and concierge aftercare.
          </p>
          <div className="mt-8 flex gap-3">
            {socialLinks.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-800 text-stone-300 transition hover:border-stone-600 hover:text-white"
                >
                  <Icon size={18} />
                </a>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">Explore</h3>
          <div className="mt-6 flex flex-col gap-4">
            {quickLinks.map((item) => (
              <button
                key={item.view}
                onClick={() => onNavigate({ view: item.view })}
                className="text-left text-sm transition hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-white">Private Updates</h3>
          <p className="mt-6 text-sm leading-7">
            Join the Maison list for collection launches, bespoke events, and aftercare guidance.
          </p>
          <form onSubmit={handleNewsletterSubmit} className="mt-6 rounded-[1.5rem] border border-stone-800 bg-stone-900/60 p-4">
            <label className="block text-[10px] uppercase tracking-[0.25em] text-stone-500">Email Address</label>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-stone-600"
                required
              />
              <Button type="submit" className="px-4 py-3">
                <ArrowRight size={14} />
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-7xl border-t border-stone-900 pt-6 text-[10px] uppercase tracking-widest text-stone-600">
        Copyright 2026 Maison Heera. All rights reserved.
      </div>
    </footer>
  );
};
