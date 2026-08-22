# AstroSim: Sun-Earth-Moon Dynamics & Multi-Stage Rocket Trajectory Simulator

> **Interactive 3D Astrodynamics, Rocket Launch Dynamics, and Earth-to-Moon Trajectory Optimization Web Application** built with **React**, **Three.js / WebGL**, **TypeScript**, and **Tailwind CSS**. Optimized for seamless deployment on **Vercel** and **GitHub Pages**.

---

## 🚀 Key Simulation Capabilities

### 1. 🪐 Sun-Earth-Moon Celestial Dynamics
- **High-Fidelity 3D Physics**:
  - Realistic Keplerian orbital propagation with true planetary eccentricities, orbital periods, and axial tilts ($23.44^\circ$ Earth obliquity, $5.145^\circ$ Moon ecliptic inclination with $18.6$-year nodal precession cycle).
  - Procedurally generated high-resolution planetary textures (Earth continents, oceans, ice caps, cloud atmosphere; Moon maria & impact craters; Sun convective plasma & sunspots) running 100% offline with zero CDN dependencies.
- **Multiple Coordinate Reference Frames**:
  - **Heliocentric**: Sun-centered solar system orbit overview.
  - **Geocentric**: Earth-centered cislunar dynamics view.
  - **Barycentric**: Earth-Moon barycenter rotating synodic frame.
- **Astrodynamics Visual Overlays**:
  - **Earth-Moon Lagrange Equilibrium Points ($L_1, L_2, L_3, L_4, L_5$)** with stability indicators and cislunar gateway markers.
  - Keplerian orbit trail ribbons, Moon's Laplace Sphere of Influence (SOI $\approx 66,100\text{ km}$), atmospheric Rayleigh glow, day/night terminator lines, and solar/lunar eclipse alignments.
- **Time Warp Controls**:
  - Real-time to $10,000\times$ time acceleration with mission elapsed epoch scrubber.

---

### 2. 🚀 Multi-Stage Rocket Launch Ascent Simulator
- **Atmospheric & Flight Dynamics Engine**:
  - **US Standard Atmosphere 1976 model**: Barometric density $\rho(h) = \rho_0 e^{-h/H}$, speed of sound $a(h) = \sqrt{\gamma R T}$, ambient pressure, and temperature.
  - **Mach-Dependent Aerodynamics**: Wave drag coefficient $C_d(M)$ with transonic rise and dynamic pressure calculation $q = \frac{1}{2}\rho v^2$ with **Max Q** tracking.
  - **Variable Mass & Staging**: Sequential burn cycles, Tsiolkovsky $\Delta v = I_{sp} g_0 \ln(m_0/m_f)$, automatic/manual MECO, spent stage separation, fairing jettison, and SECO circularization into Low Earth Orbit (LEO).
  - **Gravity Turn Pitch Guidance**: Automated vertical lift-off $\rightarrow$ pitch-over kick $\rightarrow$ zero-AoA gravity turn $\rightarrow$ vacuum orbital injection.
- **Authentic Multi-Stage Rocket Presets**:
  - **Saturn V** (Apollo lunar stack: S-IC, S-II, S-IVB)
  - **Space Launch System (SLS Block 1 - Artemis)** (Solid Boosters + RS-25 Core + ICPS)
  - **Falcon Heavy** (Expendable 3-Core Booster + Vacuum Upper Stage)
  - **Starship / Super Heavy** (33-Raptor Booster + Starship Lunar Lander)
- **Mission Control Flight Telemetry HUD**:
  - Live readout of Altitude, Downrange Distance, Inertial Velocity, Earth-Relative Velocity, Mach Number, Dynamic Pressure ($q$), G-Load, Thrust-to-Weight Ratio (TWR), Stage Propellant remaining, Apoapsis / Periapsis, and Expended vs. Budgeted $\Delta v$.

---

### 3. 🗺️ Earth-to-Moon Trajectory Optimization & Spaceports
- **Worldwide Spaceport Selection**:
  - **Guiana Space Centre / Kourou ($5.2^\circ\text{ N}$)**: $+463\text{ m/s}$ maximum Earth rotation velocity boost.
  - **Kennedy Space Center / Cape Canaveral ($28.5^\circ\text{ N}$)**: Natural alignment with Moon maximum northern declination.
  - **Baikonur Cosmodrome ($45.9^\circ\text{ N}$)**: Historic launch site with high-latitude plane change dynamics.
  - **Tanegashima Space Center ($30.4^\circ\text{ N}$)**: Pacific ocean launch corridor.
  - **Satish Dhawan Space Centre / Sriharikota ($13.7^\circ\text{ N}$)**: $+452\text{ m/s}$ equatorial boost.
  - **Mahia Launch Complex ($39.2^\circ\text{ S}$)**: Southern hemisphere cislunar orbital range.
  - **Vandenberg Space Force Base ($34.7^\circ\text{ N}$)**: Polar & retrograde launch corridors.
- **Orbital Transfer Solvers**:
  - **Direct Lunar Orbit Insertion (LOI)**: Trans-Lunar Injection ($\Delta v_{\text{TLI}} \approx 3,140\text{ m/s}$) into Low Lunar Orbit ($\Delta v_{\text{LOI}} \approx 820\text{ m/s}$).
  - **Apollo-Style Free Return Trajectory**: Figure-8 gravity assist looping behind the Moon that safely returns to Earth atmosphere without additional burns.
  - **Lunar Flyby / Slingshot**: Hyperbolic gravity assist into deep space.
  - **Spaceport Latitude & Azimuth Calculation**: Evaluates equatorial rotation speed $v_{\text{rot}} = \omega_\oplus R_\oplus \cos(\text{lat})$ and plane change penalty $\Delta v = 2 v \sin(\Delta i / 2)$.
  - **Interactive Trajectory Scrubber & Porkchop Analysis**: Trade-off visualization between Time of Flight (48h to 120h) and $\Delta v$ expenditure.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Framework**: React 19 + TypeScript + Vite
- **3D Graphics**: Three.js (WebGL with Logarithmic Depth Buffer)
- **Styling**: Tailwind CSS v4 + Aerospace Mission Control Glassmorphism
- **Icons**: Lucide React
- **Physics Engine**: Custom TypeScript Astrodynamics & Runge-Kutta 4th Order (RK4) Solvers

---

## 📦 Getting Started Locally

```bash
# Clone the repository
git clone https://github.com/your-username/orbital-dynamics-app.git
cd orbital-dynamics-app

# Install dependencies
npm install

# Start the local development server
npm run dev

# Build for production (Vercel / GitHub Pages)
npm run build
```

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Framework Preset: **Vite**
5. Root Directory: `./` (or `orbital-dynamics-app`)
6. Build Command: `npm run build`
7. Output Directory: `dist`
8. Click **Deploy**!

---

## 📄 License
MIT License
