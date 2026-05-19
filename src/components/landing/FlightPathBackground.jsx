import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Animated 3D background for the "Why Roamerz Wins" section.
 * - Glowing flight-path arcs between city dots (low opacity)
 * - Slow drifting nebula particles (cyan + gold)
 * - Soft directional light from top-left
 * Absolutely positioned to fill parent, z-index 0, pointer-events none.
 */
export default function FlightPathBackground({ visible }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 4, 18);
    camera.lookAt(0, 0, 0);

    // ── Directional glow (top-left) ──────────────────────────────────────────
    const dir = new THREE.DirectionalLight(0x22d3ee, 0.5);
    dir.position.set(-12, 12, 8);
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0x071520, 1.0));

    // ── City node positions (scattered on a gentle plane) ────────────────────
    const cityPositions = [
      [-8,  0.5,  1], [ 0,  1.5, -2], [ 8,  0.2,  0],
      [-5, -1.0, -3], [ 4, -0.5,  3], [ 1,  0.8,  4],
      [-2,  1.2, -1], [ 6,  1.0, -1],
    ];

    // City dot meshes
    const cityMeshes = cityPositions.map(([x, y, z]) => {
      const geo  = new THREE.SphereGeometry(0.12, 12, 12);
      const mat  = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    });

    // Halo rings around city dots
    cityPositions.forEach(([x, y, z]) => {
      const geo = new THREE.RingGeometry(0.2, 0.28, 24);
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.set(x, y + 0.01, z);
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
    });

    // ── Flight arcs ──────────────────────────────────────────────────────────
    // Pairs of city indices to connect
    const pairs = [[0,1],[1,2],[0,4],[2,5],[3,6],[1,7],[4,7],[0,3],[5,6],[2,7]];

    const arcLines = pairs.map(([a, b]) => {
      const pA = new THREE.Vector3(...cityPositions[a]);
      const pB = new THREE.Vector3(...cityPositions[b]);
      const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      mid.y += 3.5 + Math.random() * 2; // arc height

      const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);
      const pts   = curve.getPoints(60);
      const geo   = new THREE.BufferGeometry().setFromPoints(pts);
      const mat   = new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.0, // animated in
      });
      const line = new THREE.Line(geo, mat);
      scene.add(line);

      return { line, mat, totalPts: pts.length, drawn: 0, speed: 0.4 + Math.random() * 0.5, delay: Math.random() * 3 };
    });

    // ── Nebula particles ─────────────────────────────────────────────────────
    const makeParticles = (count, color, spread, opacity) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i*3]   = (Math.random() - 0.5) * spread;
        pos[i*3+1] = (Math.random() - 0.5) * spread * 0.4;
        pos[i*3+2] = (Math.random() - 0.5) * spread * 0.6;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color, size: 0.08, transparent: true, opacity, sizeAttenuation: true });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return { pts, geo, phases: Array.from({ length: count }, () => Math.random() * Math.PI * 2) };
    };

    const cyanPts = makeParticles(220, 0x22d3ee, 30, 0.30);
    const goldPts = makeParticles(100, 0xfbbf24, 28, 0.18);

    // ── Resize ───────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Animation ────────────────────────────────────────────────────────────
    let frameId;
    let start = null;

    const animate = (ts) => {
      frameId = requestAnimationFrame(animate);
      if (!start) start = ts;
      const t = (ts - start) * 0.001;

      // Drift nebula particles
      const cpos = cyanPts.geo.attributes.position.array;
      for (let i = 0; i < cyanPts.phases.length; i++) {
        cpos[i*3+1] += Math.sin(t * 0.3 + cyanPts.phases[i]) * 0.003;
        cpos[i*3]   += Math.cos(t * 0.2 + cyanPts.phases[i]) * 0.002;
      }
      cyanPts.geo.attributes.position.needsUpdate = true;

      const gpos = goldPts.geo.attributes.position.array;
      for (let i = 0; i < goldPts.phases.length; i++) {
        gpos[i*3+1] += Math.sin(t * 0.25 + goldPts.phases[i]) * 0.002;
      }
      goldPts.geo.attributes.position.needsUpdate = true;

      // City dot pulse
      cityMeshes.forEach((mesh, i) => {
        const s = 1 + Math.sin(t * 1.5 + i * 0.8) * 0.15;
        mesh.scale.setScalar(s);
      });

      // Arc drawing animation
      arcLines.forEach((arc, i) => {
        const elapsed = t - arc.delay;
        if (elapsed < 0) { arc.mat.opacity = 0; return; }

        // fade in + draw
        arc.mat.opacity = Math.min(0.28, elapsed * 0.15);

        // Animate the arc by revealing points progressively using a morphing geometry slice
        const progress = Math.min(1, elapsed * arc.speed * 0.5);
        const show = Math.floor(progress * arc.totalPts);
        if (show < 2) return;

        const fullPts = arc.line.geometry.attributes.position.array;
        const sliced = new Float32Array(show * 3);
        for (let j = 0; j < show * 3; j++) sliced[j] = fullPts[j];
        arc.line.geometry.setAttribute('position', new THREE.BufferAttribute(sliced, 3));
        arc.line.geometry.setDrawRange(0, show);

        // Reset once fully drawn to loop
        if (progress >= 1 && elapsed > 6) {
          arc.delay = t + Math.random() * 2;
          arc.mat.opacity = 0;
          // restore full geometry
          const curve = (() => {
            const pA = new THREE.Vector3(...cityPositions[pairs[i][0]]);
            const pB = new THREE.Vector3(...cityPositions[pairs[i][1]]);
            const m = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
            m.y += 3.5;
            return new THREE.QuadraticBezierCurve3(pA, m, pB);
          })();
          const pts = curve.getPoints(60);
          arc.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
          arc.totalPts = pts.length;
        }
      });

      // Very slow camera drift
      camera.position.x = Math.sin(t * 0.04) * 1.5;
      camera.position.y = 4 + Math.cos(t * 0.03) * 0.6;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate(0);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1.2s ease 0.3s',
      }}
    />
  );
}