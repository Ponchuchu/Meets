# Recommendations: natural media and icon navigation

Replaced the swipe stack with a scrolling programme. Images retain their source ratio, without duplicated blur backgrounds. Four icon-only tabs retain accessibility labels; plans open from the header calendar. Save confirmation appears inline and hiding has an undo action. Detail opens as a slide modal. Only the visible feed video is active; sheets and unfocused tabs pause it.

Public event snapshots in fixtures.json are used with a demo identity; browser preview blocks remote writes. Screenshots are from the actual web application, not design mockups. Native Android performance still requires device verification.

Verification: 557 tests passed (90 suites), TypeScript and Expo web export passed. Lint passed. Browser checks cover source aspect ratio, no horizontal overflow, no image blur and navigation recording.

Supabase read-only audit: 84 events, 54 future/ongoing, 40 records without a price. Existing query executed in 62.5 ms in management EXPLAIN ANALYZE; this is not phone latency. Existing indexes were checked. Historical client errors were reviewed; the detail view web StatusBar crash was fixed during preview. Own public Supabase images now request bounded image transforms; foreign and signed URLs are preserved.

Price recovery uses Kimi only to find ticket sources and independently verifies prices against matching source pages. Run https://github.com/Ponchuchu/Meets/actions/runs/42527754487 completed: three searches, zero verified prices. Unknown prices stay excluded. Conditional free admission requiring another ticket is not labelled universally free.

Interface guidance adapted from Unslop by Damir Sokolovsky (CC BY 4.0), see .skills/ryadom-interface/SKILL.md. Previous optimization measurements are in docs/progress/optimization.
