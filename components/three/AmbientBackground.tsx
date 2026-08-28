"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { Color } from "three";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const colors = ["#2563eb", "#06b6d4", "#f97316", "#38bdf8"];

function FloatingOrbs() {
  const refs = useRef<(Mesh | null)[]>([]);
  const orbs = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const s = (n: number) => ((n * 9301 + 49297) % 233280) / 233280;
        return {
          color: colors[i % colors.length],
          position: [
            (s(i + 1) - 0.5) * 9.2,
            (s(i + 41) - 0.5) * 4.6,
            -0.4 - s(i + 81) * 3.2,
          ] as [number, number, number],
          scale: 0.16 + s(i + 121) * 0.34,
          speed: 0.7 + s(i + 161) * 0.9,
          amplitude: 0.35 + s(i + 201) * 0.5,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    orbs.forEach((orb, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const phase = t * orb.speed + i * 1.7;
      mesh.position.y = orb.position[1] + Math.sin(phase) * orb.amplitude;
      mesh.position.x = orb.position[0] + Math.cos(phase * 0.8) * orb.amplitude * 1.4;
      mesh.rotation.x = t * 0.8 + i;
      mesh.rotation.y = t * 1.1 + i;
    });
  });

  return (
    <>
      <ambientLight intensity={1.1} />
      <pointLight position={[3, 3, 3]} intensity={60} color="#7dd3fc" />
      <pointLight position={[-3, -2, 1]} intensity={40} color="#fdba74" />
      {orbs.map((orb, i) => (
        <mesh
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          position={orb.position}
          scale={orb.scale}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={new Color(orb.color)} emissive={new Color(orb.color)} emissiveIntensity={0.55} roughness={0.25} />
        </mesh>
      ))}
    </>
  );
}

export default function AmbientBackground() {
  const reduceMotion = usePrefersReducedMotion();

  if (reduceMotion) {
    return <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50 opacity-80">
      <Canvas camera={{ position: [0, 0, 4.5], fov: 55 }}>
        <FloatingOrbs />
      </Canvas>
    </div>
  );
}
