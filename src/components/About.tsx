import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface AboutData {
  title: string;
  description: string;
  bio_en: string;
  bio_ko: string;
  imageUrl?: string;
  freelanceProjects?: { company: string; project: string; work: string; year: string }[];
  career: { year: string; title: string; content: string }[];
  skills: string[];
  tools: string[];
}

export default function About() {
  const [data, setData] = useState<AboutData | null>(null);
  const [lang, setLang] = useState<'en' | 'ko'>('en');

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
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-16 md:gap-24 items-start">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
          className="sticky top-32"
        >
          <div className="relative group overflow-hidden">
            <img 
              src={data.imageUrl || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80"} 
              alt="KeenVi Studio space" 
              className="w-full aspect-[4/5] object-cover rounded-sm shadow-2xl grayscale transition-all duration-1000 group-hover:grayscale-0 opacity-80 group-hover:opacity-100"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 border border-white/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          </div>

          <div className="mt-8 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-neutral-500">Established</p>
            <p className="text-sm font-light tracking-widest text-neutral-300">SEOUL, SOUTH KOREA</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="space-y-20 lg:pr-12"
        >
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-6">
              <h1 className="text-5xl md:text-6xl font-light tracking-[0.2em] uppercase mb-4">{data.title}</h1>
              <p className="text-xl text-neutral-500 font-light tracking-widest uppercase italic">
                {data.description}
              </p>
            </div>

            <div className="space-y-6">
              {/* Language Toggle */}
              <div className="flex w-fit bg-neutral-900/50 p-0.5 rounded-full border border-white/5 backdrop-blur-sm">
                <button 
                  onClick={() => setLang('en')}
                  className={cn(
                    "px-4 py-1 rounded-full text-[9px] font-bold tracking-[0.1em] uppercase transition-all",
                    lang === 'en' ? "bg-white text-black shadow-lg" : "text-neutral-500 hover:text-white"
                  )}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLang('ko')}
                  className={cn(
                    "px-4 py-1 rounded-full text-[9px] font-bold tracking-[0.1em] uppercase transition-all",
                    lang === 'ko' ? "bg-white text-black shadow-lg" : "text-neutral-500 hover:text-white"
                  )}
                >
                  KO
                </button>
              </div>

              <div className="prose prose-invert max-w-none">
                <p className="text-neutral-300 leading-relaxed text-sm font-light tracking-wide whitespace-pre-wrap">
                  {lang === 'en' ? data.bio_en : data.bio_ko}
                </p>
              </div>

              {/* Freelance Table */}
              {data.freelanceProjects && data.freelanceProjects.length > 0 && (
                <div className="pt-2 overflow-x-auto">
                  <table className="w-full text-[11px] font-mono tracking-wider text-neutral-500 border-collapse">
                    <tbody className="divide-y divide-white/5">
                      {data.freelanceProjects.map((p, idx) => (
                        <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-2 text-white font-medium w-[12%]">{p.company}</td>
                          <td className="py-2 text-neutral-400 w-[23%]">{p.project}</td>
                          <td className="py-2 italic w-[55%]">{p.work}</td>
                          <td className="py-2 text-right w-[10%]">{p.year}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
            <div className="space-y-12 w-full max-w-[340px]">
              <h3 className="uppercase text-[10px] tracking-[0.5em] font-bold text-blue-500/80 mb-8 flex items-center gap-4">
                <span className="h-px w-8 bg-blue-500/30"></span>Chronicle
              </h3>
              <div className="space-y-6">
                {data.career.map((job, i) => (
                  <div key={i} className="flex gap-4 group">
                    <span className="text-neutral-600 text-[11px] tracking-[0.2em] w-20 sm:w-24 shrink-0 transition-colors group-hover:text-white font-mono">{job.year}</span>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium tracking-[0.15em] text-white uppercase">{job.title}</h4>
                      <p className="text-xs text-neutral-500 leading-loose tracking-wide whitespace-pre-wrap">{job.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-12">
              <div className="grid grid-cols-1 gap-12 lg:gap-16">
                <div className="space-y-8">
                  <h3 className="uppercase text-[10px] tracking-[0.5em] font-bold text-neutral-600 mb-6 flex items-center gap-4">
                    <span className="h-px w-8 bg-white/10"></span>Expertise
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4 text-[11px] tracking-[0.2em] text-neutral-400">
                    {data.skills.map(s => <li key={s} className="hover:text-white transition-colors flex items-center gap-2">
                      <span className="w-1 h-1 bg-white/20 rounded-full"></span>{s}
                    </li>)}
                  </ul>
                </div>
                <div className="space-y-8">
                  <h3 className="uppercase text-[10px] tracking-[0.5em] font-bold text-neutral-600 mb-6 flex items-center gap-4">
                    <span className="h-px w-8 bg-white/10"></span>Artifacts
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4 text-[11px] tracking-[0.2em] text-neutral-400">
                    {data.tools.map(t => <li key={t} className="hover:text-white transition-colors flex items-center gap-2">
                      <span className="w-1 h-1 bg-white/20 rounded-full"></span>{t}
                    </li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
