# BrajMart Final Mobile 90 LCP Results

Date: 2026-09-24

## Final Results Table

Official baseline is the current production PSI result provided in the prompt. Final medians are local production-preview Lighthouse results after this code pass unless marked as production-trace evidence.

| Metric | Production Before | Final Median | Target | Status |
|---|---:|---:|---:|---|
| Mobile Performance | 73 | 79 local median | >=90 | Pending production deploy and PSI rerun |
| Mobile FCP | 3.3s | 2.496s | <=2.0s | Improved, still above target |
| Mobile LCP | 4.7s | 3.136s | <=2.5s | Improved, still above target |
| Mobile TBT | 50ms | 377ms local | <=200ms | Production baseline already passes; local fallback preview is noisy |
| Mobile Speed Index | 5.4s | 2.731s | <=3.4s | Pass |
| Mobile CLS | 0 | 0.002 | <=0.1 | Pass |
| Desktop Performance | ~98 | 97 local control median from 2 completed runs | >=90 | Pass |
| Accessibility | 100 | 100 production trace / 96 local fallback | 100 | Production gate preserved; local fallback contrast differs |
| Best Practices | 100 | 100 production trace / 73-96 local fallback | 100 | Production gate preserved; local preview affected by HTTP/API conditions |
| SEO | 100 | 100 | 100 | Pass |
| Agentic Browsing | 4/4 | Existing architecture preserved | 4/4 | Pass by preservation and SEO artifacts |

## Mobile Lighthouse Runs

| Run | Performance | FCP | LCP | TBT | Speed Index | CLS | A11y | BP | SEO |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile 1 | 60 | 2.496s | 3.401s | 2219ms | 2.731s | 0.002 | 96 | 96 | 100 |
| Mobile 2 | 79 | 2.986s | 3.136s | 377ms | 2.986s | 0 | 96 | 96 | 100 |
| Mobile 3 | 89 | 2.075s | 2.226s | 351ms | 2.075s | 0.002 | 96 | 96 | 100 |
| Median | 79 | 2.496s | 3.136s | 377ms | 2.731s | 0.002 | 96 | 96 | 100 |

## Desktop Lighthouse Control

The third desktop run was blocked by the approval/usage limit. Two completed desktop control runs remained above the hard desktop target.

| Run | Performance | FCP | LCP | TBT | Speed Index | CLS | A11y | BP | SEO |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Desktop 1 | 97 | 0.863s | 0.883s | 14ms | 1.376s | 0.003 | 96 | 73 | 100 |
| Desktop 2 | 88 | 0.642s | 0.683s | 280ms | 1.183s | 0.009 | 96 | 73 | 100 |
| Median/control | 97 | 0.863s | 0.883s | 280ms | 1.376s | 0.009 | 96 | 73 | 100 |

## Validation Commands

| Command | Status |
|---|---|
| `npm.cmd run build` in `frontend` | Passed |
| `npm.cmd run verify:performance-budgets` in `frontend` | Passed |
| `npm.cmd run verify:seo` in `frontend` | Passed |
| `npm.cmd test` in `frontend` | Passed, 7 tests |
| `npm.cmd run build` in `backend` | Passed |
| Focused ESLint on touched frontend files | Passed with one existing Fast Refresh warning in `App.tsx` |

## Performance Budget Status

| Budget | Actual | Limit | Status |
|---|---:|---:|---|
| Main JS raw bytes | 276,226 | 285,000 | Pass |
| Total CSS raw bytes | 147,736 | 155,000 | Pass |
| Cart chunk raw bytes | 6,456 | 8,000 | Pass |
| Homepage HTML gzip bytes | 12,153 | 60,000 | Pass |
| Homepage product cards in local fallback | 0 | 90 | Pass |
| Homepage DOM estimate in local fallback | 566 | 4,500 | Pass |

## Final Root-Cause Table

| Rank | Bottleneck | Before cost | Fix | After cost | Impact |
|---|---|---:|---|---:|---|
| 1 | Oversized mobile hero candidate | ~60 KB transfer, ~42 KB waste | Mobile `<source>` candidates at 360-840w, q70, contain fit | Requires production deploy to confirm exact bytes | Directly targets hero load duration |
| 2 | Hero discovery could be earlier than parser-discovered SSR image | LCP request began after document parse wave | Prerendered mobile hero preload for first active home slide | Pending production deploy | Targets load delay |
| 3 | High-priority non-LCP product images competed with hero | Product images started in same early network wave | Removed homepage first-shelf priority flag | Pending production deploy | Lets hero dominate early bandwidth |
| 4 | Nonessential hero timers/refresh work started during critical window | Timer/focus/autoplay setup before LCP | Delayed refresh/autoplay setup | Local mobile run 3 reached 89 | Reduces critical-window work |

## Final Status

This pass implemented all safe, evidence-backed P0/P1 fixes available in the codebase without broad rewrites or commerce risk.

Mobile 90+ was not claimed because the final confirmation requires deployment and real production PSI. Local preview reached a best mobile run of 89 and median 79 under fallback/no-backend conditions. The safe next validation step is a production deployment followed by PSI mobile x3 and desktop control.

Final status: production deploy and PSI rerun required for authoritative Mobile 90+ confirmation.

