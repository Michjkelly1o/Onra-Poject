// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Particle Orb (Phase 5.5)
// ─────────────────────────────────────────────────────────────────────────────
//
// A sphere formed by ~2200 particles, rendered with three.js. Auto-rotates
// slowly; gsap handles a smooth scale-in entrance plus a gentle continuous
// "breathing" (scale 1 → 1.05 → 1 on sine ease, yoyo loop). Coloured with
// the Onra brand greens — light at the top, deep at the bottom.
//
// Ported from ONRA AI-Agent/components/ParticleOrb.tsx with two changes:
//   • Default size dropped from 132 → 72 to match the Figma empty-state
//     spec (405:455839 shows the orb at 72×72 above the heading).
//   • Container margin removed (component now inherits gap from parent).
//
// three.js is ~600KB uncompressed but only loads on /ai-agent (route-
// split by Next.js), and only inside the empty-state which shows for a
// few seconds until the first user message. Acceptable cost for the
// signature visual.

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

export function ParticleOrb({ size = 72 }: { size?: number }) {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.z = 3.4;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(dpr);
        renderer.setSize(size, size);
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        // ── Particle sphere (Fibonacci distribution → even coverage) ────────
        const N = 2200;
        const positions = new Float32Array(N * 3);
        const colors = new Float32Array(N * 3);
        const cTop = new THREE.Color("#9ed4b6"); // light green highlight
        const cMid = new THREE.Color("#658774"); // brand green
        const cBot = new THREE.Color("#42604f"); // deep green shadow
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < N; i++) {
            const y = 1 - (i / (N - 1)) * 2; // 1 → -1
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = i * golden;
            positions[i * 3] = Math.cos(theta) * r;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = Math.sin(theta) * r;
            const t = (y + 1) / 2; // 0 bottom → 1 top
            const col =
                t > 0.5
                    ? cMid.clone().lerp(cTop, (t - 0.5) * 2)
                    : cBot.clone().lerp(cMid, t * 2);
            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        // Soft round sprite so particles read as dots, not squares.
        const tex = makeDotTexture();
        const material = new THREE.PointsMaterial({
            size: 0.055,
            map: tex,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.NormalBlending,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, material);
        const group = new THREE.Group();
        group.add(points);
        group.rotation.x = 0.32; // slight tilt so rotation reads as 3D
        scene.add(group);

        // Entrance + gentle breathing via gsap; steady slow spin via RAF.
        group.scale.setScalar(0);
        material.opacity = 0;
        const tl = gsap.timeline();
        tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 1.3, ease: "power3.out" }, 0)
            .to(material, { opacity: 0.95, duration: 1.1, ease: "power2.out" }, 0)
            .to(
                group.scale,
                {
                    x: 1.05,
                    y: 1.05,
                    z: 1.05,
                    duration: 3.4,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                },
                1.3,
            );

        let raf = 0;
        const animate = () => {
            group.rotation.y += 0.0016; // smooth, slow auto-rotation
            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(raf);
            tl.kill();
            gsap.killTweensOf([group.scale, material]);
            geo.dispose();
            material.dispose();
            tex.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === mount) {
                mount.removeChild(renderer.domElement);
            }
        };
    }, [size]);

    return (
        <div
            ref={mountRef}
            style={{ width: size, height: size }}
            aria-hidden
        />
    );
}

/** Radial-gradient sprite → soft, round particles. */
function makeDotTexture(): THREE.Texture {
    const s = 64;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
}
