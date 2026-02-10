# Smart.pr Helper - Design System

## 🎨 Color Palette

### AI-Inspired Gradients

**Warm Gradient** (Main Actions)
```
Golden Yellow → Soft Apricot → Light Peach → Pale Pink → Gentle Lavender → Light Violet
#FFD580 → #FFBC7F → #FFB4A0 → #FFB0C0 → #E8B5E8 → #D4A5F5
```

**Cool Gradient** (Active States)
```
Lavender → Light Violet → Deeper Violet
#E8B5E8 → #D4A5F5 → #C8A8F8
```

### Text Colors
- **Primary**: `#2D1B4E` - Deep purple for main content
- **Secondary**: `#6B5B8C` - Medium purple for descriptions
- **Muted**: `#9B8FB8` - Light purple for labels

## 🎭 Component Styles

### Floating Icon
- **Size**: 60×60px circular button
- **Default**: Warm gradient with white sparkle ✨
- **Hover**: Scales 1.1x, lifts up 2px, brightness boost
- **Open**: Cool gradient with gentle pulse animation
- **Position**: Bottom-right (100px from bottom, 24px from right)

### Sidebar Panel
- **Width**: 400px
- **Background**: Vertical gradient from warm cream to cool lavender
- **Header**: Gradient text title with bouncy close button
- **Shadow**: Soft lavender glow
- **Backdrop**: Blur effect for glass-morphism

### Buttons
- **Primary**: Warm gradient with shimmer effect on hover
- **Secondary**: Glass-morphic white with lavender borders
- **Hover**: Lift up 2px with enhanced shadow
- **Border Radius**: 16px for modern, friendly feel

### Suggestion Cards
- **Background**: Semi-transparent white with backdrop blur
- **Border**: 2px solid lavender (40% opacity)
- **Hover**: Border turns apricot, card lifts up
- **Copy Button**: Cool gradient with bounce animation

### Nudge Bubble
- **Background**: Glass-morphic white with subtle gradient
- **Border**: Lavender with glow effect
- **Icon**: Sparkle ✨ with drop shadow
- **Hover**: Scales 1.02x, lifts up 3px

### Loading Spinner
- **Style**: Multi-color gradient ring
- **Colors**: Rotates through all palette colors
- **Animation**: Bouncy cubic-bezier timing

## ✨ Animations

### Entrance Effects
- **Icon**: Fade in + scale + slight rotation (0.5s)
- **Sidebar**: Slide in from right (0.4s)
- **Nudge**: Slide down + scale (0.4s)
- **Toast**: Slide up from bottom (0.4s)

### Hover States
- **Buttons**: Shimmer sweep effect
- **Cards**: Transform translateY(-2px)
- **Icon**: Scale(1.1) + translateY(-2px)
- **Close Button**: Rotate 90deg + scale(1.1)

### Continuous Animations
- **Icon (open)**: Gentle brightness pulse (2s)
- **Empty State Icon**: Floating effect (3s)
- **Badge**: Scale pulse (2s)

## 🎯 Design Principles

1. **Warm & Welcoming**: Pastel gradients create friendly, approachable feel
2. **AI-Enhanced**: Smooth gradients suggest intelligent, modern technology
3. **Playful Motion**: Bouncy animations feel alive and responsive
4. **Glass Morphism**: Backdrop blur adds depth and sophistication
5. **High Contrast Text**: Dark purple text ensures readability
6. **Generous Spacing**: 16-24px padding creates breathing room
7. **Rounded Everything**: 16-18px border radius for softness

## 🌈 Gradient Usage Guide

**Use Warm Gradient for:**
- Primary action buttons
- Main floating icon
- Toast notifications
- Active/engaged states

**Use Cool Gradient for:**
- Copy buttons
- Icon when sidebar is open
- Secondary highlights

**Use Gradient Backgrounds for:**
- Sidebar panel (vertical)
- Header section (subtle)
- Current subject display
- Suggestion cards (minimal)

## 📐 Spacing Scale

- **XS**: 8px
- **SM**: 12px
- **MD**: 16px
- **LG**: 20px
- **XL**: 24px
- **2XL**: 32px
- **3XL**: 48px

## 🔤 Typography

- **Font Family**: System UI fonts (-apple-system, SF Pro, Segoe UI)
- **Title**: 20px, weight 700
- **Body**: 15px, weight 500
- **Label**: 12px, weight 600, uppercase, 1px letter-spacing
- **Button**: 15px, weight 600

## 🎪 Special Effects

### Shimmer Effect
Buttons have a sweep animation on hover that creates a light shimmer moving left to right.

### Drop Shadows
- Icons use `filter: drop-shadow()` for better edge definition
- Components use `box-shadow` with color-matched shadows
- Glow effects use the gradient colors at low opacity

### Backdrop Blur
Glass-morphic elements use `backdrop-filter: blur(10-20px)` for depth.

## 🎨 Implementation Notes

All gradients are defined as CSS custom properties in `:root` for easy maintenance and consistency across components.

The design avoids harsh edges, sharp contrasts, and geometric severity - everything feels soft, approachable, and alive.
