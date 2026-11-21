import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface OpeningCinematicProps {
  onComplete: () => void;
  onSkip: () => void;
}

type Beat = { at: number; title: string; line: string; speaker: 'COWILA' | 'TOMAS' | 'SISTEMA' };

const BEATS: Beat[] = [
  { at: 0, title: 'UMA NOVA FRONTEIRA', line: 'Setor desconhecido. Iniciando aproximação planetária.', speaker: 'COWILA' },
  { at: 7, title: 'ENTRADA ATMOSFÉRICA', line: 'Atmosfera mais densa que o previsto. Ajustando trajetória.', speaker: 'COWILA' },
  { at: 15, title: 'POUSO DE EMERGÊNCIA', line: 'Propulsor auxiliar comprometido. Pouso controlado em andamento.', speaker: 'COWILA' },
  { at: 23, title: 'SINAIS DE VIDA', line: 'Tomas, há um organismo próximo. Leitura biométrica incompleta.', speaker: 'COWILA' },
  { at: 30, title: 'PRIMEIRO CONTATO', line: 'Não se aproxime rápido. Ele está defendendo este lugar.', speaker: 'COWILA' },
  { at: 37, title: 'UMA ESCOLHA', line: 'Vamos descobrir como viver neste mundo. Um passo de cada vez.', speaker: 'TOMAS' },
];

function makeShip(): THREE.Group {
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.62, 2.1, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0xb9c7d8, metalness: 0.78, roughness: 0.28 })
  );
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(1, 0.62, 0.8);
  ship.add(hull);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 18, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x58d9ff, emissive: 0x087ba8, emissiveIntensity: 0.8, metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.82 })
  );
  cockpit.position.set(1.35, 0.05, 0);
  cockpit.scale.set(0.8, 0.56, 0.72);
  ship.add(cockpit);

  const wingMat = new THREE.MeshStandardMaterial({ color: 0x53677f, metalness: 0.7, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.62), wingMat);
    wing.position.set(-0.25, 0, side * 0.72);
    wing.rotation.y = side * -0.16;
    ship.add(wing);
    const engine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x34485c, metalness: 0.6, roughness: 0.3 })
    );
    engine.rotation.z = Math.PI / 2;
    engine.position.set(-1.2, -0.04, side * 0.48);
    ship.add(engine);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 1.25, 12),
      new THREE.MeshBasicMaterial({ color: 0x49d9ff, transparent: true, opacity: 0.82 })
    );
    flame.rotation.z = -Math.PI / 2;
    flame.position.set(-1.95, -0.04, side * 0.48);
    flame.name = 'engine-flame';
    ship.add(flame);
  }
  return ship;
}

function makeAndroid(): THREE.Group {
  const root = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xc7d4df, metalness: 0.82, roughness: 0.26 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24364b, metalness: 0.7, roughness: 0.35 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x42d9ff, emissive: 0x087fa8, emissiveIntensity: 1.5 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 5, 10), shell);
  torso.position.y = 1.15;
  root.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), dark);
  head.position.y = 1.92;
  root.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.42), glow);
  visor.position.set(0, 1.95, 0.22);
  root.add(visor);
  for (const x of [-0.19, 0.19]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.56, 4, 8), dark);
    leg.position.set(x, 0.42, 0);
    root.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.58, 4, 8), shell);
    arm.position.set(x * 2.4, 1.25, 0);
    arm.rotation.z = x < 0 ? -0.12 : 0.12;
    root.add(arm);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), glow);
  core.position.set(0, 1.2, 0.31);
  root.add(core);
  return root;
}

function makeNativeCat(): THREE.Group {
  const root = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x9caa93, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33443b, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), fur);
  body.scale.set(1.15, 0.72, 0.7);
  body.position.y = 0.58;
  root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), fur);
  head.position.set(0.48, 0.96, 0.02);
  root.add(head);
  for (const x of [0.27, 0.65]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 5), fur);
    ear.position.set(x, 1.27, 0);
    root.add(ear);
  }
  for (const x of [0.38, 0.58]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
    eye.position.set(x, 1.0, 0.31);
    root.add(eye);
  }
  for (const x of [-0.32, 0.3]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 3, 7), fur);
    leg.position.set(x, 0.22, 0);
    root.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.075, 8, 18, Math.PI), fur);
  tail.position.set(-0.68, 0.8, 0);
  tail.rotation.z = Math.PI / 2;
  root.add(tail);
  return root;
}

