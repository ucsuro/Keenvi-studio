import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  activePage: string;
  onNavigate: (page: any, sub?: string) => void;
  categories: Record<string, string[]>;
  isLoggedIn?: boolean;
}

export default function Navigation({ activePage, onNavigate, categories, isLoggedIn }: Props) {
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = ['Intro', 'Portfolio', 'Project', 'Personal Work', 'About', 'Contact'];

  const getSubCategories = (item: string) => {
    if (item === 'Portfolio') return categories.portfolio || [];
    if (item === 'Project') return categories.project || [];
    if (item === 'Personal Work') return categories.personal || [];
    return null;
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-[80] bg-[#050505]/60 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('Intro')}
            className="text-xl font-bold tracking-[0.2em] uppercase text-white hover:opacity-80 transition-opacity"
          >
            KEENVI
          </button>
          {isLoggedIn && (
            <button 
              onClick={() => onNavigate('Admin')}
              className="text-neutral-400 text-[10px] uppercase tracking-[0.2em] hover:text-white transition-colors pt-1"
            >
              / modify
            </button>
          )}
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-10">
          {menuItems.map((item) => (
            <div 
              key={item}
              className="relative group"
              onMouseEnter={() => setHoveredMenu(item)}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <button
                onClick={() => onNavigate(item as any)}
                className={cn(
                  "text-[11px] font-medium tracking-[0.15em] uppercase flex items-center transition-all py-2",
                  activePage === item ? "text-white border-b border-white" : "text-neutral-500 hover:text-white"
                )}
              >
                {item}
                {(item === 'Portfolio' || item === 'Project' || item === 'Personal Work') && (
                  <ChevronDown className="ml-1.5 w-3 h-3 group-hover:rotate-180 transition-transform opacity-50" />
                )}
              </button>

              {/* Dropdown Desktop */}
              <AnimatePresence>
                {hoveredMenu === item && getSubCategories(item) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 bg-white shadow-2xl rounded-sm py-4 min-w-[220px]"
                  >
                    {getSubCategories(item)?.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => {
                          onNavigate(item as any, sub);
                          setHoveredMenu(null);
                        }}
                        className="w-full text-left px-6 py-2.5 text-[12px] font-medium text-neutral-800 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
                      >
                        {sub}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 top-20 bg-[#050505] z-40 md:hidden overflow-y-auto px-6 py-8"
          >
            <div className="flex flex-col space-y-6">
              {menuItems.map((item) => (
                <div key={item} className="space-y-4">
                  <button
                    onClick={() => {
                      if (!getSubCategories(item)) {
                        onNavigate(item as any);
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className="text-2xl font-display font-medium text-left w-full"
                  >
                    {item}
                  </button>
                  {getSubCategories(item) && (
                    <div className="pl-4 flex flex-col space-y-3 border-l border-neutral-800">
                      {getSubCategories(item)?.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => {
                            onNavigate(item as any, sub);
                            setIsMobileMenuOpen(false);
                          }}
                          className="text-neutral-400 text-left hover:text-white text-[13px] py-1"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
