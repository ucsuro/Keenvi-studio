import { motion } from 'motion/react';
import { Youtube, Twitter, Instagram, Linkedin, Globe, Facebook } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onNavigate: (page: any, sub?: string) => void;
}

interface IntroData {
  logoText: string;
  headline: string;
  links: {
    artstation: string;
    youtube: string;
    instagram: string;
    linkedin: string;
    facebook: string;
    twitter: string;
  };
  gateways: {
    portfolio: string;
    project: string;
    personal: string;
  };
}

export default function Intro({ onNavigate }: Props) {
  const [data, setData] = useState<IntroData | null>(null);

  useEffect(() => {
    async function fetchIntroData() {
      try {
        const { data: res, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'intro')
          .single();
        
        if (error) throw error;
        if (res) setData(res.value);
      } catch (err) {
        console.error('Failed to fetch intro data:', err);
      }
    }
    fetchIntroData();
  }, []);

  const socialIcons: Record<string, React.ReactNode> = {
    artstation: <Globe className="w-4 h-4" />,
    youtube: <Youtube className="w-4 h-4" />,
    linkedin: <Linkedin className="w-4 h-4" />,
    twitter: <Twitter className="w-4 h-4" />,
    facebook: <Facebook className="w-4 h-4" />,
    instagram: <Instagram className="w-4 h-4" />,
  };

  const orderedKeys = ['artstation', 'youtube', 'linkedin', 'twitter', 'facebook', 'instagram'];

  const ensureAbsoluteUrl = (url: string) => {
    if (!url || url === '#') return '#';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  const entrances = data ? [
    { title: 'Portfolio', image: data.gateways.portfolio, type: 'Portfolio', subtitle: 'Curated Works' },
    { title: 'Project', image: data.gateways.project, type: 'Project', subtitle: 'Client Works' },
    { title: 'Personal Work', image: data.gateways.personal, type: 'Personal Work', subtitle: 'Archives' },
  ] : [];

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[70vh] md:h-[85vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="relative z-10 text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center h-[120px] md:h-[192px]"
          >
            <h1 className="text-[32px] sm:text-[45px] md:text-[68px] font-extralight tracking-[0.8em] text-white uppercase leading-tight md:leading-[95px] font-sans mr-[-0.8em]">
              {data?.logoText || "KEENVI STUDIO"}
            </h1>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="max-w-2xl mx-auto text-neutral-400 text-xs md:text-base leading-relaxed tracking-widest font-light mt-4 md:mt-0"
          >
            {data?.headline || "Visual Storyteller & Concept Artist based in Seoul."}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1.2 }}
            className="flex justify-center gap-6 mt-8 md:mt-14"
          >
            {data && orderedKeys.map((key) => (
              <a 
                key={key} 
                href={ensureAbsoluteUrl(data.links[key as keyof typeof data.links])} 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:border-white transition-all transform hover:-translate-y-1"
                title={key}
              >
                {socialIcons[key] || <Globe className="w-4 h-4" />}
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Entrance Buttons - Redesigned */}
      <section className="px-0 py-0 pb-1 w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
          {entrances.map((entrance, index) => (
            <motion.button
              key={entrance.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 * index, duration: 1 }}
              onClick={() => onNavigate(entrance.type as any)}
              className="relative h-[400px] md:h-[500px] lg:h-[650px] group overflow-hidden bg-neutral-900 border-t border-white/5"
            >
              <img 
                src={entrance.image} 
                alt={entrance.title} 
                className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110 opacity-30 group-hover:opacity-40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-neutral-950/20 group-hover:bg-transparent transition-colors" />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20 px-10">
                <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 mb-4 opacity-70 group-hover:opacity-100 group-hover:text-blue-400 transition-all transform group-hover:-translate-y-1">
                  {entrance.subtitle}
                </p>
                <div className="relative">
                  <h3 className="text-3xl md:text-4xl font-light tracking-[0.2em] text-white uppercase transition-all duration-700 group-hover:tracking-[0.3em]">
                    {entrance.title}
                  </h3>
                  <div className="h-[1px] w-0 bg-white/30 mx-auto mt-4 group-hover:w-full transition-all duration-700" />
                </div>
              </div>

              {/* Hover Grain/Overlay */}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}
