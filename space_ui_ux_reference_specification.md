# UI/UX Design Reference Specification: Aerospace & Orbital Telemetry Platform

## 1. Overview & Aesthetic Direction

* **Domain:** Aerospace, Orbital Telemetry, & Space Exploration Platform (Web & Mobile)

* **Core Vibe:** Cinematic, ultra-minimalist, authoritative, precision-engineered, and high-contrast dark mode.

* **Visual Philosophy:** Relies heavily on deep void-black negative space (`#000000`) paired with dramatic, photorealistic astronomical imagery (orbital Earth horizon with ISS, high-resolution lunar terminator, interactive 3D planetary spheres) that seamlessly fades into the dark canvas.

* **Editorial-Technical Fusion:** Combines an authoritative editorial serif for web hero headlines with clean, utilitarian geometric sans-serif typography for navigation, spaced-out planetary headers, body copy, and live telemetry metrics.

## 2. Color Palette & Surface Tokens

* **Canvas / Void Background:** `#000000` (Pure pitch black, allowing photographic shadows to blend seamlessly into the UI background)

* **Top Navigation Surface:** `#080808` / `#0A0A0A` (Near-black container with subtle bottom corner rounding `border-bottom-left-radius: 20px`, `border-bottom-right-radius: 20px` and faint ambient separation)

* **Primary Text:** `#FFFFFF` (Crisp pure white for headlines, active links, and telemetry values)

* **Secondary / Body Text:** `#A1A1AA` / `#B0B5BD` (Muted cool silver-gray for descriptive paragraphs)

* **Hairline Borders & Dividers:** `rgba(255, 255, 255, 0.25)` to `rgba(255, 255, 255, 0.6)` (Crisp `1px` structural lines for buttons and key-value telemetry rows)

* **Atmospheric Accent (Photographic):** Deep orbital cobalt/cyan glow (`#1E4D8C` to `#5B9BD5`) along the Earth's horizon line, balanced against warm metallic amber highlights on solar arrays.

## 3. Typography & Hierarchy

* **Hero Display Headline (Web Landing View):**

  * **Style:** Classical / Editorial Serif (e.g., `Playfair Display`, `Newsreader`, or `Libre Baskerville`), Regular/Medium weight.

  * **Scale & Leading:** `44px–56px`, tight line-height (`1.12`), left-aligned, constrained to \~45–50% viewport width (`max-width: 580px`).

  * **Example:** *"Infinite Precision. Seamless Experiences. The New Standard of Space UI."*

* **Section & Mobile Display Headlines:**

  * **Style:** Bold Geometric Sans-Serif (e.g., `Inter`, `Plus Jakarta Sans`, or `SF Pro Display`), Bold (`700`).

  * **Web Scale:** `32px–38px`, left-aligned, tight tracking (`-0.02em`).

  * **Mobile Onboarding Scale:** `32px–36px`, center-aligned, tight vertical stacking across 3–4 lines (`"Claim Your Destiny Among the Stars on the Red Planet"`).

* **Wide-Tracked Planetary / Micro Headers:**

  * **Style:** Geometric Sans-Serif, Medium (`500`), ultra-wide letter-spacing (`0.35em–0.5em`), centered (e.g., `M A R S`, `C o n f i g u r e   M a r s   i n   3 6 0 °`).

* **Body / Lead Copy:**

  * **Style:** Clean Sans-Serif, Regular (`400`), `14px–16px`, relaxed line-height (`1.5`).

* **Telemetry & Tabular Data:**

  * **Style:** Sans-Serif, Medium (`500`) to Bold (`700`), `14px–16px`, crisp white (`#FFFFFF`), supporting inline superscript units (e.g., $\text{m/s}^2$).

## 4. Layout & Component Architecture (Desktop / Web)

### A. Global Top Navigation Bar

* **Structure:** Full-width horizontal bar anchored at the top with rounded bottom corners (`20px`) and generous vertical padding (`24px 48px`).

* **Distribution:** Evenly spaced horizontal flex layout (`justify-content: space-between`, `align-items: center`) across 5 primary items:

  1. `Home` (Active state: slightly larger/brighter white `16px–18px`)

  2. `Telemetry`

  3. `Orbital Path`

  4. `Satellite Data`

  5. `Upcoming Missions` (Styled as a subtle outlined rectangular pill/button: `1px solid rgba(255,255,255,0.4)`, `border-radius: 6px`, `padding: 8px 18px`, `font-size: 13px`).

### B. Web Hero Landing View

* **Background Composition:** Full-bleed dark space photograph featuring Earth's curved atmospheric horizon sweeping diagonally across the middle-right and a detailed satellite/space station silhouette in the lower-right foreground. Left side fades cleanly into pure `#000000`.

* **Left Content Column (`padding-left: 8%`):**

  1. **Editorial Serif Headline:** 3-line stacked statement.

  2. **Supporting Subtitle:** 2-line concise value proposition separated by `24px` vertical margin.

  3. **Primary Outlined CTA Button:** Wide rectangular ghost button (`width: 340px–380px`, `height: 52px`, `border-radius: 8px`, `1px` translucent border) with centered label `"Explore Now"` and a northeast diagonal arrow (`↗`).

