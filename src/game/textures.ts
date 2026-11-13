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
  // 1. Post-apocalyptic cracked asphalt + faded street grid
  const [asphaltCanvas, actx] = makeCanvas(512, 512);
  actx.fillStyle = '#181e29';
  actx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 18 + Math.floor(Math.random() * 26);
    actx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 11})`;
    actx.fillRect(x, y, 2, 2);
  }

  // Subtle tile expansion seams
  actx.strokeStyle = 'rgba(8, 11, 17, 0.55)';
  actx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    actx.beginPath();
    actx.moveTo(i, 0);
    actx.lineTo(i, 512);
    actx.stroke();
    actx.beginPath();
    actx.moveTo(0, i);
    actx.lineTo(512, i);
    actx.stroke();
  }

  // Cracks
  actx.strokeStyle = 'rgba(5, 7, 12, 0.78)';
  actx.lineWidth = 1.5;
  for (let c = 0; c < 14; c++) {
    let cx = Math.random() * 512;
    let cy = Math.random() * 512;
    actx.beginPath();
    actx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (Math.random() - 0.5) * 48;
      cy += (Math.random() - 0.5) * 48;
      actx.lineTo(cx, cy);
    }
    actx.stroke();
  }

  // Mossy dust patches
  for (let m = 0; m < 16; m++) {
    const mx = Math.random() * 512;
    const my = Math.random() * 512;
    const grad = actx.createRadialGradient(mx, my, 2, mx, my, 28);
    grad.addColorStop(0, 'rgba(30, 56, 48, 0.25)');
    grad.addColorStop(1, 'rgba(30, 56, 48, 0)');
    actx.fillStyle = grad;
    actx.fillRect(mx - 28, my - 28, 56, 56);
  }

  const asphalt = new THREE.CanvasTexture(asphaltCanvas);
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(72, 72);
  asphalt.anisotropy = maxAnisotropy;

  // 2. Futuristic ruined concrete facade with dark windows
  const [bCanvas, bctx] = makeCanvas(256, 512);
  bctx.fillStyle = '#222a38';
  bctx.fillRect(0, 0, 256, 512);

  // Horizontal floor bands
  for (let y = 0; y < 512; y += 32) {
    bctx.fillStyle = '#1b222e';
    bctx.fillRect(0, y, 256, 5);
  }
  // Windows grid (some faintly lit cyan/amber, most dark/broken)
  for (let y = 10; y < 500; y += 32) {
    for (let x = 14; x < 240; x += 38) {
      const roll = Math.random();
      if (roll < 0.07) {
        bctx.fillStyle = '#0e7490';
      } else if (roll < 0.11) {
        bctx.fillStyle = '#92400e';
      } else {
        bctx.fillStyle = '#0c1018';
      }
      bctx.fillRect(x, y, 24, 16);
      bctx.strokeStyle = '#334155';
      bctx.lineWidth = 1;
      bctx.strokeRect(x, y, 24, 16);
    }
  }
  // Weathering grime
  for (let i = 0; i < 650; i++) {
    bctx.fillStyle = `rgba(10, 12, 16, ${Math.random() * 0.22})`;
    bctx.fillRect(Math.random() * 256, Math.random() * 512, 4, 10);
  }

  const buildingConcrete = new THREE.CanvasTexture(bCanvas);
  buildingConcrete.colorSpace = THREE.SRGBColorSpace;
  buildingConcrete.wrapS = THREE.RepeatWrapping;
  buildingConcrete.wrapT = THREE.RepeatWrapping;
  buildingConcrete.anisotropy = maxAnisotropy;

  // 3. Rusted corrugated shipping container / scrap metal
  const [mCanvas, mctx] = makeCanvas(256, 256);
  mctx.fillStyle = '#3b2f2f';
  mctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    mctx.fillStyle = x % 32 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)';
    mctx.fillRect(x, 0, 8, 256);
  }
  for (let r = 0; r < 180; r++) {
    mctx.fillStyle = `rgba(154, 68, 28, ${0.15 + Math.random() * 0.25})`;
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
  wctx.fillStyle = '#083344';
  wctx.fillRect(0, 0, 256, 256);
  wctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
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
