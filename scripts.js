/* SUYAN — v2 (interactive chrome floor) */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const isHover    = () => matchMedia("(hover: hover)").matches;
const isReduced  = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function resolve(path, data) {
  return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), data);
}

/* Bind data into the DOM via four attribute hooks:
     [data-bind="prefix.path"]               → element.textContent
     [data-bind-href="prefix.path"]          → element.href (with optional
                                                data-bind-href-prefix, e.g.
                                                "mailto:" for email links)
     [data-bind-value="prefix.path"]         → element.value (form inputs)
     [data-bind-src="prefix.path"]           → element.src (img / source) */
function bindAll(prefix, data) {
  const head = prefix + ".";
  $$(`[data-bind^="${head}"]`).forEach((el) => {
    const value = resolve(el.getAttribute("data-bind").slice(head.length), data);
    if (value != null) el.textContent = value;
  });
  $$(`[data-bind-href^="${head}"]`).forEach((el) => {
    const value = resolve(el.getAttribute("data-bind-href").slice(head.length), data);
    if (value != null) {
      const pre = el.getAttribute("data-bind-href-prefix") || "";
      el.setAttribute("href", pre + value);
    }
  });
  $$(`[data-bind-value^="${head}"]`).forEach((el) => {
    const value = resolve(el.getAttribute("data-bind-value").slice(head.length), data);
    if (value != null) el.value = value;
  });
  $$(`[data-bind-src^="${head}"]`).forEach((el) => {
    const value = resolve(el.getAttribute("data-bind-src").slice(head.length), data);
    if (value != null) el.setAttribute("src", value);
  });
}

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* Compact-format a number for the stats display:
     2_400_000 → "2.4M"
       220_000 → "220K"        (no decimal once we cross 10K)
       120_000 → "120K"
         9_999 → "10.0K"       (edge case, accepted)
             0 → "0"
   Single-decimal under 10K/10M for granularity, integer above so the
   ticker doesn't read as noise once it's near target. */
function formatNum(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "K";
  return Math.round(n).toString();
}

/* Animate from 0 to `target` over a fixed duration, regardless of value
   magnitude — this is intentional: per-stat pace scales with the target
   so 2.4M and 220K both reach their final number in the same time. */
function animateCount(el, target, duration = 3000) {
  const suffix = el.dataset.suffix || "";
  const start  = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const v = target * easeOutExpo(t);
    el.textContent = formatNum(v) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderStats(items) {
  const root = $("[data-stats]");
  if (!root) return;
  root.innerHTML = "";

  for (const s of items) {
    const li = document.createElement("li");
    li.className = "stats__item";

    const num = document.createElement("span");
    num.className = "stats__num";
    num.dataset.target = String(s.value);
    num.dataset.suffix = s.suffix || "";
    num.textContent = "0" + (s.suffix || "");

    const label = document.createElement("span");
    label.className = "stats__label";
    label.textContent = s.label;

    li.append(num, label);
    root.append(li);
  }

  const nums = $$(".stats__num", root);

  if (isReduced()) {
    nums.forEach((n) => {
      n.textContent = formatNum(Number(n.dataset.target)) + (n.dataset.suffix || "");
    });
    return;
  }

  /* Threshold 0.05 — fires as soon as any pixel of a stat enters viewport.
     Combined with a shortened hero, this means the count-up runs on
     initial load without the user needing to scroll. */
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animateCount(entry.target, Number(entry.target.dataset.target));
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.05 }
  );

  nums.forEach((n) => io.observe(n));
}

/* ------------------------------------------------------------------ */

/* Cursor wave — single soft chrome highlight that lazy-follows the cursor.
   We lerp the rendered position toward the cursor target each frame, so
   the highlight glides smoothly with damping instead of snapping. The
   damping factor (0.08) gives ~600ms to converge — slow and organic. */
function initWordmarkRipple() {
  const el = $(".wordmark__plate");
  if (!el || !isHover()) return;

  const DAMP = 0.08;
  let tx = 50, ty = 50;   // target (true cursor position)
  let cx = 50, cy = 50;   // rendered (lerped) position
  let raf = 0;
  let active = false;

  const tick = () => {
    cx += (tx - cx) * DAMP;
    cy += (ty - cy) * DAMP;
    el.style.setProperty("--mx", cx + "%");
    el.style.setProperty("--my", cy + "%");
    if (active) raf = requestAnimationFrame(tick);
    else raf = 0;
  };

  el.addEventListener("pointerenter", () => {
    el.style.setProperty("--wave", "1");
    if (!active) {
      active = true;
      raf = requestAnimationFrame(tick);
    }
  });
  el.addEventListener("pointerleave", () => {
    el.style.setProperty("--wave", "0");
    active = false;
  });
  el.addEventListener("pointermove", (e) => {
    const rect = el.getBoundingClientRect();
    tx = ((e.clientX - rect.left) / rect.width)  * 100;
    ty = ((e.clientY - rect.top)  / rect.height) * 100;
  });
}

