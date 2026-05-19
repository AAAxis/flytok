import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

const LOCATIONS = [
  { id: 1, name: 'Tokyo, Japan',        lat: 35.6,  lng: 139.7, traveler: 'Yuki M.',   color: '#00eeff', clip: 'Shibuya crossing at midnight 🌃',    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face' },
  { id: 2, name: 'Paris, France',       lat: 48.8,  lng: 2.3,   traveler: 'Sophie L.', color: '#f59e0b', clip: 'Eiffel Tower in rain ☔',              avatar: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=80&h=80&fit=crop&crop=face' },
  { id: 3, name: 'Santorini, Greece',   lat: 36.4,  lng: 25.4,  traveler: 'Elena K.',  color: '#00eeff', clip: 'Blue domes & golden hour 🌅',          avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&crop=face' },
  { id: 4, name: 'Cape Town',           lat: -33.9, lng: 18.4,  traveler: 'Amara D.',  color: '#f59e0b', clip: 'Table Mountain sunrise 🏔️',            avatar: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=80&h=80&fit=crop&crop=face' },
  { id: 5, name: 'New York, USA',       lat: 40.7,  lng: -74.0, traveler: 'James T.',  color: '#00eeff', clip: 'Manhattan skyline at dusk 🗽',         avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face' },
  { id: 6, name: 'Cusco, Peru',         lat: -13.5, lng: -72.0, traveler: 'Carlos R.', color: '#f59e0b', clip: 'Lost city above the clouds ☁️',        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face' },
  { id: 7, name: 'Ubud, Bali',          lat: -8.5,  lng: 115.3, traveler: 'Sari W.',   color: '#00eeff', clip: 'Rice terraces & temples 🌿',            avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=80&h=80&fit=crop&crop=face' },
];

// Arc pairs to draw flight paths between
const ARC_PAIRS = [[0,1],[1,2],[2,6],[4,0],[5,3],[3,2]];

// Heat zone center points (lat, lng, intensity)
const HEAT_ZONES = [
  { lat: 48, lng: 10,   r: 0.35, color: 0x38bdf8 },  // Europe
  { lat: 10, lng: 105,  r: 0.28, color: 0x34d399 },  // SE Asia
  { lat: 38, lng: -98,  r: 0.3,  color: 0xf59e0b },  // N America
  { lat: -5, lng: 28,   r: 0.22, color: 0xf97316 },  // Africa
];

function latLngToVec3(lat, lng, r = 1) {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function buildArc(a, b, segments = 80) {
  const start = latLngToVec3(a.lat, a.lng, 1.01);
  const end   = latLngToVec3(b.lat, b.lng, 1.01);
  const mid   = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.45);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(segments);
}

export default function MapSection() {
  const mountRef    = useRef(null);
  const sceneRef    = useRef({});
  const sectionRef  = useRef(null);
  const dragRef     = useRef({ active: false, lastX: 0, lastY: 0, velX: 0, velY: 0 });
  const zoomRef     = useRef(2.8);

  const [activeIdx, setActiveIdx]       = useState(0);
  const [markerPos, setMarkerPos]       = useState([]);
  const [selectedLoc, setSelectedLoc]   = useState(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [isDesktop, setIsDesktop]       = useState(window.innerWidth >= 768);
  const [filter, setFilter]             = useState('All');

  // Expose activeIdx to animation loop
  const activeIdxRef = useRef(0);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-cycle active pin
  useEffect(() => {
    const t = setInterval(() => {
      if (!dragRef.current.active) setActiveIdx(i => (i + 1) % LOCATIONS.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Scroll visibility
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0, rootMargin: '0px 0px -5% 0px' });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  // THREE.js scene
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const isMobile = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile, // Disable antialias on mobile for performance
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5)); // Lower pixel ratio on mobile
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    camera.position.z = zoomRef.current;

    // ── Stars ───────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const sv = [];
    const starCount = isMobile ? 800 : 2500; // Reduced stars on mobile
    for (let i = 0; i < starCount; i++) {
      const r = 60 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sv.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, sizeAttenuation: true }));
    scene.add(stars);

    // ── Lights ───────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x223344, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.position.set(5, 3, 4);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rim.position.set(-4, -1, -2);
    scene.add(rim);

    // ── Earth ────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();
    const earthSegments = isMobile ? 32 : 64; // Reduced segments on mobile
    const earthGeo = new THREE.SphereGeometry(1, earthSegments, earthSegments);
    const earthMat = new THREE.MeshPhongMaterial({
      map:         loader.load('/textures/earth-day.jpg'),
      specularMap: loader.load('/textures/earth-water.png'),
      specular:    new THREE.Color(0x2244aa),
      shininess:   isMobile ? 20 : 35, // Lower shininess on mobile
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // ── Night side lights ────────────────────────────────────
    const nightMat = new THREE.MeshBasicMaterial({
      map: loader.load('/textures/earth-night.jpg'),
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: isMobile ? 0.35 : 0.55, // Reduced opacity on mobile
    });
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.001, earthSegments, earthSegments), nightMat));

    // ── Clouds ───────────────────────────────────────────────
    const cloudSegments = isMobile ? 24 : 48;
    const cloudMat = new THREE.MeshPhongMaterial({
      map: loader.load('/textures/earth-clouds.png'),
      transparent: true, opacity: isMobile ? 0.25 : 0.35,
      depthWrite: false,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, cloudSegments, cloudSegments), cloudMat);
    scene.add(clouds);

    // ── Simplified atmosphere for mobile ─────────────────────
    if (!isMobile) {
      const atmosMat = new THREE.MeshPhongMaterial({
        color: 0x38bdf8, transparent: true, opacity: 0.07,
        side: THREE.BackSide, depthWrite: false,
      });
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 32, 32), atmosMat));

      const rimGlowMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8, transparent: true, opacity: 0.12,
        side: THREE.BackSide, depthWrite: false,
      });
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.18, 32, 32), rimGlowMat));
    }

    // ── Heat zones ───────────────────────────────────────────
    if (!isMobile) { // Skip heat zones on mobile for performance
      HEAT_ZONES.forEach(({ lat, lng, r, color }) => {
        const pos = latLngToVec3(lat, lng, 1.003);
        const geo = new THREE.CircleGeometry(r, 32);
        const mat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.12,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.lookAt(pos.clone().multiplyScalar(2));
        earth.add(mesh);
      });
    }

    // ── Arc flight paths ─────────────────────────────────────
    ARC_PAIRS.forEach(([ai, bi]) => {
      const pts = buildArc(LOCATIONS[ai], LOCATIONS[bi]);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0x38bdf8, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, linewidth: 1,
      });
      scene.add(new THREE.Line(geo, mat));
    });

    // ── Pin markers ──────────────────────────────────────────
    const markerMeshes = LOCATIONS.map((loc) => {
      const pos = latLngToVec3(loc.lat, loc.lng, 1.025);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, isMobile ? 6 : 12, isMobile ? 6 : 12), // Lower resolution on mobile
        new THREE.MeshBasicMaterial({ color: loc.color === '#00eeff' ? 0x00eeff : 0xf59e0b, blending: THREE.AdditiveBlending })
      );
      dot.position.copy(latLngToVec3(loc.lat, loc.lng, 1.015));
      earth.add(dot);
      return dot;
    });

    sceneRef.current = { earth, camera, renderer, scene, markerMeshes, clouds };

    // ── Mouse drag ───────────────────────────────────────────
    const d = dragRef.current;
    let autoRotY = 0.0015;
    let autoRotX = 0;

    const onPointerDown = (e) => {
      d.active = true;
      d.lastX  = e.clientX || e.touches?.[0]?.clientX;
      d.lastY  = e.clientY || e.touches?.[0]?.clientY;
      d.velX = d.velY = 0;
    };
    const onPointerMove = (e) => {
      if (!d.active) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      d.velX = (cx - d.lastX) * 0.005;
      d.velY = (cy - d.lastY) * 0.005;
      earth.rotation.y += d.velX;
      earth.rotation.x += d.velY;
      earth.rotation.x = Math.max(-1.2, Math.min(1.2, earth.rotation.x));
      d.lastX = cx; d.lastY = cy;
    };
    const onPointerUp = () => { d.active = false; };

    const onWheel = (e) => {
      e.preventDefault();
      zoomRef.current = Math.max(1.6, Math.min(4.5, zoomRef.current + e.deltaY * 0.003));
    };

    el.addEventListener('mousedown',   onPointerDown);
    el.addEventListener('mousemove',   onPointerMove);
    el.addEventListener('mouseup',     onPointerUp);
    el.addEventListener('mouseleave',  onPointerUp);
    el.addEventListener('touchstart',  onPointerDown, { passive: true });
    el.addEventListener('touchmove',   onPointerMove, { passive: true });
    el.addEventListener('touchend',    onPointerUp);
    el.addEventListener('wheel',       onWheel,       { passive: false });

    // ── Animation loop ───────────────────────────────────────
    let frameId;
    let lastReact = 0;
    const worldPos  = new THREE.Vector3();
    const camDir    = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const currentW  = el.clientWidth;
    const currentH  = el.clientHeight;

    const animate = (ts) => {
      frameId = requestAnimationFrame(animate);

      // Smooth zoom
      camera.position.z += (zoomRef.current - camera.position.z) * 0.08;

      // Inertia when not dragging
      if (!d.active) {
        earth.rotation.y += autoRotY + d.velX;
        earth.rotation.x += autoRotX + d.velY;
        earth.rotation.x = Math.max(-1.2, Math.min(1.2, earth.rotation.x));
        d.velX *= 0.92; d.velY *= 0.92;
      }

      // Drift clouds
      clouds.rotation.y += 0.0003;

      // Slow star parallax
      stars.rotation.y += 0.00008;

      // Pulse marker size
      const t = ts * 0.001;
      markerMeshes.forEach((m, i) => {
        const scale = i === activeIdxRef.current
          ? 1.5 + 0.5 * Math.sin(t * 4)
          : 1.0;
        m.scale.setScalar(scale);
      });

      renderer.render(scene, camera);

      // Throttle marker overlay updates (throttle more on mobile)
      const throttleMs = isMobile ? 120 : 66; // ~8fps on mobile, ~15fps on desktop
      if (ts - lastReact > throttleMs) {
        lastReact = ts;
        camera.getWorldDirection(camDir);
        const positions = markerMeshes.map((mesh) => {
          mesh.getWorldPosition(worldPos);
          const dot = worldPos.clone().normalize().dot(camDir.clone().negate());
          projected.copy(worldPos).project(camera);
          return {
            x: (projected.x * 0.5 + 0.5) * currentW,
            y: (-projected.y * 0.5 + 0.5) * currentH,
            visible: dot > 0.12,
          };
        });
        setMarkerPos(positions);
      }
    };
    animate(0);

    const onWinResize = () => {
      const nW = el.clientWidth, nH = el.clientHeight;
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onWinResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onWinResize);
      el.removeEventListener('mousedown',  onPointerDown);
      el.removeEventListener('mousemove',  onPointerMove);
      el.removeEventListener('mouseup',    onPointerUp);
      el.removeEventListener('mouseleave', onPointerUp);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove',  onPointerMove);
      el.removeEventListener('touchend',   onPointerUp);
      el.removeEventListener('wheel',      onWheel);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  const handlePinClick = useCallback((i) => {
    setActiveIdx(i);
    setSelectedLoc(LOCATIONS[i]);
    setPanelVisible(true);
  }, []);

  const filters = ['All', 'Videos', 'Photos', 'Itineraries'];

  const globeSize = isDesktop ? 'min(660px, 88vw)' : 'min(320px, 90vw)';

  return (
    <section
      ref={sectionRef}
      id="features"
      style={{
        background: 'transparent',
        padding: isDesktop ? '80px 40px' : '48px 16px',
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.9s ease',
      }}
    >
      <style>{`
        @keyframes pinDrop { 0%{opacity:0;transform:translateY(-20px) scale(0.5)} 60%{transform:translateY(3px) scale(1.1)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ripple  { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.8} 100%{transform:translate(-50%,-50%) scale(3.5);opacity:0} }
        @keyframes slidePanel { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
        .pin-drop  { animation: pinDrop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .ripple-1  { animation: ripple 2s ease-out infinite; }
        .ripple-2  { animation: ripple 2s ease-out 0.7s infinite; }
        .slide-in  { animation: slidePanel 0.35s ease forwards; }
      `}</style>

      {/* Background glow orbs */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
        <div style={{ position:'absolute', top:'10%', left:'15%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)', filter:'blur(40px)' }} />
        <div style={{ position:'absolute', bottom:'10%', right:'10%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)', filter:'blur(40px)' }} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', position:'relative', zIndex:1 }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: 48, maxWidth: 620 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            fontSize:11, fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase',
            color:'rgba(56,189,248,0.8)', border:'1px solid rgba(56,189,248,0.22)',
            borderRadius:999, padding:'4px 14px', background:'rgba(56,189,248,0.07)',
            marginBottom:16,
          }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#38bdf8', boxShadow:'0 0 8px #38bdf8', display:'inline-block' }} />
            Live Exploration
          </div>
          <h2 style={{ fontSize: isDesktop ? 52 : 32, fontWeight:900, lineHeight:1.05, color:'#fff', margin:'0 0 16px', letterSpacing:'-0.02em' }}>
            Travelers Are Here
            <br />
            <span style={{ background:'linear-gradient(90deg, #38bdf8, #67e8f9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              Right Now
            </span>
          </h2>
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize: isDesktop ? 18 : 15, lineHeight:1.65, margin:'0 0 20px' }}>
            Every video is connected to a real location.
            Watch, follow, and step into the journeys of fellow travelers.
          </p>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:14, fontStyle:'italic' }}>
            Roamerz doesn't just show you places — it shows you what it feels like to be there.
          </p>
        </div>

        {/* ── Main layout ─────────────────────────────────── */}
        <div style={{ display:'flex', gap: isDesktop ? 40 : 0, alignItems:'flex-start', flexDirection: isDesktop ? 'row' : 'column' }}>

          {/* Globe */}
          <div style={{ flex: '0 0 auto', position:'relative' }}>
            <div
              ref={mountRef}
              style={{ width: globeSize, height: globeSize, cursor:'grab', borderRadius:'50%', overflow:'visible', position:'relative', userSelect:'none' }}
            >
              {/* Pin overlays */}
              {markerPos.map((pos, i) => {
                if (!pos.visible) return null;
                const loc = LOCATIONS[i];
                const isActive = activeIdx === i;
                const color = loc.color;
                return (
                  <div
                    key={loc.id}
                    className="absolute"
                    style={{ left: pos.x, top: pos.y, zIndex: isActive ? 50 : 20, pointerEvents:'none' }}
                  >
                    {/* Popup */}
                    {isActive && (
                      <div className="pin-drop absolute" style={{ bottom:'100%', left:'50%', marginBottom:12, transform:'translateX(-50%)', width:160, pointerEvents:'none' }}>
                        <div style={{
                          background:'rgba(5,15,28,0.92)', backdropFilter:'blur(16px)',
                          border:`1px solid ${color}55`, borderRadius:14,
                          padding:'10px 12px', boxShadow:`0 0 24px ${color}44, 0 8px 32px rgba(0,0,0,0.8)`,
                          textAlign:'center',
                        }}>
                          <img src={loc.avatar} alt={loc.traveler} style={{ width:44, height:44, borderRadius:'50%', border:`2px solid ${color}`, boxShadow:`0 0 12px ${color}88`, objectFit:'cover', marginBottom:6 }} />
                          <div style={{ color:'#fff', fontWeight:700, fontSize:13 }}>{loc.traveler}</div>
                          <div style={{ color, fontSize:11, fontWeight:600, marginTop:2 }}>{loc.name}</div>
                          <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, marginTop:4, lineHeight:1.4 }}>{loc.clip}</div>
                        </div>
                        {/* Arrow tip */}
                        <div style={{ width:10, height:10, background:'rgba(5,15,28,0.92)', border:`1px solid ${color}44`, borderTop:'none', borderLeft:'none', transform:'rotate(45deg)', margin:'-6px auto 0', display:'block', position:'relative', zIndex:1 }} />
                      </div>
                    )}
                    {/* Dot + ripples */}
                    <div
                      style={{ width:16, height:16, transform:'translate(-50%,-50%)', position:'relative', cursor:'pointer', pointerEvents:'all' }}
                      onClick={() => handlePinClick(i)}
                    >
                      <span className="ripple-1 absolute rounded-full" style={{ left:'50%', top:'50%', width:12, height:12, border:`1.5px solid ${color}` }} />
                      <span className="ripple-2 absolute rounded-full" style={{ left:'50%', top:'50%', width:12, height:12, border:`1.5px solid ${color}` }} />
                      <span style={{
                        position:'absolute', left:'50%', top:'50%',
                        transform:'translate(-50%,-50%)',
                        width: isActive ? 12 : 8, height: isActive ? 12 : 8,
                        borderRadius:'50%',
                        background: color,
                        boxShadow: `0 0 ${isActive ? 16 : 8}px ${color}`,
                        display:'block', transition:'all 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drag hint */}
            <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:'rgba(255,255,255,0.25)', letterSpacing:'0.08em' }}>
              {isDesktop ? '↔ Drag to rotate · Scroll to zoom' : '↔ Drag to rotate · Pinch to zoom'}
            </div>
          </div>

          {/* ── Side panel ─────────────────────────────────── */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:16, marginTop: isDesktop ? 0 : 32 }}>

            {/* Stats bar */}
            <div style={{
              background:'rgba(12,26,46,0.82)', backdropFilter:'blur(20px)',
              border:'1px solid rgba(56,189,248,0.2)', borderRadius:16, padding:'16px 20px',
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap',
            }}>
              <div>
                <div style={{ fontSize:22, fontWeight:900, color:'#fff', lineHeight:1 }}>1,847</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:2 }}>travelers exploring</div>
              </div>
              <div style={{ width:1, height:36, background:'rgba(56,189,248,0.2)' }} />
              <div>
                <div style={{ fontSize:22, fontWeight:900, color:'#38bdf8', lineHeight:1 }}>42</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:2 }}>new moments today</div>
              </div>
              <div style={{ width:1, height:36, background:'rgba(56,189,248,0.2)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 8px #4ade80', display:'inline-block' }} />
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600 }}>Live</span>
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding:'6px 16px', borderRadius:999, fontSize:12, fontWeight:700,
                    background: filter === f ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.05)',
                    border: filter === f ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    color: filter === f ? '#38bdf8' : 'rgba(255,255,255,0.5)',
                    cursor:'pointer', transition:'all 0.2s ease',
                    boxShadow: filter === f ? '0 0 12px rgba(56,189,248,0.2)' : 'none',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Selected traveler card (slide in on pin click) */}
            {selectedLoc && panelVisible && (
              <div className="slide-in" style={{
                background:'rgba(8,18,32,0.85)', backdropFilter:'blur(20px)',
                border:`1px solid ${selectedLoc.color}44`, borderRadius:18,
                padding:20, boxShadow:`0 0 40px ${selectedLoc.color}22, 0 12px 48px rgba(0,0,0,0.7)`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                  <img src={selectedLoc.avatar} alt={selectedLoc.traveler} style={{ width:56, height:56, borderRadius:'50%', border:`2px solid ${selectedLoc.color}`, boxShadow:`0 0 16px ${selectedLoc.color}66`, objectFit:'cover', flexShrink:0 }} />
                  <div>
                    <div style={{ color:'#fff', fontWeight:800, fontSize:16 }}>{selectedLoc.traveler}</div>
                    <div style={{ color:selectedLoc.color, fontSize:12, fontWeight:600, marginTop:2 }}>{selectedLoc.name}</div>
                    <div style={{ color:'rgba(255,255,255,0.45)', fontSize:12, marginTop:4 }}>{selectedLoc.clip}</div>
                  </div>
                </div>
                <button
                  style={{
                    width:'100%', padding:'10px', borderRadius:10, fontSize:13, fontWeight:700,
                    background:'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(56,189,248,0.08))',
                    border:'1px solid rgba(56,189,248,0.35)', color:'#38bdf8',
                    cursor:'pointer', transition:'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(56,189,248,0.08))'}
                >
                  → Follow their journey
                </button>
              </div>
            )}

            {/* Location list */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {LOCATIONS.map((loc, i) => (
                <div
                  key={loc.id}
                  onClick={() => handlePinClick(i)}
                  style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                    borderRadius:12, cursor:'pointer', transition:'all 0.25s ease',
                    background: activeIdx === i ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.05)',
                    border: activeIdx === i ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: activeIdx === i ? '0 0 20px rgba(56,189,248,0.12)' : 'none',
                  }}
                >
                  <img src={loc.avatar} alt={loc.traveler} style={{ width:36, height:36, borderRadius:'50%', border:`1.5px solid ${loc.color}77`, objectFit:'cover', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{loc.traveler}</div>
                    <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:1 }}>{loc.name}</div>
                  </div>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:loc.color, boxShadow:`0 0 8px ${loc.color}`, flexShrink:0 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}