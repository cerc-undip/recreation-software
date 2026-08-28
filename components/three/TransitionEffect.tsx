"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { DoubleSide } from "three";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const DURATION = 1.2;

function Burst() {
  const groupRef = useRef<Group>(null);
  const ringMaterials = useRef<(MeshBasicMaterial | null)[]>([]);
  const shardMaterials = useRef<(MeshBasicMaterial | null)[]>([]);

  const shardRefs = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = Math.min(t / DURATION, 1);
    const group = groupRef.current;
    if (!group) return;
    group.rotation.z = t * 0.6;
    const ease = 1 - Math.pow(1 - k, 3);
    group.scale.setScalar(0.2 + ease * 5.4);
    ringMaterials.current.forEach((material) => {
      if (!material) return;
      material.opacity = 1 - k;
    });
    shardRefs.current.forEach((shard, i) => {
      if (!shard) return;
      shard.position.y = Math.sin(t * 2 + i * 2.1) * 0.4;
      shard.rotation.x = t * 3 + i;
      shard.rotation.y = t * 2.4 + i;
      const material = shardMaterials.current[i];
      if (material) material.opacity = 1 - k;
    });
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <ringGeometry args={[0.45, 0.55, 48]} />
        <meshBasicMaterial ref={(m) => { ringMaterials.current[0] = m; }} color="#7dd3fc" transparent side={DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.6, 0.68, 48]} />
        <meshBasicMaterial ref={(m) => { ringMaterials.current[1] = m; }} color="#fdba74" transparent side={DoubleSide} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => { shardRefs.current[i] = node; }}
          position={[(i - 7) * 0.5, (i % 2 === 0 ? 1 : -1) * 0.4, 0]}
        >
          <boxGeometry args={[0.09, 0.09, 0.09]} />
          <meshBasicMaterial ref={(m) => { shardMaterials.current[i] = m; }} color={i % 2 === 0 ? "#38bdf8" : "#fb923c"} transparent />
        </mesh>
      ))}
    </group>
  );
}

export default function TransitionEffect({ show }: { show: boolean }) {
  const reduceMotion = usePrefersReducedMotion();

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-600">
      {!reduceMotion && (
        <div className="absolute inset-0">
          <Canvas camera={{ position: [0, 0, 3], fov: 60 }} gl={{ alpha: true }}>
            <Burst />
          </Canvas>
        </div>
      )}
      <h1 className="relative text-6xl font-black text-white drop-shadow-lg">Next Problem!</h1>
    </div>
  );
}
