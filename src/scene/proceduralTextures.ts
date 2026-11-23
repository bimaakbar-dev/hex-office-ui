import * as THREE from 'three';

export interface ProceduralTexturePack {
  oakWood: THREE.CanvasTexture;
  terrazzo: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  screenCode: THREE.CanvasTexture;
  screenChart: THREE.CanvasTexture;
  screenDesign: THREE.CanvasTexture;
  screenQa: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  const anisotropy = Math.min(maxAnisotropy, 8);

  // 1. Smoked Walnut Wood Grain (Dark Studio Finish)
  const oakCanvas = document.createElement('canvas');
  oakCanvas.width = 256;
  oakCanvas.height = 256;
  const oakCtx = oakCanvas.getContext('2d')!;
  oakCtx.fillStyle = '#5C4433';
  oakCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 64; i++) {
    const y = (i / 64) * 256;
    oakCtx.strokeStyle = i % 2 === 0 ? 'rgba(32, 22, 16, 0.28)' : 'rgba(130, 98, 74, 0.16)';
    oakCtx.lineWidth = 1.5 + (i % 3);
    oakCtx.beginPath();
    oakCtx.moveTo(0, y);
    oakCtx.bezierCurveTo(85, y + Math.sin(i) * 4, 170, y - Math.cos(i) * 4, 256, y);
    oakCtx.stroke();
  }
  const oakWood = new THREE.CanvasTexture(oakCanvas);
  oakWood.colorSpace = THREE.SRGBColorSpace;
  oakWood.wrapS = THREE.RepeatWrapping;
  oakWood.wrapT = THREE.RepeatWrapping;
  oakWood.anisotropy = anisotropy;

  // 2. Dark Carbon Terrazzo Floor Texture (Vercel Obsidian)
  const terrazzoCanvas = document.createElement('canvas');
  terrazzoCanvas.width = 256;
  terrazzoCanvas.height = 256;
  const tCtx = terrazzoCanvas.getContext('2d')!;
  tCtx.fillStyle = '#151519';
  tCtx.fillRect(0, 0, 256, 256);
  const chipPalette = ['#27272A', '#3F3F46', '#52525B', '#3B82F6', '#D96B43'];
  for (let i = 0; i < 180; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const size = 2 + (i % 3);
    tCtx.fillStyle = chipPalette[i % chipPalette.length];
    tCtx.globalAlpha = i % 7 === 0 ? 0.45 : 0.35;
    tCtx.beginPath();
    tCtx.moveTo(x, y);
    tCtx.lineTo(x + size, y + (i % 3) - 1);
    tCtx.lineTo(x + size * 0.5, y + size);
    tCtx.closePath();
    tCtx.fill();
  }
  tCtx.globalAlpha = 1;
  const terrazzo = new THREE.CanvasTexture(terrazzoCanvas);
  terrazzo.colorSpace = THREE.SRGBColorSpace;
  terrazzo.wrapS = THREE.RepeatWrapping;
  terrazzo.wrapT = THREE.RepeatWrapping;
  terrazzo.anisotropy = anisotropy;

  // 3. Soft Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  // 4. Role Screen Textures (High contrast on dark studio)
  const makeScreen = (bg: string, drawFn: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, 256, 18);
    drawFn(ctx);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    return tex;
  };

  const screenCode = makeScreen('#0B101B', (ctx) => {
    const widths = [110, 160, 85, 190, 130, 95, 175, 120];
    const colors = ['#60A5FA', '#34D399', '#A78BFA', '#F4F4F5', '#FBBF24'];
    widths.forEach((w, idx) => {
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(18 + (idx % 2) * 14, 30 + idx * 14, w, 6);
    });
  });

  const screenChart = makeScreen('#0D1117', (ctx) => {
    ctx.fillStyle = '#F4F4F5';
    ctx.fillRect(16, 28, 90, 8);
    const bars = [42, 68, 55, 86, 74, 98];
    bars.forEach((h, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#F97316' : '#3B82F6';
      ctx.fillRect(22 + i * 34, 136 - h, 20, h);
    });
  });

  const screenDesign = makeScreen('#0B1311', (ctx) => {
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 30, 110, 108);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(146, 32, 88, 42);
    ctx.fillStyle = '#6EE7B7';
    ctx.fillRect(146, 86, 88, 50);
    ctx.fillStyle = '#FAFAFA';
    ctx.beginPath();
    ctx.arc(75, 84, 24, 0, Math.PI * 2);
    ctx.fill();
  });

  const screenQa = makeScreen('#111116', (ctx) => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i === 4 ? '#F59E0B' : '#10B981';
      ctx.fillRect(18, 30 + i * 19, 10, 10);
      ctx.fillStyle = '#D4D4D8';
      ctx.fillRect(36, 32 + i * 19, 165 - (i % 3) * 28, 6);
    }
  });

  return {
    oakWood,
    terrazzo,
    contactShadow,
    screenCode,
    screenChart,
    screenDesign,
    screenQa,
    dispose: () => {
      oakWood.dispose();
      terrazzo.dispose();
      contactShadow.dispose();
      screenCode.dispose();
      screenChart.dispose();
      screenDesign.dispose();
      screenQa.dispose();
    },
  };
}
