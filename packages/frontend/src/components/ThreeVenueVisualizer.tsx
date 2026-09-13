'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, RotateCw, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';

interface ThreeVenueVisualizerProps {
  onSelectTier?: (tier: string) => void;
  selectedTier?: string | null;
}

export function ThreeVenueVisualizer({ onSelectTier, selectedTier }: ThreeVenueVisualizerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [activeCameraView, setActiveCameraView] = useState<'isometric' | 'front' | 'overhead'>('isometric');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ─── Scene, Camera, Renderer ──────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a14);
    scene.fog = new THREE.FogExp2(0x0a0a14, 0.025);

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 450;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 22, 34);
    camera.lookAt(0, 0, -2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ─── Lighting ─────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x2d2d48, 1.2);
    scene.add(ambientLight);

    // Stage Spotlights (Volumetric glow simulation)
    const stageLight1 = new THREE.SpotLight(0x6366f1, 5, 45, Math.PI / 4, 0.5, 1);
    stageLight1.position.set(-8, 14, -10);
    stageLight1.target.position.set(0, 0, -8);
    scene.add(stageLight1);
    scene.add(stageLight1.target);

    const stageLight2 = new THREE.SpotLight(0xa855f7, 5, 45, Math.PI / 4, 0.5, 1);
    stageLight2.position.set(8, 14, -10);
    stageLight2.target.position.set(0, 0, -8);
    scene.add(stageLight2);
    scene.add(stageLight2.target);

    const arenaGlow = new THREE.PointLight(0x4f46e5, 2, 30);
    arenaGlow.position.set(0, 4, 0);
    scene.add(arenaGlow);

    // ─── Stage Construction ───────────────────────────────────────────
    const stageGeo = new THREE.BoxGeometry(16, 1.2, 7);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e38,
      roughness: 0.3,
      metalness: 0.7,
    });
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.set(0, 0.6, -9);
    scene.add(stageMesh);

    // Glowing Stage Front Edge
    const edgeGeo = new THREE.BoxGeometry(16.2, 0.15, 0.2);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.position.set(0, 1.25, -5.4);
    scene.add(edgeMesh);

    // Stage Screen Backdrop
    const backdropGeo = new THREE.PlaneGeometry(14, 5.5);
    const backdropMat = new THREE.MeshBasicMaterial({
      color: 0x2e1065,
      side: THREE.DoubleSide,
    });
    const backdropMesh = new THREE.Mesh(backdropGeo, backdropMat);
    backdropMesh.position.set(0, 4.2, -12.4);
    scene.add(backdropMesh);

    // ─── Curved Tiered Seating Bowl ───────────────────────────────────
    const tierGroups: { [key: string]: THREE.Group } = {
      VIP: new THREE.Group(),
      Premium: new THREE.Group(),
      Standard: new THREE.Group(),
    };

    scene.add(tierGroups.VIP);
    scene.add(tierGroups.Premium);
    scene.add(tierGroups.Standard);

    const tierConfigs = [
      { name: 'VIP', rows: 3, startR: 9, startAngle: -Math.PI * 0.42, endAngle: Math.PI * 0.42, color: 0xf59e0b, elevation: 0.8 },
      { name: 'Premium', rows: 4, startR: 15, startAngle: -Math.PI * 0.48, endAngle: Math.PI * 0.48, color: 0x8b5cf6, elevation: 2.2 },
      { name: 'Standard', rows: 5, startR: 22, startAngle: -Math.PI * 0.52, endAngle: Math.PI * 0.52, color: 0x3b82f6, elevation: 4.5 },
    ];

    tierConfigs.forEach((cfg) => {
      const group = tierGroups[cfg.name]!;
      for (let r = 0; r < cfg.rows; r++) {
        const radius = cfg.startR + r * 1.5;
        const count = Math.floor(radius * 2.2);
        const yPos = cfg.elevation + r * 0.5;

        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const angle = cfg.startAngle + t * (cfg.endAngle - cfg.startAngle);
          const x = Math.sin(angle) * radius;
          const z = Math.cos(angle) * radius - 4;

          const seatGeo = new THREE.BoxGeometry(0.55, 0.45, 0.55);
          const seatMat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            roughness: 0.4,
            metalness: 0.3,
            emissive: cfg.color,
            emissiveIntensity: 0.15,
          });

          const seat = new THREE.Mesh(seatGeo, seatMat);
          seat.position.set(x, yPos, z);
          seat.rotation.y = angle;
          seat.userData = { tier: cfg.name, row: r + 1, seatIndex: i + 1 };
          group.add(seat);
        }
      }
    });

    // ─── Floor Arena ──────────────────────────────────────────────────
    const floorGeo = new THREE.CylinderGeometry(32, 32, 0.2, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x070711,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.1;
    scene.add(floor);

    // ─── Interactive Orbiting & Mouse Drag ────────────────────────────
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let sphericalTheta = Math.PI / 2;
    let sphericalPhi = 0.55;
    let radiusDistance = 42;

    const updateCameraFromSpherical = () => {
      sphericalPhi = Math.max(0.15, Math.min(Math.PI / 2.1, sphericalPhi));
      camera.position.x = radiusDistance * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      camera.position.y = radiusDistance * Math.cos(sphericalPhi);
      camera.position.z = radiusDistance * Math.sin(sphericalPhi) * Math.cos(sphericalTheta) - 2;
      camera.lookAt(0, 1.5, -4);
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        // Raycasting for section hover
        const rect = mount.getBoundingClientRect();
        const mouseNormX = ((e.clientX - rect.left) / width) * 2 - 1;
        const mouseNormY = -((e.clientY - rect.top) / height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseNormX, mouseNormY), camera);

        const allSeats: THREE.Mesh[] = [];
        Object.values(tierGroups).forEach(g => g.children.forEach(c => allSeats.push(c as THREE.Mesh)));
        const intersects = raycaster.intersectObjects(allSeats);

        if (intersects.length > 0 && intersects[0]?.object.userData?.tier) {
          const tier = intersects[0].object.userData.tier;
          setHoveredSection(tier);
          mount.style.cursor = 'pointer';
        } else {
          setHoveredSection(null);
          mount.style.cursor = 'grab';
        }
        return;
      }

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      sphericalTheta -= deltaX * 0.007;
      sphericalPhi -= deltaY * 0.007;
      updateCameraFromSpherical();

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radiusDistance = Math.max(18, Math.min(65, radiusDistance + e.deltaY * 0.04));
      updateCameraFromSpherical();
    };

    const onClick = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const mouseNormX = ((e.clientX - rect.left) / width) * 2 - 1;
      const mouseNormY = -((e.clientY - rect.top) / height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseNormX, mouseNormY), camera);

      const allSeats: THREE.Mesh[] = [];
      Object.values(tierGroups).forEach(g => g.children.forEach(c => allSeats.push(c as THREE.Mesh)));
      const intersects = raycaster.intersectObjects(allSeats);

      if (intersects.length > 0 && intersects[0]?.object.userData?.tier) {
        const tier = intersects[0].object.userData.tier;
        onSelectTier?.(tier);
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('click', onClick);

    // ─── Animation Loop ───────────────────────────────────────────────
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Subtle atmospheric pulsing
      stageLight1.intensity = 4.5 + Math.sin(elapsedTime * 2.5) * 1.5;
      stageLight2.intensity = 4.5 + Math.cos(elapsedTime * 2.8) * 1.5;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    // ─── Resize Handler ───────────────────────────────────────────────
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [onSelectTier]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden glass-panel border border-indigo-500/20 shadow-2xl">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-[420px] cursor-grab active:cursor-grabbing" />

      {/* Floating HUD Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/60 text-indigo-300 backdrop-blur-md border border-indigo-500/30">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          Interactive 3D Arena
        </span>
        {hoveredSection && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600/80 text-white backdrop-blur-md shadow-lg transition-all">
            Section: {hoveredSection} Tier
          </span>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-xs text-zinc-300">
        <span className="px-2 py-0.5 text-zinc-400">Drag to Orbit • Scroll to Zoom</span>
      </div>

      {/* Tier Selection Quick Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/75 backdrop-blur-lg px-4 py-2 rounded-2xl border border-white/15 shadow-2xl">
        <span className="text-xs text-zinc-400 mr-1">Tiers:</span>
        <button
          onClick={() => onSelectTier?.('VIP')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            selectedTier === 'VIP'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
              : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          VIP Tier
        </button>

        <button
          onClick={() => onSelectTier?.('Premium')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            selectedTier === 'Premium'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          Premium Tier
        </button>

        <button
          onClick={() => onSelectTier?.('Standard')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
            selectedTier === 'Standard'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Standard Tier
        </button>
      </div>
    </div>
  );
}
