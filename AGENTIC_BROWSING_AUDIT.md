# BrajMart Agentic Browsing Audit

Date: 2026-09-24

## Starting Result

Production Lighthouse 13.5.0 reproduced Agentic Browsing at 2/3.

Passing:

- Accessibility tree was well-formed.
- CLS passed.

Failing:

- `llms-txt`: "File does not appear to contain any links."

## Root Cause

The generated `llms.txt` contained headings and URL text, but Lighthouse did not recognize the URL format as links for the Agentic Browsing audit.

Local Vite preview also exposed an invalid ARD result because `/.well-known/ai-catalog.json` fell through to `index.html`. Lighthouse then attempted to parse HTML as JSON.

## Changes

- Updated `scripts/generate-llms.mjs` to emit explicit Markdown links.
- Regenerated `public/llms.txt`.
- Added `public/.well-known/ai-catalog.json` using Lighthouse's ARD 1.0 schema.
- Added `<link rel="ai-catalog" type="application/ai-catalog+json" href="/.well-known/ai-catalog.json">`.
- Fixed footer home-link accessible name.
- Improved repeated product-card control names.

## Final Local Verification

Focused local Lighthouse gates:

| Audit | Result |
|---|---:|
| Agentic Browsing | 100 |
| Accessibility tree | Pass |
| `llms.txt` | Pass |
| `ai-catalog.json` schema | Pass |
| CLS | Pass |

## Production Expectation

After deployment, production should move from Agentic Browsing 2/3 to 3/3 if Vercel serves:

- `/llms.txt`
- `/.well-known/ai-catalog.json`
- homepage `<link rel="ai-catalog">`

No fake ARIA, bot-policy weakening, crawler cloaking, or Lighthouse detection was added.

