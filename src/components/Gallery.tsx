import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Maximize2, Search, Upload, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { trackImageClick } from '../lib/analytics';

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
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [columnsCount, setColumnsCount] = useState(4);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleImageLoad = (id: string) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session || localStorage.getItem('keenvi_auth') === 'hardcoded');
    });
  }, []);

  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    client: '',
    year: '',
    description: '',
    imageUrl: '',
    thumbnailUrl: '',
    width: 0,
    height: 0
  });
  const [formLoading, setFormLoading] = useState(false);

  const startEditing = (item: GalleryItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title || '',
      category: item.category || '',
      client: item.client || '',
      year: item.year || '',
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      thumbnailUrl: item.thumbnailUrl || '',
      width: item.width || 0,
      height: item.height || 0
    });
  };

  const handleFormFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isThumbnail: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Manual thumbnail doesn't resize, while original upload generates 430px thumbnail automatically
      const endpoint = isThumbnail ? '/api/upload/thumbnail' : '/api/upload';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (isThumbnail) {
        setEditForm(prev => ({
          ...prev,
          thumbnailUrl: result.url,
          width: result.width || prev.width,
          height: result.height || prev.height
        }));
      } else {
        setEditForm(prev => ({
          ...prev,
          imageUrl: result.url,
          thumbnailUrl: result.thumbnailUrl || prev.thumbnailUrl
        }));
        
        // Let's load bounds for the original image as well
        const img = new Image();
        img.onload = () => {
          setEditForm(prev => ({
            ...prev,
            width: img.naturalWidth,
            height: img.naturalHeight
          }));
        };
        img.src = result.url;
      }
    } catch (err: any) {
      console.error(err);
      alert('파일 업로드 실패: ' + (err.message || 'Unknown error'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleApplyModify = async () => {
    if (!editingItem) return;
    setFormLoading(true);
    try {
      const w = editForm.width || 0;
      const h = editForm.height || 0;
      const r = w && h ? parseFloat((w / h).toFixed(3)) : 1;

      const { error } = await supabase
        .from('gallery_items')
        .update({
          title: editForm.title.trim(),
          category: editForm.category.trim(),
          client: editForm.client.trim() || null,
          year: editForm.year.trim() || null,
          description: editForm.description.trim() || null,
          image_url: editForm.imageUrl.trim(),
          thumbnail_url: editForm.thumbnailUrl.trim() || null,
          width: w,
          height: h,
          ratio: r
        })
        .eq('id', editingItem.id);

      if (error) {
        throw error;
      }

      alert('수정이 적용되었습니다.');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert('적용 실패: ' + (err.message || 'Unknown error'));
    } finally {
      setFormLoading(false);
    }
  };

  const isThumbnailUsed = (url: string | undefined): boolean => {
    if (!url || !isAdmin) return false;
    return url.includes('/thumbnails/') || url.includes('-t.') || url.includes('thumb-') || url.includes('t-');
  };

  // Initial calculation for visible count based on columns
  useEffect(() => {
    const initialCount = Math.max(12, columnsCount * 4);
    setVisibleCount(initialCount);
  }, [columnsCount]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (loading || items.length <= visibleCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + (columnsCount * 5), items.length));
        }
      },
      { threshold: 0, rootMargin: '800px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loading, items.length, visibleCount, columnsCount]);

  useEffect(() => {
    if (isZoomed && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Use setTimeout to ensure the layout has recalculated after the state change
      setTimeout(() => {
        const scrollWidth = container.scrollWidth;
        const scrollHeight = container.scrollHeight;
        const clientWidth = container.clientWidth;
        const clientHeight = container.clientHeight;

        container.scrollTo({
          left: (scrollWidth - clientWidth) / 2,
          top: 0,
          behavior: 'instant' as any
        });
      }, 10);
    }
  }, [isZoomed, selectedIndex]);

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
    // Reset visible count when category change
    setVisibleCount(Math.max(12, columnsCount * 4));
  }, [type, subCategory, columnsCount]);

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setIsZoomed(false);
    
    // Track image click
    if (items[index]) {
      trackImageClick(items[index].title);
    }
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

  // Only process items up to visibleCount for the masonry layout
  const visibleItems = items.slice(0, visibleCount);

  visibleItems.forEach((item, index) => {
    // Find the index of the column with the minimum height
    const minHeight = Math.min(...columnHeights);
    const shortestIndex = columnHeights.indexOf(minHeight);
    
    // Safety check: if shortestIndex is -1 (shouldn't happen with 1+ columns), fallback to 0
    const targetIdx = shortestIndex === -1 ? 0 : shortestIndex;
    
    columnData[targetIdx].push(item);
    
    // Update the column height based on aspect ratio
    // Force numbers and check validity to prevent NaN
    const h = Number(item.height);
    const w = Number(item.width);
    const ratio = (h > 0 && w > 0) ? (h / w) : (1.2 + (index % 5) * 0.1);
    
    columnHeights[targetIdx] += isNaN(ratio) ? 1.5 : ratio;
  });

  return (
    <div className="w-full max-w-[2400px] mx-auto px-6 md:px-10 py-12">
      <div className="mb-16">
        <h2 className="text-xl sm:text-3xl font-light tracking-[0.12em] sm:tracking-[0.2em] mb-4 sm:mb-6">
          <span className="uppercase">{type}</span> {subCategory && <span className="text-neutral-400 font-sans font-normal tracking-normal ml-1 sm:ml-5 text-[18px] sm:text-[23px]">  {subCategory}</span>}
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
                  transition={{ 
                    delay: originalIndex < 12 ? originalIndex * 0.06 : 0.05, 
                    duration: 0.6
                  }}
                  className="relative group cursor-pointer overflow-hidden bg-neutral-900 rounded-sm"
                  style={{ 
                    aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : undefined,
                    minHeight: !item.width ? '200px' : undefined
                  }}
                  onClick={() => openLightbox(originalIndex)}
                >
                  {/* Placeholder Skeleton */}
                  {!loadedImages[item.id] && (
                    <div className="absolute inset-0 bg-neutral-800/40 animate-pulse" />
                  )}
                  
                  <img
                    src={item.thumbnailUrl || item.imageUrl}
                    alt={item.title}
                    onLoad={() => handleImageLoad(item.id)}
                    className={cn(
                      "w-full  h-auto transition-all duration-1000 group-hover:scale-105 block mx-auto",
                      loadedImages[item.id] ? "opacity-100" : "opacity-0"
                    )}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  {isThumbnailUsed(item.thumbnailUrl || item.imageUrl) && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_3px_rgba(0,0,0,0.8)] pointer-events-none z-10" />
                  )}
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

      {/* Infinite Scroll Trigger */}
      {items.length > visibleCount && (
        <div ref={loadMoreRef} className="h-20 w-full flex items-center justify-center mt-10">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-white/30 rounded-full animate-spin" />
        </div>
      )}

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
            <button
              onClick={prevImage}
              className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors z-[10005] p-2 hover:bg-black/20 rounded-full"
            >
              <ChevronLeft className="w-12 h-12 md:w-16 md:h-16" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors z-[10005] p-2 hover:bg-black/20 rounded-full"
            >
              <ChevronRight className="w-12 h-12 md:w-16 md:h-16" />
            </button>

            {/* Image Stage */}
            <div 
              ref={scrollContainerRef}
              className={cn(
                "relative flex-grow flex p-0 md:p-12 w-full h-full custom-scrollbar",
                isZoomed ? "overflow-auto block" : "overflow-hidden items-center justify-center cursor-zoom-in"
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
                  "relative flex justify-center",
                  isZoomed ? "items-start w-fit h-fit min-w-full min-h-full" : "items-center origin-center w-full h-full max-w-[100vw] max-h-[98vh]"
                )}
              >
                <img
                  ref={imgRef}
                  src={items[selectedIndex].imageUrl}
                  alt={items[selectedIndex].title}
                  className={cn(
                    "shadow-2xl flex-shrink-0",
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
                  {isAdmin && (
                    <button
                      onClick={() => startEditing(items[selectedIndex])}
                      className="px-2.5 py-0.5 text-[10px] uppercase font-semibold tracking-widest bg-blue-600/80 hover:bg-blue-600 border border-blue-500/20 rounded-sm text-white transition-all active:scale-95 cursor-pointer z-[10020]"
                    >
                      Modify
                    </button>
                  )}
                  <h2 className="text-[14px] font-medium tracking-widest text-white uppercase">{items[selectedIndex].title}</h2>
                  
                  <div className="flex items-center gap-x-4">
                    <p className="text-[10px] font-light text-neutral-300 uppercase tracking-widest">
                      {items[selectedIndex].client || 'Personal Project'}
                      {items[selectedIndex].year && (
                        <span className="text-blue-400 ml-2"> {items[selectedIndex].year}</span>
                      )}
                    </p>

                    {items[selectedIndex].description && (
                      <p className="hidden md:block text-[11px] font-light text-neutral-400 italic border-l border-neutral-800 pl-4 pr-4 max-w-[900px] line-clamp-3 leading-relaxed whitespace-pre-line tracking-tight">
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

      {/* Modify Popup Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[10010] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-sm overflow-hidden flex flex-col font-sans text-white text-[11px] uppercase tracking-widest"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-white/5">
                <span className="font-semibold text-xs tracking-[0.2em] text-blue-400">Modify Artwork Settings</span>
                <button 
                  onClick={() => setEditingItem(null)}
                  className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-neutral-500 text-[9px] font-bold block">Title</label>
                  <input 
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 text-white text-xs rounded-sm focus:border-blue-500/50 outline-none transition-colors"
                    placeholder="Enter art title"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-neutral-500 text-[9px] font-bold block">Category</label>
                  <input 
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-white/10 text-white text-xs rounded-sm focus:border-blue-500/50 outline-none transition-colors"
                    placeholder="Enter category"
                  />
                </div>

                {/* Client / Year Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-neutral-500 text-[9px] font-bold block">Client</label>
                    <input 
                      type="text"
                      value={editForm.client}
                      onChange={(e) => setEditForm(prev => ({ ...prev, client: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 text-white text-xs rounded-sm focus:border-blue-500/50 outline-none transition-colors"
                      placeholder="e.g. Acme Studio"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-neutral-500 text-[9px] font-bold block">Year</label>
                    <input 
                      type="text"
                      value={editForm.year}
                      onChange={(e) => setEditForm(prev => ({ ...prev, year: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-900 border border-white/10 text-white text-xs rounded-sm focus:border-blue-500/50 outline-none transition-colors"
                      placeholder="e.g. 2026"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5 font-sans whitespace-normal lowercase">
                  <label className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest block">Description</label>
                  <textarea 
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full min-h-[80px] px-3 py-2 bg-neutral-900 border border-white/10 text-white text-xs rounded-sm focus:border-blue-500/50 outline-none transition-colors resize-none"
                    placeholder="Enter artwork short description in lowercases"
                  />
                </div>

                {/* Image URL Links */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-neutral-500 text-[9px] font-bold block">Source Image URL</label>
                    <input 
                      type="text"
                      value={editForm.imageUrl}
                      onChange={(e) => setEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-white/10 text-white text-[9px] font-mono rounded-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-neutral-500 text-[9px] font-bold block">Thumbnail URL</label>
                    <input 
                      type="text"
                      value={editForm.thumbnailUrl}
                      onChange={(e) => setEditForm(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-white/10 text-white text-[9px] font-mono rounded-sm outline-none"
                    />
                  </div>
                </div>

                {/* File Upload Overrides */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 animate-none">
                  <div className="space-y-1">
                    <label className="text-neutral-500 text-[9px] font-bold block">Upload Original</label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 rounded-sm cursor-pointer transition-colors text-center text-xs">
                      <Upload className="w-3.5 h-3.5 text-neutral-400 animate-none" />
                      <span className="text-[10px] text-neutral-300">Choose File</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFormFileUpload(e, false)} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-neutral-500 text-[9px] font-bold block">Upload Thumbnail</label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 rounded-sm cursor-pointer transition-colors text-center text-xs">
                      <Upload className="w-3.5 h-3.5 text-neutral-400 animate-none" />
                      <span className="text-[10px] text-neutral-300">Choose File</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFormFileUpload(e, true)} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex p-5 gap-3 border-t border-white/5 bg-neutral-950/40">
                <button 
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-neutral-400 hover:text-white transition-colors text-center rounded-sm font-semibold active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleApplyModify}
                  disabled={formLoading || !editForm.title.trim() || !editForm.category.trim() || !editForm.imageUrl.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white transition-colors text-center rounded-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                >
                  {formLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>적용 (Apply)</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
