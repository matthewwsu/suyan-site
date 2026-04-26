# SUYAN Portfolio Site

Personal portfolio and booking site for SUYAN, a NYC-based DJ/producer 
working in house, afrohouse, and trap techno. This file is the source of 
truth for project context. Read it at the start of every session.

## Project goals

- Distinctive artist portfolio that signals taste and craft, not template
- Bookers, labels, press, and fans should land here and immediately get the vibe
- Updatable in 30 seconds from a phone via GitHub mobile (JSON edits only)
- Free or near-free to run forever
- Live at suyan.us

## Aesthetic direction

Chrome/silver as the hero treatment. Grey, black, and white as supporting 
palette. Liquid metal, mirror finishes, brushed steel, Y2K industrial revival.

Reference territory: Arca, Eartheater, SOPHIE, Aphex Twin's site, 
early-2000s industrial design. Editorial weight, intentional whitespace, 
type as a design element.

NOT this: generic dark-mode-with-neon-accents, SaaS portfolio templates, 
glassmorphism, gradient blobs, "modern minimal" that looks like every other 
AI-generated site.

Motion philosophy: chrome shimmer on hover, slow gradient drift, 
scroll-triggered reveals, cursor-reactive accents. Subtle and earned, never 
showy. No heavy WebGL unless it serves the vibe.

Typography: pair a strong display face with weight and presence (think 
something like PP Neue Machina, Editorial New, or a chrome-treated custom 
wordmark) with a clean grotesque or mono for body. Use type at scale as a 
design element, not just for reading.

## Architecture

Static site. Vanilla HTML, CSS, JS. No build step. No framework.
Single repo. Deployed to Firebase Hosting from main branch.
Content is JSON-driven so updates require zero code edits.

### File structure

```
/
├── index.html        single page, all sections inline with anchor IDs
├── styles.css        global styles, chrome palette, motion
├── scripts.js        JSON loaders, bindings, count-up, scroll observers
├── data/
│   ├── content.json  copy: hero tagline, location, about, booking email, social links
│   ├── stats.json    animated count-up values for the stats bar
│   ├── tracks.json   featured + archive: SoundCloud / Spotify embeds
│   └── shows.json    upcoming + past shows
└── assets/
    ├── press/        press photos, EPK PDF
    └── ...           favicons, OG image
```

Edits go through GitHub mobile: open a JSON file, tap the pencil, save.
No local build step. Cloudflare Pages serves the repo as-is.

For local dev, run a static server from the repo root (`fetch()` won't
work over `file://`):

```
python3 -m http.server 8000
# then http://localhost:8000
```

### Content binding

HTML elements declare `data-bind="content.<path>"` and `scripts.js`
fetches `data/content.json` and writes the resolved value into the
element's text. Sections that need richer rendering (stats, tracks,
shows) get dedicated render functions in `scripts.js`.

## Required reading per task type

Before starting work, read the listed files first. These are not
optional — they encode preferences that have already been settled and
cover failure modes that are easy to repeat.

- **Animation, motion, hover effects, scroll behaviour, cursor
  effects, parallax, count-ups, sticky sections, text reveals,
  SVG noise/turbulence, "Framer-style" anything**:
  read `.claude/skills/vanilla-effects/SKILL.md` first. The default
  for every effect on this site is vanilla CSS/JS — do not introduce
  React, Framer Motion, GSAP, Lenis, or any animation library
  without explicit approval. The skill documents performance
  characteristics, browser support, and when to use vs skip each
  technique, plus pointers to where the same patterns are already
  implemented in `scripts.js` / `styles.css`.
- **Frontend design (typography, colour, layout, "make it pop"
  decisions)**: the `frontend-design` skill at
  `.claude/skills/frontend-design/SKILL.md` auto-loads on relevant
  prompts; review it before making aesthetic decisions. Note in
  particular its guidance against converging on common font choices
  (Space Grotesk is called out by name).
- **Content edits**: the source of truth is `data/*.json`. Never
  inline copy into HTML. Every visible text string should resolve
  through `data-bind` or a renderer in `scripts.js`.