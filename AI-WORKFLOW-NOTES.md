# AI workflow notes

**Hana Hussain**

---

## What I delegated

**Reading the file.** 1,716 lines, 148KB, with 13 base64-encoded SVGs inflating it. I didn't read it top to bottom. I had the model map the structure first — section boundaries, where the CSS blocks sat, what the JS actually did — then pulled specific line ranges on demand. Two useful findings came out of that pass rather than out of reading: the shop grid renders its eight cards two different ways, and the JS is a single IIFE that caches DOM references, which is what breaks in the theme editor.

**Asset extraction.** The product bottles were base64 SVGs inside CSS custom properties. I had a script decode all 13 and rasterise them to transparent PNGs at consistent dimensions, then uploaded them as real product images. Doing that by hand — decode, inspect, convert, name — would have been an hour of tedium with a real chance of mismatching a bottle to the wrong product.

**Extracting the design system.** Pulling `:root` tokens, the glass panels, button variants and reveal states out of an 800-line block into a scoped stylesheet is exactly the kind of mechanical, high-volume, easy-to-get-subtly-wrong work worth delegating. I checked the output against the original values rather than trusting it.

**First drafts of the Liquid.** Section scaffolding, schema JSON, the snippet structure. Schema in particular is verbose and easy to typo, and a malformed schema fails loudly and immediately, so it's low-risk to generate.

**These notes.** Drafted from the actual decisions made during the build, then edited.

---

## Where it failed me

**It doesn't know the environment.** New Shopify stores now ship with Horizon, not Dawn — so "add a theme in admin" quietly gives you the wrong theme for an assignment that specifies stock Dawn. I had to pull Dawn from `Shopify/dawn` directly. The model was confident about a workflow that no longer matches the product.

**It suggests plausible files that don't exist.** Early on I was told to edit `layout/theme.liquid` while I had the wrong folder open in the editor, and the advice was given with no hedging about verifying the file was actually there. Every "open this file and find X" needs checking before acting on it.

**Long shell commands break when pasted.** Several `cp` commands with full absolute paths wrapped in the terminal and executed as two broken halves — producing `usage: cp` and a misleading `permission denied` on a directory. It looked like a permissions problem and wasn't. The fix was shorter commands and one at a time, but I lost real time chasing the wrong cause.

**Debugging by suggestion is slow.** When the backdrop wasn't rendering, I went through several rounds of hypotheses — MIME types, a malformed Liquid comment, body classes — before checking what the server was actually returning with `curl`. The real cause was that a line had been deleted from `theme.liquid` during an earlier edit. One `curl | grep` at the start would have found it in thirty seconds. The lesson isn't about the model; it's that I let it theorise when I should have made it look.

**It optimises for the request, not the deadline.** Given a two-day window and five sections, the natural output is a plan for all five. Deciding to build one properly and cut four was a judgement call I had to make and hold.

---

## What I'd systematise for twenty more of these

**A prototype triage pass, run first, every time.** One prompt that inventories any handed-over file and reports: section boundaries and IDs, every asset and how it's encoded, what the JS does and whether it survives AJAX re-render, hardcoded values that must become settings, data that has no native Shopify field, and accessibility problems in the existing markup. That output *is* the spec. On this build it surfaced the two-mechanisms problem and the IIFE problem inside the first ten minutes, and both shaped the whole architecture.

**A house section template.** Every section I write has the same skeleton: `data-purelane-section` and `data-scene` on the root, section-scoped CSS asset, heading level as a setting, anchor ID as a setting, padding as a setting, an editor-only empty state, a preset block. Making that a scaffold rather than a prompt removes a whole category of "the agent forgot the preset again."

**A standing edge-case checklist injected into every card-rendering prompt.** No image, sold out, no compare-at price, missing metafield, four-line title, single product in the grid, more products than the limit. The agent handles all of these well when asked and forgets most of them when not. This assignment made three of them explicit test cases; in production nobody does.

**Verification the agent can't fake.** `curl | grep` on the rendered output, a scripted theme-editor stress test (add, delete, reorder, reload, confirm animations still run), and a Lighthouse run — as commands, not as questions asked of the model. My worst time loss this build came from reasoning about what the page *should* contain instead of checking what it *did*.

**A shared token file per client, built once.** The design system extraction is mechanical and identical every time. Doing it as the first commit on every project, before any section exists, means every section afterwards is composition rather than translation.

**Where I'd keep humans.** Data modelling decisions — metafield vs metaobject vs bundle product — depend on what the merchant actually needs and how they'll edit it, and the model will happily produce a confident answer to a question it can't have the context for. Same for scope calls under a deadline. The agent is good at volume and consistency; it isn't good at knowing what to abandon.
