---
name: Clinical Warmth
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#444651'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#536439'
  on-secondary: '#ffffff'
  secondary-container: '#d3e7b1'
  on-secondary-container: '#57683d'
  tertiary: '#262b2e'
  on-tertiary: '#ffffff'
  tertiary-container: '#3c4144'
  on-tertiary-container: '#a8adb1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#d6eab4'
  secondary-fixed-dim: '#bace99'
  on-secondary-fixed: '#121f00'
  on-secondary-fixed-variant: '#3c4c24'
  tertiary-fixed: '#dfe3e7'
  tertiary-fixed-dim: '#c3c7cb'
  on-tertiary-fixed: '#171c1f'
  on-tertiary-fixed-variant: '#43474b'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  display:
    fontFamily: Public Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-lg:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 64px
---

## Brand & Style

This design system establishes a visual language centered on "Clinical Warmth." It bridges the gap between high-precision medical utility and high-end hospitality. The brand personality is authoritative yet empathetic, designed to instill immediate confidence in both elderly users and their professional caregivers.

The style is **Corporate / Modern**, characterized by generous whitespace, a structured grid, and a focus on legibility. It avoids the sterile coldness of traditional healthcare apps by utilizing a sophisticated, nature-inspired secondary palette and soft, organic elevation. The goal is to provide a "premium tech" experience that feels reliable, expensive, and profoundly safe.

## Colors

The color strategy prioritizes high-contrast accessibility (WCAG AAA) while maintaining a refined aesthetic. 

- **Primary (Deep Navy):** Used for primary actions, navigation headers, and core brand elements to signify stability and intelligence.
- **Secondary (Sage Green):** Applied to accents, progress indicators, and health-positive milestones. It provides a calming, natural counterpoint to the deep navy.
- **Neutrals (Slate):** A range of slate grays replaces pure blacks to reduce eye strain while maintaining sharp text definitions.
- **SOS Red:** Reserved exclusively for emergency triggers and critical health alerts. No other UI elements should use this hue to prevent "alert fatigue."
- **Backgrounds:** A mix of pure white surfaces and soft slate-tinted backgrounds creates clear content zoning.

## Typography

Public Sans was selected for its institutional clarity and exceptional legibility at large scales. This design system employs a "Scale+2" approach: the default body size is 18px (instead of the standard 16px) to accommodate aging eyes without appearing overly simplified.

Weight is used strategically to denote hierarchy. Headlines use Semi-Bold and Bold weights to anchor the page, while body text maintains a Regular weight with increased line-height (1.5x) to ensure maximum readability during long reading sessions or medical record reviews.

## Layout & Spacing

The design system utilizes a **Fixed Grid** model for desktop (1280px max-width) and a **Fluid Grid** for mobile devices. All layout decisions are based on an 8px base unit to ensure rhythmic consistency.

- **Grid:** A 12-column grid is used for dashboard layouts, with 24px outer margins and 16px gutters.
- **Touch Targets:** Minimum touch targets are strictly set to 48x48px, even for smaller icons, to support users with limited dexterity.
- **Negative Space:** Generous vertical padding is used between sections to prevent visual clutter and cognitive overload, which is critical for elder care interfaces.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and tonal layering. This design system avoids harsh borders in favor of soft, diffused shadows that lift interactive components off the page.

- **Surface 0 (Background):** Slate-50 (#f8fafc) for the main application canvas.
- **Surface 1 (Cards):** Pure White (#ffffff) with a 4% opacity navy shadow (12px blur). This is the primary container for content.
- **Surface 2 (Interactive):** Elements like buttons or active cards use a slightly deeper shadow (8% opacity) to signify clickability.
- **Overlays:** Modals and dropdowns use a 16% opacity shadow with a backdrop blur of 8px to maintain context while focusing user attention.

## Shapes

The shape language is defined by a consistent 12px corner radius across all primary containers and interactive elements. 

- **Standard Radius (12px):** Applied to cards, input fields, and primary buttons. This "gentle rounding" strikes a balance between professional geometry and approachable softness.
- **Large Radius (24px):** Used for decorative elements or containers that hold specifically "warm" content, such as profile summaries or community activity cards.
- **Pill Shapes:** Reserved for status tags (chips) and the SOS button to distinguish them from standard functional buttons.

## Components

### Buttons
- **Primary:** Deep Navy background, White text. High-contrast, bold weight.
- **Secondary:** Sage Green background, Deep Navy text. Used for "positive" actions like "Save" or "Complete."
- **SOS:** Bright Red (#b91c1c), large pill-shape, always includes a high-contrast icon (e.g., a bell or lifebuoy) and text.

### Inputs
- **Text Fields:** 12px rounded corners, 2px border on focus using Primary Navy. Labels are always visible above the field (never just placeholders) for accessibility.
- **Selection:** Large radio buttons and checkboxes (24x24px) with high-contrast active states.

### Cards
- The primary unit of information. All cards feature a subtle shadow and 12px rounding. Content within cards should follow a strict hierarchy: Header (Bold), Meta-data (Slate-500), and Action (Button or Link).

### Feedback & Indicators
- **Health Markers:** Use the Sage Green for healthy metrics and Primary Navy for neutral data. 
- **Empty States:** Use simplified, soft-colored slate illustrations to guide the user without causing frustration.