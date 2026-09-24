# BrajMart Mobile 90+ Final Results

Date: 2026-09-24

## Mobile Production Baseline Runs

| Metric | Run 1 | Run 2 | Run 3 | Median |
|---|---:|---:|---:|---:|
| Performance | 35 | 43 | 49 | 43 |
| FCP | 4.3 s | 3.8 s | 2.6 s | 3.76 s |
| LCP | 6.3 s | 6.0 s | 4.9 s | 6.04 s |
| TBT | 1,800 ms | 970 ms | 2,360 ms | 1,799 ms |
| Speed Index | 7.2 s | 6.8 s | 3.6 s | 6.79 s |
| CLS | 0 | 0 | 0.015 | 0 |
| Accessibility | 100 | 100 | 100 | 100 |
| Best Practices | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| Agentic Browsing | 4/4 | 4/4 | 4/4 | 4/4 |

## Desktop Production Control Runs

| Metric | Run 1 | Run 2 | Run 3 | Median |
|---|---:|---:|---:|---:|
| Performance | 64 | 79 | 83 | 79 |
| FCP | 1.1 s | 1.1 s | 1.1 s | 1.07 s |
| LCP | 1.5 s | 1.5 s | 1.5 s | 1.47 s |
| TBT | 780 ms | 290 ms | 240 ms | 285 ms |
| Speed Index | 1.7 s | 1.7 s | 1.6 s | 1.68 s |
| CLS | 0.059 | 0.005 | 0.005 | 0.005 |
| Accessibility | 100 | 100 | 100 | 100 |
| Best Practices | 77 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| Agentic Browsing | 4/4 | 4/4 | 4/4 | 4/4 |

Note: supplied production screenshots remain authoritative for final PSI: mobile 57, desktop 96.

## Post-Change Local Build Results

| Metric | Local Mobile | Local Desktop |
|---|---:|---:|
| Performance | 73 | 98 |
| FCP | 2.9 s | 0.9 s |
| LCP | 3.7 s | 0.9 s |
| TBT | 430 ms | 0 ms |
| Speed Index | 3.4 s | 1.0 s |
| CLS | 0.015 | 0.003 |
| SEO | 100 | 100 |
| Agentic Browsing | 4/4 | 4/4 |

The local mobile result improved from the production-baseline shape by removing the large carousel execution cost and early runtime refresh contention. Final production PSI must be rerun after deployment.

## Final Comparison Table

| Metric | Starting Production | Final | Target | Status |
|---|---:|---:|---:|---|
| Mobile Performance | 57 | pending production deploy / 73 local preview | >=90 | Safe improvement prepared |
| Desktop Performance | 96 | 98 local preview | >=90 | Pass |
| Mobile FCP | unknown PSI / 3.76 s local prod median | 2.9 s local preview | <=1.8 s ideal | Improved, not fully at ideal locally |
| Mobile LCP | unknown PSI / 6.04 s local prod median | 3.7 s local preview | <=2.5 s | Improved, needs production rerun |
| Mobile TBT | unknown PSI / 1,799 ms local prod median | 430 ms local preview | <=200 ms preferred | Major improvement, still above preferred locally |
| Mobile Speed Index | unknown PSI / 6.79 s local prod median | 3.4 s local preview | <=3.4 s preferred | At preferred local threshold |
| Mobile CLS | 0 class | 0.015 local preview | <=0.1 | Pass |
| Accessibility | 100 | 100 production baseline; local fallback 96 | 100 | Preserve in production |
| Best Practices | 100 | 100 production baseline; local fallback 96/73 due preview API | 100 | Preserve in production |
| SEO | 100 | 100 | 100 | Pass |
| Agentic Browsing | 4/4 | 4/4 | 4/4 | Pass |

## Final Status

MOBILE 90+ CONVERGENCE: SAFE OPTIMIZATION LIMIT REACHED

The safe source changes are implemented and validated. Achieving or confirming mobile >=90 requires deploying these changes and rerunning production PageSpeed/Lighthouse. Further local changes would require broader CSS/hydration architecture work or production-only hero data access that cannot be safely validated in this local fallback environment.

