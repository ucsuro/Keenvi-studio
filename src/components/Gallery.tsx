import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Maximize2, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
  client?: string;
  year?: string;
  tools?: string;
  description?: string;
  width?: number;
  height?: number;
}

interface Props {
  type: 'portfolio' | 'project' | 'personal work';
  subCategory: string | null;
}

export default function Gallery({ type, subCategory }: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [columnsCount, setColumnsCount] = useState(4);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1280) setColumnsCount(4);
      else if (width >= 1024) setColumnsCount(3);
      else if (width >= 640) setColumnsCount(2);
      else setColumnsCount(1);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      try {
        const dbType = type === 'personal work' ? 'personal' : type;
        
        let query = supabase
          .from('gallery_items')
          .select('*')
          .eq('type', dbType)
          .order('order', { ascending: false });

        if (subCategory) {
          query = query.ilike('category', subCategory);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
          const mappedItems: GalleryItem[] = data.map(item => ({
            id: item.id,
            title: item.title,
            category: item.category,
            imageUrl: item.image_url,
            thumbnailUrl: item.thumbnail_url,
            client: item.client,
            year: item.year,
            tools: item.tools,
            description: item.description,
            width: item.width,
            height: item.height
          }));
          setItems(mappedItems);
        }
      } catch (error) {
        console.error('Failed to fetch gallery items', error);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [type, subCategory]);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setIsZoomed(false);
  };
  const closeLightbox = () => {
    setSelectedIndex(null);
    setIsZoomed(false);
  };

  const nextImage = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % items.length);
    setIsZoomed(false);
  };

  const prevImage = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + items.length) % items.length);
    setIsZoomed(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Parallax mouse effect is disabled in favor of scrollable 100% zoom
    if (isZoomed) return;
    
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    
    // ... rest of logic for normal mode if needed, but keeping it empty for now to simplify
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-neutral-800 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  // Masonry algorithm: Distribute items to the shortest column to balance vertical spread
  // while maintaining chronological order (newest items processed first)
  const columnData: GalleryItem[][] = Array.from({ length: columnsCount }, () => []);
  const columnHeights = Array(columnsCount).fill(0);

  items.forEach((item, index) => {
    // Find the index of the column with the minimum height
    const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights));
    
    columnData[shortestIndex].push(item);
    
    // Update the column height based on aspect ratio
    // If original width/height missing, use a pseudo-random fallback based on index to ensure column variation
    const ratio = (item.height && item.width) ? (item.height / item.width) : (1.2 + (index % 5) * 0.1);
    columnHeights[shortestIndex] += ratio;
  });

  return (
    <div className="w-full max-w-[2400px] mx-auto px-6 md:px-10 py-12">
      <div className="mb-16">
        <h2 className="text-3xl font-light tracking-[0.2em] mb-6">
          <span className="uppercase">{type}</span> {subCategory && <span className="text-neutral-500 font-sans font-normal tracking-normal ml-2">/ {subCategory}</span>}
        </h2>
        <div className="h-px bg-white/5 w-full" />
      </div>

      <div className="flex gap-2">
        {columnData.map((col, colIdx) => (
          <div key={colIdx} className="flex-1 space-y-2">
            {col.map((item) => {
              // Get original index for lightbox
              const originalIndex = items.findIndex(i => i.id === item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: originalIndex * 0.03, duration: 0.6 }}
                  className="relative group cursor-pointer overflow-hidden bg-neutral-900"
                  onClick={() => openLightbox(originalIndex)}
                >
                  <img
                    src={item.thumbnailUrl || item.imageUrl}
                    alt={item.title}
                    className="w-full h-auto transition-transform duration-1000 group-hover:scale-105 block"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                    <p className="text-blue-400 text-[10px] tracking-[0.2em] mb-1">{item.category}</p>
                    <h3 className="text-lg font-light tracking-widest text-white leading-tight">{item.title}</h3>
                    <div className="mt-4 flex items-center text-[8px] text-white/50 uppercase tracking-[0.2em]">
                      View Details <Search className="ml-2 w-3 h-3" />
                    </div>
                  </div>
                  <div className="absolute inset-0 border border-white/5 group-hover:border-white/10 transition-colors pointer-events-none" />
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center select-none"
            onMouseMove={handleMouseMove}
          >
            {/* Control Bar */}
            <div className="absolute top-0 left-0 w-full p-10 flex justify-between items-center z-[10002] pointer-events-none">
              <div className="flex items-center gap-4 pointer-events-auto">
                <p className="text-[10px] font-mono tracking-widest text-white/40">
                  {String(selectedIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                </p>
                <button
                  onClick={() => setIsZoomed(!isZoomed)}
                  className={cn(
                    "text-neutral-500 hover:text-white transition-colors p-2",
                    isZoomed && "text-blue-400"
                  )}
                  title={isZoomed ? "Exit Zoom" : "100% Zoom"}
                >
                  <Search className="w-6 h-6" />
                </button>
              </div>
              
              <button
                onClick={closeLightbox}
                className="text-neutral-500 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-10 h-10" />
              </button>
            </div>

            {/* Navigation Buttons */}
            {!isZoomed && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-10 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors z-[10001]"
                >
                  <ChevronLeft className="w-16 h-16" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors z-[10001]"
                >
                  <ChevronRight className="w-16 h-16" />
                </button>
              </>
            )}

            {/* Image Stage */}
            <div 
              className={cn(
                "relative flex-grow flex p-0 md:p-12 w-full h-full custom-scrollbar",
                isZoomed ? "overflow-auto items-start justify-center" : "overflow-hidden items-center justify-center cursor-zoom-in"
              )}
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsZoomed(!isZoomed);
              }}
            >
              <motion.div
                key={items[selectedIndex].id}
                initial={false}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  x: 0,
                  y: 0
                }}
                className={cn(
                  "relative origin-top flex items-center justify-center",
                  isZoomed ? "w-auto h-auto py-20" : "w-full h-full max-w-[100vw] max-h-[98vh]"
                )}
              >
                <img
                  ref={imgRef}
                  src={items[selectedIndex].imageUrl}
                  alt={items[selectedIndex].title}
                  className={cn(
                    "shadow-2xl",
                    isZoomed ? "max-w-none cursor-zoom-out" : "w-auto h-auto max-w-full max-h-full object-contain"
                  )}
                  onClick={() => setIsZoomed(!isZoomed)}
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </div>

            {/* Floating Meta Table */}
            {!isZoomed && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-0 w-full px-4 z-[10002] pointer-events-none flex justify-center"
              >
                <div className="w-fit py-1.5 px-5 bg-black/30 backdrop-blur-[2px] border border-white/5 flex flex-col md:flex-row items-center gap-x-6 gap-y-1 text-center md:text-left pointer-events-auto rounded-sm">
                  <h2 className="text-[14px] font-medium tracking-widest text-white uppercase">{items[selectedIndex].title}</h2>
                  
                  <div className="flex items-center gap-x-4">
                    <p className="text-[10px] font-light text-neutral-300 uppercase tracking-widest">
                      {items[selectedIndex].client || 'Personal Project'}
                      {items[selectedIndex].year && (
                        <span className="text-blue-400 ml-2"> {items[selectedIndex].year}</span>
                      )}
                    </p>

                    {items[selectedIndex].description && (
                      <p className="hidden md:block text-[10px] font-light text-neutral-500 italic border-l border-neutral-800 pl-4 max-w-[900px] line-clamp-3 leading-relaxed whitespace-pre-line tracking-tight">
                        {items[selectedIndex].description}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
