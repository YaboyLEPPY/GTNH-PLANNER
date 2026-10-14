# Independent design and journey review

A separate evaluation agent used system Chromium/Playwright against the running production build, following the attached user brief as an unfamiliar player. This is agent-based usability review, not a claim of a human playtest.

Verified: Ender IO search opens its source MV chapter; actual task and reward information is accessible; circuit calculation, base drawing, resizing, duplication and connection workflows operate; Midnight palette is coherent. Automated axe analysis found zero violations in the five default destinations.

Concrete findings and corrections:

1. The mobile base grid expanded document width to 882 px on a 390 px viewport. Fixed grid child minimum width and mobile columns. Touch/keyboard acceptance now asserts no horizontal document overflow.
2. Coin reward names showed literal `&quot;`. Added safe entity decoding at catalogue/presentation boundaries; no HTML is executed.
3. Dense original quest layout made individual source nodes difficult to identify. Added a readable chapter quest selector and source-node focus while retaining every original coordinate and node.
4. Recipe routes often differed only by opaque source hashes. Route options now show distinguishing consumed ingredients alongside machine, tier and output quantity; full source IDs remain in recipe details.
5. During own journey testing, changing floors left a connection inspector open, and completion statuses rendered twice. Floor/brush changes now reset selection; completion messaging renders once.

Source hierarchy differs from an assumption in the brief: this pinned snapshot defines a single chapter menu, not a separate Ender IO book. The planner preserves source chapter locations rather than inventing that hierarchy. See SOURCES.md.
