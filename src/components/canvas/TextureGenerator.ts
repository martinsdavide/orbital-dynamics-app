import * as THREE from 'three';

/**
 * Procedurally generates realistic planetary and celestial textures via 2D Canvas.
 * Ensures zero external image asset dependencies and instant rendering.
 */

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

// Stylized Callisto: dark ice and rock, densely cratered with a Valhalla-like ring system.
export function createCallistoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const longitudes = Array.from({ length: width }, (_, x) => 2 * Math.PI * (x / width - 0.5));
  const cosLongitude = longitudes.map(angle => Math.cos(angle));
  const sinLongitude = longitudes.map(angle => Math.sin(angle));
  const basinLatitude = 15.5 * Math.PI / 180;
  const basinLongitude = -56 * Math.PI / 180;
  const basinX = Math.cos(basinLatitude) * Math.cos(basinLongitude);
  const basinY = Math.sin(basinLatitude);
  const basinZ = Math.cos(basinLatitude) * Math.sin(basinLongitude);

  for (let row = 0; row < height; row++) {
    const latitude = Math.PI * (0.5 - row / height);
    const y = Math.sin(latitude);
    const latitudeRadius = Math.cos(latitude);
    for (let col = 0; col < width; col++) {
      const x = latitudeRadius * cosLongitude[col];
      const z = latitudeRadius * sinLongitude[col];
      const terrain = 9 * Math.sin(x * 9 + z * 7) * Math.cos(y * 11 - z * 4) +
        6 * Math.sin(x * 26 + y * 31) * Math.cos(z * 26 - y * 13) +
        5 * Math.sin(x * 94 - y * 55 + z * 87) * Math.cos(y * 89 + z * 101);
      const basinDistance = Math.acos(Math.min(1, basinX * x + basinY * y + basinZ * z));
      const centralIce = 38 * Math.exp(-((basinDistance / 0.14) ** 2));
      const rings = 18 * Math.max(0, Math.cos(basinDistance * 99 + 0.55 * Math.sin(y * 48 + x * 35))) ** 4 *
        Math.max(0, 1 - basinDistance / 0.5);
      const shade = terrain + centralIce + rings;
      const index = (row * width + col) * 4;
      image.data[index] = 108 + shade;
      image.data[index + 1] = 92 + shade;
      image.data[index + 2] = 79 + shade;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Vary crater scale and relief, wrapping each rim across the longitude seam.
  let seed = 5783;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const rim = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  rim.addColorStop(0, 'rgba(46, 38, 34, 0.25)');
  rim.addColorStop(0.64, 'rgba(57, 47, 41, 0.22)');
  rim.addColorStop(0.83, 'rgba(206, 190, 165, 0.4)');
  rim.addColorStop(1, 'rgba(206, 190, 165, 0)');
  for (let i = 0; i < 880; i++) {
    const x = random() * width;
    const latitude = Math.asin(2 * random() - 1);
    const y = height * (0.5 - latitude / Math.PI);
    const size = 1.2 + 22 * random() ** 6;
    const relief = 0.45 + 0.55 * random();
    const rimAngle = random() * 2 * Math.PI;
    const flattening = 0.8 + 0.2 * random();
    const longitudeRadius = size / Math.max(0.22, Math.cos(latitude));
    for (const offset of [-width, 0, width]) {
      ctx.save();
      ctx.translate(x + offset, y);
      ctx.scale(longitudeRadius, size * flattening);
      ctx.globalAlpha = relief;
      ctx.fillStyle = rim;
      ctx.fillRect(-1, -1, 2, 2);
      if (size > 3) {
        ctx.beginPath();
        ctx.arc(0, 0, 0.83, rimAngle, rimAngle + Math.PI * 0.82);
        ctx.strokeStyle = 'rgba(230, 216, 190, 0.35)';
        ctx.lineWidth = 0.08;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
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

// Procedural Mercury Texture: Cratered slate-grey iron surface
export function createMercuryTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base graphite-grey regolith
  ctx.fillStyle = '#7a7a7e';
  ctx.fillRect(0, 0, width, height);

  // Surface noise grain
  const imgData = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 30;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + grain));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + grain));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);

  // Caloris Basin & dark volcanic plains
  ctx.fillStyle = 'rgba(50, 50, 55, 0.6)';
  ctx.beginPath();
  ctx.ellipse(width * 0.35, height * 0.45, width * 0.14, height * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(width * 0.72, height * 0.6, width * 0.1, height * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Heavy cratering
  for (let c = 0; c < 120; c++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = 2 + Math.random() * 8;
    ctx.fillStyle = '#b0b0b8';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#424246';
    ctx.beginPath();
    ctx.arc(cx - 0.8, cy - 0.8, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Venus Texture: Dense swirling sulfuric acid clouds
export function createVenusTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Smooth warm cream-yellow gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#e8cf8d');
  grad.addColorStop(0.3, '#f5deb3');
  grad.addColorStop(0.5, '#edd493');
  grad.addColorStop(0.7, '#e0be75');
  grad.addColorStop(1, '#caa257');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Broad planetary UV cloud bands
  ctx.fillStyle = 'rgba(215, 175, 95, 0.22)';
  for (let i = 0; i < 24; i++) {
    const y = (i / 24) * height;
    ctx.beginPath();
    ctx.ellipse(width * 0.5, y, width * 0.6, 12 + Math.sin(i * 0.8) * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Atmospheric chevron swirls
  ctx.strokeStyle = 'rgba(248, 235, 195, 0.35)';
  ctx.lineWidth = 14;
  for (let c = 0; c < 16; c++) {
    const y = (c / 16) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.3, y - 25, width * 0.7, y + 25, width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Mars Texture: Rusty red regolith, dark basalt, polar caps
export function createMarsTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Iron oxide red-orange base
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#b84419');
  grad.addColorStop(0.4, '#c85a2b');
  grad.addColorStop(0.6, '#bf4f20');
  grad.addColorStop(1, '#a83c14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Dark volcanic plains: Syrtis Major, Acidalia Planitia, Sinus Meridiani
  ctx.fillStyle = 'rgba(75, 42, 28, 0.75)';
  // Syrtis Major triangular dark patch
  ctx.beginPath();
  ctx.moveTo(width * 0.58, height * 0.4);
  ctx.lineTo(width * 0.66, height * 0.52);
  ctx.lineTo(width * 0.54, height * 0.58);
  ctx.closePath();
  ctx.fill();

  // Mare Erythraeum / southern dark belt
  ctx.beginPath();
  ctx.ellipse(width * 0.32, height * 0.62, width * 0.16, height * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Acidalia Planitia
  ctx.beginPath();
  ctx.ellipse(width * 0.28, height * 0.32, width * 0.1, height * 0.08, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Valles Marineris canyon cut
  ctx.strokeStyle = '#3e1e12';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.22, height * 0.52);
  ctx.lineTo(width * 0.36, height * 0.54);
  ctx.stroke();

  // White CO2 / water ice polar caps
  ctx.fillStyle = '#f5f8fa';
  // North Pole
  ctx.beginPath();
  ctx.ellipse(width * 0.5, 0, width * 0.22, height * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // South Pole
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height, width * 0.18, height * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Jupiter Texture: Atmospheric belts, zones, eddies, and Great Red Spot
export function createJupiterTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Alternating gas zones (light) and belts (dark reddish-brown)
  const bands = [
    { y: 0.0, h: 0.12, color: '#9c8167' }, // North Polar Region
    { y: 0.12, h: 0.08, color: '#f1e2cd' }, // North North Temperate Zone
    { y: 0.20, h: 0.09, color: '#b96937' }, // North Temperate Belt
    { y: 0.29, h: 0.10, color: '#eddac2' }, // North Tropical Zone
    { y: 0.39, h: 0.12, color: '#974921' }, // North Equatorial Belt (NEB)
    { y: 0.51, h: 0.07, color: '#f7efe1' }, // Equatorial Zone
    { y: 0.58, h: 0.12, color: '#883d1c' }, // South Equatorial Belt (SEB)
    { y: 0.70, h: 0.09, color: '#ebd1b0' }, // South Tropical Zone
    { y: 0.79, h: 0.09, color: '#9c6640' }, // South Temperate Belt
    { y: 0.88, h: 0.12, color: '#7a6048' }, // South Polar Region
  ];

  bands.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, b.y * height, width, b.h * height + 2);
  });

  // Wavy jet-stream turbulent shear lines
  for (let j = 0; j < 36; j++) {
    const yBase = (j / 36) * height;
    ctx.strokeStyle = j % 2 === 0 ? 'rgba(255, 245, 230, 0.25)' : 'rgba(80, 30, 10, 0.25)';
    ctx.lineWidth = 4 + (j % 4);
    ctx.beginPath();
    for (let x = 0; x <= width; x += 30) {
      const yOff = Math.sin((x / width) * Math.PI * 14 + j) * 8 + Math.cos((x / width) * Math.PI * 6) * 4;
      if (x === 0) ctx.moveTo(x, yBase + yOff);
      else ctx.lineTo(x, yBase + yOff);
    }
    ctx.stroke();
  }

  // The Great Red Spot (in the South Equatorial Belt / Tropical Zone)
  const grsX = width * 0.62;
  const grsY = height * 0.63;
  const grsW = width * 0.075;
  const grsH = height * 0.045;

  // GRS Turbulent hollow
  ctx.fillStyle = 'rgba(235, 210, 180, 0.6)';
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, grsW * 1.3, grsH * 1.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // GRS Core (deep crimson/terracotta)
  ctx.fillStyle = '#b33e1c';
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, grsW, grsH, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // GRS Inner swirl ring
  ctx.strokeStyle = '#e0764e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, grsW * 0.65, grsH * 0.6, 0.05, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Saturn Texture: Delicate golden-butter atmospheric latitude bands
export function createSaturnTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Smooth warm butterscotch and golden-ochre bands
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#a89368'); // North polar hood
  grad.addColorStop(0.2, '#c7b384');
  grad.addColorStop(0.4, '#e2cb98');
  grad.addColorStop(0.5, '#edd8a9'); // Equatorial bright zone
  grad.addColorStop(0.65, '#dfc58f');
  grad.addColorStop(0.85, '#bfab7c');
  grad.addColorStop(1, '#97845c'); // South polar hood
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle cloud stripes
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * height;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 245, 215, 0.12)' : 'rgba(120, 95, 45, 0.1)';
    ctx.fillRect(0, y, width, height / 40);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Saturn Rings Texture: Concentric rings with Cassini division and alpha gradients
export function createSaturnRingTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1D horizontal gradient across ring radius (left = inner, right = outer)
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)'); // Inner transparent boundary
  grad.addColorStop(0.08, 'rgba(160, 140, 100, 0.15)'); // C Ring (crepe ring)
  grad.addColorStop(0.22, 'rgba(180, 160, 115, 0.45)');
  grad.addColorStop(0.25, 'rgba(225, 205, 155, 0.92)'); // B Ring start (brightest)
  grad.addColorStop(0.58, 'rgba(240, 220, 170, 0.95)'); // B Ring dense outer
  grad.addColorStop(0.60, 'rgba(20, 15, 10, 0.05)'); // Cassini Division start
  grad.addColorStop(0.65, 'rgba(10, 10, 10, 0.02)'); // Cassini Division dark void
  grad.addColorStop(0.67, 'rgba(195, 175, 130, 0.75)'); // A Ring start
  grad.addColorStop(0.85, 'rgba(180, 160, 120, 0.70)'); // Encke Gap vicinity
  grad.addColorStop(0.96, 'rgba(150, 130, 95, 0.35)'); // A Ring outer edge
  grad.addColorStop(1.00, 'rgba(0, 0, 0, 0)'); // Outer transparent void

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Micro-ringlet striations
  for (let x = Math.floor(width * 0.25); x < width * 0.96; x += 4) {
    if (x >= width * 0.59 && x <= width * 0.66) continue; // Skip Cassini Division
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(x, 0, 1.5, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Procedural Uranus Texture: Soft pale aquamarine ice-giant
export function createUranusTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#8ec5cf');
  grad.addColorStop(0.3, '#74b6c3');
  grad.addColorStop(0.5, '#6daebc');
  grad.addColorStop(0.7, '#78bcc9');
  grad.addColorStop(1, '#94cbd5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Very subtle faint polar methane haze
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, 0, width, height * 0.15);
  ctx.fillRect(0, height * 0.85, width, height * 0.15);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Neptune Texture: Deep azure blue with white storm streaks and Great Dark Spot
export function createNeptuneTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#1c3d78');
  grad.addColorStop(0.3, '#244d93');
  grad.addColorStop(0.5, '#2b5cb0');
  grad.addColorStop(0.7, '#244d93');
  grad.addColorStop(1, '#173468');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Great Dark Spot (vortex in southern hemisphere)
  ctx.fillStyle = 'rgba(15, 30, 70, 0.75)';
  ctx.beginPath();
  ctx.ellipse(width * 0.45, height * 0.62, width * 0.08, height * 0.05, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Companion bright cirrus cloud streak (Scooter)
  ctx.fillStyle = 'rgba(235, 245, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(width * 0.45, height * 0.58, width * 0.06, height * 0.012, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Equatorial and mid-latitude high-altitude cirrus cloud streaks
  for (let s = 0; s < 8; s++) {
    const y = height * (0.35 + s * 0.06);
    const x = (s * 180) % width;
    ctx.fillStyle = 'rgba(220, 240, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, 70 + (s % 4) * 20, 3.5, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Stylized Pluto map with reddish terrain and the bright Tombaugh Regio.
export function createPlutoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const surface = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const latitude = Math.PI * (0.5 - y / height);
    const polarFrost = Math.abs(Math.sin(latitude)) ** 3;
    for (let x = 0; x < width; x++) {
      const longitude = x / width * 2 * Math.PI;
      const relief = 0.52 * Math.sin(5 * longitude + 14 * latitude) +
        0.29 * Math.sin(19 * longitude - 31 * latitude) + 0.19 * Math.cos(47 * longitude + 43 * latitude);
      const darkBelt = (Math.cos(latitude + 0.28) ** 18) * (0.72 + 0.28 * Math.cos(2 * longitude));
      const brightness = 17 * relief + 25 * polarFrost - 42 * darkBelt;
      const index = 4 * (y * width + x);
      surface.data[index] = 174 + brightness;
      surface.data[index + 1] = 134 + brightness;
      surface.data[index + 2] = 107 + brightness;
      surface.data[index + 3] = 255;
    }
  }
  ctx.putImageData(surface, 0, 0);

  ctx.save();
  ctx.scale(width, height);
  ctx.beginPath();
  ctx.moveTo(0.47, 0.62);
  ctx.bezierCurveTo(0.43, 0.56, 0.37, 0.43, 0.39, 0.35);
  ctx.bezierCurveTo(0.41, 0.28, 0.46, 0.28, 0.49, 0.37);
  ctx.bezierCurveTo(0.53, 0.30, 0.60, 0.35, 0.60, 0.43);
  ctx.bezierCurveTo(0.59, 0.51, 0.53, 0.56, 0.47, 0.62);
  ctx.closePath();
  const nitrogenIce = ctx.createLinearGradient(0.39, 0.36, 0.59, 0.53);
  nitrogenIce.addColorStop(0, '#eadcc4');
  nitrogenIce.addColorStop(0.45, '#ded0b8');
  nitrogenIce.addColorStop(1, '#baa996');
  ctx.fillStyle = nitrogenIce;
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Stylized Ceres with dark regolith, subdued crater rims, and Occator's bright salt deposits.
export function createCeresTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const surface = ctx.createImageData(width, height);
  const longitudeCos = Array.from({ length: width }, (_, x) => Math.cos(x / width * 2 * Math.PI));
  const longitudeSin = Array.from({ length: width }, (_, x) => Math.sin(x / width * 2 * Math.PI));
  for (let row = 0; row < height; row++) {
    const latitude = Math.PI * (0.5 - row / height);
    const y = Math.sin(latitude);
    const latitudeRadius = Math.cos(latitude);
    for (let col = 0; col < width; col++) {
      const x = latitudeRadius * longitudeCos[col];
      const z = latitudeRadius * longitudeSin[col];
      const shade = 10 * Math.sin(11 * x + 6 * y) * Math.cos(7 * z - 5 * y) +
        6 * Math.sin(28 * z - 32 * y) * Math.cos(26 * x + 17 * y) +
        5 * Math.sin(91 * x + 113 * y + 81 * z);
      const index = (row * width + col) * 4;
      surface.data[index] = 102 + shade;
      surface.data[index + 1] = 99 + shade;
      surface.data[index + 2] = 94 + shade;
      surface.data[index + 3] = 255;
    }
  }
  ctx.putImageData(surface, 0, 0);

  const drawCrater = (x: number, y: number, radius: number, depth: number) => {
    for (const wrap of [-width, 0, width]) {
      const centerX = x + wrap;
      const gradient = ctx.createRadialGradient(centerX - radius * 0.16, y - radius * 0.13, 0, centerX, y, radius);
      gradient.addColorStop(0, `rgba(45, 39, 34, ${depth})`);
      gradient.addColorStop(0.72, `rgba(73, 66, 58, ${depth})`);
      gradient.addColorStop(0.88, 'rgba(173, 165, 149, 0.43)');
      gradient.addColorStop(1, 'rgba(173, 165, 149, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(centerX - radius, y - radius, radius * 2, radius * 2);
    }
  };

  let seed = 22259;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 205; i++) {
    drawCrater(random() * width, (0.04 + 0.92 * random()) * height, 2 + 31 * random() ** 4, 0.15 + 0.32 * random());
  }

  const occatorX = width * (0.5 - 121 / 360);
  const occatorY = height * (0.5 - 20 / 180);
  drawCrater(occatorX, occatorY, 17, 0.6);
  for (const [x, y, radius] of [[0, 0, 4.2], [6, 2, 2.6], [9, 0.5, 1.6], [5, 4, 1.1]]) {
    const deposit = ctx.createRadialGradient(occatorX + x, occatorY + y, 0, occatorX + x, occatorY + y, radius);
    deposit.addColorStop(0, '#fff5df');
    deposit.addColorStop(0.65, 'rgba(226, 215, 193, 0.88)');
    deposit.addColorStop(1, 'rgba(226, 215, 193, 0)');
    ctx.fillStyle = deposit;
    ctx.fillRect(occatorX + x - radius, occatorY + y - radius, 2 * radius, 2 * radius);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Europa's bright ice is crossed by dark, reddish lineae and broken terrain.
export function createEuropaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 768;
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const ice = ctx.createImageData(width, height);
  const longitudeCos = Array.from({ length: width }, (_, x) => Math.cos(x / width * 2 * Math.PI));
  const longitudeSin = Array.from({ length: width }, (_, x) => Math.sin(x / width * 2 * Math.PI));
  for (let row = 0; row < height; row++) {
    const latitude = Math.PI * (0.5 - row / height);
    const y = Math.sin(latitude);
    const surfaceRadius = Math.cos(latitude);
    for (let col = 0; col < width; col++) {
      const x = surfaceRadius * longitudeCos[col];
      const z = surfaceRadius * longitudeSin[col];
      const mottling = 6 * Math.sin(11 * x + 7 * y) * Math.sin(13 * z - 4 * y) +
        4 * Math.sin(34 * x - 19 * y + 28 * z) + 2 * Math.cos(119 * x - 93 * y + 71 * z);
      const disrupted = Math.max(0, Math.sin(5 * x - 6 * z + 3 * y) * Math.cos(3 * z - 8 * y)) ** 2;
      const index = (row * width + col) * 4;
      ice.data[index] = 223 + mottling - 31 * disrupted;
      ice.data[index + 1] = 217 + mottling - 47 * disrupted;
      ice.data[index + 2] = 202 + mottling - 54 * disrupted;
      ice.data[index + 3] = 255;
    }
  }
  ctx.putImageData(ice, 0, 0);

  let seed = 4118;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let index = 0; index < 88; index++) {
    const x = random() * width;
    const y = (0.16 + 0.68 * random()) * height;
    const length = 85 + 610 * random() ** 2.1;
    const slope = (random() - 0.5) * 0.82;
    const bend = (random() - 0.5) * 0.19 * height;
    const bandWidth = 0.6 + 4 * random() ** 2;
    const phase = random() * 2 * Math.PI;
    for (const wrap of [-width, 0, width]) {
      ctx.beginPath();
      for (let step = 0; step <= 48; step++) {
        const u = step / 48;
        const px = x + wrap + u * length;
        const py = y + u * slope * length + bend * Math.sin(Math.PI * u) +
          1.7 * Math.sin(10 * u + phase) + 0.7 * Math.cos(37 * u + phase);
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(151, 90, 56, 0.28)';
      ctx.lineWidth = bandWidth * 2.8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110, 62, 44, 0.58)';
      ctx.lineWidth = bandWidth;
      ctx.stroke();
      if (bandWidth > 2.5) {
        ctx.strokeStyle = 'rgba(235, 215, 184, 0.60)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Procedural 3D Billboard Planet Label Sprite
export function createPlanetLabelTexture(name: string, colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const text = name.toUpperCase();
  const font = 'bold 22px monospace, sans-serif';
  const x = 6;
  const y = 8;
  const h = 48;
  const r = 18;
  const textOffset = 36;
  const rightPadding = 14;
  ctx.font = font;
  const w = textOffset + Math.ceil(ctx.measureText(text).width) + rightPadding;
  canvas.width = w + x * 2;
  ctx.font = font;

  ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Color dot indicator
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(x + 19, y + h / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  // Planet Name
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + textOffset, y + h / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

