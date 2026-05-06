# POC UI Refactor Progress

This document tracks the phase-wise progress of refactoring the VandeBharat POC UI to the new "Industrial Logic" design system. The goal is to move from the current basic React UI to a high-fidelity, modular, and professional engineering dashboard.

## Design Principles (Industrial Logic)
- **Utility & Precision**: Prioritize function over decorative flourishes.
- **Tonal Layers**: Use shades of gray and subtle borders instead of heavy shadows.
- **Restrained Palette**: Primary focus on Slates and Blue-Grays (#F8FAFC, #1E293B, #64748B).
- **Mathematical Rhythm**: 4px spacing rule.
- **Typography**: Inter (14px base) for high information density.

---

## Phase 1: Foundation & Infrastructure [Agents: 1]
- [x] **Tailwind Configuration**: Update `tailwind.config.js` with the "Industrial Logic" theme (colors, typography, spacing, border radius).
- [x] **Global CSS**: Update `src/index.css` with font imports (Inter, Material Symbols) and base layer resets.
- [x] **Component Library**: Create atomic components in `src/components/common/`:
    - [x] `Button`: Industrial rectangular buttons (Primary, Secondary, Outline).
    - [x] `Card`: Modular cards with headers and dividers.
    - [x] `StatusChip`: Rectangular chips for status signaling.
    - [x] `Input`/`Select`: Styled inputs with `#F1F5F9` background.
    - [x] `ProgressBar`: Thin, industrial progress bars.

## Phase 2: App Shell & Routing [Agents: 1]
- [x] **Layout Component**: Create `src/components/layout/AppShell.jsx`.
    - [x] `TopNavBar`: Fixed header with logo and navigation links.
    - [x] `WorkflowFooter`: Fixed footer with status and copyright.
- [x] **Routing Setup**: Implement basic view switching in `App.jsx` (Dashboard, Inspections, Analytics, etc.).

## Phase 3: Module 1 - Video Framing [Agents: 1]
- [x] **Page Component**: Create `src/pages/VideoFraming/`.
- [x] **Sidebar Controls**: Upload section, extraction parameters, and processing state.
- [x] **Main Workspace**: Frame grid with "img_XXX" cards and preview tooltips.
- [x] **Frame Detail**: Implementation of the side drawer for frame-specific metadata.

## Phase 4: Module 2 - Component & Defect Detection [Agents: 1]
- [x] **Page Component**: Create `src/pages/Detection/`.
- [x] **Detection Header**: Breadcrumbs and "AI Detection Ready" status.
- [x] **Controls Panel**: Input source summary and detection parameter controls (Confidence threshold, GPU status).
- [x] **Processing State**: Active processing progress bar with "frames processed" count.
- [x] **Results Gallery**: Grid of result cards with bounding box overlays (Corrosion, Nominal, etc.).
- [x] **Analysis Detail**: Side drawer for detailed entity list and metadata.

## Phase 5: Module 3 - Structured Inspection Output [Agents: 1]
- [x] **Page Component**: Create `src/pages/InspectionOutput/`.
- [x] **Summary Header**: KPI overview (Safety score, Total defects, Components).
- [x] **Data Table**: Defect log with filtering and export buttons.
- [x] **Visual Summary**: High-level severity distribution and component health charts.
- [x] **Final Action**: "Approve & Sync to Cloud" workflow.
- [x] **Detection Preview**: Bottom panel for visual verification of selected log entries.

## Phase 6: Integration & Polish [Agents: All]
- [x] **Mock Data Update**: Align `src/data/mockDetections.js` with the new module structures.
- [x] **State Management**: Ensure smooth transition between steps (data passing from Framing to Detection).
- [x] **Transitions**: Add Framer Motion (if available) or CSS transitions for module switching.
- [x] **Final QA**: Check responsiveness and dark mode support across all 3 modules.

---

## Parallel Development Context
Agents can work on Phase 3, 4, and 5 in parallel once Phase 1 and 2 are complete.
- **Phase 3 Agent**: Focus on video frame extraction UI and file upload simulation.
- **Phase 4 Agent**: Focus on AI bounding box rendering and result gallery.
- **Phase 5 Agent**: Focus on data tables, JSON visualization, and report generation.
