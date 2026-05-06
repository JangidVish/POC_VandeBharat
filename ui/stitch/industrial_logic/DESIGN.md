---
name: Industrial Logic
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45474c'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#1e1200'
  on-tertiary: '#ffffff'
  tertiary-container: '#35260c'
  on-tertiary-container: '#a38c6a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fadfb8'
  tertiary-fixed-dim: '#ddc39d'
  on-tertiary-fixed: '#271902'
  on-tertiary-fixed-variant: '#564427'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  code:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  panel-padding: 20px
---

## Brand & Style

This design system is built on the principles of **Modern Industrialism**. It prioritizes utility, precision, and structural integrity, moving away from the "softness" of consumer apps toward the "hardness" of engineering tools. The aesthetic is minimal and high-fidelity, evoking the feeling of a high-end laboratory instrument or an advanced aerospace control panel.

The target audience consists of machine learning engineers and data scientists who require a focused environment for complex workflows. The UI should evoke a sense of **calm authority** and **technical reliability**. By utilizing a restrained color palette and a rigorous layout, the design system ensures that the AI's output remains the primary focus.

The design style is **Corporate / Modern** with a lean toward **Minimalism**. It avoids all decorative flourishes, opting instead for functional ornamentation like alignment markers, hairline strokes, and modular containers.

## Colors

The palette is strictly controlled to maintain an "industrial workstation" feel. The primary focus is on a range of cool slates and blue-grays that reduce eye strain during long engineering sessions.

- **Backgrounds:** Use `#F8FAFC` for the primary canvas to provide a crisp, clean base. Use `#F1F5F9` for sidebars and secondary panels to create subtle structural differentiation.
- **Primary Action/Typography:** `#1E293B` (Slate 900) is used for high-contrast text and primary interactive states, ensuring maximum legibility.
- **Secondary Details:** `#64748B` (Slate 500) is reserved for metadata, icons, and non-critical labels.
- **Interaction States:** Hover states should utilize a slight darkening of the background or a subtle 1px border shift rather than color shifts.
- **No Gradients:** All colors must be applied as solid fills to maintain a mathematical, flat aesthetic.

## Typography

This design system utilizes **Inter** for its exceptional legibility and systematic character. The type scale is tight, favoring information density over large whitespace.

- **Headlines:** Keep headings purposeful and understated. Use Semi-Bold (`600`) to differentiate hierarchy without needing excessive size increases.
- **Mono-spacing:** While Inter is the primary font, numerical data and code blocks should ideally be rendered in a monospaced variant to emphasize the engineering nature of the workbench.
- **Labels:** Small caps with increased letter spacing should be used for section headers within panels to provide a clear "instrument cluster" feel.
- **Paragraphs:** Standardize on 14px for body text to maintain high information density while ensuring accessibility.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** logic for primary navigation and toolbars, with a **Fluid Content** area for the workbench canvas.

- **The 4px Rule:** All spacing increments must be multiples of 4px. This ensures a mathematical rhythm that reflects precision engineering.
- **Modular Panels:** The UI is composed of "docked" panels. Each panel should have a consistent internal padding of `20px`.
- **Pipeline Connectors:** In flow-based views, connectors should be 1px wide lines using `#CBD5E1`, with right-angle turns rather than curves to maintain the industrial aesthetic.
- **Information Density:** Elements should be tightly grouped by logic, using `8px` between related inputs and `24px` between distinct sections.

## Elevation & Depth

This design system rejects deep shadows and skeuomorphism in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Levels:** The base background is `#F8FAFC`. Elevated modules (cards, modals) use a white `#FFFFFF` background with a subtle `1px` border in `#E2E8F0`.
- **Shadows:** Use a single, highly-diffused "Ambient Shadow" for floating elements (modals, dropdowns): `0 4px 12px rgba(30, 41, 59, 0.05)`. Avoid shadows on standard dashboard cards.
- **Flat Depth:** Create depth by layering shades of gray rather than using shadows. A sidebar should be differentiated from the main content by its background color (`#F1F5F9`) and a solid right-hand border, not a shadow.

## Shapes

The shape language is "Soft-Mechanical." We use a very small border radius to take the "edge" off the UI while maintaining a professional, rigid structure.

- **Components:** Buttons, input fields, and small cards use a `4px` (0.25rem) radius.
- **Large Containers:** Main workbench panels or large layout sections use an `8px` (0.5rem) radius.
- **Interaction Elements:** Checkboxes should have a minimal `2px` radius to appear more like industrial toggles.
- **Strictness:** Avoid pill-shaped buttons; all buttons must be rectangular with the defined `4px` corner radius.

## Components

- **Industrial Buttons:** Use solid `#1E293B` for primary actions with white text. Secondary buttons use a white fill with a `1px` border of `#E2E8F0`. No gradients or rounded ends.
- **Modular Cards:** Cards should have a flat white background, a light border, and a header section with a `1px` bottom divider.
- **Input Fields:** Use a subtle background fill of `#F1F5F9` for inputs, moving to a white fill with a `1px` blue-gray border on focus.
- **Pipeline Connectors:** Use 1px paths to connect AI nodes. Active paths should be highlighted with a `2px` weight in the primary color, never neon or glowing.
- **Status Chips:** Chips should be rectangular with a `2px` radius. Use muted background fills with high-contrast text (e.g., light green background with dark green text) to signal status without being flashy.
- **Data Tables:** Use a header with a `#F1F5F9` background and no vertical borders between columns. Use hairline horizontal dividers.