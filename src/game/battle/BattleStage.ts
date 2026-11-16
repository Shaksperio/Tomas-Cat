import * as THREE from 'three';
import { type BattleAction, FOE_SIDES, type FoeSide, type Side } from './atb';

/**
 * Cena cinematográfica da batalha (estilo RPG clássico): cortes de câmera,
 * investidas, riscos de garra, faíscas, números de dano, Limit Break.
 * Só apresentação — as regras e resultados vêm de `atb.ts`.
 */

interface Fighter {
  root: THREE.Object3D;
  home: THREE.Vector3;
  start: THREE.Vector3;
  offset: THREE.Vector3;
  tween: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number } | null;
  jumpT: number;
  jumpDur: number;
  jumpHeight: number;
  shiver: number;
  tilt: number;
  tiltTarget: number;
  squash: number;
  yaw: number;
}

interface Effect {
  obj: THREE.Object3D;
  age: number;
  life: number;
  step: (e: Effect, dt: number) => void;
  dispose: () => void;
}

interface TimedEvent {
  at: number;
  fn: () => void;
}

const _v = new THREE.Vector3();
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeStreakTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 16);
  g.quadraticCurveTo(128, 0, 256, 16);
  g.quadraticCurveTo(128, 32, 0, 16);
  g.fill();
  return new THREE.CanvasTexture(c);
}

export class BattleStage {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly group = new THREE.Group();
  private readonly glowTex = makeGlowTexture();
  private readonly streakTex = makeStreakTexture();
  private readonly flashLight = new THREE.PointLight(0xffffff, 0, 16, 1.6);
  private effects: Effect[] = [];
  private events: TimedEvent[] = [];
  private clock = 0;
  private hitStop = 0;
  private fighters!: Record<Side, Fighter>;
  /** Lados presentes nesta batalha (jogador + 1 a 4 oponentes). */
  private activeSides: Side[] = ['player', 'opponent'];
  /** Oponentes já derrubados (ficam deitados até o fim). */
  private fallen = new Set<Side>();
  private active = false;
  private actionBusy = false;
  private actionDone: (() => void) | null = null;
  private introT = 0;
  private readonly introDur = 1.5;
  private shake = 0;
  private readonly origFov: number;
  private fovTarget: number;
  private readonly center = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private readonly perp = new THREE.Vector3(1, 0, 0);
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private readonly camPosTarget = new THREE.Vector3();
  private readonly camLookTarget = new THREE.Vector3();
  private camK = 6;
  /** Afasta a câmera conforme o tamanho do grupo. */
  private spread = 1;
  private orbit: { around: Side | 'center'; radius: number; height: number; speed: number; phase: number } | null = null;
  private guardDomes: Record<Side, THREE.Mesh> | null = null;
  private onPlayerClaw: () => void = () => undefined;
  private onPlayerCheer: () => void = () => undefined;

