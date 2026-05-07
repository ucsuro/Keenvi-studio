import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Intro from './components/Intro';
import Gallery from './components/Gallery';
import About from './components/About';
import Contact from './components/Contact';
import Admin from './components/Admin';
import { cn } from './lib/utils';

type Page = 'Intro' | 'Portfolio' | 'Project' | 'Personal Work' | 'About' | 'Contact' | 'Admin';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('Intro');
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [categories, setCategories] = useState<Record<string, string[]>>({ portfolio: [], project: [], personal: [] });

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  // Check login status on mount
  useEffect(() => {
    if (localStorage.getItem('keenvi_auth')) {
      setIsLoggedIn(true);
    }
    fetchCategories();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: adminId.trim(), password: adminPw.trim() })
      });
      if (res.ok) {
        setIsLoggedIn(true);
        localStorage.setItem('keenvi_auth', 'true');
        setShowLoginModal(false);
        setAdminId('');
        setAdminPw('');
      } else {
        alert('Invalid credentials');
      }
    } catch (error) {
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('keenvi_auth');
  };

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage, subCategory]);

  const renderPage = () => {
    switch (activePage) {
      case 'Intro':
        return <Intro onNavigate={(page, sub) => { setActivePage(page); setSubCategory(sub || null); }} />;
      case 'Portfolio':
      case 'Project':
      case 'Personal Work':
        return <Gallery type={activePage.toLowerCase() as any} subCategory={subCategory} />;
      case 'About':
        return <About />;
      case 'Contact':
        return <Contact />;
      case 'Admin':
        return <Admin onCategoriesChange={fetchCategories} />;
      default:
        return <Intro onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      {/* Immersive Background Elements */}
      <div className="bg-blob top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-900"></div>
      <div className="bg-blob bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-950"></div>

      <Navigation 
        activePage={activePage} 
        onNavigate={(page, sub) => { setActivePage(page); setSubCategory(sub || null); }} 
        categories={categories}
        isLoggedIn={isLoggedIn}
      />
      
      <main className="flex-grow relative pt-20">
        {renderPage()}
      </main>

      <footer className="relative z-10 py-12 border-t border-white/5 text-center flex flex-col items-center">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => !isLoggedIn && setShowLoginModal(true)} 
            className="text-neutral-800 text-[8px] hover:text-neutral-600 transition-colors cursor-pointer"
            title="Admin Login"
          >
            ◆◆◆
          </button>
          {isLoggedIn && (
            <button 
              onClick={handleLogout}
              className="text-neutral-500 text-[9px] uppercase tracking-widest hover:text-white transition-colors"
            >
              Logout
            </button>
          )}
        </div>
        <p className="text-neutral-600 text-[10px] uppercase tracking-[0.2em]">
          © {new Date().getFullYear()} KeenVi Studio • All rights reserved
        </p>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 p-8 rounded-sm">
            <h2 className="text-xl tracking-[0.2em] uppercase font-light mb-8 text-center">Studio Access</h2>
            <form onSubmit={handleLogin} className="space-y-6">
              <input
                type="text"
                placeholder="ID"
                value={adminId}
                onChange={e => setAdminId(e.target.value)}
                className="w-full bg-black border-b border-white/10 py-3 focus:outline-none focus:border-white text-sm"
              />
              <input
                type="password"
                placeholder="PASSWORD"
                value={adminPw}
                onChange={e => setAdminPw(e.target.value)}
                className="w-full bg-black border-b border-white/10 py-3 focus:outline-none focus:border-white text-sm"
              />
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 border border-white/10 py-3 text-[10px] uppercase tracking-widest hover:bg-white/5"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-white text-black py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-200"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
