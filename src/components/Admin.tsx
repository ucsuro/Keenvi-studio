import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X, Upload, Check, ChevronUp, ChevronDown } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [aboutData, setAboutData] = useState<{
    title: string;
    description: string;
    bio: string;
    career: Array<{ year: string; title: string; content: string }>;
    skills: string[];
    tools: string[];
  } | null>(null);

  const [introData, setIntroData] = useState<{
    logoText: string;
    headline: string;
    links: {
      artstation: string;
      instagram: string;
      linkedin: string;
      facebook: string;
      naver: string;
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
    manualThumbnailFile: null as File | null
  });

  useEffect(() => {
    fetchCategories();
    if (activeTab === 'about') {
      fetch('/api/about').then(res => res.json()).then(setAboutData);
    } else if (activeTab === 'intro') {
      fetch('/api/intro').then(res => res.json()).then(setIntroData);
    } else {
      fetchItems();
    }
  }, [activeTab]);

  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (activeTab === 'portfolio' || activeTab === 'project' || activeTab === 'personal') {
      setCategories(data[activeTab] || []);
    } else {
      setCategories([]);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gallery/${activeTab}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<GalleryItem>) => {
    const res = await fetch(`/api/gallery/${activeTab}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this art?')) return;
    try {
      const res = await fetch(`/api/gallery/${activeTab}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(items.filter(item => item.id !== id));
      } else {
        alert('Failed to delete item');
      }
    } catch (err) {
      console.error(err);
      alert('Error during deletion');
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      return { url: data.url, thumbnailUrl: data.thumbnailUrl };
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
      return null;
    }
  };

  const handleManualThumbnailUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload/thumbnail', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
      alert('Thumbnail upload failed');
      return null;
    }
  };

  const handleSaveNewArt = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalImageUrl = newArt.imageUrl;
    let finalThumbnailUrl = newArt.thumbnailUrl;
    
    if (newArt.file) {
      const result = await handleFileUpload(newArt.file);
      if (result) {
        finalImageUrl = result.url;
        finalThumbnailUrl = result.thumbnailUrl;
      } else return; 
    }

    if (newArt.manualThumbnailFile) {
      const manualThumbUrl = await handleManualThumbnailUpload(newArt.manualThumbnailFile);
      if (manualThumbUrl) finalThumbnailUrl = manualThumbUrl;
    }

    if (!finalImageUrl) {
      alert('Please upload an image or provide a URL');
      return;
    }

    const res = await fetch(`/api/gallery/${activeTab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...newArt, 
        imageUrl: finalImageUrl, 
        thumbnailUrl: finalThumbnailUrl,
        file: undefined, 
        manualThumbnailFile: undefined 
      })
    });

    if (res.ok) {
      setShowAddModal(false);
      setNewArt({ 
        title: '', category: '', client: '', year: new Date().getFullYear().toString(), 
        description: '', imageUrl: '', thumbnailUrl: '', 
        file: null, manualThumbnailFile: null 
      });
      fetchItems();
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch(`/api/categories/${activeTab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName })
    });
    if (res.ok) {
      setNewCatName('');
      fetchCategories();
      onCategoriesChange?.();
    }
  };

  const handleDeleteCategory = async (name: string) => {
    const res = await fetch(`/api/categories/${activeTab}/${name}`, { method: 'DELETE' });
    if (res.ok) {
      fetchCategories();
      onCategoriesChange?.();
    }
  };
  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newCategories.length) return;
    
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    
    const res = await fetch(`/api/categories/${activeTab}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: newCategories })
    });
    
    if (res.ok) {
      setCategories(newCategories);
      onCategoriesChange?.();
    }
  };

  const handleAdjustOrder = async (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const newOrder = (item.order || 0) + delta;
    const updates = { order: newOrder };
    
    const res = await fetch(`/api/gallery/${activeTab}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (res.ok) {
      setItems(items.map(i => i.id === id ? { ...i, ...updates } : i).sort((a, b) => {
        if (b.order !== a.order) return b.order - a.order;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }));
    }
  };

  const handleSaveAbout = async () => {
    const res = await fetch('/api/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aboutData)
    });
    if (res.ok) alert('About page updated');
  };

  const handleSaveIntro = async () => {
    const res = await fetch('/api/intro', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(introData)
    });
    if (res.ok) alert('Intro context saved');
  };

  const handleGatewayUpload = async (type: 'portfolio' | 'project' | 'personal', file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url && introData) {
        setIntroData({
          ...introData,
          gateways: {
            ...introData.gateways,
            [type]: data.url
          }
        });
      }
    } catch (err) {
      console.error('Upload failed');
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
            <h2 className="text-2xl font-light tracking-[0.2em] uppercase">Managing {activeTab}</h2>
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
                      value={introData.logoText}
                      onChange={e => setIntroData({...introData, logoText: e.target.value})}
                      className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-white text-xl uppercase tracking-[0.2em]"
                      placeholder="Enter logo name..."
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">Intro Headline (Description)</label>
                    <textarea 
                      value={introData.headline}
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
                    {['artstation', 'linkedin', 'twitter', 'facebook', 'instagram', 'naver'].map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-600">{key}</label>
                        <input 
                          value={introData.links[key as keyof typeof introData.links]}
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
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Studio Name</label>
                  <input 
                    value={aboutData.title}
                    onChange={e => setAboutData({...aboutData, title: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Short Description</label>
                  <textarea 
                    value={aboutData.description}
                    onChange={e => setAboutData({...aboutData, description: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400 h-24"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500">Detailed Biography</label>
                  <textarea 
                    value={aboutData.bio}
                    onChange={e => setAboutData({...aboutData, bio: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/5 rounded-sm px-4 py-3 focus:outline-none focus:border-blue-400 h-48"
                  />
                </div>
                <div className="space-y-4 pt-8 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">Chronicle (Career)</h3>
                    <button 
                      onClick={() => setAboutData({...aboutData, career: [...(aboutData.career || []), { year: '', title: '', content: '' }]})}
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
                            value={exp.year}
                            onChange={e => {
                              const newCareer = [...aboutData.career];
                              newCareer[idx].year = e.target.value;
                              setAboutData({...aboutData, career: newCareer});
                            }}
                            className="bg-transparent border-b border-white/10 py-1 text-[10px] tracking-widest focus:outline-none focus:border-white"
                          />
                          <input 
                            placeholder="TITLED POSITION / PROJECT"
                            value={exp.title}
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
                          value={exp.content}
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
                      value={(aboutData.skills || []).join('\n')}
                      onChange={e => setAboutData({...aboutData, skills: e.target.value.split('\n')})}
                      className="w-full bg-neutral-900 border border-white/5 p-3 text-xs tracking-widest focus:outline-none focus:border-white h-32"
                      placeholder="One item per line"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-neutral-500">Artifacts (Tools)</label>
                    <textarea 
                      value={(aboutData.tools || []).join('\n')}
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
                    {/* Order Controls */}
                    <div className="absolute top-0 right-0 z-10 flex items-center border-l border-b border-white/10 bg-black/40 backdrop-blur-sm">
                      <div className="px-3 font-mono text-[10px] text-neutral-400 tracking-tighter">
                        {String(item.order || 0).padStart(4, '0')}
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
                          value={item.title}
                          onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Category</label>
                        <select 
                          value={item.category}
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
                          value={item.client}
                          onChange={e => handleUpdateItem(item.id, { client: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Year</label>
                        <input 
                          value={item.year}
                          onChange={e => handleUpdateItem(item.id, { year: e.target.value })}
                          className="w-full bg-transparent border-b border-white/10 py-1 focus:outline-none focus:border-white text-sm"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] uppercase tracking-widest text-neutral-500">Description</label>
                        <textarea 
                          value={item.description}
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
                        <img src={URL.createObjectURL(newArt.file)} className="w-full h-full object-cover" />
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
                        if (file) setNewArt({...newArt, file});
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
                        if (file) setNewArt({...newArt, manualThumbnailFile: file});
                      }}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-neutral-500">Title</label>
                      <input 
                        required
                        value={newArt.title}
                        onChange={e => setNewArt({...newArt, title: e.target.value})}
                        className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-neutral-500">Categorization</label>
                      <select 
                        required
                        value={newArt.category}
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
                        value={newArt.client}
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
                        value={newArt.year}
                        onChange={e => setNewArt({...newArt, year: e.target.value})}
                        className="w-full bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-neutral-500">Extended Description</label>
                    <textarea 
                      required
                      value={newArt.description}
                      onChange={e => setNewArt({...newArt, description: e.target.value})}
                      className="w-full bg-transparent border border-white/10 rounded-sm p-4 focus:outline-none focus:border-white text-sm h-32 resize-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-white text-black py-4 text-[11px] font-bold uppercase tracking-[0.3em] hover:bg-neutral-200 transition-all mt-8"
                  >
                    Archive Art
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
                  value={newCatName}
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
    </div>
  );
}
