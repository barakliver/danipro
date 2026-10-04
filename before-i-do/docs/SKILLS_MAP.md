# Before I Do Content Studio: Skills Map

Working stack chosen on 2026-10-04 after looking through every installed skill and
the skills.sh registry. The rule: use one strong skill per job and leave the gaps to
native judgment. Collecting skills was never the goal.

Skills installed this session (official publishers only, recorded in `skills-lock.json`):
`vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`
(vercel-labs/agent-skills), `supabase` and `supabase-postgres-best-practices`
(supabase/agent-skills), `frontend-design` and `webapp-testing` (anthropics/skills).

I rejected unofficial alternatives that overlapped with these: Supabase "pentest" skills,
copilot Playwright prompt packs, "taste"/redesign packs and the TanStack skills.

| # | Task | Selected skill | Reason |
|---|------|----------------|--------|
| 1 | Frontend design | `frontend-design` (Anthropic) | Distinctive editorial direction and protection against templated defaults. This is the core one for "not an admin dashboard". |
| 2 | UI/UX design, IA, flows | `anthropic-skills:ui-ux-pro-max`, plus `design:ux-copy` for microcopy | Broadest UX rule set (mobile, flows, empty states). ux-copy covers labels and empty-state text. |
| 3 | Next.js | `vercel-react-best-practices` | Vercel's own App Router, RSC, caching, waterfall and bundle rules. No better Next.js-specific skill exists. |
| 4 | React | `vercel-react-best-practices` + `vercel-composition-patterns` | Rendering performance plus compound-component APIs for the editors (Story frames, carousel slides). |
| 5 | Supabase | `supabase` (official) | Auth with @supabase/ssr, Storage, RLS and the getClaims/getUser pitfalls. The Supabase MCP tools are available for applying migrations. |
| 6 | Database design | `supabase-postgres-best-practices` | Schema, types, indexes, RLS policy performance and migrations. Load it before every migration. |
| 7 | Tailwind | `anthropic-skills:ui-styling` | Covers Tailwind and shadcn token setup. The tokens live in one theme file and no arbitrary values appear in components. |
| 8 | shadcn/ui | `anthropic-skills:ui-styling` | Gives the accessible Radix primitives. Visual identity is overridden by `frontend-design` and the brand tokens. |
| 9 | Responsive / mobile-first | `ui-ux-pro-max` + `webapp-testing` | Design rules plus real viewport checks at 375, 390, 430, 768 and 1280 px. |
| 10 | RTL and Hebrew | `anthropic-skills:rtl-hebrew-docs` (typography and bidi rules) + native | No dedicated web-RTL skill exists. I'll use logical CSS properties (`ms-/me-/ps-/pe-`, `start/end`), `dir` at the root, `<bdi>` for mixed runs and Hebrew-capable fonts from day one. |
| 11 | Accessibility | `design:accessibility-review` | WCAG 2.1 AA audit for every major flow. |
| 12 | Web design guidelines review | `web-design-guidelines` (Vercel) | Post-implementation review pass on the code against Vercel's interface guidelines. |
| 13 | Playwright E2E | `webapp-testing` + `@playwright/test` (1.56, preinstalled Chromium) | Real user-flow specs (Today → edit → save, idea → content, carousel edit → export, batch filming…). |
| 14 | Browser testing | `webapp-testing` (+ browser-use MCP as a fallback) | Drive the running app, interact with it and read console errors. |
| 15 | Screenshot review | `webapp-testing` screenshots + `design:design-critique` | Capture each screen at mobile and desktop widths, inspect it, critique it, fix it, repeat. |
| 16 | Image processing | Native: `sharp` (server) | Thumbnails, crops, aspect ratios and AVIF/WebP previews. Originals are kept untouched in private Storage. |
| 17–18 | Graphic rendering (Stories 1080×1920, carousels 1080×1350) | Native, with a documented decision. See below. | No skill is better than a well-chosen library here. |
| 19 | Image generation | Native provider adapter (optional) | Backgrounds and textures only. It never stands in for real founder, product or customer photos. |
| 20 | Spreadsheet import | `anthropic-skills:xlsx` | Sheet inspection, plus a structured per-sheet mapper into calendar, stories, POVs, carousels and highlights. |
| 21 | Copywriting | `marketing:draft-content` *as a reference only*, governed by Brand Brain | Generic conversion copy is explicitly overridden by the Sounds Like Us rules. |
| 22 | Social content | `small-business:social-content-engine` (reference) + native | Story, carousel and Reel formats, polls and hooks. Optimized for "חחח אנחנו", not clickbait. |
| 23 | Content strategy | `small-business:content-strategy` | Pillar balance (about 70/20/10), rotation and repetition management. |
| 24 | Security review | `security-review` (built-in) + `supabase` security checklist + Supabase `get_advisors` | RLS, private Storage buckets, signed URLs and server-only keys. |
| 25 | Performance | `vercel-react-best-practices` | Bundle, images, waterfalls and rendering. |
| 26 | TypeScript | Native (strict mode, `noUncheckedIndexedAccess`) | Domain types: Content, Story, StoryFrame, Carousel, CarouselSlide, POV, GalleryAsset, Template, Idea, AudienceEntry, BrandRule, ContentFeedback, Analytics. |
| 27 | Code review | `code-review` + `simplify` (built-in) | Run after every phase, then refactor before adding complexity. |
| 28 | Unit and integration tests | Native: Vitest | Status transitions, import parsing, template selection, repetition detection and scoring. |
| 29 | AI architecture | `claude-api` | Provider-agnostic generation service, stored generation history and Claude as the default provider. |
| 30 | Prompt engineering | `claude-api` + native | Structured prompts per task type, given relevant context only (no database dumps). |
| 31 | Product design | Native judgment + `design:design-critique` | Each feature has to remove work, speed up publishing or make content sound more like us. |

## Graphic renderer decision (proposed, to be confirmed while building)

| Option | Hebrew/RTL | Fidelity | Notes |
|---|---|---|---|
| Raw Canvas 2D | Weak: manual bidi and line breaking | Good | Too much hand-rolled text layout. |
| Satori / `@vercel/og` | Partial: limited RTL and bidi support | Good | Subset of CSS. Hebrew shaping is risky. |
| `html-to-image` in the client | Real browser engine | Varies by device and font loading | Results are inconsistent across phones. |
| **Headless Chromium (Playwright) rendering one shared React/HTML template** | **Full HarfBuzz shaping and native bidi** | **Pixel-exact at deviceScaleFactor 1 → 1080×1920 / 1080×1350 PNG** | The same template drives the live editor preview, so the preview matches the export. |

Recommendation: templates are React components rendered with fixed pixel dimensions.
The editor shows them scaled with CSS. The export route renders the same component in
headless Chromium with self-hosted fonts and writes a lossless PNG. If serverless hosting
can't run Chromium, the fallback is client-side `html-to-image` against the identical DOM.

## Working sequences

- **Frontend feature:** product design → ui-ux-pro-max → frontend-design → RTL rules →
  accessibility-review → implement → webapp-testing (375 and 1280 px) → screenshot critique → Playwright spec.
- **Database feature:** supabase-postgres-best-practices → supabase → security-review → migration → tests → code-review.
- **Content generation:** content-strategy → copy (Brand Brain first) → social formats → claude-api → Sounds Like Us eval.
- **Story and carousel rendering:** frontend-design → renderer → RTL → sharp → webapp-testing → export pixel tests.
