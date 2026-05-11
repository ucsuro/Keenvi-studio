import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MapPin, Globe, Copy, Check, Youtube, Twitter, Instagram, Linkedin, Facebook } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface IntroData {
  links: {
    artstation: string;
    youtube: string;
    instagram: string;
    linkedin: string;
    facebook: string;
    twitter: string;
  };
}

export default function Contact() {
  const [copied, setCopied] = useState(false);
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText('ucsuro@naver.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const socialIcons: Record<string, React.ReactNode> = {
    artstation: <Globe className="w-5 h-5" />,
    youtube: <Youtube className="w-5 h-5" />,
    linkedin: <Linkedin className="w-5 h-5" />,
    twitter: <Twitter className="w-5 h-5" />,
    facebook: <Facebook className="w-5 h-5" />,
    instagram: <Instagram className="w-5 h-5" />,
  };

  const orderedKeys = ['artstation', 'youtube', 'linkedin', 'twitter', 'facebook', 'instagram'];

  const ensureAbsoluteUrl = (url: string) => {
    if (!url || url === '#') return '#';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-32 flex flex-col items-center justify-start min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="w-full space-y-16 md:space-y-24 lg:space-y-32 text-center"
      >
        <div className="space-y-6 md:space-y-8">
          <p className="max-w-xl mx-auto text-neutral-400 text-xs sm:text-sm leading-loose font-light tracking-[0.1em] italic font-serif">
            Available for high-end cinematic visual projects, <br className="hidden sm:block" />
            visual development, and project-based collaborations.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-12 md:space-y-20">
          {/* Main Connectivity Section */}
          <div className="space-y-6 text-center w-full">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 group px-4">
              <a 
                href="mailto:ucsuro@naver.com" 
                className="text-[20px] sm:text-[30px] md:text-[36px] lg:text-[40px] text-white tracking-[0.15em] font-light hover:text-blue-400 transition-all duration-500 break-all"
              >
                ucsuro@naver.com
              </a>
              <button 
                onClick={copyToClipboard}
                className="relative p-2.5 md:p-3 rounded-full border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/30 transition-all group shrink-0"
                title="Copy to clipboard"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                    >
                      <Copy className="w-4 h-4 md:w-5 md:h-5 text-neutral-400 group-hover:text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {copied && (
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-widest text-green-400 font-bold whitespace-nowrap bg-neutral-900 px-2 py-1 rounded border border-white/5">
                    Copied
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Social Links Section - Single Row */}
          <div className="w-full">
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-10">
              {data && orderedKeys.map((key) => {
                const colors: Record<string, string> = {
                  artstation: 'hover:text-blue-400 hover:border-blue-400/50',
                  youtube: 'hover:text-red-500 hover:border-red-500/50',
                  linkedin: 'hover:text-blue-600 hover:border-blue-600/50',
                  twitter: 'hover:text-sky-400 hover:border-sky-400/50',
                  facebook: 'hover:text-blue-700 hover:border-blue-700/50',
                  instagram: 'hover:text-pink-500 hover:border-pink-500/50',
                };
                return (
                  <a 
                    key={key} 
                    href={ensureAbsoluteUrl(data.links[key as keyof typeof data.links])} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center gap-2 text-neutral-400 transition-all transform hover:-translate-y-1 group ${colors[key] || 'hover:text-white'}`}
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/10 flex items-center justify-center transition-all group-hover:bg-white/[0.02]">
                      {socialIcons[key] || <Globe className="w-4 h-4" />}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="pt-16 pb-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-3 text-white text-base sm:text-lg md:text-xl uppercase tracking-[0.25em] font-medium transition-colors">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
              Seoul, South Korea
            </div>
            <div className="text-blue-400/60 font-mono text-[10px] sm:text-xs tracking-[0.2em] uppercase">
              Current Time: <KoreanTime />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function KoreanTime() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
      setTime(new Intl.DateTimeFormat('en-US', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}
