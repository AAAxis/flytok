import Navbar from '@/components/landing/Navbar.jsx';
import StatsSection from '@/components/landing/StatsSection.jsx';
import WhyRoamerzSection from '@/components/landing/WhyRoamerzSection.jsx';
import MapSection from '@/components/landing/features/MapSection.jsx';
import ExploreSection from '@/components/landing/ExploreSection.jsx';
import ShareSection from '@/components/landing/ShareSection.jsx';
import DownloadSection from '@/components/landing/DownloadSection.jsx';
import CinematicOverlay from '@/components/landing/CinematicOverlay.jsx';
import HeroSection from '@/components/landing/hero/HeroSection.jsx';
import ScrollBird from '@/components/landing/ScrollBird.jsx';
import CinematicBackground from '@/components/landing/CinematicBackground.jsx';

export default function Landing() {
  return (
    <div
      className="text-white flex flex-col"
      style={{
        background: '#050c18',
        position: 'relative',
        isolation: 'isolate',
        willChange: 'scroll-position',
      }}
    >
      <CinematicBackground />
      <CinematicOverlay grainOpacity={0.022} vignetteOpacity={0.42} />
      <ScrollBird />
      <Navbar />

      <div style={{ position: 'relative', zIndex: 10 }}>
        <HeroSection />
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <StatsSection />
      </div>
      <div style={{ position: 'relative', zIndex: 10 }}>
        <WhyRoamerzSection />
      </div>

      <div id="features" style={{ position: 'relative', zIndex: 10 }}>
        <MapSection />
      </div>

      <div id="discover" style={{ position: 'relative', zIndex: 10 }}>
        <ExploreSection />
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <ShareSection />
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <DownloadSection />
      </div>
    </div>
  );
}
