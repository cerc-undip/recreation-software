"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

function seeded(index: number) {
  return ((index * 9301 + 49297) % 233280) / 233280;
}

function ConfettiPiece({ index }: { index: number }) {
  const ref = useRef<Mesh>(null);
  const velocityRef = useRef<[number, number, number]>([
    (seeded(index) - 0.5) * 8,
    seeded(index + 31) * 6 + 4,
    (seeded(index + 71) - 0.5) * 8,
  ]);
  const rotationSpeed = (seeded(index + 101) - 0.5) * 4;

  useFrame((_, delta) => {
    if (!ref.current) return;
    const velocity = velocityRef.current;
    ref.current.position.x += velocity[0] * delta;
    ref.current.position.y += velocity[1] * delta;
    ref.current.position.z += velocity[2] * delta;
    velocity[1] -= 9.8 * delta;

    if (ref.current.position.y < -5) {
      ref.current.position.set(0, 2, 0);
      velocity[0] = (seeded(index) - 0.5) * 8;
      velocity[1] = seeded(index + 31) * 6 + 4;
      velocity[2] = (seeded(index + 71) - 0.5) * 8;
    }

    ref.current.rotation.x += rotationSpeed * delta;
    ref.current.rotation.y += rotationSpeed * delta;
  });

  return (
    <mesh ref={ref} position={[0, 2, 0]}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color={`hsl(${Math.floor(seeded(index + 17) * 360)}, 100%, 60%)`} />
    </mesh>
  );
}

export default function ConfettiEffect() {
  const reduceMotion = usePrefersReducedMotion();

  if (reduceMotion) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <Canvas camera={{ position: [0, 0, 6] }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} />
        {Array.from({ length: 120 }, (_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      </Canvas>
    </div>
  );
}
