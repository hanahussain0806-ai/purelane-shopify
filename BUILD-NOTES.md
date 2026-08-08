# Build notes — Purelane homepage on Shopify

**Hana Hussain**
Dev store: https://purelane-assignment-wuz4qywl.myshopify.com — password `assignment2026`
Repo: https://github.com/hanahussain0806-ai/purelane-shopify
Theme: stock Dawn 15.5.0, pulled from Shopify/dawn, first commit is unmodified for a clean diff

---

## What I shipped, and what I didn't

**Shipped:** the foundation (design tokens, the fixed scene backdrop, a theme-editor-safe JS runtime) and the **Shop / product grid** section, complete and production-ready.

**Not shipped:** Hero, Combos, Bundles, Reviews.

I had roughly a day of working time. The choice was five rough sections or one correct one plus the architecture the other four would sit on. I picked the second, because the parts I'd have skipped to move faster — the card abstraction, the editor lifecycle, the metafield modelling — are the parts that are expensive to retrofit and the parts this assignment is actually testing. Four hardcoded sections would have looked like more work and been worth less.

The scaffolding for the remaining four is done. They are section files calling an existing snippet against an existing token system.

---

## What I'd flag about the original file

**The product images aren't images.** They're hand-drawn SVGs base64-encoded into CSS custom properties (`--p-tap`, `--p-kitchen`, …). In a prototype that's a clever way to ship one self-contained file. In a theme it means product imagery lives in your stylesheet, where no merchant can reach it and no CDN can optimise it. I decoded all 13, converted them to transparent PNGs, and uploaded them as real product images. Prices, titles, and images now come from the platform.

**The shop grid contradicts itself.** Cards 1–4 draw their bottle from a CSS variable; cards 5–8 paste a full inline `<svg>` into the markup. Identical visual result, two different mechanisms, in the same grid. Classic prototype drift, and a good argument for the single card renderer.

**The JavaScript can't survive the theme editor.** Everything is one anonymous IIFE that runs once on load and caches every element it finds. The editor swaps section HTML over AJAX without reloading, so after any merchant edit those cached references point at dead nodes and the animations in that section stop silently. This is the single biggest reason the file can't be ported as-is.

**Reduced motion is half-handled.** The author gated the JS parallax on `prefers-reduced-motion` — good — but left the CSS keyframes running, so someone who asked for less motion still got drifting water, rising bubbles and a swaying light shaft.

**Accessibility gaps in the card.** The rating is a bare `★` glyph inside `<b>`, which screen readers announce as "black star 4.8" with no indication it's a rating out of 5. The "Add to cart" button is decorative — a `<button>` with no form behind it. The decorative leaf divider is exposed to assistive tech.

**No empty or edge states anywhere.** Every card has an image, stock, a rating, a badge, and a short title, because the data was invented to fit the design. Nothing in the file says what happens when a product is sold out, has no image, or has a title that runs four lines.

**Structural nits.** Cards use `<h4>` with no `<h1>`–`<h3>` above them, chosen for size rather than document outline. Section backgrounds depend on source order rather than an explicit stacking context, which breaks the moment sections are reordered.

---

## What I changed, and why

**One card renderer instead of eight cards.** `snippets/purelane-product-card.liquid` is called by the shop grid and is what combos and bundles would call too. It takes a product and a reveal delay. This is what their "several sections render similar cards, build accordingly" line is pointing at.

**Ratings, review counts and badges as metafields.** `custom.rating` (decimal), `custom.review_count` (integer), `custom.badge` (single-line text). Shopify has no native field for these, and putting them in Liquid would have failed "nothing hardcoded a marketing team would want to change." Badge is constrained to a preset list so a merchant typing "best-seller" can't silently break the styling.

**Discounts computed, not typed.** The "33% off" chip is derived from `compare_at_price` vs `price`. Change the price in admin and the chip follows. It also disappears when there's no compare-at price, rather than rendering "0% off".

**A real add-to-cart form.** `{% form 'product' %}` posting to `/cart/add`, so the card works with JS disabled. Sold-out products get a disabled button instead.

**Three edge cases handled explicitly**, and seeded in the store so they're visible rather than theoretical:
- *No image* (Liquid handwash) → placeholder occupying the same box, so the grid row doesn't collapse
- *Sold out* (Copper, bronze & brass) → disabled "Sold out", price still shown
- *Very long title* (the magic eraser) → clamped to two lines, full text kept in the DOM for screen readers and SEO

**The backdrop moved to the layout.** It's `position: fixed` and spans the whole page, so it belongs to `theme.liquid`, not to any one section. Sections declare a depth via `data-scene="1..4"`; the JS reads those on scroll and crossfades. Scene depth is a merchant setting, so reordering sections in the editor doesn't require a developer to fix the background progression.

**The JS rewritten around the editor lifecycle.** Named init/teardown instead of an IIFE. Re-queries the DOM on every init rather than caching across runs. Tracks observers and timers per element so they can be disconnected. Listens for `shopify:section:load` / `:unload` / `:reorder` / `:select` / `:block:select`. One scroll listener for the whole page regardless of how many sections a merchant adds — the naive port adds one per section, which degrades as the page grows.

**Reduced motion enforced in CSS as well as JS**, and it now reacts if the visitor changes the preference mid-session rather than only reading it at load.

**Performance.** Explicit `width`/`height` on card images so the browser reserves space (the prototype had no `<img>` at all, so it had no CLS; a naive port reintroduces it). First two cards eager with `fetchpriority="high"`, rest lazy. Fonts preconnected and `display=swap`. The two heaviest water layers — `feTurbulence` + `feDisplacementMap`, expensive to rasterise — are dropped below 750px, where they're barely visible and cost the most on the devices least able to afford it.

**Accessibility.** Semantic rating with a visually-hidden "Rated 4.8 out of 5 from 237 reviews". Decorative SVGs marked `aria-hidden`. Heading level is a schema setting so the section can sit anywhere in a page's outline. Focus-visible styles on the accent colour.

**CSS scoped under `.purelane`** so nothing leaks into Dawn's other templates. Section CSS loads per-section rather than globally.

---

## What I'd do with more time

**Finish the four remaining sections.** Hero first — it's the LCP element and the most complex. The product stage would be block-driven, one block per slide, with the price flag reading `product.price` rather than typed text.

**Combos and bundles need a data model decision, and I'd go with metaobjects.** A combo's price isn't any single product's price. A `combo` metaobject with fields for title, product list and bundle price is editable from one place and reusable across sections. The alternative — creating each combo as a real product with an `included_products` metafield — is simpler and makes the combo purchasable, which the "Shop bundle" button implies it should be. I'd want to ask which the merchant actually needs before committing.

**Self-host Outfit and Inter.** Google Fonts costs a third-party connection on the critical path. Self-hosted with `font-display: swap` and a preload on the two weights actually used above the fold would measurably help LCP.

**Deduplicate the SVG filter IDs.** The backdrop's three `<svg>` blocks each define `cg`, `wf`, `wf2`. Scoped per-`<svg>` so it works, but it's fragile — if anything ever moves those into one document, the filters collide. I left it because renaming risked a visual diff I couldn't verify under time pressure, which felt like the wrong trade against "match the file exactly."

**Full audit pass.** I checked 375px and desktop, keyboard traversal, and reduced motion on the shop grid. I have not run a full Lighthouse pass on the published theme or tested on a real low-end Android, and I'd want both before calling this done.

**Real review data.** The reviews rail hardcodes reviews as section blocks, which is right for this exercise but wrong for a live store. In production that's a reviews app with a metafield, or a metaobject if the merchant is entering them manually.