  /** Vigor mostrado na HUD (cai no instante do impacto, não antes). */
  public readonly displayVigor: Record<Side, number> = {
    player: 100,
    opponent: 100,
    opponent2: 100,
    opponent3: 100,
    opponent4: 100,
  };
  public banner: { text: string; id: number } | null = null;
  public darkness = 0;
  public whiteFlash = 0;
  private bannerCounter = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.origFov = camera.fov;
    this.fovTarget = camera.fov;
    this.scene.add(this.group);
    this.group.add(this.flashLight);
  }

  public get isActive(): boolean {
    return this.active;
  }

  /** Verdadeiro durante a introdução, uma ação ou o final: o jogo espera. */
  public get busy(): boolean {
    return this.introT < this.introDur || this.actionBusy;
  }

  public get introActive(): boolean {
    return this.introT < this.introDur;
  }

  public begin(opts: {
    playerRoot: THREE.Object3D;
    playerPos: THREE.Vector3;
    /** Um ou mais oponentes (em ordem de FOE_SIDES). */
    foes: Array<{ root: THREE.Object3D; pos: THREE.Vector3 }>;
    cameraSide: 1 | -1;
    onPlayerClaw: () => void;
    onPlayerCheer: () => void;
  }): void {
    this.end();
    this.active = true;
    this.onPlayerClaw = opts.onPlayerClaw;
    this.onPlayerCheer = opts.onPlayerCheer;
    this.clock = 0;
    this.introT = 0;
    this.events = [];
    for (const k of Object.keys(this.displayVigor) as Side[]) this.displayVigor[k] = 100;
    this.fallen.clear();
    this.darkness = 0;
    this.whiteFlash = 1;
    this.shake = 0;

    const foes = opts.foes.slice(0, FOE_SIDES.length);
    const n = foes.length;
    this.activeSides = ['player', ...FOE_SIDES.slice(0, n)];
    const fcx = foes.reduce((sum, f) => sum + f.pos.x, 0) / n;
    const fcz = foes.reduce((sum, f) => sum + f.pos.z, 0) / n;
    this.axis.set(fcx - opts.playerPos.x, 0, fcz - opts.playerPos.z);
    if (this.axis.lengthSq() < 1e-4) this.axis.set(0, 0, 1);
    this.axis.normalize();
    this.perp.set(-this.axis.z, 0, this.axis.x).multiplyScalar(opts.cameraSide);
    this.center.set((fcx + opts.playerPos.x) / 2, 0, (fcz + opts.playerPos.z) / 2);
    this.spread = 1 + 0.17 * (n - 1);
    const half = 2.7;
    const mk = (
      root: THREE.Object3D,
      from: THREE.Vector3,
      dir: number,
      yaw: number,
      lateral = 0,
      depth = 0,
    ): Fighter => ({
      root,
      home: new THREE.Vector3()
        .copy(this.center)
        .addScaledVector(this.axis, half * dir + depth)
        .addScaledVector(this.perp, lateral),
      start: from.clone(),
      offset: new THREE.Vector3(),
      tween: null,
      jumpT: 0,
      jumpDur: 0,
      jumpHeight: 0,
      shiver: 0,
      tilt: 0,
      tiltTarget: 0,
      squash: 0,
      yaw,
    });
    const faceBack = Math.atan2(-this.axis.x, -this.axis.z);
    // Apenas os lados ativos são instanciados; os oponentes são preenchidos logo abaixo.
    this.fighters = {
      player: mk(opts.playerRoot, opts.playerPos, -1, Math.atan2(this.axis.x, this.axis.z)),
    } as unknown as Record<Side, Fighter>;
    foes.forEach((foe, i) => {
      const lateral = (i - (n - 1) / 2) * 2.3;
      const depth = Math.abs(i - (n - 1) / 2) * 0.5; // arco: os das pontas ficam um pouco mais atrás
      this.fighters[FOE_SIDES[i]] = mk(foe.root, foe.pos, 1, faceBack, lateral, depth);
    });
    this.fighters.player.home.y = opts.playerPos.y;

    // Domos de defesa.
    const domeGeo = new THREE.SphereGeometry(1.15, 20, 14);
    const mkDome = (color: number) => {
      const m = new THREE.Mesh(
        domeGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      this.group.add(m);
      return m;
    };
    // Só os lados ativos recebem domos; os demais não existem nesta batalha.
    this.guardDomes = { player: mkDome(0x67e8f9) } as unknown as Record<Side, THREE.Mesh>;
    for (const side of this.activeSides) {
      if (side !== 'player') this.guardDomes[side] = mkDome(0xfbbf24);
    }

    this.camPos.copy(this.camera.position);
    this.camLook.copy(this.center).setY(1);
    this.setBanner('Batalha!');
  }

  public end(): void {
    if (!this.active && !this.fighters) return;
    this.active = false;
    this.actionBusy = false;
    this.actionDone = null;
    this.events = [];
    for (const fx of this.effects) {
      this.group.remove(fx.obj);
      fx.dispose();
    }
    this.effects = [];
    if (this.guardDomes) {
      for (const d of Object.values(this.guardDomes)) {
        this.group.remove(d);
        (d.material as THREE.Material).dispose();
      }
      this.guardDomes = null;
    }
    if (this.fighters) {
      for (const f of Object.values(this.fighters)) {
        f.root.rotation.z = 0;
        f.root.rotation.x = 0;
      }
    }
    this.flashLight.intensity = 0;
    this.darkness = 0;
    this.whiteFlash = 0;
    this.banner = null;
    this.camera.fov = this.origFov;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.end();
    this.scene.remove(this.group);
    this.glowTex.dispose();
    this.streakTex.dispose();
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  private setBanner(text: string): void {
    this.bannerCounter += 1;
    this.banner = { text, id: this.bannerCounter };
  }

  private after(delay: number, fn: () => void): void {
    this.events.push({ at: this.clock + delay, fn });
  }

  private worldPos(side: Side, height = 0.9): THREE.Vector3 {
    const f = this.fighters[side];
    return new THREE.Vector3(
      f.home.x + f.offset.x,
      f.home.y + f.offset.y + height,
      f.home.z + f.offset.z,
    );
  }

  private moveTo(side: Side, offset: THREE.Vector3, dur: number): void {
    const f = this.fighters[side];
    f.tween = { from: f.offset.clone(), to: offset.clone(), t: 0, dur: Math.max(0.01, dur) };
  }

  private jump(side: Side, height: number, dur: number): void {
    const f = this.fighters[side];
    f.jumpT = 0;
    f.jumpDur = dur;
    f.jumpHeight = height;
  }

  private shot(pos: THREE.Vector3, look: THREE.Vector3, k: number, fov = this.origFov): void {
    this.camPosTarget.copy(pos);
    this.camLookTarget.copy(look);
    this.camK = k;
    this.fovTarget = fov;
    this.orbit = null;
  }

  private wideShot(k = 4): void {
    const pos = new THREE.Vector3()
      .copy(this.center)
      .addScaledVector(this.perp, 7.4 * this.spread)
      .addScaledVector(this.axis, -0.8);
    pos.y = 2.5;
    this.shot(pos, new THREE.Vector3(this.center.x, 0.9, this.center.z), k, this.origFov - 8);
  }

  /** Direção horizontal (unitária) de quem age até o alvo. */
  private dirBetween(from: Side, to: Side): THREE.Vector3 {
    const a = this.fighters[from].home;
    const b = this.fighters[to].home;
    const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    if (d.lengthSq() < 1e-6) return this.axis.clone();
    return d.normalize();
  }

  private overShoulder(actor: Side, target: Side, k = 9): void {
    const f = this.fighters[actor];
    const dir = this.dirBetween(actor, target);
    const pos = new THREE.Vector3()
      .copy(f.home)
      .addScaledVector(dir, -3.4)
      .addScaledVector(this.perp, 1.5);
    pos.y = 2.3;
    const look = this.worldPos(target, 0.9);
    this.shot(pos, look, k, this.origFov - 6);
  }

  private impactShot(target: Side, k = 12): void {
    const t = this.worldPos(target, 1.0);
    const pos = new THREE.Vector3().copy(t).addScaledVector(this.perp, 5.0);
    pos.y = 1.8;
    this.shot(pos, t, k, this.origFov - 10);
  }

  private addEffect(fx: Effect): void {
    this.group.add(fx.obj);
    this.effects.push(fx);
  }

  private glowSprite(pos: THREE.Vector3, color: number, size: number, life: number): void {
    const mat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(0.1);
    this.addEffect({
      obj: s,
      age: 0,
      life,
      step: (e) => {
        const t = e.age / e.life;
        s.scale.setScalar(size * (0.25 + easeOutCubic(t) * 0.75));
        mat.opacity = 1 - t * t;
      },
      dispose: () => mat.dispose(),
    });
  }

  private slashStreak(pos: THREE.Vector3, color: number, length: number, angle: number): void {
    const mat = new THREE.MeshBasicMaterial({
      map: this.streakTex,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.position.copy(pos);
    const life = 0.28;
    this.addEffect({
      obj: m,
      age: 0,
      life,
      step: (e) => {
        const t = e.age / e.life;
        m.quaternion.copy(this.camera.quaternion);
        m.rotateZ(angle);
        m.scale.set(length * (0.4 + easeOutCubic(Math.min(1, t * 2.2)) * 0.8), 0.5 * (1 - t * 0.7), 1);
        mat.opacity = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      },
      dispose: () => {
        m.geometry.dispose();
        mat.dispose();
      },
    });
  }

  private sparks(pos: THREE.Vector3, color: number, count: number, speed: number): void {
    const positions = new Float32Array(count * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      vel.push(
        new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(speed * (0.4 + Math.random() * 0.8)),
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 4,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.addEffect({
      obj: pts,
      age: 0,
      life: 0.7,
      step: (e, dt) => {
        const arr = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < count; i += 1) {
          vel[i].y -= 9 * dt;
          arr.setXYZ(i, arr.getX(i) + vel[i].x * dt, arr.getY(i) + vel[i].y * dt, arr.getZ(i) + vel[i].z * dt);
        }
        arr.needsUpdate = true;
        mat.opacity = 1 - e.age / e.life;
      },
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    });
  }

  private ring(pos: THREE.Vector3, color: number, maxScale: number, life: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    this.addEffect({
      obj: m,
      age: 0,
      life,
      step: (e) => {
        const t = e.age / e.life;
        m.scale.setScalar(0.2 + easeOutCubic(t) * maxScale);
        mat.opacity = 1 - t;
      },
      dispose: () => {
        m.geometry.dispose();
        mat.dispose();
      },
    });
  }

  private beam(pos: THREE.Vector3, color: number, life: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 14, 10, 1, true), mat);
    m.position.set(pos.x, pos.y + 6.5, pos.z);
    this.addEffect({
      obj: m,
      age: 0,
      life,
      step: (e) => {
        const t = e.age / e.life;
        m.scale.set(1 - t * 0.6, 1, 1 - t * 0.6);
        mat.opacity = 0.9 * (1 - t);
      },
      dispose: () => {
        m.geometry.dispose();
        mat.dispose();
      },
    });
  }

  private damageNumber(pos: THREE.Vector3, damage: number, crit: boolean, blocked: boolean): void {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.font = `900 ${crit ? 72 : 60}px Arial Black, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#0b1020';
    const text = String(damage) + (crit ? '!' : '');
    g.strokeText(text, 96, 50);
    g.fillStyle = crit ? '#fde047' : blocked ? '#9ca3af' : '#ffffff';
    g.fillText(text, 96, 50);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const start = pos.clone();
    start.x += (Math.random() - 0.5) * 0.6;
    s.position.copy(start);
    s.scale.set(crit ? 2.4 : 1.9, crit ? 1.2 : 0.95, 1);
    this.addEffect({
      obj: s,
      age: 0,
      life: 1.1,
      step: (e) => {
        const t = e.age / e.life;
        s.position.y = start.y + easeOutCubic(Math.min(1, t * 1.6)) * 1.3;
        mat.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      },
      dispose: () => {
        tex.dispose();
        mat.dispose();
      },
    });
  }

  private flashLightPulse(pos: THREE.Vector3, color: number, intensity: number): void {
    this.flashLight.position.copy(pos);
    this.flashLight.color.setHex(color);
    this.flashLight.intensity = intensity;
  }

  /** Um golpe que acerta: flash, riscos, faíscas, número, recuo, tremor e "hit stop". */
  private impact(
    action: BattleAction,
    hitIndex: number,
    opts: { big?: boolean; knockback?: number } = {},
  ): void {
    const hit = action.hits[hitIndex];
    if (!hit) return;
    const target = action.target;
    const color = action.actor === 'player' ? 0x7dd3fc : 0xfb7185;
    const p = this.worldPos(target, 1.0);
    const big = Boolean(opts.big) || hit.crit;
    this.glowSprite(p, 0xffffff, big ? 4.2 : 2.6, 0.32);
    this.glowSprite(p, color, big ? 6 : 3.8, 0.45);
    const base = (hitIndex % 2 === 0 ? 1 : -1) * (0.5 + Math.random() * 0.5);
    this.slashStreak(p, 0xffffff, big ? 4.2 : 3.2, base);
    this.slashStreak(p, color, big ? 3.6 : 2.6, -base * 0.8);
    if (big) this.slashStreak(p, 0xffffff, 3.2, base + 1.3);
    this.sparks(p, color, big ? 40 : 24, big ? 7 : 5);
    this.flashLightPulse(p, color, big ? 90 : 50);
    this.damageNumber(p.clone().setY(p.y + 0.6), hit.damage, hit.crit, action.blocked);
    this.shake = Math.max(this.shake, big ? 0.7 : 0.35);
    this.hitStop = big ? 0.11 : 0.06;
    this.displayVigor[target] = Math.max(0, this.displayVigor[target] - hit.damage);
    const f = this.fighters[target];
    f.shiver = 0.35;
    // Recuo: empurra ao longo do eixo e volta.
    const dir = this.dirBetween(action.actor, target);
    const kb = opts.knockback ?? 0.9;
    this.moveTo(target, new THREE.Vector3(dir.x * kb, 0, dir.z * kb), 0.12);
    this.after(0.22, () => {
      if (!this.fallen.has(target)) this.moveTo(target, new THREE.Vector3(), 0.3);
    });
    if (action.blocked && this.guardDomes) {
      const dome = this.guardDomes[target];
      (dome.material as THREE.MeshBasicMaterial).opacity = 0.75;
    }
  }

  // ---------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------

  /** Anima a ação já resolvida por `resolveCommand`. `onDone` roda ao terminar. */
  public playAction(action: BattleAction, onDone: () => void): void {
    this.actionBusy = true;
    this.actionDone = onDone;
    const actor = action.actor;
    const dirToTarget = this.dirBetween(actor, action.target);
    const stand = (dist: number) => new THREE.Vector3(dirToTarget.x * dist, 0, dirToTarget.z * dist);
    // Distância de investida: até ficar a ~1,5 m do alvo.
    const hA = this.fighters[actor].home;
    const hT = this.fighters[action.target].home;
    const reach = Math.max(1.2, Math.hypot(hT.x - hA.x, hT.z - hA.z) - 1.5);
    const f = this.fighters[actor];
    // Ao agir, a defesa anterior de quem age termina.
    if (this.guardDomes) (this.guardDomes[actor].material as THREE.MeshBasicMaterial).opacity = 0;
    void f;

    this.setBanner(action.name);
    let total = 1.5;

    if (action.command === 'item') {
      this.wideShot(5);
      this.ring(this.worldPos(actor, 0.08), 0x86efac, 1.8, 0.65);
      this.glowSprite(this.worldPos(actor, 1.0), 0x86efac, 3.2, 0.8);
      this.after(0.38, () => {
        this.displayVigor[actor] = Math.min(100, this.displayVigor[actor] + (action.healing ?? 0));
        this.whiteFlash = 0.18;
      });
      total = 1.0;
    } else if (action.command === 'attack') {
      this.overShoulder(actor, action.target);
      this.moveTo(actor, stand(-0.45), 0.22);
      this.after(0.3, () => {
        this.moveTo(actor, stand(reach), 0.18);
        if (actor === 'player') this.onPlayerClaw();
      });
      this.after(0.5, () => {
        this.impactShot(action.target);
        this.impact(action, 0, { knockback: 1.0 });
      });
      this.after(0.85, () => {
        this.moveTo(actor, new THREE.Vector3(), 0.35);
        this.wideShot(5);
      });
      total = 1.5;
    } else if (action.command === 'flurry') {
      this.overShoulder(actor, action.target);
      this.moveTo(actor, stand(-0.5), 0.25);
      this.after(0.3, () => this.moveTo(actor, stand(reach), 0.16));
      for (let i = 0; i < action.hits.length; i += 1) {
        const at = 0.48 + i * 0.3;
        this.after(at, () => {
          if (actor === 'player') this.onPlayerClaw();
          if (i === 0) this.impactShot(action.target, 14);
          this.moveTo(actor, stand(reach - (i % 2) * 0.35), 0.1);
          this.impact(action, i, { big: i === action.hits.length - 1, knockback: i === action.hits.length - 1 ? 1.6 : 0.6 });
        });
      }
      this.after(1.55, () => {
        this.moveTo(actor, new THREE.Vector3(), 0.4);
        this.wideShot(5);
      });
      total = 2.1;
    } else if (action.command === 'combo_a' || action.command === 'combo_b') {
      const color = action.command === 'combo_a' ? 0xc4b5fd : 0xf9a8d4;
      const duration = action.command === 'combo_a' ? 1.8 : 2.35;
      this.overShoulder(actor, action.target);
      this.moveTo(actor, stand(-0.5), 0.18);
      this.after(0.24, () => this.moveTo(actor, stand(reach), 0.16));
      for (let i = 0; i < action.hits.length; i += 1) {
        const last = i === action.hits.length - 1;
        this.after(0.38 + i * (action.command === 'combo_a' ? 0.22 : 0.25), () => {
          if (i === 0) this.impactShot(action.target, 14);
          if (actor === 'player') this.onPlayerClaw();
          const p = this.worldPos(action.target, 0.8);
          p.x += ((i % 3) - 1) * 0.28;
          p.z += (i % 2 === 0 ? -0.2 : 0.2);
          this.beam(p, color, 0.32);
          this.sparks(p, color, last ? 18 : 8, last ? 2.8 : 1.5);
          this.impact(action, i, { big: last, knockback: last ? 1.8 : 0.45 });
        });
      }
      this.after(duration - 0.15, () => {
        this.moveTo(actor, new THREE.Vector3(), 0.3);
        this.ring(this.worldPos(action.target, 0.05), color, action.command === 'combo_b' ? 4.4 : 3.2, 0.55);
        this.wideShot(5);
      });
      total = duration;
    } else if (action.command === 'guard') {
      const p = this.worldPos(actor, 0.1);
      this.wideShot(5);
      this.ring(p, actor === 'player' ? 0x67e8f9 : 0xfbbf24, 2.6, 0.7);
      this.glowSprite(this.worldPos(actor, 0.9), actor === 'player' ? 0x67e8f9 : 0xfbbf24, 3, 0.6);
      this.fighters[actor].squash = 0.35;
      if (this.guardDomes) {
        (this.guardDomes[actor].material as THREE.MeshBasicMaterial).opacity = 0.35;
      }
      total = 1.0;
    } else {
      this.playLimit(action, stand, reach);
      total = 4.2;
    }

    // Oponente derrubado no meio da batalha em grupo: cai e fica deitado.
    if (action.knockedOut && !action.finishing && action.target !== 'player') {
      const tgt = action.target;
      this.after(Math.max(0.7, total - 0.5), () => {
        this.fallen.add(tgt);
        this.fighters[tgt].tiltTarget = Math.PI / 2;
        this.ring(this.worldPos(tgt, 0.05), 0xffffff, 3.4, 0.7);
        this.sparks(this.worldPos(tgt, 0.6), 0xfde68a, 22, 3.5);
      });
    }

    this.after(total, () => {
      this.actionBusy = false;
      this.darkness = 0;
      const cb = this.actionDone;
      this.actionDone = null;
      cb?.();
    });
  }

  private playLimit(
    action: BattleAction,
    stand: (d: number) => THREE.Vector3,
    reach: number,
  ): void {
    const actor = action.actor;
    const target = action.target;
    const color = actor === 'player' ? 0x93c5fd : 0xf472b6;
    this.darkness = 0.55;
    this.shot(
      this.worldPos(actor, 2.0).addScaledVector(this.perp, 4.8),
      this.worldPos(actor, 1.0),
      3,
      this.origFov - 12,
    );
    this.orbit = { around: actor, radius: 4.8, height: 2.1, speed: 1.0, phase: Math.atan2(this.perp.z, this.perp.x) };
    this.fighters[actor].squash = 0.3;
    // Carga: orbe crescente + anéis no chão.
    const orb = this.worldPos(actor, 2.4);
    for (let i = 0; i < 3; i += 1) {
      this.after(i * 0.4, () => this.ring(this.worldPos(actor, 0.05), color, 3.4, 0.8));
    }
    this.glowSprite(orb, color, 5.2, 1.2);
    this.glowSprite(orb, 0xffffff, 2.6, 1.2);
    // Salto para o alto.
    this.after(1.2, () => {
      this.fighters[actor].squash = 0;
      this.jump(actor, 5.2, 0.9);
      this.flashLightPulse(this.worldPos(actor, 1.5), color, 80);
      this.shot(
        this.worldPos(actor, 0.5).addScaledVector(this.perp, 3.2),
        this.worldPos(actor, 5.5),
        6,
        this.origFov + 4,
      );
      this.orbit = null;
    });
    // Chuva de garras.
    for (let i = 0; i < action.hits.length; i += 1) {
      this.after(1.7 + i * 0.22, () => {
        if (i === 0) {
          this.moveTo(actor, stand(reach * 0.6), 0.2);
          this.impactShot(target, 14);
        }
        const t = this.worldPos(target, 0.2);
        t.x += (Math.random() - 0.5) * 1.1;
        t.z += (Math.random() - 0.5) * 1.1;
        this.beam(t, color, 0.4);
        if (actor === 'player') this.onPlayerClaw();
        this.impact(action, i, { big: i === action.hits.length - 1, knockback: i === action.hits.length - 1 ? 2.4 : 0.5 });
      });
    }
    // Finale: onda de choque e clarão.
    this.after(2.95, () => {
      const p = this.worldPos(target, 0.1);
      this.ring(p, 0xffffff, 7, 0.7);
      this.ring(p, color, 10, 0.9);
      this.glowSprite(this.worldPos(target, 1.2), 0xffffff, 9, 0.6);
      this.whiteFlash = 1;
      this.shake = 1.2;
      this.darkness = 0;
      this.moveTo(actor, new THREE.Vector3(), 0.45);
    });
    this.after(3.4, () => this.wideShot(3));
  }

  /** Final da batalha: derrotado cai, vencedor comemora. */
  public playEnding(winner: 'player' | 'opponent' | null, onDone: () => void): void {
    this.actionBusy = true;
    this.actionDone = onDone;
    this.orbit = null;
    if (winner) {
      const foeSides = this.activeSides.filter((x): x is FoeSide => x !== 'player');
      const standing = foeSides.filter((x) => !this.fallen.has(x));
      const winSide: Side = winner === 'player' ? 'player' : (standing[0] ?? 'opponent');
      const losers: Side[] = winner === 'player' ? foeSides.filter((x) => !this.fallen.has(x)) : ['player'];
      for (const loser of losers) {
        const lf = this.fighters[loser];
        lf.tiltTarget = Math.PI / 2;
        this.fallen.add(loser);
        const dir = this.dirBetween(winSide, loser);
        this.moveTo(loser, new THREE.Vector3(dir.x * 0.8, 0, dir.z * 0.8), 0.4);
        this.ring(this.worldPos(loser, 0.05), 0xffffff, 4, 0.8);
        this.sparks(this.worldPos(loser, 0.6), 0xfde68a, 30, 4);
      }
      this.setBanner(winner === 'player' ? 'Vitória!' : 'Derrota...');
      const wp = this.worldPos(winSide, 2.0);
      this.shot(
        new THREE.Vector3().copy(this.fighters[winSide].home).addScaledVector(this.perp, 4.2 * this.spread).setY(1.7),
        wp.setY(1.2),
        3,
        this.origFov - 8,
      );
      this.orbit = {
        around: winSide,
        radius: 4.2 * this.spread,
        height: 1.7,
        speed: 0.45,
        phase: Math.atan2(this.perp.z, this.perp.x),
      };
      this.after(0.5, () => {
        this.jump(winSide, 1.1, 0.5);
        if (winner === 'player') this.onPlayerCheer();
      });
      this.after(1.1, () => this.jump(winSide, 1.1, 0.5));
    } else {
      this.setBanner('Empate!');
      this.wideShot(3);
    }
    this.after(2.6, () => {
      this.actionBusy = false;
      const cb = this.actionDone;
      this.actionDone = null;
      cb?.();
    });
  }

  // ---------------------------------------------------------------------
  // Quadro a quadro
  // ---------------------------------------------------------------------

  public update(dt: number): void {
    if (!this.active) return;
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 1.8);

    // Hit stop: congela por instantes (efeitos e relógio) no impacto.
    let step = dt;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      step = dt * 0.05;
    }
    this.clock += step;

    // Introdução: fighters se posicionam e a câmera espirala.
    if (this.introT < this.introDur) {
      this.introT = Math.min(this.introDur, this.introT + step);
      const e = easeOutCubic(this.introT / this.introDur);
      const fp = easeInOut(Math.min(1, this.introT / 0.7));
      for (const side of this.activeSides) {
        const f = this.fighters[side];
        f.offset.set(0, 0, 0);
        f.root.position.lerpVectors(f.start, f.home, fp);
      }
      const ang = Math.atan2(this.perp.z, this.perp.x) + (1 - e) * 2.3;
      const radius = 7.4 * this.spread + (1 - e) * 9;
      this.camPos.set(
        this.center.x + Math.cos(ang) * radius,
        2.5 + (1 - e) * 8,
        this.center.z + Math.sin(ang) * radius,
      );
      this.camLook.set(this.center.x, 1.0, this.center.z);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.fov = this.origFov + (1 - e) * 18;
      this.camera.updateProjectionMatrix();
      if (this.introT >= this.introDur) {
        this.wideShot(4);
      }
      this.updateEffects(step);
      return;
    }

    // Eventos agendados.
    if (this.events.length > 0) {
      const due = this.events.filter((ev) => ev.at <= this.clock).sort((a, b) => a.at - b.at);
      if (due.length > 0) {
        this.events = this.events.filter((ev) => ev.at > this.clock);
        for (const ev of due) ev.fn();
      }
    }

    // Lutadores.
    for (const side of this.activeSides) {
      const f = this.fighters[side];
      if (f.tween) {
        f.tween.t += step;
        const k = Math.min(1, f.tween.t / f.tween.dur);
        f.offset.lerpVectors(f.tween.from, f.tween.to, easeOutCubic(k));
        if (k >= 1) f.tween = null;
      }
      let jumpY = 0;
      if (f.jumpDur > 0) {
        f.jumpT += step;
        const k = Math.min(1, f.jumpT / f.jumpDur);
        jumpY = Math.sin(Math.PI * k) * f.jumpHeight;
        if (k >= 1) f.jumpDur = 0;
      }
      f.shiver = Math.max(0, f.shiver - step);
      f.tilt = THREE.MathUtils.damp(f.tilt, f.tiltTarget, 9, step);
      f.root.position.set(
        f.home.x + f.offset.x,
        f.home.y + f.offset.y + jumpY,
        f.home.z + f.offset.z,
      );
      f.root.rotation.y = f.yaw;
      f.root.rotation.z = f.tilt + Math.sin(this.clock * 70) * 0.12 * f.shiver;
      f.root.rotation.x = f.squash * 0.5;
    }

    // Domos de defesa seguem os lutadores e esmaecem.
    if (this.guardDomes) {
      for (const side of this.activeSides) {
        const d = this.guardDomes[side];
        d.position.copy(this.worldPos(side, 0.8));
        const mat = d.material as THREE.MeshBasicMaterial;
        if (mat.opacity > 0.3) mat.opacity = Math.max(0.3, mat.opacity - step * 0.6);
        d.visible = mat.opacity > 0.01;
      }
    }

    this.updateEffects(step);
    this.updateCamera(dt);
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const fx = this.effects[i];
      fx.age += dt;
      fx.step(fx, dt);
      if (fx.age >= fx.life) {
        this.group.remove(fx.obj);
        fx.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 220);
  }

  private updateCamera(dt: number): void {
    if (this.orbit) {
      const o = this.orbit;
      o.phase += o.speed * dt;
      const around = o.around === 'center' ? this.center : this.fighters[o.around].home;
      this.camPosTarget.set(
        around.x + Math.cos(o.phase) * o.radius,
        o.height,
        around.z + Math.sin(o.phase) * o.radius,
      );
    }
    const k = 1 - Math.exp(-this.camK * dt);
    this.camPos.lerp(this.camPosTarget, k);
    this.camLook.lerp(this.camLookTarget, k);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    _v.set(
      (Math.random() - 0.5) * this.shake * 0.5,
      (Math.random() - 0.5) * this.shake * 0.4,
      (Math.random() - 0.5) * this.shake * 0.5,
    );
    this.camera.position.copy(this.camPos).add(_v);
    this.camera.lookAt(this.camLook);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.fovTarget, 6, dt);
    this.camera.updateProjectionMatrix();
  }
}
