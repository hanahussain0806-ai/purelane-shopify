# AI workflow notes

**Hana Hussain**

The brief asks what I delegated, where the limits are, and what I'd systematise across twenty of these. That last question is the interesting one — the value of agents on this kind of work isn't speed on one build, it's whether the process compounds. Here's how I ran this one and what I'd turn into infrastructure.

---

## What I delegated

**Reconnaissance, not reading.** 1,716 lines and 148KB, inflated by 13 base64-encoded SVGs. Reading that top to bottom is a poor use of the first hour. I had the agent map the structure — section boundaries, where the CSS blocks sat, what the JS actually did on scroll — then pulled specific line ranges on demand.

Two of the most important findings in this build came out of that pass rather than out of careful reading: the shop grid renders its eight cards two different ways, and the animation code caches DOM references in a way that breaks in the theme editor. Both shaped the entire architecture, and both surfaced in the first ten minutes.

**Asset extraction.** The product bottles were base64 SVGs inside CSS custom properties. I had a script decode all 13 and rasterise them to transparent PNGs at consistent dimensions for upload as real product images. By hand that's an hour of decode-inspect-convert-name with a real chance of mismatching a bottle to the wrong product. Scripted, it's two minutes and verifiable.

**Design system extraction.** Pulling `:root` tokens, glass panels, button variants and reveal states out of an 800-line block into a scoped stylesheet is mechanical, high-volume, and easy to get subtly wrong — which is exactly the profile of work worth delegating. I verified the output against the original values rather than trusting it.

**First drafts of Liquid.** Section scaffolding, schema JSON, snippet structure. Schema in particular is verbose and typo-prone, and a malformed schema fails loudly and immediately, so it's low-risk to generate and fast to validate.

---

## Where the limits are, and how I work around them

**Agents don't know the current environment.** New Shopify stores now ship with Horizon rather than Dawn, so the standard "add a theme in admin" workflow quietly gives you the wrong theme for a brief that specifies stock Dawn. I pulled Dawn from `Shopify/dawn` directly instead. The general lesson: anything about a platform's *current* behaviour — default themes, admin navigation, API versions — is where training data goes stale first, and it's worth verifying rather than assuming.

**Confident output about unverified state.** An agent will happily tell you to edit a file without knowing whether that file is in front of you. Every "open X and change Y" instruction gets a existence check before I act on it. Cheap to do, expensive to skip.

**Reasoning is not verification.** My largest time loss on this build was a rendering issue I debugged by hypothesis — MIME types, malformed Liquid comments, body classes — through several rounds before checking what the server was actually returning with a single `curl | grep`. The root cause was a line that had been dropped from `theme.liquid` during an earlier edit, and thirty seconds of looking would have found it. That's not really a limitation of the tool; it's a discipline I now treat as a rule: **check the output before theorising about the cause.**

**Scope judgement stays with me.** Given five sections and two days, the natural agent output is a plan for all five. Deciding to build the foundation plus one section properly — and holding that line — was a call about what this brief is actually testing. Agents optimise for the request as stated; someone has to own what's worth cutting.

---

## What I'd systematise for twenty more of these

**A prototype triage pass, run first, every time.** One standardised prompt that inventories any handed-over file and returns: section boundaries and IDs, every asset and how it's encoded, what the JS does and whether it survives AJAX re-render, hardcoded values that must become settings, data with no native Shopify field, and accessibility problems in the existing markup. That output *is* the spec, and it turns the most variable part of the job — understanding someone else's prototype — into a repeatable step.

**A house section template.** Every section I write shares a skeleton: `data-purelane-section` and `data-scene` on the root, section-scoped CSS asset, heading level as a setting, anchor ID as a setting, padding as a setting, an editor-only empty state, a preset block. Making that a scaffold rather than a prompt eliminates a whole class of "the agent forgot the preset again," and it's why adding a fifth section costs a fraction of what the first one did.

**A standing edge-case checklist injected into every card-rendering prompt.** No image, sold out, no compare-at price, missing metafield, four-line title, single product in the grid, more products than the display limit. Agents handle all of these well when asked and forget most of them when not. This brief made three of them explicit test cases; production merchants make all seven eventually.

**Verification the agent can't fake.** `curl | grep` on rendered output, a scripted theme-editor stress test (add, delete, reorder, reload, confirm animations still run), and a Lighthouse run — as commands in a checklist, not as questions asked of the model. This is the single highest-leverage thing on the list, based on where my time actually went.

**A shared token file per client, built once.** Design system extraction is mechanical and identical every time. Doing it as the first commit on every project, before any section exists, means everything afterwards is composition rather than translation. It's also what makes a build reviewable — a reviewer can diff my tokens against the original values in one file instead of hunting through eight sections.

**Where humans stay in the loop.** Data modelling decisions — metafield versus metaobject versus bundle product — depend on what the merchant needs and how they'll actually edit it, and an agent will produce a confident answer to a question it can't have the context for. Same with scope calls under a deadline. Agents are excellent at volume and consistency. Knowing what to build, and what to leave, is the part that stays mine.

---

I've enjoyed this one. The prototype had genuinely interesting problems in it — the encoded assets, the editor-lifecycle trap, the combo pricing model — and they're the kind of problems that only show up when you're translating someone else's fast work into something a merchant has to live with. That's the part of this job I want to be doing.
