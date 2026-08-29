"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, Points } from "three";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

function seeded(seed: number) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function InteractivePoints() {
  const pointsRef = useRef<Points>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const { colors, positions } = useMemo(() => {
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new Color();

    for (let i = 0; i < count; i++) {
      const radius = 2.2 + seeded(i + 1) * 2.8;
      const branch = (i % 7) / 7 * Math.PI * 2;
      const spin = radius * 1.2;
      const randomX = (seeded(i + 11) - 0.5) * 0.55 * radius;
      const randomY = (seeded(i + 21) - 0.5) * 0.35 * radius;
      const randomZ = (seeded(i + 31) - 0.5) * 0.55 * radius;

      positions[i * 3] = Math.cos(branch + spin) * radius + randomX;
      positions[i * 3 + 1] = randomY;
      positions[i * 3 + 2] = Math.sin(branch + spin) * radius + randomZ;

      color.setHSL(0.56 + seeded(i + 41) * 0.14, 0.9, 0.48 + seeded(i + 51) * 0.22);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { colors, positions };
  }, []);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = clock.elapsedTime;
    points.rotation.y = t * 0.08 + mouseRef.current.x * 0.35;
    points.rotation.x = -0.45 + mouseRef.current.y * 0.18;
    const pulse = 1 + Math.sin(t * 1.8) * 0.025;
    points.scale.setScalar(pulse);
  });

  return (
    <points ref={pointsRef} position={[0, 0, -1.7]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.035}
        sizeAttenuation
        depthWrite={false}
        blending={AdditiveBlending}
        transparent
        opacity={0.9}
      />
    </points>
  );
}

export default function InteractivePointsBackground() {
  const reduceMotion = usePrefersReducedMotion();

  if (reduceMotion) {
    return <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950" />;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_55%)]" />
      <Canvas camera={{ position: [0, 0, 7], fov: 58 }}>
        <InteractivePoints />
      </Canvas>
    </div>
  );
}
