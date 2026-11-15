import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphalt: THREE.CanvasTexture;
  buildingConcrete: THREE.CanvasTexture;
  rustedMetal: THREE.CanvasTexture;
  neonSignA: THREE.CanvasTexture;
  neonSignB: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  waterRipple: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Relva estilizada (chão): base viva, manchas de tom e tufos em traços curtos
  const [asphaltCanvas, actx] = makeCanvas(512, 512);
  actx.fillStyle = '#5fae3f';
  actx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const r = 24 + Math.random() * 46;
    actx.fillStyle = Math.random() < 0.5 ? 'rgba(63,138,52,0.35)' : 'rgba(134,201,90,0.35)';
    actx.beginPath();
    actx.arc(gx, gy, r, 0, Math.PI * 2);
    actx.fill();
  }
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    actx.strokeStyle = Math.random() < 0.5 ? '#3f8a34' : '#9ad766';
    actx.lineWidth = 1.5;
    actx.beginPath();
    actx.moveTo(x, y);
    actx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 5);
    actx.stroke();
  }
  for (let i = 0; i < 30; i++) {
    actx.fillStyle = 'rgba(176,138,86,0.35)';
    actx.fillRect(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 8, 4);
  }

  const asphalt = new THREE.CanvasTexture(asphaltCanvas);
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(72, 72);
  asphalt.anisotropy = maxAnisotropy;

  // 2. Fachada de reboco claro com vigas de madeira e janelas de vidro quente
  const [bCanvas, bctx] = makeCanvas(256, 512);
  bctx.fillStyle = '#e8d9b4';
  bctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 500; i++) {
    bctx.fillStyle = `rgba(150,120,80,${Math.random() * 0.08})`;
    bctx.fillRect(Math.random() * 256, Math.random() * 512, 10, 6);
  }
  for (let y = 0; y < 512; y += 64) {
    bctx.fillStyle = '#7a5230';
    bctx.fillRect(0, y, 256, 6);
  }
  for (let x = 0; x <= 256; x += 128) {
    bctx.fillStyle = '#7a5230';
    bctx.fillRect(x === 256 ? 250 : x, 0, 6, 512);
  }
  for (let y = 16; y < 500; y += 64) {
    for (let x = 22; x < 240; x += 64) {
      const lit = Math.random() < 0.4;
      bctx.fillStyle = lit ? '#ffd98a' : '#7fc4e0';
      bctx.fillRect(x, y, 30, 34);
      bctx.strokeStyle = '#5b3a1e';
      bctx.lineWidth = 3;
      bctx.strokeRect(x, y, 30, 34);
      bctx.beginPath();
      bctx.moveTo(x + 15, y);
      bctx.lineTo(x + 15, y + 34);
      bctx.moveTo(x, y + 17);
      bctx.lineTo(x + 30, y + 17);
      bctx.stroke();
    }
  }

  const buildingConcrete = new THREE.CanvasTexture(bCanvas);
  buildingConcrete.colorSpace = THREE.SRGBColorSpace;
  buildingConcrete.wrapS = THREE.RepeatWrapping;
  buildingConcrete.wrapT = THREE.RepeatWrapping;
  buildingConcrete.anisotropy = maxAnisotropy;

  // 3. Rusted corrugated shipping container / scrap metal
  const [mCanvas, mctx] = makeCanvas(256, 256);
  mctx.fillStyle = '#8a5a3a';
  mctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    mctx.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
    mctx.fillRect(x, 0, 8, 256);
  }
  for (let r = 0; r < 180; r++) {
    mctx.fillStyle = `rgba(196, 120, 60, ${0.12 + Math.random() * 0.2})`;
    mctx.beginPath();
    mctx.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 0, Math.PI * 2);
    mctx.fill();
  }

  const rustedMetal = new THREE.CanvasTexture(mCanvas);
  rustedMetal.colorSpace = THREE.SRGBColorSpace;
  rustedMetal.wrapS = THREE.RepeatWrapping;
  rustedMetal.wrapT = THREE.RepeatWrapping;
  rustedMetal.anisotropy = maxAnisotropy;

  // 4. Flickering Holographic Neon Signs (PT-BR world-building!)
  const [s1Canvas, s1ctx] = makeCanvas(512, 256);
  s1ctx.fillStyle = '#090d16';
  s1ctx.fillRect(0, 0, 512, 256);
  s1ctx.strokeStyle = '#06b6d4';
  s1ctx.lineWidth = 6;
  s1ctx.strokeRect(10, 10, 492, 236);
  s1ctx.fillStyle = '#22d3ee';
  s1ctx.font = 'bold 54px sans-serif';
  s1ctx.textAlign = 'center';
  s1ctx.fillText('SETOR AQUA-04', 256, 112);
  s1ctx.fillStyle = '#94a3b8';
  s1ctx.font = '26px monospace';
  s1ctx.fillText('PURIFICAÇÃO SUSPENSA', 256, 174);
  const neonSignA = new THREE.CanvasTexture(s1Canvas);
  neonSignA.colorSpace = THREE.SRGBColorSpace;
  neonSignA.anisotropy = maxAnisotropy;

  const [s2Canvas, s2ctx] = makeCanvas(512, 256);
  s2ctx.fillStyle = '#0f0b14';
  s2ctx.fillRect(0, 0, 512, 256);
  s2ctx.strokeStyle = '#f59e0b';
  s2ctx.lineWidth = 6;
  s2ctx.strokeRect(10, 10, 492, 236);
  s2ctx.fillStyle = '#fbbf24';
  s2ctx.font = 'bold 52px sans-serif';
  s2ctx.textAlign = 'center';
  s2ctx.fillText('MERCADO SINTÉTICO', 256, 112);
  s2ctx.fillStyle = '#cbd5e1';
  s2ctx.font = '26px monospace';
  s2ctx.fillText('RAÇÕES & ENERGIA', 256, 174);
  const neonSignB = new THREE.CanvasTexture(s2Canvas);
  neonSignB.colorSpace = THREE.SRGBColorSpace;
  neonSignB.anisotropy = maxAnisotropy;

  // 5. Soft radial contact shadow
  const [shCanvas, shctx] = makeCanvas(128, 128);
  const shGrad = shctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  shGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shctx.fillStyle = shGrad;
  shctx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 6. Water surface ripple pattern
  const [wCanvas, wctx] = makeCanvas(256, 256);
  wctx.fillStyle = '#1f8fc0';
  wctx.fillRect(0, 0, 256, 256);
  wctx.strokeStyle = 'rgba(200, 240, 255, 0.5)';
  wctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    wctx.beginPath();
    wctx.arc(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 34, 0, Math.PI * 2);
    wctx.stroke();
  }
  const waterRipple = new THREE.CanvasTexture(wCanvas);
  waterRipple.colorSpace = THREE.SRGBColorSpace;
  waterRipple.wrapS = THREE.RepeatWrapping;
  waterRipple.wrapT = THREE.RepeatWrapping;

  return {
    asphalt,
    buildingConcrete,
    rustedMetal,
    neonSignA,
    neonSignB,
    contactShadow,
    waterRipple,
    dispose: () => {
      asphalt.dispose();
      buildingConcrete.dispose();
      rustedMetal.dispose();
      neonSignA.dispose();
      neonSignB.dispose();
      contactShadow.dispose();
      waterRipple.dispose();
    },
  };
}
