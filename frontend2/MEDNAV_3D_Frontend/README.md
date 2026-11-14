# MEDNAV — Interactive 3D Astronaut Health Dashboard

A Vite + React + **Three.js** frontend inspired by the provided MEDNAV concept image. It has a selectable human body with rotation, zoom, anatomy layers, selectable structures, per-structure information, crew switching and synthetic monitoring charts.

> **HACKATHON PROTOTYPE — NOT CLINICALLY VALIDATED.** All sample patient readings and inventory entries are simulated. The viewer is for visualization/education and must not be used for diagnosis or medical decisions. No watch, NASA service, hospital system or clinical API is connected.

## Prerequisites

- Node.js **20.19+** or **22.12+** ([official Node.js site](https://nodejs.org/))
- An up-to-date Chrome, Edge, Firefox or Safari with WebGL2
- Internet access to install dependencies and to download the optional detailed anatomy model

## Run (Windows)

1. Extract the zip.
2. Double-click `start-windows.bat` and allow the initial `npm install`.
3. Open **http://localhost:5173** if the browser does not open automatically.

## Run (Mac/Linux / VS Code terminal)

```bash
npm install
npm run dev
```

Navigate to **http://localhost:5173**.

## Production build

```bash
npm run build
npm run preview
```

Your static site output is in `dist/`.

## What is interactive?

- **3D rotation:** drag across the body (mouse or touch); the right-side camera icons zoom, reset and toggle auto-rotation.
- **Select a body part:** click a visible organ or bone. The `Selected Anatomy` panel shows the part name, anatomical system, educational description and any available simulated metric.
- **Layer presets:** `X-RAY`, `ORGANS`, `BONES`, `SKIN` change which anatomical systems are highlighted.
- **Quick targets:** Brain, Heart, Lungs, Liver and Kidney buttons select those structures from a list, especially useful on small screens.
- **Body model selector:** `M` and `F` choose the male/female reference anatomy.
- **Crew:** A01–A04 switch synthetic readings and associated panels.
- **Menu sections:** Crew, Investigation, Trends, Inventory, Reports, NASA Research and Settings have basic interactive example screens.
- **Reports:** exports synthetic crew data as a JSON file.

## 3D assets and offline fallback

The project uses plain Three.js with `GLTFLoader` and `MeshoptDecoder`. It attempts to load the models from the **open-anatomy-3d v0.1.0** CDN:

- `https://cdn.jsdelivr.net/npm/open-anatomy-3d@0.1.0/models/anatomy-male.glb`
- `https://cdn.jsdelivr.net/npm/open-anatomy-3d@0.1.0/models/anatomy-female.glb`

This model package has named meshes for approximately 140 anatomical structures, so clicking can resolve their names. The remote model requires internet access and CDN availability. **If loading fails, a working procedural, stylized 3D anatomy fallback is rendered** (the interface shows `SCHEMATIC MODEL`). This fallback is intentionally illustrative rather than medically precise.

To use models from the project itself instead of a CDN:

1. Download both `.glb` assets and save them as `public/models/anatomy-male.glb` and `public/models/anatomy-female.glb`.
2. In `src/anatomyScene.js`, change the URLs at the top to `/models/anatomy-male.glb` and `/models/anatomy-female.glb`.
3. Keep the required attribution displayed in your deployment and include `ATTRIBUTION.md`.

**Attribution is required for the detailed anatomy model.** See `ATTRIBUTION.md` for the source and license details.

## Project map

```text
MEDNAV_3D_Frontend/
├── index.html
├── package.json
├── vite.config.js
├── start-windows.bat
├── README.md
├── ATTRIBUTION.md
├── public/
│   ├── favicon.svg
│   └── models/             # Optional self-hosted GLBs
└── src/
    ├── main.jsx            # React entry
    ├── App.jsx             # Dashboard, crew, investigation, reports, controls
    ├── anatomyScene.js     # Three.js 3D scene, model loading, raycast selection
    ├── data.js             # Synthetic astronauts and body-part descriptions
    └── index.css           # MEDNAV dark holographic styling + responsive layout
```

## Connect to your existing MEDNAV FastAPI backend

Your backend route names and response contract were not supplied. The frontend therefore **does not guess or call backend endpoints**. Use the following integration approach after checking your actual FastAPI contract:

1. In `src/data.js`, replace the hardcoded `CREW` entries with data returned from your API and map response fields to the UI keys `heartRate`, `sleep`, `bp`, `spo2`, `temperature`, `coverage`, `symptom`.
2. Create a fetch function for your **real** endpoint, for example in `src/api.js`, using `fetch(import.meta.env.VITE_MEDNAV_API_BASE + yourConfirmedPath)`. Do not assume `/api/vitals` exists unless your backend defines it.
3. Add a `.env.local` containing `VITE_MEDNAV_API_BASE=http://localhost:8000` for local development.
4. Permit the Vite origin `http://localhost:5173` in your FastAPI CORS middleware, or configure a local dev-server proxy.
5. Define a verified mapping from your real sensor readings / symptom reports to specific structures. **Do not infer clinical conditions** from selected body parts.

When integrating a smartwatch, its measurements generally need a separate app or authorized data-service connection; a browser-based anatomy viewer alone cannot directly read every proprietary watch.

## License and credits

The **app UI code** in this generated project is available to customize for MEDNAV. The separately sourced `open-anatomy-3d` assets have attribution obligations under CC BY 4.0; see `ATTRIBUTION.md`. The concept image provided by the user is a visual design reference, not a photographic or clinical source.
