# UI Rules

## Design Law

V1 is the source of truth for all visual decisions. No exceptions.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | #0d0907 | Body, main area |
| Card BG | rgba(255,255,255,0.04) | Cards, panels |
| Card Border | rgba(255,255,255,0.08) | Default borders |
| Card Hover Border | rgba(255,255,255,0.15) | Hover state |
| Text Primary | #ffffff / #f5f5f7 | Headings |
| Text Secondary | rgba(255,255,255,0.55) | Body text |
| Text Muted | rgba(255,255,255,0.35) | Metadata |
| Text Dim | rgba(255,255,255,0.22) | Placeholders |
| Accent Blue | #2AABFF | Primary accent, Sean |
| Orange | #ff9f0a | Lacey, warnings |
| Red | #ff453a | Errors, kill switch |
| Pink | #ff375f | Muse |
| Purple | #5e5ce6 | Scrappy |
| Cyan | #64d2ff | Overseer |
| Yellow | #ffd60a | Sam |
| Green | #2AABFF | Success states |

## Typography

| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| Hero heading | Instrument Serif | 52px | 400 | italic |
| Section heading | Instrument Serif | 22-28px | 400 | italic |
| Body | Inter / -apple-system | 12-13px | 400-500 | normal |
| Label / Meta | Geist Mono | 9-10px | 600-700 | uppercase, letter-spacing: 2-3px |
| Nav item | Inter | 12px | 400/500 | normal |

## Spacing

- Page padding: 48px 52px (desktop), 24px 16px (mobile)
- Section margin: 44px bottom
- Card padding: 14-18px
- Card gap: 12-14px
- Card border-radius: 14-16px

## Animations

| Name | Duration | Usage |
|------|----------|-------|
| fadeIn | 0.4s | Page transitions |
| slideIn | 0.2-0.3s | Cards, toasts |
| livePulse | 1-2.5s | Agent status dots |

## Inline Styles

Most V1 styling is inline React styles. This is intentional — do NOT convert to CSS classes unless extracting to a separate file. Inline styles keep components self-contained.

## Mobile

- Breakpoint: 768px
- Sidebar becomes bottom tab bar on mobile
- Cards stack to single column
- Inputs get 16px font-size (prevents iOS zoom)