/* Custom cursor follower + cursor-tracked floor light.
   Both fed by a single pointermove handler, RAF-throttled. */
function initCursor() {
  if (!isHover()) return;
  const cursor = $("[data-cursor]");
  const hero   = $(".hero");
  if (!cursor || !hero) return;

  let frame = 0, x = -100, y = -100;
  const apply = () => {
    cursor.style.setProperty("--cx", x + "px");
    cursor.style.setProperty("--cy", y + "px");
    const r = hero.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      hero.style.setProperty("--fx", ((x - r.left) / r.width)  * 100 + "%");
      hero.style.setProperty("--fy", ((y - r.top)  / r.height) * 100 + "%");
    }
    frame = 0;
  };

  document.addEventListener("pointermove", (e) => {
    x = e.clientX; y = e.clientY;
    if (frame) return;
    frame = requestAnimationFrame(apply);
  });

  hero.addEventListener("pointerenter", () => {
    cursor.classList.add("is-active");
    hero.style.setProperty("--cursor-on", "1");
  });
  hero.addEventListener("pointerleave", () => {
    cursor.classList.remove("is-active");
    hero.style.setProperty("--cursor-on", "0");
  });

  /* Hover scale-up over interactive elements */
  $$(".hero a, .hero button, .hero [data-magnetic], .wordmark__plate").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("is-hover"));
  });
}

/* Magnetic pull on elements marked [data-magnetic]. The element nudges
   toward the cursor with damping, snapping back on leave. */
function initMagnetic() {
  if (!isHover()) return;
  $$("[data-magnetic]").forEach((el) => {
    let frame = 0;
    el.addEventListener("pointermove", (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const r  = el.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const dx = (e.clientX - cx) * 0.25;
        const dy = (e.clientY - cy) * 0.25;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        frame = 0;
      });
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
}

/* Click anywhere on the wordmark → expanding ring radiates from the
   click point. Self-cleans on animationend. Skipped under reduced motion. */
function initShockwave() {
  const wm = $(".wordmark");
  if (!wm || isReduced()) return;
  wm.addEventListener("pointerdown", (e) => {
    const ring = document.createElement("div");
    ring.className = "shockwave";
    ring.style.left = e.clientX + "px";
    ring.style.top  = e.clientY + "px";
    document.body.append(ring);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
  });
}

/* Live local time ticker (NYC / Eastern). Updates every second. */
function initTimeTicker() {
  const el = $("[data-time]");
  if (!el) return;
  const tick = () => {
    const t = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: "America/New_York",
    });
    el.textContent = t + " EST";
  };
  tick();
  setInterval(tick, 1000);
}

