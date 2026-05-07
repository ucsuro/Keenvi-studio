import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

interface AboutData {
  title: string;
  description: string;
  bio: string;
  career: { year: string; title: string; content: string }[];
  skills: string[];
  tools: string[];
}

export default function About() {
  const [data, setData] = useState<AboutData | null>(null);

  useEffect(() => {
    async function fetchAboutData() {
      try {
        const { data: res, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'about')
          .single();
        
        if (error) throw error;
        if (res) setData(res.value);
      } catch (err) {
        console.error('Failed to fetch about data:', err);
      }
    }
    fetchAboutData();
  }, []);

  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto px-10 py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-start">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
        >
          <div className="relative group overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80" 
              alt="KeenVi Studio space" 
              className="w-full rounded-sm shadow-2xl grayscale opacity-70 group-hover:opacity-90 transition-opacity duration-1000"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 border border-white/10" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="space-y-16"
        >
          <div>
            <h1 className="text-4xl font-light tracking-[0.3em] uppercase mb-8">{data.title}</h1>
            <p className="text-lg text-gray-400 font-light leading-relaxed tracking-wide italic font-serif">
              {data.description}
            </p>
          </div>

          <div className="prose prose-invert max-w-none">
            <p className="text-neutral-400 leading-loose text-sm tracking-wide">
              {data.bio}
            </p>
          </div>

          <div className="space-y-10">
            <h3 className="uppercase text-[10px] tracking-[0.4em] font-bold text-blue-400">Chronicle</h3>
            <div className="space-y-8">
              {data.career.map((job, i) => (
                <div key={i} className="flex gap-8 group">
                  <span className="text-neutral-600 text-[11px] tracking-widest w-24 shrink-0 transition-colors group-hover:text-white">{job.year}</span>
                  <div>
                    <h4 className="text-sm font-medium tracking-widest text-white">{job.title}</h4>
                    <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{job.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-16 pt-12 border-t border-white/5">
            <div className="space-y-6">
              <h3 className="uppercase text-[9px] tracking-[0.4em] font-bold text-neutral-500">Expertise</h3>
              <ul className="space-y-3 text-[11px] tracking-widest text-neutral-400">
                {data.skills.map(s => <li key={s} className="hover:text-white transition-colors">{s}</li>)}
              </ul>
            </div>
            <div className="space-y-6">
              <h3 className="uppercase text-[9px] tracking-[0.4em] font-bold text-neutral-500">Artifacts</h3>
              <ul className="space-y-3 text-[11px] tracking-widest text-neutral-400">
                {data.tools.map(t => <li key={t} className="hover:text-white transition-colors">{t}</li>)}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
