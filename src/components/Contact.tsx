import { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Mail, MapPin, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const { error } = await supabase
        .from('messages')
        .insert([form]);
      
      if (!error) {
        setStatus('success');
        setForm({ name: '', email: '', company: '', message: '' });
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-10 py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-32">
        <div className="space-y-16">
          <div className="space-y-6">
            <h2 className="text-4xl font-light tracking-[0.3em] uppercase">Inquire</h2>
            <p className="text-gray-400 leading-relaxed font-light tracking-wide italic font-serif">
              Available for high-end concept art outsourcing and cinematic visual projects.
            </p>
          </div>

          <div className="space-y-10">
            <div className="flex items-start space-x-6 group">
              <div className="w-11 h-11 rounded-full border border-white/5 flex items-center justify-center shrink-0 group-hover:border-white/20 transition-colors">
                <Mail className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-blue-400 block mb-1">Electronic Mail</span>
                <a href="mailto:ucsuro@naver.com" className="text-white text-sm tracking-widest hover:text-blue-400 transition-colors">ucsuro@naver.com</a>
              </div>
            </div>
            <div className="flex items-start space-x-6 group">
              <div className="w-11 h-11 rounded-full border border-white/5 flex items-center justify-center shrink-0 group-hover:border-white/20 transition-colors">
                <MapPin className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-[0.4em] font-bold text-blue-400 block mb-1">Operational Base</span>
                <span className="text-white text-sm tracking-widest">Seoul, South Korea</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 gap-10">
            <div className="space-y-3">
              <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-neutral-600">Identity</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 px-0 py-3 focus:outline-none focus:border-white transition-colors text-sm tracking-widest"
                type="text"
                placeholder="YOUR NAME"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-neutral-600">Connectivity</label>
              <input
                required
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 px-0 py-3 focus:outline-none focus:border-white transition-colors text-sm tracking-widest"
                type="email"
                placeholder="EMAIL ADDRESS"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-neutral-600">Affiliation</label>
            <input
              value={form.company}
              onChange={e => setForm({...form, company: e.target.value})}
              className="w-full bg-transparent border-b border-white/10 px-0 py-3 focus:outline-none focus:border-white transition-colors text-sm tracking-widest"
              type="text"
              placeholder="COMPANY / STUDIO"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[9px] uppercase tracking-[0.4em] font-bold text-neutral-600">Transmission</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={e => setForm({...form, message: e.target.value})}
              className="w-full bg-transparent border-b border-white/10 px-0 py-3 focus:outline-none focus:border-white transition-colors resize-none text-sm tracking-widest"
              placeholder="PROJECT DESCRIPTION"
            />
          </div>
          
          <button
            disabled={status === 'sending'}
            className="w-full border border-white/10 text-white text-[11px] uppercase tracking-[0.4em] py-5 hover:bg-white hover:text-black transition-all disabled:opacity-50"
          >
            {status === 'sending' ? 'Transmitting...' : 'Initiate Contact'}
          </button>

          {status === 'success' && <p className="text-blue-400 text-[10px] uppercase tracking-widest text-center mt-4">Broadcast Received</p>}
          {status === 'error' && <p className="text-red-500 text-[10px] uppercase tracking-widest text-center mt-4">Signal Lost - Retry Required</p>}
        </form>
      </div>
    </div>
  );
}