/* Sticky pill nav — reveals once the hero scrolls out of view. */
function initTopnav() {
  const nav  = $("[data-topnav]");
  const hero = $(".hero");
  if (!nav || !hero) return;
  const io = new IntersectionObserver(
    ([entry]) => nav.classList.toggle("is-visible", !entry.isIntersecting),
    { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
  );
  io.observe(hero);
}

/* Current year into [data-year] elements. */
function initYear() {
  const y = new Date().getFullYear();
  $$("[data-year]").forEach((el) => (el.textContent = y));
}

/* ------------------------------------------------------------------ */

function renderGenres(genres) {
  const root = $("[data-genres]");
  if (!root || !Array.isArray(genres)) return;
  root.innerHTML = "";
  for (const g of genres) {
    const li = document.createElement("li");
    li.className = "about__tag";
    li.textContent = g;
    root.append(li);
  }
}

function renderMusic(tracks) {
  const featuredRoot = $("[data-music-featured]");
  if (featuredRoot && Array.isArray(tracks.featured)) {
    featuredRoot.innerHTML = "";
    for (const t of tracks.featured) {
      featuredRoot.append(buildMusicCard(t));
    }
  }

  const archiveHeading = $("[data-music-archive-heading]");
  const archiveRoot    = $("[data-music-archive]");
  if (archiveRoot) {
    archiveRoot.innerHTML = "";
    if (Array.isArray(tracks.archive) && tracks.archive.length) {
      if (archiveHeading) archiveHeading.hidden = false;
      for (const t of tracks.archive) {
        archiveRoot.append(buildArchiveRow(t));
      }
    }
  }
}

function buildMusicCard(t) {
  const card = document.createElement("article");
  card.className = "music__card";

  const head = document.createElement("header");
  head.className = "music__card-head";

  const platform = document.createElement("span");
  platform.className = "music__card-platform";
  platform.textContent = t.platform || "";

  const right = document.createElement("span");
  right.className = "music__card-meta";
  if (t.date) {
    const date = document.createElement("span");
    date.className = "music__card-date";
    date.textContent = t.date;
    right.append(date);
  }
  if (t.external_url) {
    const link = document.createElement("a");
    link.className = "music__card-link";
    link.href = t.external_url;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", `Open in ${t.platform}`);
    link.textContent = "↗";
    right.append(link);
  }

  head.append(platform, right);

  const title = document.createElement("h3");
  title.className = "music__card-title";
  title.textContent = t.title || "";

  const embed = document.createElement("div");
  embed.className = `music__embed music__embed--${t.platform || "generic"}`;
  if (t.embed_url) {
    const iframe = document.createElement("iframe");
    iframe.src = t.embed_url;
    iframe.loading = "lazy";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
    iframe.title = `${t.title || "Track"} — ${t.platform || ""}`;
    embed.append(iframe);
  }

  card.append(head, title, embed);
  return card;
}

function buildArchiveRow(t) {
  const li = document.createElement("li");
  li.className = "music__archive-item";

  const a = document.createElement("a");
  a.className = "music__archive-link";
  a.href = t.external_url || "#";
  if (t.external_url) {
    a.target = "_blank";
    a.rel = "noopener";
  }

  const title = document.createElement("span");
  title.className = "music__archive-title";
  title.textContent = t.title || "";

  const platform = document.createElement("span");
  platform.className = "music__archive-platform";
  platform.textContent = t.platform || "";

  const date = document.createElement("span");
  date.className = "music__archive-date";
  date.textContent = t.date || "";

  a.append(title, platform, date);
  li.append(a);
  return li;
}

function renderShows(shows) {
  const upcomingRoot   = $("[data-shows-upcoming]");
  const pastRoot       = $("[data-shows-past]");
  const pastHeading    = $("[data-shows-past-heading]");

  const fmtDate = (iso) => {
    if (!iso) return "TBA";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    return `${String(d.getDate()).padStart(2, "0")} ${month} ${d.getFullYear()}`;
  };

  const buildRow = (show, isUpcoming) => {
    const li = document.createElement("li");
    li.className = "show";

    const date = document.createElement("time");
    date.className = "show__date";
    if (show.date) date.dateTime = show.date;
    date.textContent = fmtDate(show.date);

    const venue = document.createElement("span");
    venue.className = "show__venue";
    venue.textContent = show.venue || "—";

    const city = document.createElement("span");
    city.className = "show__city";
    city.textContent = show.city || "";

    const action = document.createElement("span");
    action.className = "show__action";
    if (isUpcoming && show.ticket_url) {
      const a = document.createElement("a");
      a.href = show.ticket_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Tickets →";
      action.append(a);
    } else if (isUpcoming) {
      action.textContent = "TBA";
    } else {
      action.textContent = "Played";
    }

    li.append(date, venue, city, action);
    return li;
  };

  if (upcomingRoot) {
    upcomingRoot.innerHTML = "";
    if (Array.isArray(shows.upcoming) && shows.upcoming.length) {
      shows.upcoming.forEach((s) => upcomingRoot.append(buildRow(s, true)));
    } else {
      const empty = document.createElement("li");
      empty.className = "show show--empty";
      empty.textContent = "No shows announced. Check back soon.";
      upcomingRoot.append(empty);
    }
  }

  if (pastRoot) {
    pastRoot.innerHTML = "";
    if (Array.isArray(shows.past) && shows.past.length) {
      if (pastHeading) pastHeading.hidden = false;
      shows.past.forEach((s) => pastRoot.append(buildRow(s, false)));
    }
  }
}

/* Contact form — POSTs to Web3Forms. Refuses to send if the access key is
   still the placeholder; user updates content.json with their real key. */
function initContactForm() {
  const form   = $("[data-contact-form]");
  const status = $("[data-contact-status]");
  if (!form) return;

  const PLACEHOLDER = "YOUR_WEB3FORMS_ACCESS_KEY";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);

    if (data.get("botcheck")) return;  /* honeypot tripped */

    const key = data.get("access_key");
    if (!key || key === PLACEHOLDER) {
      if (status) status.textContent = "Form not yet configured — use the email link below.";
      return;
    }

    if (status) status.textContent = "Sending…";
    try {
      const res = await fetch(form.action, {
        method:  "POST",
        body:    data,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        form.reset();
        if (status) status.textContent = "Sent. We'll be in touch.";
      } else {
        if (status) status.textContent = "Couldn't send — try the email link below.";
      }
    } catch (err) {
      if (status) status.textContent = "Couldn't send — try the email link below.";
    }
  });
}

