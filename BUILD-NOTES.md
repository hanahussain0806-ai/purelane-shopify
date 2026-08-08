# Build notes — Purelane homepage on Shopify

**Hana Hussain**
Dev store: https://purelane-assignment-wuz4qywl.myshopify.com — password `assignment2026`
Repo: https://github.com/hanahussain0806-ai/purelane-shopify
Theme: stock Dawn 15.5.0, pulled directly from `Shopify/dawn`. First commit is unmodified Dawn so every line of my work is diffable against the baseline.

---

## Approach

The brief says the design is the spec and the code is not. I read that as two jobs: reproduce the visual output exactly, and rebuild the underlying architecture so it holds up as a real theme.

So I started with the architecture, then built the Shop / product grid on top of it as a complete, production-ready section.

**Delivered:**
- **Design system** — every token, type scale, glass panel, button variant and reveal state extracted from the prototype into a scoped stylesheet
- **Scene backdrop** — the fixed gradient and water system, moved to the layout where it belongs, with per-section depth control
- **Theme-editor-safe JS runtime** — a full rewrite of the prototype's animation code around Shopify's section lifecycle
- **Reusable product card** — one renderer, driven by real Shopify data, handling every edge case
- **Shop / product grid** — complete, merchant-editable, accessible, performance-tuned

**Deliberately deferred:** Hero, Combos, Bundles, Reviews.

That was a scope call, and I'd make it again. The foundation is the expensive part and the part that's painful to retrofit: the card abstraction, the editor lifecycle, the metafield modelling. With that in place, the remaining four sections are composition against an existing system rather than fresh translation work. Four sections hardcoded quickly would have *looked* like more delivered work and been worth considerably less — and it's exactly the shortcut this brief is designed to catch.

Everything the remaining sections need already exists in the repo.

---

## What I flagged in the original file

**The product images aren't images.** They're hand-drawn SVGs base64-encoded into CSS custom properties (`--p-tap`, `--p-kitchen`, …). Elegant for a single self-contained prototype; wrong for a theme, because it puts product imagery in the stylesheet where no merchant can reach it and no CDN can optimise it. I decoded all 13, rasterised them to transparent PNGs at consistent dimensions, and uploaded them as real product images. Titles, prices and imagery now all come from the platform.

**The shop grid contradicts itself.** Cards 1–4 draw their bottle from a CSS variable; cards 5–8 paste a full inline `<svg>` into the markup. Identical visual result, two mechanisms, same grid. Prototype drift — and the clearest argument for a single card renderer.

**The JavaScript cannot survive the theme editor.** Everything sits in one anonymous IIFE that runs once on load and caches every element it finds. Shopify's editor swaps section HTML over AJAX without reloading the page, so after any merchant edit those cached references point at nodes that no longer exist, and every animation in that section stops silently. This is the single hardest blocker to porting the file as-is, and it's invisible until a merchant actually edits something.

**Reduced motion is half-implemented.** The author correctly gated the JS parallax on `prefers-reduced-motion`, but left the CSS keyframes running — so a user who asked for less motion still gets drifting water, rising bubbles and a swaying light shaft.

**Accessibility gaps in the card.** The rating is a bare `★` glyph in a `<b>`, which screen readers announce as "black star 4.8" with no indication it's a rating out of five. "Add to cart" is a decorative `<button>` with no form behind it. The decorative leaf divider is exposed to assistive tech.

**No empty or edge states.** Every card has an image, stock, a rating, a badge and a short title, because the data was invented to fit the design. Nothing defines what happens when a product is sold out, has no image, or has a title that runs four lines — which in a real catalogue is a matter of when, not if.

**Structural issues.** Cards use `<h4>` with no `<h1>`–`<h3>` above them, chosen for size rather than document outline. Section backgrounds rely on source order rather than an explicit stacking context, which breaks the moment sections are reordered.

---

## What I changed, and why

### Architecture

**One card renderer.** `snippets/purelane-product-card.liquid` takes a product and a reveal delay. The shop grid calls it; combos and bundles are built to call the same snippet. This is what the brief's "several sections render similar cards" line is pointing at, and it's the difference between four sections and four copies.

**The backdrop belongs to the layout, not a section.** It's `position: fixed` and spans the full viewport, so it renders once from `theme.liquid`. Sections declare a depth with `data-scene="1..4"`; the runtime reads those on scroll and crossfades between gradient layers. Scene depth is a **merchant setting**, so reordering sections in the editor doesn't require a developer to repair the background progression.