### C. Web Mission Telemetry & Lunar Detail View

* **Background Composition:** Pitch black (`#000000`) canvas with a high-contrast 3D lunar sphere cropped along the right edge (`right: -5%`).

* **Left Content Column (`width: ~45%`, `padding-left: 8%`):**

  1. **Bold Sans-Serif Title:** Single-line strong header (`"Lunar Base Alpha: The Next Frontier."`).

  2. **Mission Summary Paragraph:** 3-line description below the header (`margin-top: 24px`).

  3. **Key-Value Telemetry Data List (`margin-top: 64px`):** Stacked vertical list of 3 telemetry rows separated by clean horizontal hairline dividers (`1px` solid, `padding: 20px 0`), pairing left-aligned labels (`Current Phase:`, `Next Full Moon:`, `Illumination:`) with right-aligned values (`Waxing Gibbous`, `4 Days`, `84%`).

## 5. Layout & Component Architecture (Mobile Portrait Views)

### A. Full-Bleed Immersive Onboarding Screen (`image_3d7068.jpg`)

* **Background Composition:** Full-screen vertical starfield with a dramatic, oversized planetary horizon filling the center-right and bottom-right of the portrait viewport, creating an atmospheric rim-light arc behind the typography.

* **Centered Overlay Stack:**

  1. **Hero Display Title (Upper-Middle):** Bold, center-aligned 4-line headline (`"Claim Your Destiny Among the Stars on the Red Planet"`) overlaid directly across the upper planetary limb.

  2. **Supporting Tagline (Center):** Centered 2-line subtitle (`"225 Million Kilometers away, yet feels like home"`) positioned in the middle of the planetary surface.

  3. **Slide-to-Action Pill CTA (Bottom Anchor):**

     * Full-width rounded pill track (`border-radius: 9999px`, `height: 56px`, frosted/translucent glass fill with a subtle `1px` rim highlight).

     * Left/Center label: `"Start Your Journey"` in medium-bold white text.

     * Right-aligned interactive thumb/knob: Elevated pill-shaped button (`border-radius: 9999px`) housing a diagonal spacecraft/shuttle icon, designed for swipe-to-unlock or tap-to-launch interaction.

### B. Interactive 3D Planetary Configurator & Bottom Sheet (`image_3d6dbe.jpg`)

* **Top Header:** Minimalist wide-tracked planetary title centered at the top (`M A R S`).

* **Interactive 3D Viewport (Upper Half):**

  * Centered, standalone 3D planetary globe floating in deep space with realistic day/night terminator shadowing.

  * **360° Gesture Affordance Overlay:** Centered horizontally over the planet's equator:

    * Wide-tracked micro-label: `C o n f i g u r e   M a r s   i n   3 6 0 °`

    * Direct-manipulation slider/scrub indicator directly beneath: A horizontal hairline track terminated by a crisp diamond node (`—◆`), signaling horizontal drag-to-rotate interactivity.

* **Frosted Glass Telemetry & Selector Bottom Sheet (Lower Half):**

  * **Container:** Rounded top corners (`border-top-left-radius: 28px`, `border-top-right-radius: 28px`), dark frosted glass background (`backdrop-filter: blur(20px)`) with a subtle `1px` top border highlight overlapping the bottom edge of the 3D planet.

  * **Vertical Telemetry Spec List:** Clean, generous vertical spacing (`gap: 24px`), left-aligned inline `Label: Value` rows:

    * `Distance: 225M km`

    * `Travel Time: 210 Days`

    * `Gravity: 3.72 m/s²` (utilizing proper superscript exponent formatting)

  * **Landing Zone Selector Footer:**

    * Centered section prompt: `"Select Your Landing Zone"`

    * **Segmented Pill Selector / Launch Bar:** Full-width rounded pill container (`border-radius: 9999px`, `height: 54px`) split into two interactive zones:

      * **Left Active Selection Pill (~65% width):** Elevated inner pill (`border-radius: 9999px`) displaying the active destination (`Jezero Crater`) in dark high-contrast text, acting as a dropdown/selector trigger.

      * **Right Action Trigger (~35% width):** Integrated right-hand track housing a circular outlined rocket/shuttle launch icon button on the far right edge to confirm and initiate mission launch.

## 6. UX & Interaction Guidelines for Implementation

* **Asymmetric Negative Space (Desktop):** Keep web headlines and data tables anchored to the left 45–50% column while reserving the right 50% for astronomical visuals.

* **Centered Overlay & Bottom-Sheet Ergonomics (Mobile):** On portrait screens, center-align hero onboarding copy over the planetary curve and anchor interactive controls, telemetry specs, and destination selectors in the lower thumb-friendly zone using rounded glassmorphic sheets (`border-radius: 28px`) and pill controls (`border-radius: 9999px`).

* **Tactile Gesture Affordances:** Use horizontal scrub tracks with diamond indicators (`—◆`) for 3D model rotation and dual-state pill tracks with shuttle icons for high-commitment actions (launching/starting a mission).

* **Seamless Photographic Blending:** Ensure all background celestial assets fade cleanly into `#000000` at their edges so there are never hard rectangular image boundaries against the viewport.