import { useEffect, useState } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';


export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['download', 'share', 'discover', 'features', 'home'];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight / 2) {
          setActiveSection(id);
          break;
        }
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-10 h-16 transition-all duration-300"
      style={{
        background: scrolled
          ? 'rgba(10, 20, 30, 0.85)'
          : 'rgba(10, 20, 30, 0.45)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: scrolled
          ? '1px solid rgba(56,189,248,0.25)'
          : '1px solid rgba(56,189,248,0.10)',
        boxShadow: scrolled
          ? '0 4px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
        transition: 'all 0.4s ease',
      }}
    >
      <a href="#home" onClick={(e) => { e.preventDefault(); scrollTo('home'); }}>
        <img
          src="https://media.base44.com/images/public/69fdbea1d88b5185b3e0b8ce/66ac82178_Roamerz-SYMBOLDARKMODE.png"
          alt="Roamerz Logo"
          className="h-8 md:h-10 w-auto transition-transform duration-200 hover:scale-125 cursor-pointer"
        />
      </a>

      {/* Desktop Menu */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
        <button
          onClick={() => scrollTo('home')}
          className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-300 ${
            activeSection === 'home'
              ? 'text-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'text-white/60 hover:text-white hover:bg-white/8'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => scrollTo('features')}
          className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-300 ${
            activeSection === 'features'
              ? 'text-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'text-white/60 hover:text-white hover:bg-white/8'
          }`}
        >
          Features
        </button>
        <button
          onClick={() => scrollTo('discover')}
          className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-300 ${
            activeSection === 'discover'
              ? 'text-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'text-white/60 hover:text-white hover:bg-white/8'
          }`}
        >
          Discover
        </button>
        <button
          onClick={() => scrollTo('share')}
          className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-300 ${
            activeSection === 'share'
              ? 'text-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'text-white/60 hover:text-white hover:bg-white/8'
          }`}
        >
          Share
        </button>
        <button
          onClick={() => scrollTo('download')}
          className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-300 ${
            activeSection === 'download'
              ? 'text-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'text-white/60 hover:text-white hover:bg-white/8'
          }`}
        >
          Download
        </button>
      </div>
      {/* Desktop CTA Button */}
      <div className="hidden md:flex items-center">
        <button
          onClick={() => scrollTo('download')}
          className="text-sm font-semibold px-5 py-2 rounded-full transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(56,189,248,0.08))',
            border: '1px solid rgba(56,189,248,0.55)',
            color: '#e0f8ff',
            letterSpacing: '0.02em',
            boxShadow: '0 0 18px rgba(56,189,248,0.18), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.28), rgba(56,189,248,0.15))';
            e.currentTarget.style.boxShadow = '0 0 26px rgba(56,189,248,0.3), inset 0 1px 0 rgba(255,255,255,0.12)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(56,189,248,0.08))';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(56,189,248,0.18), inset 0 1px 0 rgba(255,255,255,0.1)';
          }}
        >
          Apply for Early Access
        </button>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden text-white/70 hover:text-white transition"
      >
        {mobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
      </button>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="absolute top-16 left-0 right-0 md:hidden flex flex-col"
          style={{
            background: 'rgba(8,18,36,0.97)',
            backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(56,189,248,0.2)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          }}
        >
          {[
            { label: 'Home', id: 'home' },
            { label: 'Features', id: 'features' },
            { label: 'Discover', id: 'discover' },
            { label: 'Share', id: 'share' },
            { label: 'Download', id: 'download' },
          ].map(({ label, id }) => (
            <button
              key={id}
              onClick={() => { scrollTo(id); setMobileMenuOpen(false); }}
              className="text-left px-6 py-4 text-base font-semibold transition-all"
              style={{
                color: activeSection === id ? '#38bdf8' : 'rgba(255,255,255,0.75)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: activeSection === id ? 'rgba(56,189,248,0.06)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
          <div className="px-6 py-5">
            <button
              onClick={() => { scrollTo('download'); setMobileMenuOpen(false); }}
              className="w-full text-base font-bold py-3.5 rounded-xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #1a7fa0, #0e5f7a)',
                color: '#fff',
                boxShadow: '0 0 24px rgba(56,189,248,0.25)',
              }}
            >
              Apply for Early Access
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
