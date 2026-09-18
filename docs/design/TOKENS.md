# Feltbogen Design Tokens (LOCKED · 9. sep 2026)

Source of truth also in Notion. Do not invent new colors.

| Token | Hex | Use |
| --- | --- | --- |
| `--bg` | `#F9F5EB` | Page background |
| `--surface` | `#DBE0D5` | Muted surface / utility |
| `--surface-tint` | `#E5EEE6` / `#E8F3EE` | Selected pill, badge |
| `--text` | `#24362C` | Primary text |
| `--text-muted` | `#536055` | Secondary text |
| `--accent` | `#315C45` | Primary CTA / active |
| `--accent-text` | `#F9F5EB` | Text on accent (cream, not `#fff`) |
| `--accent-border` | `#A8BFAD` | Outline / borders |
| `--warning` | `#A06000` / `#FFF4E0` | Warnings |
| `--danger` | `#A02020` | Errors / destructive |

**Typography:** Fraunces (display) · Inter (UI/body)
**Radius:** primary button 10px · cards 10–16px · utility 2px

## CTA rules
- Max **one** filled primary (`#315C45` + cream text) per viewport
- Outline/secondary for next priority; ghost/text for the rest
- Create sheets: **no** create on open; Cancel + disabled Opret until valid name/title
- Naming: **Afsluttet** (not “arkiveret”); honest sync status
