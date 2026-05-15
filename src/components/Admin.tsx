import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X, Upload, Check, ChevronUp, ChevronDown, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DEFAULT_INTRO, DEFAULT_ABOUT, DEFAULT_CATEGORIES } from '../constants/defaults';

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
  client: string;
  year: string;
  description: string;
  order: number;
  createdAt: string;
  width?: number;
  height?: number;
}

// Helper for resizing images client-side
const resizeImage = (file: File, maxWidth: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', 0.9);
      };
    };
    reader.onerror = reject;
  });
};

interface AdminProps {
  onCategoriesChange?: () => void;
}

export default function Admin({ onCategoriesChange }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'project' | 'personal' | 'about' | 'intro'>('portfolio');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allCategoriesMap, setAllCategoriesMap] = useState<Record<string, string[]>>({});
  const [pendingMoves, setPendingMoves] = useState<Record<string, string>>({});
  const [editingOrders, setEditingOrders] = useState<Record<string, string>>({});
  const [editingDimensions, setEditingDimensions] = useState<Record<string, { width: string; height: string; ratio?: string }>>({});
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aboutData, setAboutData] = useState<{
    title: string;
    description: string;
    bio_en: string;
    bio_ko: string;
    imageUrl?: string;
    freelanceProjects: Array<{ company: string; project: string; work: string; year: string }>;
    career: Array<{ year: string; title: string; content: string }>;
    skills: string[];
    tools: string[];
  } | null>(null);

  const [introData, setIntroData] = useState<{
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
  } | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<GalleryItem | null>(null);
  const [newCatName, setNewCatName] = useState('');
  
  // Form states for adding new art
  const [newArt, setNewArt] = useState({
    title: '',
    category: '',
    client: '',
    year: new Date().getFullYear().toString(),
    description: '',
    imageUrl: '',
    thumbnailUrl: '',
    file: null as File | null,
    manualThumbnailFile: null as File | null,
    width: 0,
    height: 0
  });

  useEffect(() => {
    fetchCategories();
    if (activeTab === 'about') {
      fetchAboutData();
    } else if (activeTab === 'intro') {
      fetchIntroData();
    } else {
      fetchItems();
    }
  }, [activeTab]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchAboutData = async () => {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'about').single();
    if (data) setAboutData(data.value);
  };

  const fetchIntroData = async () => {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'intro').single();
    if (data) setIntroData(data.value);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'categories').single();
    if (data) {
      const allCats = data.value || {};
      setAllCategoriesMap(allCats);
      if (activeTab === 'portfolio' || activeTab === 'project' || activeTab === 'personal') {
        setCategories(allCats[activeTab] || []);
      } else {
        setCategories([]);
      }
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const dbType = activeTab === 'personal' ? 'personal' : activeTab;
      const { data, error } = await supabase
        .from('gallery_items')
        .select('*')
        .eq('type', dbType)
        .order('order', { ascending: false });

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
          description: item.description,
          order: item.order,
          createdAt: item.created_at,
          width: item.width,
          height: item.height
        }));
        setItems(mappedItems);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<GalleryItem>) => {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.thumbnailUrl !== undefined) dbUpdates.thumbnail_url = updates.thumbnailUrl;
    if (updates.client !== undefined) dbUpdates.client = updates.client;
    if (updates.year !== undefined) dbUpdates.year = updates.year;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.order !== undefined) dbUpdates.order = updates.order;

    const { error } = await supabase
      .from('gallery_items')
      .update(dbUpdates)
      .eq('id', id);

    if (!error) {
      setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
    } else {
      console.error('Update failed:', error);
    }
  };

  const handleDeleteItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setItemToDelete(item);
      setShowDeleteModal(true);
    }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    
    setLoading(true);
    try {
      // 1. Delete from storage if images exist and are stored in our Supabase bucket
      const pathsToDelete: string[] = [];
      
      const getPath = (url: string) => {
        const part = '/storage/v1/object/public/gallery/';
        if (url.includes(part)) {
          return url.split(part)[1];
        }
        return null;
      };

      const imgPath = getPath(itemToDelete.imageUrl);
      const thumbPath = itemToDelete.thumbnailUrl ? getPath(itemToDelete.thumbnailUrl) : null;

      if (imgPath) pathsToDelete.push(imgPath);
      if (thumbPath) pathsToDelete.push(thumbPath);

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('gallery').remove(pathsToDelete);
        if (storageError) console.error('Storage deletion warning:', storageError);
      }

      // 2. Delete from database
      const { error } = await supabase
        .from('gallery_items')
        .delete()
        .eq('id', itemToDelete.id);

      if (!error) {
        setItems(items.filter(item => item.id !== itemToDelete.id));
        setShowDeleteModal(false);
        setItemToDelete(null);
      } else {
        throw error;
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Deletion failed: ' + (err.message || 'Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('gallery')
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('gallery')
        .getPublicUrl(filePath);

      // Simple approach: Use same URL for both if client-side resizing isn't fully implemented here
      return { url: publicUrlData.publicUrl, thumbnailUrl: publicUrlData.publicUrl };
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
      return null;
    }
  };

  const handleManualThumbnailUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `thumbs/${Math.random()}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('gallery')
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('gallery')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
      alert('Thumbnail upload failed');
      return null;
    }
  };

  const handleSaveNewArt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalImageUrl = newArt.imageUrl;
      let finalThumbnailUrl = newArt.thumbnailUrl;
      
      if (newArt.file) {
        const result = await handleFileUpload(newArt.file);
        if (result) {
          finalImageUrl = result.url;
          finalThumbnailUrl = result.thumbnailUrl;
        } else {
          setLoading(false);
          return;
        }
      }

      if (newArt.manualThumbnailFile) {
        const manualThumbUrl = await handleManualThumbnailUpload(newArt.manualThumbnailFile);
        if (manualThumbUrl) finalThumbnailUrl = manualThumbUrl;
      }

      if (!finalImageUrl) {
        alert('Please upload an image or provide a URL');
        setLoading(false);
        return;
      }

      const dbType = activeTab === 'personal' ? 'personal' : activeTab;
      const insertData: any = {
        type: dbType,
        title: newArt.title,
        category: newArt.category,
        client: newArt.client,
        year: newArt.year,
        description: newArt.description,
        image_url: finalImageUrl,
        thumbnail_url: finalThumbnailUrl,
        order: items.length > 0 ? Math.max(...items.map(i => i.order || 0)) + 1 : 0
      };

      // Only add width/height if they are valid
      if (newArt.width > 0 && newArt.height > 0) {
        insertData.width = newArt.width;
        insertData.height = newArt.height;
      }
      
      let { data, error } = await supabase
        .from('gallery_items')
        .insert([insertData])
        .select()
        .single();

      // Fallback: If DB doesn't have width/height columns yet, try without them
      if (error && (error as any).code === '42703') {
        console.warn('DB columns width/height missing, retrying without them...');
        const safeInsertData = { ...insertData };
        delete safeInsertData.width;
        delete safeInsertData.height;
        
        const retry = await supabase
          .from('gallery_items')
          .insert([safeInsertData])
          .select()
          .single();
        
        data = retry.data;
        error = retry.error;
      }

      if (!error) {
        setShowAddModal(false);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setNewArt({ 
          title: '', category: '', client: '', year: new Date().getFullYear().toString(), 
          description: '', imageUrl: '', thumbnailUrl: '', 
          file: null, manualThumbnailFile: null, width: 0, height: 0
        });
        fetchItems();
      } else {
        console.error('Supabase Insert Error:', error);
        throw error;
      }
    } catch (err: any) {
      console.error('Save Art Error:', err);
      alert(`Failed to save art: ${err.message || 'Check database connection'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    
    try {
      const { data: res, error: fetchError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'categories')
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      const allCats = res?.value || { portfolio: [], project: [], personal: [] };
      if (!allCats[activeTab]) allCats[activeTab] = [];
      
      if (!allCats[activeTab].includes(newCatName)) {
        allCats[activeTab].push(newCatName);
        
        const { error: upsertError } = await supabase
          .from('site_settings')
          .upsert({ key: 'categories', value: allCats });
          
        if (upsertError) throw upsertError;
        
        setNewCatName('');
        await fetchCategories();
        onCategoriesChange?.();
      }
    } catch (err) {
      console.error('Failed to add category:', err);
      alert('카테고리 추가 실패: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeleteCategory = async (name: string) => {
    try {
      const { data: res, error: fetchError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'categories')
        .single();
        
      if (fetchError) throw fetchError;
      
      const allCats = res.value;
      if (allCats[activeTab]) {
        allCats[activeTab] = allCats[activeTab].filter((c: string) => c !== name);
        
        const { error: upsertError } = await supabase
          .from('site_settings')
          .upsert({ key: 'categories', value: allCats });
          
        if (upsertError) throw upsertError;
        
        await fetchCategories();
        onCategoriesChange?.();
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newCategories.length) return;
    
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    
    try {
      const { data: res, error: fetchError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'categories')
        .single();
        
      if (fetchError) throw fetchError;
      
      const allCats = res.value;
      allCats[activeTab] = newCategories;
      
      const { error: upsertError } = await supabase
        .from('site_settings')
        .upsert({ key: 'categories', value: allCats });
        
      if (upsertError) throw upsertError;
      
      setCategories(newCategories);
      onCategoriesChange?.();
    } catch (err) {
      console.error('Failed to reorder categories:', err);
    }
  };

  const [confirmingMoveId, setConfirmingMoveId] = useState<string | null>(null);

  const handleAdjustOrder = async (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const newOrder = (item.order || 0) + delta;
    
    const { error } = await supabase
      .from('gallery_items')
      .update({ order: newOrder })
      .eq('id', id);
    
    if (!error) {
      setItems(items.map(i => i.id === id ? { ...i, order: newOrder } : i).sort((a, b) => {
        if (b.order !== a.order) return b.order - a.order;
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }));
    } else {
      console.error('Failed to adjust order:', error);
    }
  };

  const handleReloadDimensions = async (item: GalleryItem) => {
    // Global loading을 제거하여 전체 화면이 깜박거리지 않게 함
    try {
      const img = new Image();
      img.src = item.imageUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Image load failed'));
      });

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w > 0 && h > 0) {
        const { error } = await supabase
          .from('gallery_items')
          .update({ width: w, height: h })
          .eq('id', item.id);
        
        if (error) throw error;
        
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, width: w, height: h } : i));
        
        setEditingDimensions(prev => ({
          ...prev,
          [item.id]: {
            width: w.toString(),
            height: h.toString(),
            ratio: (h / w).toFixed(2)
          }
        }));
        
        setSaveSuccess(item.id);
        setTimeout(() => setSaveSuccess(null), 2000);
      }
    } catch (err) {
      console.error('Failed to reload dimensions:', err);
      alert('이미지 사이즈 확인 실패. URL을 확인하거나 다시 시도해주세요.');
    }
  };

  const handleMoveToLocation = async (id: string, typeAndCategory: string) => {
    if (!typeAndCategory) return;
    
    const [targetType, newCategory] = typeAndCategory.split('|');
    if (!targetType || !newCategory) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('gallery_items')
        .update({ 
          category: newCategory,
          type: targetType 
        })
        .eq('id', id);

      if (error) throw error;
      
      alert(`Successfully moved to ${targetType} > ${newCategory}`);
      
      // Update local state: if type matches current tab, just update category, else remove from list
      const currentDbType = activeTab === 'personal' ? 'personal' : activeTab;
      if (targetType === currentDbType) {
        setItems(prev => prev.map(item => item.id === id ? { ...item, category: newCategory } : item));
      } else {
        setItems(prev => prev.filter(item => item.id !== id));
      }
    } catch (err: any) {
      console.error('Move failed:', err);
      alert('Failed to move item: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAbout = async () => {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'about', value: aboutData });
    
    if (!error) alert('About page updated');
    else console.error(error);
  };

  const handleRestoreAboutDefaults = () => {
    if (window.confirm('Restore About defaults?')) {
      setAboutData(DEFAULT_ABOUT);
    }
  };

  const handleSaveIntro = async () => {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'intro', value: introData });
      
    if (!error) alert('Intro context saved');
    else console.error(error);
  };

  const handleRestoreIntroDefaults = () => {
    if (window.confirm('Restore Intro defaults?')) {
      setIntroData(DEFAULT_INTRO);
    }
  };

  const handleRestoreCategoryDefaults = async () => {
    if (window.confirm('Restore categories to original defaults?')) {
      try {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key: 'categories', value: DEFAULT_CATEGORIES });
        
        if (error) throw error;
        
        await fetchCategories();
        onCategoriesChange?.();
        alert('Categories restored to defaults');
      } catch (err) {
        console.error(err);
        alert('Failed to restore categories');
      }
    }
  };

  const handleGatewayUpload = async (type: 'portfolio' | 'project' | 'personal', file: File) => {
    try {
      const result = await handleFileUpload(file);
      if (result && introData) {
        setIntroData({
          ...introData,
          gateways: {
            ...introData.gateways,
            [type]: result.url
          }
        });
      }
    } catch (err) {
      console.error('Gateway upload failed:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-10 py-12">
      <div className="flex flex-col md:flex-row gap-12">
        {/* Sidebar */}
        <div className="md:w-64 flex flex-col gap-2">
          {['intro', 'portfolio', 'project', 'personal', 'about'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`text-left px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-bold transition-all border ${activeTab === tab ? 'bg-white text-black border-white' : 'text-neutral-500 border-white/5 hover:border-white/20'}`}
            >
              {tab === 'about' ? 'About Context' : tab === 'intro' ? 'Intro Context' : `${tab} Gallery`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-grow space-y-8">
          <div className="flex justify-between items-center pb-8 border-b border-white/5">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-light tracking-[0.2em] uppercase">Managing {activeTab}</h2>
              {(activeTab === 'intro' || activeTab === 'about') && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (activeTab === 'intro') handleRestoreIntroDefaults();
                    else handleRestoreAboutDefaults();
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[8px] tracking-widest uppercase transition-colors"
                  title="Restore original defaults"
                >
                  <RefreshCcw size={10} />
                  Restore Defaults
                </button>
              )}
              {(activeTab === 'portfolio' || activeTab === 'project' || activeTab === 'personal') && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRestoreCategoryDefaults();
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[8px] tracking-widest uppercase transition-colors"
                  title="Restore category defaults"
                >
                  <RefreshCcw size={10} />
                  Restore Cat. Defaults
                </button>
              )}
            </div>
            {activeTab !== 'about' && activeTab !== 'intro' && (
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowCatModal(true)}
                  className="border border-white/10 text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  Categories
                </button>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-colors flex items-center"
                >
                  Add New Art <Plus className="ml-2 w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {activeTab === 'intro' ? (
            introData && (
              <div className="space-y-12">
                {/* Logo & Headline Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">Main Logo Text</label>
                    <input 
                      value={introData.logoText || ''}
                      onChange={e => setIntroData({...introData, logoText: e.target.value})}
                      className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-white text-xl uppercase tracking-[0.2em]"
                      placeholder="Enter logo name..."
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">Intro Headline (Description)</label>
                    <textarea 
                      value={introData.headline || ''}
                      onChange={e => setIntroData({...introData, headline: e.target.value})}
                      className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-white h-24"
                      placeholder="Enter main headline..."
                    />
                  </div>
                </div>

                {/* External Links Section */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 border-b border-white/5 pb-2">External Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['artstation', 'youtube', 'linkedin', 'twitter', 'facebook', 'instagram'].map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-600">{key}</label>
                        <input 
                          value={introData.links[key as keyof typeof introData.links] || ''}
                          onChange={e => setIntroData({
                            ...introData,
                            links: { ...introData.links, [key]: e.target.value }
                          })}
                          className="w-full bg-neutral-900 border border-white/5 px-3 py-2 text-xs focus:outline-none focus:border-white"
                          placeholder={`https://...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gallery Gateways Section */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 border-b border-white/5 pb-2">Gallery Gateway Images</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['portfolio', 'project', 'personal'].map((gt) => (
                      <div key={gt} className="space-y-3">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-600 font-bold">{gt} Gateway</label>
                        <label className="block aspect-[3/4] bg-neutral-900 border border-dashed border-white/10 relative group cursor-pointer overflow-hidden">
                          {introData.gateways[gt as keyof typeof introData.gateways] ? (
                            <img 
                              src={introData.gateways[gt as keyof typeof introData.gateways]} 
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Plus className="w-6 h-6 text-neutral-700" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            <Upload className="w-6 h-6 text-white" />
                          </div>
                          <input 
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleGatewayUpload(gt as any, file);
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-neutral-600 uppercase tracking-widest italic leading-relaxed">
                    * Gateway images are displayed at 3:4 aspect ratio.<br/>
                    Original resolution is preserved. No compression or resizing applied during upload.
                  </p>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <button 
                    onClick={handleSaveIntro}
                    className="bg-blue-600 text-white px-10 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-colors w-full sm:w-auto"
                  >
                    Update Intro Context
                  </button>
                </div>
              </div>
            )
          ) : activeTab === 'about' ? (
            aboutData && (
              <div className="space-y-8 max-w-2xl">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">About Main Image</label>
                  <label className="block aspect-[4/5] w-[200px] bg-neutral-900 border border-dashed border-white/10 relative group cursor-pointer overflow-hidden rounded-sm">
                    {aboutData.imageUrl ? (
                      <img 
                        src={aboutData.imageUrl} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-neutral-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-black/40">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <input 
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLoading(true);
                          const result = await handleFileUpload(file);
                          if (result) {
                            setAboutData({
                              ...aboutData,
                              imageUrl: result.url
                            });
                          }
                          setLoading(false);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[9px] text-neutral-600 uppercase tracking-widest">
                    Recommended: 800x1000px (4:5 Aspect Ratio)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Studio Name</label>
                  <input 
                    value={aboutData.title || ''}
                    onChange={e => setAboutData({...aboutData, title: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Short Description</label>
                  <textarea 
                    value={aboutData.description || ''}
                    onChange={e => setAboutData({...aboutData, description: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400 h-24"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">English Bio</label>
                  <textarea 
                    value={aboutData.bio_en || ''}
                    onChange={e => setAboutData({...aboutData, bio_en: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400 h-48 text-sm leading-relaxed"
                    placeholder="English biography..."
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Korean Bio (한글 소개)</label>
                  <textarea 
                    value={aboutData.bio_ko || ''}
                    onChange={e => setAboutData({...aboutData, bio_ko: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400 h-48 text-sm leading-relaxed"
                    placeholder="한국어 소개글..."
                  />
                </div>

                <div className="space-y-4 pt-8 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Freelance Projects</label>
                    <button 
                      onClick={() => setAboutData({
                        ...aboutData, 
                        freelanceProjects: [{ company: '', project: '', work: '', year: '' }, ...(aboutData.freelanceProjects || [])]
                      })}
                      className="text-[9px] uppercase tracking-widest text-blue-400 hover:text-white transition-colors"
                    >
                      + Add Project
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {(aboutData.freelanceProjects || []).map((p, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white/[0.02] p-4 rounded-sm relative group">
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase text-neutral-600">Company</label>
                          <input 
                            value={p.company}
                            onChange={e => {
                              const newList = [...aboutData.freelanceProjects];
                              newList[idx].company = e.target.value;
                              setAboutData({...aboutData, freelanceProjects: newList});
                            }}
                            className="w-full bg-neutral-900 border border-white/5 rounded-sm px-3 py-2 focus:outline-none focus:border-blue-400 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase text-neutral-600">Project</label>
                          <input 
                            value={p.project}
                            onChange={e => {
                              const newList = [...aboutData.freelanceProjects];
                              newList[idx].project = e.target.value;
                              setAboutData({...aboutData, freelanceProjects: newList});
                            }}
                            className="w-full bg-neutral-900 border border-white/5 rounded-sm px-3 py-2 focus:outline-none focus:border-blue-400 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase text-neutral-600">Work/Ref</label>
                          <input 
                            value={p.work}
                            onChange={e => {
                              const newList = [...aboutData.freelanceProjects];
                              newList[idx].work = e.target.value;
                              setAboutData({...aboutData, freelanceProjects: newList});
                            }}
                            className="w-full bg-neutral-900 border border-white/5 rounded-sm px-3 py-2 focus:outline-none focus:border-blue-400 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase text-neutral-600">Year</label>
                          <div className="flex gap-2">
                            <input 
                              value={p.year}
                              onChange={e => {
                                const newList = [...aboutData.freelanceProjects];
                                newList[idx].year = e.target.value;
                                setAboutData({...aboutData, freelanceProjects: newList});
                              }}
                              className="w-full bg-neutral-900 border border-white/5 rounded-sm px-3 py-2 focus:outline-none focus:border-blue-400 text-sm"
                            />
                            <button 
                              onClick={() => {
                                const newList = aboutData.freelanceProjects.filter((_, i) => i !== idx);
                                setAboutData({...aboutData, freelanceProjects: newList});
                              }}
                              className="text-red-500/50 hover:text-red-500 px-2"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-8 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">Chronicle (Career)</h3>
                    <button 
                      onClick={() => setAboutData({...aboutData, career: [{ year: '', title: '', content: '' }, ...(aboutData.career || [])]})}
                      className="text-[9px] uppercase tracking-widest border border-white/10 px-3 py-1 hover:bg-white/5"
                    >
                      + Add Record
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {(aboutData.career || []).map((exp, idx) => (
                      <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 space-y-4 relative group">
                        <button 
                          onClick={() => {
                            const newCareer = [...aboutData.career];
                            newCareer.splice(idx, 1);
                            setAboutData({...aboutData, career: newCareer});
                          }}
                          className="absolute top-4 right-4 text-red-900 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div className="grid grid-cols-[100px_1fr] gap-4">
                          <input 
                            placeholder="YEAR"
                            value={exp.year || ''}
                            onChange={e => {
                              const newCareer = [...aboutData.career];
                              newCareer[idx].year = e.target.value;
                              setAboutData({...aboutData, career: newCareer});
                            }}
                            className="bg-transparent border-b border-white/10 py-1 text-[10px] tracking-widest focus:outline-none focus:border-white"
                          />
                          <input 
                            placeholder="TITLED POSITION / PROJECT"
                            value={exp.title || ''}
                            onChange={e => {
                              const newCareer = [...aboutData.career];
                              newCareer[idx].title = e.target.value;
                              setAboutData({...aboutData, career: newCareer});
                            }}
                            className="bg-transparent border-b border-white/10 py-1 text-xs tracking-widest focus:outline-none focus:border-white"
                          />
                        </div>
                        <textarea 
                          placeholder="DESCRIPTION / ACHIEVEMENTS"
                          value={exp.content || ''}
                          onChange={e => {
                            const newCareer = [...aboutData.career];
                            newCareer[idx].content = e.target.value;
                            setAboutData({...aboutData, career: newCareer});
                          }}
                          className="w-full bg-transparent border border-white/5 p-2 text-[10px] tracking-widest focus:outline-none focus:border-white h-20 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">Expertise (Skills)</label>
                    <textarea 
                      value={(aboutData.skills || []).join('\n') || ''}
                      onChange={e => setAboutData({...aboutData, skills: e.target.value.split('\n')})}
                      className="w-full bg-neutral-900 border border-white/5 p-3 text-xs tracking-widest focus:outline-none focus:border-white h-32"
                      placeholder="One item per line"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">Artifacts (Tools)</label>
                    <textarea 
                      value={(aboutData.tools || []).join('\n') || ''}
                      onChange={e => setAboutData({...aboutData, tools: e.target.value.split('\n')})}
                      className="w-full bg-neutral-900 border border-white/5 p-3 text-xs tracking-widest focus:outline-none focus:border-white h-32"
                      placeholder="One item per line"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveAbout}
                  className="bg-blue-600 text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-colors w-full sm:w-auto"
                >
                  Save Full Context
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-12">
              {loading ? (
                <div className="text-center py-20 text-neutral-600 tracking-widest animate-pulse">SYNCHRONIZING...</div>
              ) : items.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/5 text-neutral-600">
                  No images found.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 p-6 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors relative">
                    {/* Order & Move Controls */}
                    <div className="absolute top-0 right-0 z-10 flex items-center border-l border-b border-white/10 bg-black/40 backdrop-blur-sm">
                      <div className="flex items-center px-2 gap-2 border-r border-white/10">
                        <select 
                          className="bg-transparent text-[8px] uppercase tracking-widest text-neutral-400 focus:outline-none cursor-pointer py-2 max-w-[120px]"
                          value={pendingMoves[item.id] || ""}
                          onChange={(e) => setPendingMoves(prev => ({ ...prev, [item.id]: e.target.value }))}
                        >
                          <option value="" disabled className="bg-neutral-900 border-none">TARGET GALLERY...</option>
                          {Object.entries(allCategoriesMap).map(([type, cats]) => (
                            <optgroup key={type} label={type.toUpperCase()} className="bg-neutral-900 text-neutral-500 text-[10px]">
                              {cats.map(c => (
                                <option key={`${type}-${c}`} value={`${type}|${c}`} className="bg-neutral-900 text-white">{c}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {pendingMoves[item.id] && (
                          <div className="flex items-center gap-1">
                            {confirmingMoveId === item.id ? (
                              <>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    handleMoveToLocation(item.id, pendingMoves[item.id]);
                                    setConfirmingMoveId(null);
                                    setPendingMoves(prev => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    });
                                  }}
                                  className="bg-green-600 hover:bg-green-500 text-[8px] px-2 py-1 rounded-sm font-bold transition-colors ml-1"
                                >
                                  YES, MOVE
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setConfirmingMoveId(null)}
                                  className="bg-neutral-700 hover:bg-neutral-600 text-[8px] px-2 py-1 rounded-sm font-bold transition-colors"
                                >
                                  NO
                                </button>
                              </>
                            ) : (
                              <button 
                                type="button"
                                onClick={() => setConfirmingMoveId(item.id)}
                                className="bg-blue-600 hover:bg-blue-500 text-[8px] px-2 py-1 rounded-sm font-bold transition-colors cursor-pointer relative z-[30] ml-1"
                              >
                                MOVE
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="px-3 flex items-center gap-1 border-r border-white/10 h-full">
                        <input 
                          type="text"
                          className="bg-transparent font-mono text-[10px] text-neutral-400 tracking-tighter w-12 text-center focus:outline-none focus:text-white"
                          value={editingOrders[item.id] !== undefined ? editingOrders[item.id] : String(item.order || 0).padStart(4, '0')}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setEditingOrders(prev => ({ ...prev, [item.id]: val }));
                          }}
                        />
                        {editingOrders[item.id] !== undefined && editingOrders[item.id] !== String(item.order || 0).padStart(4, '0') && (
                          <button 
                            onClick={async () => {
                              const newOrder = parseInt(editingOrders[item.id]);
                              if (!isNaN(newOrder)) {
                                setLoading(true);
                                try {
                                  const { error } = await supabase
                                    .from('gallery_items')
                                    .update({ order: newOrder })
                                    .eq('id', item.id);
                                  if (error) throw error;
                                  
                                  // Reset editing state for this item
                                  setEditingOrders(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                  
                                  // Refresh data locally
                                  fetchItems();
                                } catch (err) {
                                  console.error(err);
                                  alert('Failed to update order');
                                  setLoading(false);
                                }
                              }
                            }}
                            className="bg-white text-black text-[8px] font-bold px-1.5 py-0.5 rounded-sm hover:bg-neutral-200 transition-colors"
                          >
                            OK
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={() => handleAdjustOrder(item.id, 1)}
                        className="text-white w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors font-mono border-l border-white/10"
                        title="Increase Order"
                      >
                        +
                      </button>
                      <button 
                        onClick={() => handleAdjustOrder(item.id, -1)}
                        className="text-white w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-colors font-mono border-l border-white/10"
                        title="Decrease Order"
                      >
                        -
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="flex flex-col gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">Original Image (Source)</label>
                          <div className="aspect-video bg-black relative group overflow-hidden border border-white/10">
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                              <button 
                                title="Update Original Image"
                                onClick={async () => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const result = await handleFileUpload(file);
                                      if (result) handleUpdateItem(item.id, { imageUrl: result.url, thumbnailUrl: result.thumbnailUrl });
                                    }
                                  };
                                  input.click();
                                }}
                                className="bg-white text-black p-2 rounded-full hover:bg-neutral-200"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">Thumbnail (Small 430px View)</label>
                          <div className="w-[50%] aspect-video bg-black/40 relative group overflow-hidden border border-white/5">
                            <img src={item.thumbnailUrl || item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                title="Update Thumbnail Manually"
                                onClick={async () => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const url = await handleManualThumbnailUpload(file);
                                      if (url) handleUpdateItem(item.id, { thumbnailUrl: url });
                                    }
                                  };
                                  input.click();
                                }}
                                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-500"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[8px] text-neutral-600 uppercase tracking-widest mt-1">Shown at 50% size</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="w-full border border-red-900/40 text-red-500 hover:bg-red-900/20 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center"
                      >
                        <Trash2 className="mr-3 w-4 h-4" /> DELETE ART
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Art Title</label>
                        <input 
                          value={item.title || ''}
                          onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Category</label>
                        <select 
                          value={item.category || ''}
                          onChange={e => handleUpdateItem(item.id, { category: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        >
                          <option value="" className="bg-neutral-900">UNCATEGORIZED</option>
                          {categories.map(c => (
                            <option key={c} value={c} className="bg-neutral-900">{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Client</label>
                        <input 
                          value={item.client || ''}
                          onChange={e => handleUpdateItem(item.id, { client: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Year</label>
                        <input 
                          value={item.year || ''}
                          onChange={e => handleUpdateItem(item.id, { year: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] uppercase tracking-widest text-neutral-500">Dimensions (W x H)</label>
                          {item.width && item.height && (
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-blue-400 font-mono">{(item.height / item.width).toFixed(2)}</span>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleReloadDimensions(item);
                                }}
                                className="text-neutral-600 hover:text-white p-1 transition-colors"
                                title="Reload Original Dimensions"
                              >
                                <RefreshCcw size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex flex-col">
                            <span className="text-[7px] text-neutral-600 uppercase mb-0.5">W</span>
                            <input 
                              placeholder="W"
                              value={editingDimensions[item.id]?.width ?? (item.width || '')}
                              onChange={e => setEditingDimensions(prev => ({
                                ...prev,
                                [item.id]: {
                                  width: e.target.value,
                                  height: editingDimensions[item.id]?.height ?? (item.height?.toString() || '')
                                }
                              }))}
                              className="w-12 bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-xs font-mono text-center"
                            />
                          </div>
                          <span className="text-neutral-600 pb-1">×</span>
                          <div className="flex flex-col">
                            <span className="text-[7px] text-neutral-600 uppercase mb-0.5">H</span>
                            <input 
                              placeholder="H"
                              value={editingDimensions[item.id]?.height ?? (item.height || '')}
                              onChange={e => setEditingDimensions(prev => ({
                                ...prev,
                                [item.id]: {
                                  width: editingDimensions[item.id]?.width ?? (item.width?.toString() || ''),
                                  height: e.target.value
                                }
                              }))}
                              className="w-12 bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-xs font-mono text-center"
                            />
                          </div>
                          
                          <div className="flex flex-col ml-4">
                            <span className="text-[7px] text-neutral-600 uppercase mb-0.5">Ratio</span>
                            <input 
                              placeholder="1.4"
                              value={editingDimensions[item.id]?.ratio ?? (item.width && item.height ? (item.height / item.width).toFixed(2) : '')}
                              onChange={e => {
                                const ratioVal = e.target.value;
                                const r = parseFloat(ratioVal);
                                if (!isNaN(r)) {
                                  // Auto-calculate W/H based on ratio if user edits ratio
                                  // We'll use 1000 as a base width for standardizing
                                  setEditingDimensions(prev => ({
                                    ...prev,
                                    [item.id]: {
                                      width: "1000",
                                      height: Math.round(1000 * r).toString(),
                                      ratio: ratioVal
                                    }
                                  }));
                                } else {
                                  setEditingDimensions(prev => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      ratio: ratioVal
                                    }
                                  }));
                                }
                              }}
                              className="w-12 bg-transparent border-b border-blue-400/30 py-1 focus:outline-none focus:border-blue-400 text-xs font-mono text-center text-blue-400"
                            />
                          </div>

                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleReloadDimensions(item);
                            }}
                            className="text-neutral-600 hover:text-white p-1 mb-1 transition-colors ml-1"
                            title="Fetch Actual Dimensions"
                          >
                            <RefreshCcw size={12} />
                          </button>
                          
                          {(editingDimensions[item.id]) && (
                            <button 
                              onClick={async () => {
                                const dims = editingDimensions[item.id];
                                const w = parseInt(dims.width);
                                const h = parseInt(dims.height);
                                
                                if (!isNaN(w) && !isNaN(h)) {
                                  try {
                                    const { error } = await supabase
                                      .from('gallery_items')
                                      .update({ width: w, height: h })
                                      .eq('id', item.id);
                                    
                                    if (error) throw error;
                                    
                                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, width: w, height: h } : i));
                                    setSaveSuccess(item.id);
                                    setEditingDimensions(prev => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    });
                                    setTimeout(() => setSaveSuccess(null), 2000);
                                  } catch (err) {
                                    console.error(err);
                                    alert('Failed to update dimensions');
                                  }
                                }
                              }}
                              className="text-white hover:text-blue-400 p-1 mb-1 transition-colors ml-2"
                              title="Confirm Dimensions"
                            >
                              <Check className={`w-3 h-3 ${saveSuccess === item.id ? 'text-green-400' : ''}`} />
                            </button>
                          )}
                          {saveSuccess === item.id && (
                            <span className="text-[8px] text-green-400 font-bold animate-pulse pb-1">OK</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Description</label>
                        <textarea 
                          value={item.description || ''}
                          onChange={e => handleUpdateItem(item.id, { description: e.target.value })}
                          className="w-full bg-transparent border border-white/10 rounded-sm p-3 focus:outline-none focus:border-white text-sm h-20 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Art Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-24 bg-black/90 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="w-full max-w-4xl bg-neutral-900 border border-white/10 p-10 relative my-auto"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-2xl font-light tracking-[0.3em] uppercase mb-12">New Creation</h2>
              
              <form onSubmit={handleSaveNewArt} className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div 
                    onClick={() => document.getElementById('new-file-upload')?.click()}
                    className="aspect-video bg-black border border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-white/30 transition-all group overflow-hidden relative"
                  >
                    {newArt.file ? (
                      <div className="relative w-full h-full">
                        <img src={previewUrl || ''} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Check className="w-8 h-8 text-green-400" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-neutral-600 group-hover:text-white transition-colors mb-4" />
                        <div className="text-center space-y-1 px-4">
                          <span className="text-[9px] uppercase tracking-widest text-neutral-500 block">Main Image Upload</span>
                          <span className="text-[7px] uppercase tracking-widest text-neutral-700 block">(Original file saved, thumbnail generated automatically)</span>
                        </div>
                      </>
                    )}
                    <input 
                      id="new-file-upload"
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Set file immediately
                          setNewArt(prev => ({ ...prev, file }));
                          
                          // Clean up old preview
                          if (previewUrl) URL.revokeObjectURL(previewUrl);
                          const newUrl = URL.createObjectURL(file);
                          setPreviewUrl(newUrl);

                          // Extract dimensions
                          const img = new Image();
                          img.onload = () => {
                            setNewArt(prev => ({
                              ...prev, 
                              width: img.naturalWidth, 
                              height: img.naturalHeight 
                            }));
                          };
                          img.src = newUrl;
                        }
                      }}
                    />
                  </div>

                  <div 
                    onClick={() => document.getElementById('manual-thumb-upload')?.click()}
                    className="aspect-video bg-black/50 border border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer hover:border-white/20 transition-all group overflow-hidden relative"
                  >
                    {newArt.manualThumbnailFile ? (
                      <div className="relative w-full h-full">
                        <img src={URL.createObjectURL(newArt.manualThumbnailFile)} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-[8px] uppercase tracking-widest text-white">Manual Thumb Selected</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <Plus className="w-4 h-4 text-neutral-700 group-hover:text-neutral-500 mx-auto mb-2" />
                        <span className="text-[8px] uppercase tracking-widest text-neutral-600 block">Manual Thumbnail (Optional)</span>
                        <span className="text-[7px] uppercase tracking-widest text-neutral-700 block">Required: 430px Width</span>
                      </div>
                    )}
                    <input 
                      id="manual-thumb-upload"
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) setNewArt(prev => ({...prev, manualThumbnailFile: file}));
                      }}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-neutral-500">Title</label>
                      <input 
                        required
                        value={newArt.title || ''}
                        onChange={e => setNewArt({...newArt, title: e.target.value})}
                        className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-neutral-500">Categorization</label>
                      <select 
                        required
                        value={newArt.category || ''}
                        onChange={e => setNewArt({...newArt, category: e.target.value})}
                        className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-white text-sm"
                      >
                        <option value="" disabled className="bg-neutral-900">SELECT CATEGORY</option>
                        {categories.map(c => (
                          <option key={c} value={c} className="bg-neutral-900">{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-neutral-500">Client</label>
                      <input 
                        value={newArt.client || ''}
                        onChange={e => setNewArt({...newArt, client: e.target.value})}
                        className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-neutral-500">Year</label>
                      <input 
                        value={newArt.year || ''}
                        onChange={e => setNewArt({...newArt, year: e.target.value})}
                        className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-neutral-500">Extended Description</label>
                    <textarea 
                      required
                      value={newArt.description || ''}
                      onChange={e => setNewArt({...newArt, description: e.target.value})}
                      className="w-full bg-transparent border border-white/10 rounded-sm p-4 focus:outline-none focus:border-white text-sm h-32 resize-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className={`w-full bg-white text-black py-4 text-[11px] font-bold uppercase tracking-[0.3em] transition-all mt-8 flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-200'}`}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        Archiving...
                      </>
                    ) : (
                      'Archive Art'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {showCatModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-neutral-900 border border-white/10 p-10 rounded-sm"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-lg tracking-[0.2em] font-light uppercase">Structure Index</h3>
                <button onClick={() => setShowCatModal(false)}><X className="w-5 h-5 text-neutral-500" /></button>
              </div>

              <div className="space-y-4 mb-10 max-h-[300px] overflow-y-auto pr-4 scrollbar-hide">
                {categories.map((cat, idx) => (
                  <div key={cat} className="flex items-center justify-between group p-3 border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] tracking-widest">{cat}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleMoveCategory(idx, 'up')}
                          disabled={idx === 0}
                          className="text-neutral-600 hover:text-white disabled:opacity-30 transition-colors text-[9px] font-bold"
                          title="Move Up"
                        >
                          &lt;
                        </button>
                        <button 
                          onClick={() => handleMoveCategory(idx, 'down')}
                          disabled={idx === categories.length - 1}
                          className="text-neutral-600 hover:text-white disabled:opacity-30 transition-colors text-[9px] font-bold"
                          title="Move Down"
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-red-900 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input 
                  value={newCatName || ''}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="NEW CLASSIFICATION"
                  className="flex-grow bg-black border-b border-white/10 py-3 px-4 focus:outline-none focus:border-white text-[10px] tracking-widest"
                />
                <button 
                  onClick={handleAddCategory}
                  className="bg-white text-black px-4 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && itemToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-neutral-900 border border-white/10 p-8 rounded-sm shadow-2xl"
            >
              <h3 className="text-sm tracking-[0.2em] font-light uppercase mb-6 text-red-500">Confirm Deletion</h3>
              <p className="text-xs text-neutral-400 tracking-widest leading-relaxed mb-8">
                Are you sure you want to permanently delete <span className="text-white font-bold">"{itemToDelete.title}"</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                  }}
                  className="flex-1 border border-white/10 text-white py-3 text-[9px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-3 text-[9px] font-bold uppercase tracking-widest hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCcw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>Delete Art</>
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