/* Cursor-tracked spotlight on cards marked [data-spotlight]. JS only
   writes 2 CSS vars per frame (--light-x, --light-y); CSS draws the
   radial via a pseudo-element and toggles --on for fade in/out.
   See .claude/skills/vanilla-effects/SKILL.md → effect 10. */
function initSpotlights() {
  if (!isHover()) return;

  $$("[data-spotlight]").forEach((host) => {
    let raf = 0;

    host.addEventListener("pointerenter", () => {
      host.style.setProperty("--on", "1");
    });

    host.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect();
        host.style.setProperty("--light-x", ((e.clientX - r.left) / r.width)  * 100 + "%");
        host.style.setProperty("--light-y", ((e.clientY - r.top)  / r.height) * 100 + "%");
        raf = 0;
      });
    });

    host.addEventListener("pointerleave", () => {
      host.style.setProperty("--on", "0");
    });
  });
}

/* 3D cursor-tilt + light-tracker on portrait images marked [data-tilt].
   Uses CSS custom properties so the rendering stays in CSS — JS only
   writes 4 numbers per frame (tilt x/y, light x/y). Hover-only.
   See .claude/skills/vanilla-effects/SKILL.md → effect 10 (cursor
   spotlight) and effect 3 (transform-driven hover). */
function initPortraitTilt() {
  if (!isHover()) return;
  const MAX = 5; /* degrees max tilt */

  $$("[data-tilt]").forEach((host) => {
    const frame = host.querySelector(".about__portrait-frame");
    if (!frame) return;
    let raf = 0;

    host.addEventListener("pointerenter", () => {
      frame.style.setProperty("--on", "1");
    });

    host.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r  = host.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top)  / r.height;
        const tx = (px - 0.5) * 2 * MAX;     /* -MAX → MAX */
        const ty = (py - 0.5) * 2 * MAX;
        frame.style.setProperty("--tilt-y",  tx + "deg");
        frame.style.setProperty("--tilt-x", -ty + "deg");
        frame.style.setProperty("--light-x", px * 100 + "%");
        frame.style.setProperty("--light-y", py * 100 + "%");
        raf = 0;
      });
    });

    host.addEventListener("pointerleave", () => {
      frame.style.setProperty("--tilt-x", "0deg");
      frame.style.setProperty("--tilt-y", "0deg");
      frame.style.setProperty("--on", "0");
    });
  });
}

/* Reveal-on-scroll for sections. Adds .is-visible when entering viewport;
   CSS handles the staggered fade/slide. */
function initSectionReveals() {
  const sections = $$(".section");
  if (!sections.length) return;
  if (isReduced()) {
    sections.forEach((s) => s.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.15 }
  );
  sections.forEach((s) => io.observe(s));
}

/* ------------------------------------------------------------------ */

(async function init() {
  try {
    const [content, stats, tracks, shows] = await Promise.all([
      loadJSON("data/content.json"),
      loadJSON("data/stats.json"),
      loadJSON("data/tracks.json"),
      loadJSON("data/shows.json"),
    ]);
    bindAll("content", content);
    renderStats(stats.items);
    renderGenres(content.genres);
    renderMusic(tracks);
    renderShows(shows);
  } catch (err) {
    console.error("[suyan] init failed:", err);
  }

  initWordmarkRipple();
  initCursor();
  initMagnetic();
  initShockwave();
  initTimeTicker();
  initTopnav();
  initYear();
  initContactForm();
  initSectionReveals();
  initPortraitTilt();
  initSpotlights();
})();
