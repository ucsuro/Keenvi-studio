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
    <>
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

          {/* Desktop & Tablet Menu */}
          <div className="hidden md:flex items-center gap-7 lg:gap-10">
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
                    "text-[10px] lg:text-[11px] font-medium tracking-[0.12em] lg:tracking-[0.15em] uppercase flex items-center transition-all py-2",
                    activePage === item ? "text-white border-b border-white" : "text-neutral-400 hover:text-white"
                  )}
                >
                  {item}
                  {(item === 'Portfolio' || item === 'Project' || item === 'Personal Work') && (
                    <ChevronDown className="ml-1.5 w-3 h-3 group-hover:rotate-180 transition-transform opacity-50" />
                  )}
                </button>

                {/* Dropdown Desktop/Tablet */}
                <AnimatePresence>
                  {hoveredMenu === item && getSubCategories(item) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 bg-white shadow-2xl rounded-sm py-4 min-w-[200px] lg:min-w-[220px] z-50"
                    >
                      {getSubCategories(item)?.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => {
                            onNavigate(item as any, sub);
                            setHoveredMenu(null);
                          }}
                          className="w-full text-left px-6 py-2.5 text-[11px] lg:text-[12px] font-medium text-neutral-800 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
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
          <button 
            className="md:hidden text-white relative z-50 p-2" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[85] md:hidden"
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-screen w-[200px] bg-white z-[90] md:hidden shadow-2xl flex flex-col pt-12 pb-16 overflow-y-auto border-l border-neutral-200"
            >
              <div className="flex flex-col divide-y divide-neutral-100">
                {menuItems.map((item) => {
                  const subCats = getSubCategories(item);
                  const hasSubs = subCats && subCats.length > 0;
                  
                  return (
                    <div key={item} className="px-5 py-3">
                      <button
                        onClick={() => {
                          onNavigate(item as any);
                          setIsMobileMenuOpen(false);
                        }}
                        className={cn(
                          "text-[13px] font-display font-medium text-left w-full tracking-[0.06em] transition-all uppercase",
                          activePage === item ? "text-black" : "text-neutral-500 hover:text-black"
                        )}
                      >
                        {item}
                      </button>
                      
                      {hasSubs && (
                        <div className="flex flex-col space-y-1.5 mt-2">
                          {subCats.map((sub) => (
                            <button
                              key={sub}
                              onClick={() => {
                                onNavigate(item as any, sub);
                                setIsMobileMenuOpen(false);
                              }}
                              className="text-neutral-500 text-left hover:text-black text-[10.5px] py-0.5 tracking-[0.06em] font-medium uppercase transition-colors"
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {isLoggedIn && (
                <div className="mt-6 px-5 pt-5 border-t border-neutral-100">
                  <button 
                    onClick={() => {
                      onNavigate('Admin');
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-neutral-400 text-[8px] uppercase tracking-[0.2em] font-mono font-medium hover:text-black transition-colors"
                  >
                    / SYSTEM ACCESS
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