export function OpeningCinematic({ onComplete, onSkip }: OpeningCinematicProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const duration = 44;
  const beat = [...BEATS].reverse().find((entry) => elapsed >= entry.at) ?? BEATS[0];

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;
    let frame = 0;
    let last = 0;
    let clock = 0;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030812);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    camera.position.set(0, 5, 24);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x8ba6c8, 1.1));
    const key = new THREE.DirectionalLight(0xd7e9ff, 2.4);
    key.position.set(-8, 12, 10);
    scene.add(key);

    const starPositions = new Float32Array(1800 * 3);
    for (let i = 0; i < starPositions.length; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 180;
      starPositions[i + 1] = (Math.random() - 0.5) * 100;
      starPositions[i + 2] = -20 - Math.random() * 150;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xd6e8ff, size: 0.12, sizeAttenuation: true }));
    scene.add(stars);

    const spaceGroup = new THREE.Group();
    scene.add(spaceGroup);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(7.4, 64, 48),
      new THREE.MeshStandardMaterial({ color: 0x536b59, roughness: 0.95, metalness: 0.02 })
    );
    planet.position.set(0, -1.4, -15);
    spaceGroup.add(planet);
    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(7.43, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0x233e50, roughness: 0.88, transparent: true, opacity: 0.48 })
    );
    ocean.position.copy(planet.position);
    spaceGroup.add(ocean);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(7.8, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x69d8ff, transparent: true, opacity: 0.12, side: THREE.BackSide })
    );
    atmosphere.position.copy(planet.position);
    spaceGroup.add(atmosphere);

    const ship = makeShip();
    ship.position.set(-1, 4.5, 4);
    spaceGroup.add(ship);

    const surfaceGroup = new THREE.Group();
    surfaceGroup.visible = false;
    scene.add(surfaceGroup);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4b5549, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    surfaceGroup.add(ground);
    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(100, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x758b87, side: THREE.BackSide })
    );
    horizon.position.y = -1;
    surfaceGroup.add(horizon);

    for (let i = 0; i < 70; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.65, 0),
        new THREE.MeshStandardMaterial({ color: i % 3 ? 0x5c6659 : 0x7a7663, roughness: 1 })
      );
      rock.position.set((Math.random() - 0.5) * 48, -0.12, -8 - Math.random() * 42);
      rock.scale.y = 0.35 + Math.random() * 0.5;
      surfaceGroup.add(rock);
    }
    const landedShip = makeShip();
    landedShip.position.set(-2.6, 0, -7);
    landedShip.rotation.z = -0.06;
    landedShip.scale.setScalar(1.45);
    surfaceGroup.add(landedShip);

    const android = makeAndroid();
    android.position.set(-1.1, 0, 0.5);
    android.scale.setScalar(0.9);
    surfaceGroup.add(android);
    const cat = makeNativeCat();
    cat.position.set(2.1, 0, -2.1);
    cat.scale.setScalar(1.15);
    surfaceGroup.add(cat);

    const scanRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x53dcff, transparent: true, opacity: 0.85 })
    );
    scanRing.rotation.x = Math.PI / 2;
    scanRing.position.set(2.1, 0.08, -2.1);
    surfaceGroup.add(scanRing);

    const dust = new THREE.Group();
    surfaceGroup.add(dust);
    for (let i = 0; i < 24; i++) {
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 + Math.random() * 0.18, 7, 6),
        new THREE.MeshBasicMaterial({ color: 0xc5c1a2, transparent: true, opacity: 0.32 })
      );
      mote.position.set((Math.random() - 0.5) * 8, Math.random() * 1.2, -6 - Math.random() * 4);
      dust.add(mote);
    }

    const resize = () => {
      if (!host || disposed) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const animate = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock += dt;
      const t = clock;
      const landing = t >= 15;
      spaceGroup.visible = !landing;
      surfaceGroup.visible = landing;

      if (!landing) {
        const approach = THREE.MathUtils.clamp(t / 15, 0, 1);
        ship.position.set(-1 + approach * 0.4, 4.5 - approach * 3.3, 4 - approach * 3.2);
        ship.rotation.z = Math.sin(t * 1.4) * 0.035 + approach * 0.08;
        ship.rotation.y = Math.sin(t * 0.42) * 0.12;
        planet.rotation.y = t * 0.018;
        ocean.rotation.y = t * 0.018;
        camera.position.set(Math.sin(t * 0.09) * 0.8, 5 - approach * 1.4, 24 - approach * 3.5);
        camera.lookAt(0, -0.8, -12);
        stars.rotation.y = t * 0.002;
      } else {
        const local = t - 15;
        camera.position.set(0.3 + Math.sin(local * 0.12) * 0.4, 4.1 - Math.min(local, 6) * 0.12, 12.5 - Math.min(local, 8) * 0.42);
        camera.lookAt(0.2, 1.05, -1.2);
        landedShip.position.y = local < 5 ? Math.sin(local * 5) * 0.07 * (1 - local / 5) : 0;
        landedShip.rotation.z = -0.06 + (local < 4 ? Math.sin(local * 8) * 0.025 : 0);
        dust.children.forEach((mote, i) => {
          mote.position.y = 0.3 + Math.abs(Math.sin(local * 1.2 + i)) * 1.2;
          mote.position.x += Math.sin(local + i) * dt * 0.09;
        });
        android.rotation.y = local > 9 ? Math.sin(local * 0.28) * 0.08 : 0;
        cat.rotation.y = local > 8 ? Math.sin(local * 0.8) * 0.1 : 0;
        cat.position.x = 2.1 + (local > 10 ? Math.sin(local * 0.55) * 0.1 : 0);
        const scan = THREE.MathUtils.clamp((local - 15) / 7, 0, 1);
        scanRing.scale.setScalar(0.75 + scan * 1.15 + Math.sin(t * 3) * 0.05);
        (scanRing.material as THREE.MeshBasicMaterial).opacity = 0.82 - scan * 0.3;
        if (local > 20) {
          android.scale.setScalar(0.9 + Math.sin((local - 20) * 0.8) * 0.012);
        }
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    setReady(true);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      });
      starGeometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((current) => Math.min(duration, current + 0.1));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  const finished = elapsed >= duration;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#030812] text-white" role="dialog" aria-modal="true" aria-label="Abertura da missão de Tomas">
      <div ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030812] via-transparent to-[#030812]/45" />
      <div className="absolute left-5 right-5 top-5 flex items-center justify-between sm:left-8 sm:right-8 sm:top-7">
        <div className="text-[10px] font-semibold tracking-[0.34em] text-cyan-200/75 sm:text-xs">TOMAS VAGABUNDO · REGISTRO DE MISSÃO</div>
        <button type="button" onClick={onSkip} className="pointer-events-auto rounded-full border border-white/20 bg-black/35 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur hover:bg-white/10">Pular abertura</button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 sm:px-10 sm:pb-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-cyan-300" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-cyan-200">{beat.speaker}</span>
            <span className="text-[10px] tracking-[0.2em] text-white/40">/ {String(Math.floor(elapsed)).padStart(2, '0')}:{String(Math.floor((elapsed % 1) * 100)).padStart(2, '0')}</span>
          </div>
          <div className="max-w-2xl rounded-2xl border border-white/10 bg-[#06111c]/75 p-5 shadow-2xl backdrop-blur-md sm:p-7">
            <div className="text-[10px] font-bold tracking-[0.28em] text-cyan-300/80">{beat.title}</div>
            <p className="mt-2 text-lg font-medium leading-relaxed text-white sm:text-2xl">{beat.line}</p>
            <div className="mt-5 flex items-center gap-4">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-cyan-300 transition-[width]" style={{ width: `${(elapsed / duration) * 100}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-white/50">{Math.floor((duration - elapsed) / 60)}:{String(Math.floor((duration - elapsed) % 60)).padStart(2, '0')}</span>
            </div>
            {finished && (
              <button type="button" onClick={onComplete} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
                Iniciar exploração <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <div className="mt-3 text-[10px] tracking-[0.18em] text-white/45">{ready ? 'SEQUÊNCIA CINEMATOGRÁFICA' : 'PREPARANDO CENA 3D'} · MUNDO VIRTUAL</div>
        </div>
      </div>
    </div>
  );
}