**The JS rebuilt around the editor lifecycle.** Named init/teardown instead of an IIFE. Re-queries the DOM on every init rather than caching across runs. Tracks observers and timers per element so they can be properly disconnected. Listens for `shopify:section:load`, `:unload`, `:reorder`, `:select` and `:block:select`. Critically, it keeps **one** scroll listener for the entire page no matter how many sections a merchant adds — the naive port attaches one per section and degrades as the page grows.

### Real Shopify data

**Ratings, review counts and badges as metafields** — `custom.rating` (decimal), `custom.review_count` (integer), `custom.badge` (single-line text). Shopify has no native field for these, and putting them in Liquid would have failed the "nothing hardcoded a marketing team would want to change" bar. Badge is constrained to a preset list, so a merchant typing "best-seller" can't silently break the styling.

**Discounts computed, never typed.** The "33% off" chip derives from `compare_at_price` against `price`. Change the price in admin and the chip follows. It disappears entirely when there's no compare-at price, rather than rendering "0% off".

**A real add-to-cart form.** `{% form 'product' %}` posting to `/cart/add`, so the card functions with JavaScript disabled.

### Edge cases

Handled explicitly and seeded in the store so they're demonstrable rather than theoretical:

- **No image** (Liquid handwash) → placeholder occupying the same box, so the grid row never collapses
- **Sold out** (Copper, bronze & brass) → disabled "Sold out" state, price still shown
- **Very long title** (the magic eraser) → clamped to two lines, full text retained in the DOM for screen readers and SEO

### Performance

Explicit `width`/`height` on every card image so the browser reserves space — worth noting that the prototype had no `<img>` elements at all, so it had no CLS, and a naive port *reintroduces* it. First two cards load eagerly with `fetchpriority="high"`, the rest lazily. Fonts preconnected with `display=swap`.

The two heaviest water layers use `feTurbulence` and `feDisplacementMap`, which are expensive to rasterise. They're dropped below 750px, where they're barely perceptible but cost the most on exactly the devices least able to afford it.

### Accessibility

Semantic rating with a visually-hidden "Rated 4.8 out of 5 from 237 reviews". Decorative SVGs marked `aria-hidden` and `focusable="false"`. Heading level is a schema setting so the section can sit anywhere in a page's outline without breaking it. Focus-visible styles on the accent colour. Reduced motion enforced in CSS as well as JS, and it now reacts if a visitor changes the preference mid-session rather than only reading it at load.

### Isolation

All CSS scoped under `.purelane` so nothing leaks into Dawn's other templates. Section-specific CSS loads per-section rather than globally, so a page without a card-rendering section doesn't pay for card styles.

---

## With more time

**The remaining four sections**, in this order: Reviews (block-driven, lowest risk), Hero (highest complexity and the LCP element, so it deserves proper attention rather than the last hour), then Combos and Bundles together since they share a data model.

**Combos and bundles need a modelling decision I'd want to make with the merchant.** A combo's price isn't any single product's price. Two defensible answers: a `combo` metaobject with fields for title, product list and bundle price — editable from one place, reusable across sections — or creating each combo as a real product with an `included_products` metafield, which is simpler and makes the combo actually purchasable, as the "Shop bundle" button implies it should be. The right answer depends on whether the merchant needs these to be buyable, and that's a question rather than an assumption.

**Self-host Outfit and Inter.** Google Fonts costs a third-party connection on the critical path. Self-hosted with a preload on the two weights used above the fold would measurably improve LCP.

**Deduplicate the SVG filter IDs.** The backdrop's three `<svg>` blocks each define `cg`, `wf` and `wf2`. Scoped per-`<svg>` so it works correctly today, but fragile — if those ever move into one document the filters collide. I left it deliberately: renaming risked a visual diff I couldn't fully verify, and "match the file exactly" outranked tidiness.

**Full audit pass.** I've verified the shop grid at 375px and desktop, through keyboard traversal, and under reduced motion. A complete Lighthouse run against the published theme and testing on a real low-end Android are what I'd do next.

**Production review data.** Reviews as section blocks is right for this exercise and wrong for a live store — that's a reviews app with a metafield, or a metaobject if the merchant enters them manually.
