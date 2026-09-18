# Feltbogen — offline design package

Claude Code / implementers: **do not open Superdesign**. Network policy may block `superdesign.dev`.

Use the HTML files in this folder as visual + structural reference together with Notion handoffs.

## How to implement a screen
1. Open the matching Notion handoff (index linked from project UI docs / ask Emil).
2. Open the HTML file listed below for that screen.
3. Match tokens in `TOKENS.md`.
4. Implement **only that screen**; one filled primary per viewport; cream text on accent.

## Layout
```
docs/design/
  README.md          ← this file
  TOKENS.md          ← locked design tokens + CTA rules
  system/
    design-system.html
  desktop/
    01-hjem.html … 12-sheet-tilfoej-grej.html
  mobile/
    01-hjem.html … 08-sheet-tilfoej-grej.html
```

## Desktop map
| Screen | File |
| --- | --- |
| Design system | `system/design-system.html` |
| Hjem | `desktop/01-hjem.html` |
| Ture | `desktop/02-ture.html` |
| Tur-detalje | `desktop/03-tur-detalje.html` |
| Pakning | `desktop/04-pakning.html` |
| Grej | `desktop/05-grej.html` |
| Grejsæt | `desktop/06-grejsaet.html` |
| Folk | `desktop/07-folk.html` |
| Mere | `desktop/08-mere.html` |
| Steder & Statistik | `desktop/09-steder-statistik.html` |
| Indstillinger | `desktop/10-indstillinger.html` |
| Sheet — Ny tur | `desktop/11-sheet-ny-tur.html` |
| Sheet — Tilføj grej | `desktop/12-sheet-tilfoej-grej.html` |

## Mobile map
| Screen | File |
| --- | --- |
| Hjem | `mobile/01-hjem.html` |
| Ture | `mobile/02-ture.html` |
| Grej | `mobile/03-grej.html` |
| Folk | `mobile/04-folk.html` |
| Mere | `mobile/05-mere.html` |
| Pakning | `mobile/06-pakning.html` |
| Sheet — Ny tur | `mobile/07-sheet-ny-tur.html` |
| Sheet — Tilføj grej | `mobile/08-sheet-tilfoej-grej.html` |

## Notes
- HTML is Tailwind + iconify reference UI (design drafts), not production code to copy blindly.
- Prefer matching hierarchy, tokens, and CTA rules over pixel-perfect class names.
- Notion handoffs remain the acceptance checklist; HTML is the visual reference when Superdesign is unreachable.
