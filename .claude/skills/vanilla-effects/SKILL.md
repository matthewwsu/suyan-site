---
name: vanilla-effects
description: Reference of vanilla CSS/JS implementations of effects typically built with React + Framer Motion (scroll reveals, magnetic cursors, chrome shimmer, scroll parallax, count-ups, sticky sections, cursor spotlights, text reveals, scroll-snap transitions, animated SVG turbulence). Use this skill when implementing any animation, hover, scroll, or visual effect on a static / vanilla site without a JS framework — covers performance characteristics, browser support, and when to use vs skip each technique.
---

# Vanilla effects reference

This is a reference for building Framer-class effects in plain HTML/CSS/JS. The default for every effect on a static site is **vanilla**, not React + Framer Motion / GSAP / Lenis / similar. Reach for a library only when (a) the effect genuinely needs frame-perfect orchestration that CSS/native APIs can't deliver, and (b) the bundle cost is justified — log the reasoning in the PR.

The patterns below are written for a no-build single-file site (`index.html` + `styles.css` + `scripts.js`). They compose cleanly: each technique works in isolation and stacks with the others without coordination.

## Defaults that apply to every technique

- **Always honour `prefers-reduced-motion: reduce`.** Either disable the animation or snap to the end state. Add this once near the bottom of `styles.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  Then layer per-effect overrides for things that need a different reduced-motion behaviour (e.g. count-ups should snap to final value, not animate to it).
- **Animate only `transform` and `opacity`.** They're compositor-only — no layout/paint. Avoid animating `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow`, or `filter` in hot paths.
- **Use `translate3d(…)` (or `transform: translate(…)` with `will-change: transform`)** to force GPU compositing on elements that animate frequently. Don't sprinkle `will-change` everywhere — it costs memory.
- **Drive JS → CSS via custom properties (`--mx`, `--my`, `--progress`)**, not by writing `style.transform` strings repeatedly. CSS handles the rendering; JS only updates two numbers.
- **RAF-throttle every pointer/scroll handler.** One state update per frame, max. Pattern:
  ```js
  let raf = 0;
  el.addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      // update CSS vars / transforms here
      raf = 0;
    });
  });
  ```
- **Prefer `IntersectionObserver` over `scroll` listeners** for "fire when visible" logic. The browser already tracks intersection; you don't need to.
- **Gate hover-only effects on `matchMedia("(hover: hover)").matches`.** Touch users will fire your `pointermove` once on tap and leave the effect in a stuck state otherwise.

---

## 1. Animated SVG turbulence (chrome smoke / liquid metal background)

**Visual outcome.** A slowly shifting cloud of grey/silver noise across a hero or section. Looks like smoke, brushed metal under a moving light, or atmospheric grain. Different from a static SVG noise overlay because the noise *moves*.

**Vanilla technique.** SVG `<feTurbulence>` generates fractal noise. Animate the `seed` (or `baseFrequency`) attribute via SMIL `<animate>` to make the noise drift.

```html
<svg class="smoke" aria-hidden="true" preserveAspectRatio="none">
  <defs>
    <filter id="smoke-filter">
      <feTurbulence type="fractalNoise"
                    baseFrequency="0.012 0.018"
                    numOctaves="2"
                    seed="1">
        <animate attributeName="seed"
                 from="1" to="120"
                 dur="24s"
                 repeatCount="indefinite"/>
      </feTurbulence>
      <feColorMatrix values="0 0 0 0 0.85
                             0 0 0 0 0.86
                             0 0 0 0 0.90
                             0 0 0 1 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" filter="url(#smoke-filter)"/>
</svg>
```

```css
.smoke {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.35;
  mix-blend-mode: overlay;
  z-index: 0;
}
```

For higher-end "liquid metal" warping (chrome surface that ripples), pair `feTurbulence` with `feDisplacementMap` and apply the filter to a real chrome gradient element:

```html
<filter id="liquid">
  <feTurbulence baseFrequency="0.008 0.014" numOctaves="2" seed="1">
    <animate attributeName="seed" from="1" to="200" dur="30s" repeatCount="indefinite"/>
  </feTurbulence>
  <feDisplacementMap in="SourceGraphic" scale="18"/>
</filter>
```

**Performance.** `feTurbulence` is the most expensive primitive in SVG — it runs per-pixel per repaint. Keep `baseFrequency` low (≤ 0.02), `numOctaves` ≤ 2, and animate `seed` (cheap) instead of `baseFrequency` (expensive). Cap the SVG resolution: a 600×400 `<rect>` upscaled with `preserveAspectRatio="none"` is far cheaper than a full-viewport raster. Disable on mobile if you measure jank.

**Browser support.** `feTurbulence`: universal (SVG 1.1, all browsers). SMIL `<animate>`: supported in Chrome, Firefox, Safari. Chrome briefly considered deprecating SMIL years ago and reversed; it's stable. Avoid SMIL only if you're specifically targeting embedded WebViews on legacy Android — in which case fall back to animating CSS `background-position` on a static noise SVG (cheap but doesn't actually warp).

**Use when.** Hero atmospheres, ambient texture under chrome wordmarks, "feels alive" backgrounds.
**Skip when.** Mobile-first sites where it's the third+ animation running, or for purely decorative grain (a static noise data-URI is enough).

---

## 2. Scroll-triggered reveals (IntersectionObserver + CSS transitions)

**Visual outcome.** Elements fade up / slide in / clip-wipe as they cross into the viewport. The most-built effect on the modern web.

**Vanilla technique.** IntersectionObserver toggles a class; CSS handles the transition. No scroll listener.

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 700ms cubic-bezier(0.2, 0.7, 0.3, 1),
    transform 700ms cubic-bezier(0.2, 0.7, 0.3, 1);
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}
```

```js
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      io.unobserve(entry.target);   // fire once
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
);

document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
```

**Stagger** by setting an inline `--i` index and delaying via CSS:
```html
<li class="reveal" style="--i: 0">…</li>
<li class="reveal" style="--i: 1">…</li>
```
```css
.reveal { transition-delay: calc(var(--i, 0) * 80ms); }
```

**Performance.** Excellent. IO is browser-native and batches efficiently. Transitions on `opacity`/`transform` are GPU-composited.

**Browser support.** Universal modern (IO since Chrome 51 / Safari 12.1, ~2018). No fallback needed in 2026.

**Use when.** Default for any "reveal as you scroll" pattern. Sections, cards, list items, headlines.
**Skip when.** Above-the-fold content (use a load-time animation instead — the user shouldn't see content that's invisible because IO hasn't fired). Continuously scroll-tied effects (use scroll-driven animations or the parallax pattern instead).

> The SUYAN site uses this in `scripts.js` → `initSectionReveals()` and `styles.css` → `.section / .section.is-visible`.

---

## 3. Magnetic cursor effects (pointermove + transform)

**Visual outcome.** A button or interactive element gently pulls toward the cursor when the cursor is near or over it, then snaps back on leave. Creates an "alive" feeling for primary CTAs.

**Vanilla technique.** Listen to `pointermove` on the element, compute offset from element centre, write `transform: translate3d()`. RAF-throttled. Hover-only.

```css
[data-magnetic] {
  transition: transform 280ms cubic-bezier(0.2, 0.7, 0.3, 1);
  will-change: transform;
}
```

```js
const isHover = matchMedia("(hover: hover)").matches;
if (isHover) {
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    let raf = 0;
    el.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r  = el.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const strength = 0.25;          // 0–0.5 typical
        const dx = (e.clientX - cx) * strength;
        const dy = (e.clientY - cy) * strength;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        raf = 0;
      });
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
}
```

**Damped follow** (more "rubber band" feel) — replace direct write with a lerp loop:
```js
let cx = 0, cy = 0, tx = 0, ty = 0, animating = false;
function tick() {
  cx += (tx - cx) * 0.15;
  cy += (ty - cy) * 0.15;
  el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
  if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) requestAnimationFrame(tick);
  else animating = false;
}
// in pointermove: set tx, ty; if (!animating) { animating = true; tick(); }
```

**Performance.** Very cheap (one transform per element per frame).

**Browser support.** Pointer events: universal. Transform: universal.

**Use when.** Single hero CTA, "send" button on a form, primary action buttons.
**Skip when.** Dense grids of items (every cell pulling toward the cursor is dizzying). Text links. Touch-only contexts.

> The SUYAN site uses this on `[data-magnetic]` elements (`.hero__cue`, `.contact__submit`) — see `scripts.js` → `initMagnetic()`.

---

## 4. Chrome shimmer on hover (background gradient animation)

**Visual outcome.** A bright band of light sweeps across chrome-treated text on hover, like sunlight catching polished metal. Often used on hero wordmarks or premium CTAs.

**Vanilla technique.** Apply a multi-stop gradient as `background-image`, clip it to the text with `background-clip: text`, oversize the gradient (`background-size: 200% 100%`), and animate `background-position` on hover.

```css
.shimmer {
  background: linear-gradient(
    110deg,
    #c8c8cc 0%,
    #c8c8cc 35%,
    #ffffff 50%,
    #c8c8cc 65%,
    #c8c8cc 100%
  );
  background-size: 200% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
          background-clip: text;
  -webkit-text-fill-color: transparent;
          color: transparent;
  transition: background-position 900ms cubic-bezier(0.2, 0.7, 0.3, 1);
}

.shimmer:hover {
  background-position: -100% 0;
}
```

For a **continuous** shimmer that loops while hovered:
```css
@keyframes shimmer-sweep {
  from { background-position:  100% 0; }
  to   { background-position: -100% 0; }
}
.shimmer:hover { animation: shimmer-sweep 1.6s linear infinite; }
```

For a **slow ambient drift** (no hover required), apply the animation by default and use a long duration (~10–14s).

**Performance.** Animating `background-position` on a clipped gradient is compositor-friendly on modern browsers. Cheap.

**Browser support.** `background-clip: text` with the `-webkit-` prefix: universal modern. No fallback needed.

**Use when.** Hero wordmarks, premium CTAs, anywhere chrome typography earns the moment.
**Skip when.** Body text, repeated UI elements (overuse cheapens it instantly), small text where the gradient bands are sub-pixel.

> The SUYAN site uses this as the slow ambient drift on the wordmark (`.wordmark__plate { animation: chrome-drift 14s … }`) and as the cursor wave (#10).

---

## 5. Smooth scroll-linked parallax

**Visual outcome.** A background image, decorative element, or hero text moves at a different rate than the page scroll. Adds depth without 3D.

**Vanilla technique.** Two paths.

**Modern: scroll-driven animations API (CSS-only).** Best when supported.
```css
@supports (animation-timeline: scroll()) {
  .parallax-bg {
    animation: drift linear both;
    animation-timeline: scroll(root);   /* root scroller */
    animation-range: entry 0% exit 100%;
  }
  @keyframes drift {
    from { transform: translateY(0); }
    to   { transform: translateY(-30%); }
  }
}
```

**Legacy fallback: scroll listener + RAF.**
```js
const elements = document.querySelectorAll("[data-parallax]");
let ticking = false;

function update() {
  for (const el of elements) {
    const speed = Number(el.dataset.parallax) || 0.4;
    const r = el.getBoundingClientRect();
    const offset = (r.top + r.height / 2 - window.innerHeight / 2) * speed;
    el.style.transform = `translate3d(0, ${offset}px, 0)`;
  }
  ticking = false;
}

window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(update);
}, { passive: true });

update();
```

Combine: use `@supports` to ship the CSS-only version where available, and only run the JS for browsers that lack it.

**Performance.** CSS scroll-driven animations are GPU-only and run on the compositor — basically free. The JS fallback is cheaper than most "parallax libraries" but degrades on busy pages.

**Browser support.**
- `animation-timeline: scroll()` / `view()`: Chrome/Edge 115+ (Jul 2023), Firefox 132+ (Oct 2024). **Safari**: incomplete as of early 2026 — verify before relying on it; ship the JS fallback for Safari users.
- Scroll listener with `{ passive: true }`: universal.

**Use when.** Hero backgrounds, single decorative drift element. Always honour `prefers-reduced-motion: reduce` and disable.
**Skip when.** Long-form articles (induces motion sickness), more than ~3 parallax elements simultaneously (cumulative jank).

---

## 6. Number count-up animation

**Visual outcome.** A number ticks up from 0 to a target on entry, with all stats reaching their target simultaneously regardless of magnitude (so 2.4M and 220K both finish in the same time).

**Vanilla technique.** RAF loop, fixed duration, `easeOutExpo` for a confident "shoot up and settle" feel. Format the value compactly (e.g. `2.4M`) so the ticker reads as it grows. Trigger via IntersectionObserver.

```js
const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function formatNum(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "K";
  return Math.round(n).toString();
}

function countUp(el, target, duration = 1600) {
  const suffix = el.dataset.suffix || "";
  const start  = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = formatNum(target * easeOutExpo(t)) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const target = Number(el.dataset.target);
      if (reduce) el.textContent = formatNum(target) + (el.dataset.suffix || "");
      else        countUp(el, target);
      io.unobserve(el);
    }
  },
  { threshold: 0.05 }
);

document.querySelectorAll("[data-count]").forEach((el) => io.observe(el));
```

Pair with `font-variant-numeric: tabular-nums` so digit width is stable and the number doesn't visibly jiggle as it ticks.

**Performance.** Trivial (one RAF per active counter; auto-stops at target).

**Browser support.** `requestAnimationFrame` + `IntersectionObserver` + `font-variant-numeric: tabular-nums`: all universal modern.

**Use when.** Stats bars, hero metrics, any "X streams / Y followers" moment.
**Skip when.** Numbers that change frequently (a live counter is a different problem; use a different cadence, not an ease-out curve).

> The SUYAN site uses this in `scripts.js` → `animateCount()` + `formatNum()`. Duration is 3000 ms (set per the artist's preference) and the trigger threshold is `0.05` so it fires on initial paint when the stats row is barely visible.

---

## 7. Section transitions (scroll-snap or scroll-driven animations)

**Visual outcome.** Either (a) the page snaps to discrete sections like slides, or (b) sections smoothly fade/translate as they cross into view (the "scroll like a document but feel like a deck" pattern).

**Vanilla technique — A: scroll-snap.** Universally supported, zero JS.
```css
html {
  scroll-snap-type: y mandatory;       /* or 'y proximity' for less aggressive */
  scroll-behavior: smooth;
}
.snap-section {
  scroll-snap-align: start;
  scroll-snap-stop: always;            /* skip-prevention */
  min-height: 100svh;
}
```

**Vanilla technique — B: scroll-driven animations.** Modern; smooth fade/translate driven by viewport position.
```css
@supports (animation-timeline: view()) {
  .section {
    animation: section-in linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 25%;
  }
  @keyframes section-in {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: none; }
  }
}
```
For browsers without `view()`, the IntersectionObserver pattern in #2 is the fallback.

**Performance.** Both are essentially free — handled entirely in CSS / compositor.

**Browser support.**
- `scroll-snap`: universal modern.
- `animation-timeline: view()`: same as #5 (Chrome/Edge 115+, Firefox 132+, Safari incomplete in 2026).

**Use when.**
- Snap: editorial / portfolio sites with discrete "page" sections (hero / about / showcase / contact).
- View timeline: when you want the fade-in to track scroll position exactly, not just fire on threshold.

**Skip when.** Long-form articles (snap fights natural reading). Pages where users habitually use Cmd-F or scroll-up-to-re-read (snap interferes). Forms inside the snapping container.

---

## 8. Text reveal animations (clip-path or word-stagger)

**Visual outcome.** A headline appears via a left-to-right wipe, or its words/lines rise into place one after another.

**Vanilla technique — A: clip-path wipe.** Cheapest. Whole text revealed with a clipping rectangle.
```css
.text-wipe {
  clip-path: inset(0 100% 0 0);
  animation: wipe 800ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
}
@keyframes wipe {
  to { clip-path: inset(0 0 0 0); }
}
```

**Vanilla technique — B: word stagger.** More expressive. Split text into spans, animate each with an indexed delay.
```js
function splitWords(el) {
  const text = el.textContent.trim();
  el.textContent = "";
  text.split(/\s+/).forEach((word, i) => {
    const span = document.createElement("span");
    span.className = "split-word";
    span.style.setProperty("--i", i);
    span.textContent = word;
    el.append(span, document.createTextNode(" "));
  });
  el.setAttribute("aria-label", text);   // preserve readable text for AT
}
```
```css
.split-word {
  display: inline-block;
  opacity: 0;
  transform: translateY(0.6em);
  animation: word-rise 700ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  animation-delay: calc(var(--i, 0) * 60ms);
}
@keyframes word-rise {
  to { opacity: 1; transform: none; }
}
```

For line-by-line reveal, mask each line with `overflow: hidden` and translate inner spans up. (Lines are harder than words because they require measuring the wrapped layout.)

**Performance.** Clip-path: cheap. Stagger: cheap up to ~50 elements simultaneously. Past that, batch.

**Browser support.** `clip-path: inset()`: universal modern. CSS custom properties in `calc()`: universal modern.

**Use when.** Hero headlines, landing-page key copy, "moment" text.
**Skip when.** Body paragraphs (annoying), captions, anything a screen reader will hit. If you split into spans, set `aria-label` on the parent so AT reads the original sentence — otherwise screen readers may read each word with awkward pauses.

---

## 9. Sticky / scroll-pinned sections (`position: sticky`)

**Visual outcome.** An element pins to a position while the user scrolls past, then unpins when its container scrolls out. No JS.

**Vanilla technique.**
```css
.sticky {
  position: sticky;
  top: 0;
  height: 100svh;
}
```

**Common gotchas (the reasons developers wrongly conclude "sticky doesn't work"):**
1. **Any ancestor with `overflow: hidden | auto | scroll`** clips the sticky element's scrolling parent. Find and remove the offending overflow, or move the sticky element outside.
2. **The sticky element's parent must be taller than the sticky element.** If parent height = sticky height, there's nothing to scroll, so it appears not to stick.
3. **`display: flex` parent** is fine, but `align-items: stretch` (default) can make the sticky child the parent's height — defeating it. Use `align-items: flex-start`.

For "sticky scene with content changing as you scroll", combine with scroll-driven animations or IntersectionObserver — the sticky element is the stage, and the "show" is driven by scroll progress through the parent.

**Performance.** Native CSS; effectively free. Far better than `position: fixed` toggled by a scroll listener.

**Browser support.** Universal modern.

**Use when.** Pinned headers, side rails, scroll-based storytelling, sticky table of contents.
**Skip when.** Inside containers that need to clip overflow (you'll need a different approach). Mobile if the sticky element occupies more than ~70% of the viewport (no scroll room left).

---

## 10. Cursor-following spotlight (radial gradient + pointer)

**Visual outcome.** A soft circle of light follows the cursor across an element or section. Variants: hard spotlight, soft glow, multi-ring sonar, lazy-trailing wave.

**Vanilla technique.** CSS custom properties drive a radial gradient; JS only writes `--mx` and `--my`.

**Hard-tracking spotlight** (snaps to cursor):
```css
.spotlight {
  position: relative;
  overflow: hidden;
}
.spotlight::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle 28vw at var(--mx, 50%) var(--my, 50%),
    rgba(255, 255, 255, 0.18) 0%,
    transparent 55%
  );
  pointer-events: none;
  opacity: var(--on, 0);
  transition: opacity 280ms ease;
}
```
```js
function spotlight(el) {
  if (!matchMedia("(hover: hover)").matches) return;
  let raf = 0, x = 50, y = 50;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    x = ((e.clientX - r.left) / r.width)  * 100;
    y = ((e.clientY - r.top)  / r.height) * 100;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      el.style.setProperty("--mx", x + "%");
      el.style.setProperty("--my", y + "%");
      raf = 0;
    });
  });
  el.addEventListener("pointerenter", () => el.style.setProperty("--on", "1"));
  el.addEventListener("pointerleave", () => el.style.setProperty("--on", "0"));
}
document.querySelectorAll(".spotlight").forEach(spotlight);
```

**Lazy-trailing wave** (highlight glides behind the cursor — more refined feel). RAF loop lerps the rendered position toward the cursor target each frame; CSS doesn't change.
```js
let tx = 50, ty = 50, cx = 50, cy = 50, active = false, raf = 0;
const DAMP = 0.08;     // ~600ms convergence at 60fps
function tick() {
  cx += (tx - cx) * DAMP;
  cy += (ty - cy) * DAMP;
  el.style.setProperty("--mx", cx + "%");
  el.style.setProperty("--my", cy + "%");
  raf = active ? requestAnimationFrame(tick) : 0;
}
el.addEventListener("pointerenter", () => {
  el.style.setProperty("--on", "1");
  if (!active) { active = true; raf = requestAnimationFrame(tick); }
});
el.addEventListener("pointerleave", () => {
  el.style.setProperty("--on", "0");
  active = false;
});
el.addEventListener("pointermove", (e) => {
  const r = el.getBoundingClientRect();
  tx = ((e.clientX - r.left) / r.width)  * 100;
  ty = ((e.clientY - r.top)  / r.height) * 100;
});
```

**Multi-ring sonar.** Spawn DOM ring elements at cursor position on a timer; each ring runs its own one-shot `@keyframes` animating an `@property`-registered `--r` length, then removes itself on `animationend`. (Pseudo-elements share state and snap when the cursor moves; DOM rings each capture a birth position.) See `scripts.js` history of the SUYAN site for an example.

**Performance.** Cheap. CSS handles rendering; JS writes 2 numbers per frame at most.

**Browser support.** CSS custom properties in `radial-gradient`: universal modern. `@property` (for animatable lengths): Chrome 85+, Safari 16.4+, Firefox 128+ — all current as of 2026.

**Use when.** Hero sections, card grids, premium feature surfaces, anywhere you want to signal "this responds to you".
**Skip when.** Touch-only contexts (no hover). Reduced-motion users. Sections where the user is reading body text (distracting).

> The SUYAN site uses this on `.wordmark__plate::after` (the lazy-trailing wave) and `.hero__floor-light` (the slow follow on the silver floor).

---

## Browser support summary (early 2026)

| Technique | Chrome | Firefox | Safari | Notes |
|---|---|---|---|---|
| IntersectionObserver | ✅ | ✅ | ✅ | Universal since ~2018 |
| Pointer events | ✅ | ✅ | ✅ | Universal |
| `background-clip: text` | ✅ | ✅ | ✅ | Use `-webkit-` prefix |
| CSS custom properties in gradients | ✅ | ✅ | ✅ | Universal |
| `@property` (animatable lengths) | 85+ | 128+ | 16.4+ | Universal current |
| `clip-path: inset()` | ✅ | ✅ | ✅ | Universal modern |
| `position: sticky` | ✅ | ✅ | ✅ | Universal modern |
| `scroll-snap-*` | ✅ | ✅ | ✅ | Universal modern |
| `animation-timeline: scroll()` | 115+ | 132+ | ⚠️ incomplete | Ship JS fallback for Safari |
| `animation-timeline: view()` | 115+ | 132+ | ⚠️ incomplete | Ship JS fallback for Safari |
| SMIL `<animate>` in SVG | ✅ | ✅ | ✅ | Stable; Chrome's deprecation was reversed |
| `mix-blend-mode` | ✅ | ✅ | ✅ | Universal modern |
| `mask-image` (radial-gradient) | ✅ | ✅ | ✅ | Use `-webkit-` prefix on Safari ≤ 15 |

For anything in the ⚠️ row, wrap in `@supports` and ship a JS fallback. For anything in the ✅ rows, no fallback needed in 2026.

---

## When to reach for a library instead

Vanilla covers ~95% of Framer-Motion-style work cleanly. The genuine cases for a library:

- **Physics-based spring chains** with multiple coupled elements — Framer Motion's spring engine is hard to reproduce in vanilla without writing your own integrator.
- **Complex SVG path morphing or shape interpolation** — `flubber` / `gsap.morphSVG` exist for a reason.
- **Frame-perfect scroll scrubbing across dozens of elements with branching logic** — scroll-driven animations cover the simple version; dense storytelling sequences may justify GSAP ScrollTrigger.

Everything in this document — including effects you'd reach for `framer-motion` for on a Next.js project — works in vanilla without measurable downsides on a static site. Don't import a 30 KB animation library to fade in a section.
