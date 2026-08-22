import * as THREE from 'three';

/**
 * Procedurally generates realistic planetary and celestial textures via 2D Canvas.
 * Ensures zero external image asset dependencies and instant rendering.
 */

// Procedural Earth Texture
export function createEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep Ocean Blue Base
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#0a2342'); // Arctic Ocean
  oceanGrad.addColorStop(0.3, '#0b3d91'); // Atlantic / Pacific
  oceanGrad.addColorStop(0.5, '#0e4d92'); // Equatorial waters
  oceanGrad.addColorStop(0.7, '#0b3d91');
  oceanGrad.addColorStop(1, '#081d36'); // Southern Ocean
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Continent noise map generator
  const drawContinentBlob = (cx: number, cy: number, rx: number, ry: number, color: string, roughness: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const noise = (Math.sin(theta * 7) * 0.15 + Math.cos(theta * 13) * 0.1) * roughness;
      const rX = rx * (1 + noise);
      const rY = ry * (1 + noise);
      const px = cx + Math.cos(theta) * rX;
      const py = cy + Math.sin(theta) * rY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  // Continents: North America, South America, Eurasia, Africa, Australia, Antarctica
  // North America
  drawContinentBlob(width * 0.22, height * 0.30, width * 0.12, height * 0.15, '#2e6f40', 0.8);
  drawContinentBlob(width * 0.20, height * 0.22, width * 0.08, height * 0.08, '#4a7c59', 0.9); // Canada
  // South America
  drawContinentBlob(width * 0.32, height * 0.65, width * 0.07, height * 0.18, '#1e5f38', 0.7);
  // Eurasia
  drawContinentBlob(width * 0.65, height * 0.30, width * 0.22, height * 0.16, '#3a7d44', 0.85);
  drawContinentBlob(width * 0.58, height * 0.22, width * 0.12, height * 0.08, '#5b8e55', 0.9); // Siberia
  // Africa
  drawContinentBlob(width * 0.52, height * 0.55, width * 0.10, height * 0.18, '#70653d', 0.7); // Sahara & savanna
  drawContinentBlob(width * 0.52, height * 0.62, width * 0.08, height * 0.12, '#2d6a3f', 0.75); // Congo
  // Australia
  drawContinentBlob(width * 0.85, height * 0.70, width * 0.08, height * 0.09, '#b26e38', 0.6); // Outback
  // Polar Ice Caps
  // North Pole
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height * 0.07);
  // South Pole (Antarctica)
  drawContinentBlob(width * 0.5, height * 0.95, width * 0.45, height * 0.07, '#e8f4f8', 0.4);

  // Cloud Layer Swirls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let c = 0; c < 40; c++) {
    const cx = (c * 73) % width;
    const cy = height * 0.2 + (c * 47) % (height * 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 80 + (c % 15) * 8, 25 + (c % 8) * 4, (c * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Moon Texture with Maria & Craters
export function createMoonTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Highland Regolith Base Grey
  ctx.fillStyle = '#8f9298';
  ctx.fillRect(0, 0, width, height);

  // Surface noise grain
  const imgData = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 35;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + grain));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + grain));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);

  // Dark Lunar Maria (Basaltic Plains)
  const mariaList = [
    { x: width * 0.35, y: height * 0.45, rx: width * 0.12, ry: height * 0.18, name: 'Oceanus Procellarum' },
    { x: width * 0.50, y: height * 0.35, rx: width * 0.08, ry: height * 0.10, name: 'Mare Imbrium' },
    { x: width * 0.58, y: height * 0.45, rx: width * 0.07, ry: height * 0.09, name: 'Mare Serenitatis' },
    { x: width * 0.65, y: height * 0.52, rx: width * 0.08, ry: height * 0.09, name: 'Mare Tranquillitatis' },
    { x: width * 0.70, y: height * 0.40, rx: width * 0.05, ry: height * 0.06, name: 'Mare Crisium' },
    { x: width * 0.60, y: height * 0.65, rx: width * 0.06, ry: height * 0.08, name: 'Mare Nubium' },
  ];

  ctx.fillStyle = 'rgba(55, 58, 64, 0.75)';
  mariaList.forEach((m) => {
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Impact Craters with bright ejecta rays (Tycho, Copernicus, Kepler)
  const craters = [
    { x: width * 0.48, y: height * 0.75, r: 12, name: 'Tycho' },
    { x: width * 0.45, y: height * 0.42, r: 10, name: 'Copernicus' },
    { x: width * 0.38, y: height * 0.44, r: 6, name: 'Kepler' },
    { x: width * 0.75, y: height * 0.35, r: 8, name: 'Langrenus' },
  ];

  craters.forEach((crater) => {
    // Ejecta rays
    ctx.strokeStyle = 'rgba(235, 240, 250, 0.35)';
    ctx.lineWidth = 1.5;
    for (let a = 0; a < 12; a++) {
      const angle = (a / 12) * Math.PI * 2 + Math.random() * 0.2;
      const len = crater.r * (4 + Math.random() * 8);
      ctx.beginPath();
      ctx.moveTo(crater.x, crater.y);
      ctx.lineTo(crater.x + Math.cos(angle) * len, crater.y + Math.sin(angle) * len);
      ctx.stroke();
    }

    // Crater Rim
    ctx.fillStyle = '#b8bcc4';
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, crater.r, 0, Math.PI * 2);
    ctx.fill();

    // Crater Floor (shadow)
    ctx.fillStyle = '#404348';
    ctx.beginPath();
    ctx.arc(crater.x - 1, crater.y - 1, crater.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Dynamic Sun Surface Texture
export function createSunTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Brilliant Yellow-Orange Plasma Base
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#ff9900');
  grad.addColorStop(0.5, '#ffcc00');
  grad.addColorStop(1, '#ff8800');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Solar Convection Granules
  ctx.fillStyle = 'rgba(255, 245, 180, 0.25)';
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 4 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunspots (Magnetic field flux tubes)
  const sunspots = [
    { x: width * 0.45, y: height * 0.40, r: 8 },
    { x: width * 0.47, y: height * 0.42, r: 5 },
    { x: width * 0.60, y: height * 0.55, r: 7 },
  ];

  sunspots.forEach((spot) => {
    // Penumbra (brownish-red)
    ctx.fillStyle = 'rgba(180, 60, 10, 0.7)';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Umbra (dark core)
    ctx.fillStyle = '#4a0e00';
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Particle Texture for Rocket Exhaust Plume & Staging Debris
export function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(255, 180, 50, 0.9)');
  grad.addColorStop(0.5, 'rgba(255, 80, 10, 0.6)');
  grad.addColorStop(1, 'rgba(255, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  return new THREE.CanvasTexture(canvas);
}
