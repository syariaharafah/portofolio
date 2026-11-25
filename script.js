const CONFIG = window.PORTFOLIO_CONFIG || {};
const FALLBACK = window.PORTFOLIO_FALLBACK;
const CACHE_KEY = "siti-syariah-portfolio-v2";
const ADMIN_DEMO_KEY = "portfolio-admin-demo-v2";

const escapeHTML = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function safeUrl(value, fallback = "#") {
  if (!value) return fallback;
  try {
    const url = new URL(value, document.baseURI);
    if (["http:", "https:", "mailto:"].includes(url.protocol)) return url.href;
  } catch { /* use fallback */ }
  return fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeData(raw) {
  const data = { ...deepClone(FALLBACK), ...deepClone(raw || {}) };
  data.settings = { ...FALLBACK.settings, ...(raw?.settings || {}) };
  data.texts = { ...FALLBACK.texts, ...(raw?.texts || {}) };
  data.sections = Array.isArray(raw?.sections) ? raw.sections : deepClone(FALLBACK.sections);
  data.profile_facts = Array.isArray(raw?.profile_facts) ? raw.profile_facts : deepClone(FALLBACK.profile_facts);
  data.education = Array.isArray(raw?.education) ? raw.education : deepClone(FALLBACK.education);
  data.portfolio_items = (Array.isArray(raw?.portfolio_items) ? raw.portfolio_items : deepClone(FALLBACK.portfolio_items))
    .map((item) => ({ ...item, media: Array.isArray(item.media) ? item.media : [] }));
  data.custom_sections = (Array.isArray(raw?.custom_sections) ? raw.custom_sections : deepClone(FALLBACK.custom_sections))
    .map((section) => ({ ...section, entries: Array.isArray(section.entries) ? section.entries : [] }));
  return data;
}

function readCache() {
  try {
    if (!CONFIG.supabaseUrl || !CONFIG.supabasePublishableKey) {
      const demo = JSON.parse(localStorage.getItem(ADMIN_DEMO_KEY));
      if (demo?.settings) return demo;
    }
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return cached?.settings ? cached : null;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* cache is optional */ }
}

async function fetchRemoteData() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabasePublishableKey) return null;
  const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/rpc/get_public_portfolio`, {
    method: "POST",
    headers: {
      apikey: CONFIG.supabasePublishableKey,
      Authorization: `Bearer ${CONFIG.supabasePublishableKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error(`Gagal memuat data (${response.status})`);
  const data = await response.json();
  if (!data?.settings || !Array.isArray(data.sections)) throw new Error("Data publik belum siap");
  return normalizeData(data);
}

function sectionByKey(data, key) {
  return data.sections.find((section) => section.section_key === key) || {};
}

function sortedVisible(items = []) {
  return items.filter((item) => item.is_published !== false && item.is_visible !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function mediaFor(item) {
  return [...(item.media || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
}

function lightboxAttributes(item) {
  const slides = mediaFor(item).map((entry) => ({
    src: safeUrl(entry.original_url, entry.thumbnail_url),
    title: entry.alt_text || item.title,
  }));
  return `data-lightbox='${escapeHTML(JSON.stringify(slides))}' data-title="${escapeHTML(item.title)}"`;
}

function renderBrand(settings, texts, footer = false) {
  return `<a class="brand${footer ? " footer-brand" : ""}" href="#beranda" aria-label="${escapeHTML(texts.home_aria)}">
    <span class="brand-mark">${escapeHTML(settings.brand_mark)}</span>
    <span class="brand-copy"><strong>${escapeHTML(settings.brand_name)}</strong><small>${escapeHTML(settings.brand_tagline)}</small></span>
  </a>`;
}

function renderHero(data) {
  const { settings: s, texts: t } = data;
  return `<section class="hero section-shell" id="beranda" aria-labelledby="hero-title">
    <div class="hero-copy reveal">
      <p class="eyebrow"><span></span>${escapeHTML(t.hero_eyebrow)}</p>
      <h1 id="hero-title">${escapeHTML(t.hero_title)}<br><em>${escapeHTML(t.hero_emphasis)}</em></h1>
      <p class="hero-role">${escapeHTML(t.hero_role)}</p>
      <p class="hero-summary">${escapeHTML(t.hero_summary)}</p>
      <div class="hero-actions">
        <a class="button button-primary" href="#pencapaian">${escapeHTML(t.hero_primary_button)}</a>
        <a class="button button-soft" href="${safeUrl(`mailto:${s.email}`)}">${escapeHTML(t.hero_secondary_button)}</a>
      </div>
      <div class="hero-note"><span class="note-line"></span><p><strong>${escapeHTML(t.hero_location_label)}</strong><br>${escapeHTML(t.hero_location)}</p></div>
    </div>
    <div class="hero-visual reveal reveal-delay" aria-label="${escapeHTML(s.profile_image_alt)}">
      <div class="portrait-frame"><div class="portrait-pattern">
        <img class="portrait-photo" src="${safeUrl(s.profile_image_url)}" alt="${escapeHTML(s.profile_image_alt)}" fetchpriority="high" decoding="async">
      </div><div class="orbit-badge" aria-label="${escapeHTML(s.campus_name)}">
        <img src="${safeUrl(s.campus_logo_url)}" alt="${escapeHTML(s.campus_logo_alt)}" decoding="async"><span>${escapeHTML(s.campus_name)}</span>
      </div></div>
    </div>
  </section>`;
}

function renderProfile(data, section) {
  const facts = sortedVisible(data.profile_facts).map((fact) => {
    const value = fact.value_type === "email"
      ? `<a href="${safeUrl(`mailto:${fact.value}`)}">${escapeHTML(fact.value)}</a>`
      : `<strong>${escapeHTML(fact.value)}</strong>`;
    return `<div><span>${escapeHTML(fact.label)}</span>${value}</div>`;
  }).join("");
  const educationCount = sortedVisible(data.education).length;
  const achievements = sortedVisible(data.portfolio_items.filter((item) => item.section_type === "achievement")).length;
  const seminars = sortedVisible(data.portfolio_items.filter((item) => item.section_type === "seminar")).length;
  const experiences = sortedVisible(data.portfolio_items.filter((item) => ["teaching", "organization"].includes(item.section_type))).length;
  return `<section class="profile-strip" id="${escapeHTML(section.anchor)}" aria-labelledby="profile-title">
    <div class="section-shell profile-grid"><div class="section-heading reveal">
      <p class="eyebrow"><span></span>${escapeHTML(section.eyebrow)}</p><h2 id="profile-title">${escapeHTML(section.title)}</h2>
    </div><div class="profile-intro reveal"><p class="lead">${escapeHTML(data.texts.profile_intro)}</p><div class="profile-facts">${facts}</div></div></div>
    <div class="section-shell stats-grid reveal">
      <div class="stat"><strong>${String(educationCount).padStart(2, "0")}</strong><span>${escapeHTML(data.texts.stat_education)}</span></div>
      <div class="stat"><strong>${String(achievements).padStart(2, "0")}</strong><span>${escapeHTML(data.texts.stat_achievement)}</span></div>
      <div class="stat"><strong>${String(seminars).padStart(2, "0")}</strong><span>${escapeHTML(data.texts.stat_training)}</span></div>
      <div class="stat"><strong>${String(experiences).padStart(2, "0")}</strong><span>${escapeHTML(data.texts.stat_experience)}</span></div>
    </div>
  </section>`;
}

function renderEducation(data, section) {
  const items = sortedVisible(data.education).map((item) => `<li class="education-item${item.is_current ? " current" : ""} reveal">
    <div class="edu-year">${escapeHTML(item.period)}</div><div class="edu-marker"><span></span></div>
    <div class="edu-card${item.is_current ? " campus-card" : ""}">${item.is_current ? `<img class="campus-logo" src="${safeUrl(data.settings.campus_logo_url)}" alt="${escapeHTML(data.settings.campus_logo_alt)}" loading="lazy" decoding="async"><div>` : ""}
      <small>${escapeHTML(item.level)}</small><h3>${escapeHTML(item.institution)}</h3><p>${escapeHTML(item.description)}</p>${item.is_current ? "</div>" : ""}
    </div></li>`).join("");
  return `<section class="section-shell education-section" id="${escapeHTML(section.anchor)}" aria-labelledby="education-title">
    <div class="section-heading centered reveal"><p class="eyebrow"><span></span>${escapeHTML(section.eyebrow)}<span></span></p>
      <h2 id="education-title">${escapeHTML(section.title)}</h2><p>${escapeHTML(section.description)}</p></div>
    <ol class="education-timeline">${items || `<li>${escapeHTML(data.texts.empty_message)}</li>`}</ol>
  </section>`;
}

function renderAchievements(data, section) {
  const items = sortedVisible(data.portfolio_items.filter((item) => item.section_type === "achievement"));
  const cards = items.map((item, index) => {
    const first = mediaFor(item)[0];
    return `<article class="achievement-card${item.is_featured ? " featured" : ""} reveal">
      ${first ? `<a class="card-media lightbox-link" href="${safeUrl(first.original_url)}" ${lightboxAttributes(item)}>
        <img src="${safeUrl(first.thumbnail_url || first.original_url)}" alt="${escapeHTML(first.alt_text || item.title)}" loading="lazy" decoding="async"><span>${escapeHTML(data.texts.view_attachment)}</span></a>` : ""}
      <div class="card-body"><p class="card-date">${escapeHTML(item.date_label)}</p><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p><span class="card-index">${String(index + 1).padStart(2, "0")}</span></div>
    </article>`;
  }).join("");
  return `<section class="achievement-section" id="${escapeHTML(section.anchor)}" aria-labelledby="achievement-title"><div class="section-shell">
    <div class="section-heading split-heading reveal"><div><p class="eyebrow light"><span></span>${escapeHTML(section.eyebrow)}</p><h2 id="achievement-title">${escapeHTML(section.title)}</h2></div><p>${escapeHTML(section.description)}</p></div>
    <div class="achievement-grid">${cards || `<p>${escapeHTML(data.texts.empty_message)}</p>`}</div>
  </div></section>`;
}

function renderActivityPanel(data, type, active) {
  const items = sortedVisible(data.portfolio_items.filter((item) => item.section_type === type));
  const cards = items.map((item) => {
    const first = mediaFor(item)[0];
    const count = mediaFor(item).length;
    return `<article>${first ? `<a class="certificate-preview lightbox-link" href="${safeUrl(first.original_url)}" ${lightboxAttributes(item)}>
      <img src="${safeUrl(first.thumbnail_url || first.original_url)}" alt="${escapeHTML(first.alt_text || item.title)}" loading="lazy" decoding="async">
      <span>${count > 1 ? `${count} ${escapeHTML(data.texts.open_gallery)}` : escapeHTML(data.texts.enlarge)}</span></a>` : ""}
      <div><time>${escapeHTML(item.date_label)}</time><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p></div></article>`;
  }).join("");
  return `<div class="activity-panel${active ? " active" : ""}" id="panel-${type}" role="tabpanel" aria-labelledby="tab-${type}"${active ? "" : " hidden"}><div class="activity-list">${cards || `<p>${escapeHTML(data.texts.empty_message)}</p>`}</div></div>`;
}

function renderActivities(data, section) {
  const types = [
    ["seminar", data.texts.tab_seminar], ["teaching", data.texts.tab_teaching], ["organization", data.texts.tab_organization],
  ];
  const tabs = types.map(([type, label], index) => {
    const count = sortedVisible(data.portfolio_items.filter((item) => item.section_type === type)).length;
    return `<button class="tab-button${index === 0 ? " active" : ""}" id="tab-${type}" role="tab" aria-selected="${index === 0}" aria-controls="panel-${type}" data-tab="${type}">${escapeHTML(label)} <span>${String(count).padStart(2, "0")}</span></button>`;
  }).join("");
  return `<section class="section-shell activity-section" id="${escapeHTML(section.anchor)}" aria-labelledby="activity-title">
    <div class="section-heading reveal"><p class="eyebrow"><span></span>${escapeHTML(section.eyebrow)}</p><h2 id="activity-title">${escapeHTML(section.title)}</h2><p>${escapeHTML(section.description)}</p></div>
    <div class="activity-tabs reveal" role="tablist" aria-label="${escapeHTML(section.title)}">${tabs}</div>
    ${types.map(([type], index) => renderActivityPanel(data, type, index === 0)).join("")}
  </section>`;
}

function renderCustom(data, section) {
  const groups = sortedVisible(data.custom_sections);
  const entries = groups.flatMap((group) => sortedVisible(group.entries || []));
  const cards = entries.map((item) => `<article class="placeholder-card reveal"><span class="sample-badge">${escapeHTML(item.badge || data.texts.sample_badge)}</span><div class="placeholder-icon">${escapeHTML(item.icon || "✦")}</div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p></article>`).join("");
  return `<section class="placeholder-section" id="${escapeHTML(section.anchor)}" aria-labelledby="custom-title"><div class="section-shell">
    <div class="section-heading centered reveal"><p class="eyebrow"><span></span>${escapeHTML(section.eyebrow)}<span></span></p><h2 id="custom-title">${escapeHTML(section.title)}</h2><p>${escapeHTML(section.description)}</p></div>
    <div class="placeholder-grid">${cards || `<p>${escapeHTML(data.texts.empty_message)}</p>`}</div>
  </div></section>`;
}

const categoryInfo = {
  achievement: ["prestasi", "gallery_achievement"], seminar: ["seminar", "gallery_seminar"],
  teaching: ["mengajar", "gallery_teaching"], organization: ["organisasi", "gallery_organization"],
};

function renderGallery(data, section) {
  const items = sortedVisible(data.portfolio_items).filter((item) => mediaFor(item).length);
  const totalImages = items.reduce((sum, item) => sum + mediaFor(item).length, 0);
  const filters = [["all", "gallery_all", totalImages], ...Object.entries(categoryInfo).map(([type, [filter, label]]) => [filter, label, items.filter((item) => item.section_type === type).reduce((sum, item) => sum + mediaFor(item).length, 0)])];
  const filterButtons = filters.map(([filter, label, count], index) => `<button class="filter-button${index === 0 ? " active" : ""}" data-filter="${filter}">${escapeHTML(data.texts[label])} <span>${count}</span></button>`).join("");
  const cards = items.map((item) => {
    const first = mediaFor(item)[0];
    const [category, labelKey] = categoryInfo[item.section_type];
    return `<a class="gallery-item lightbox-link${first.is_wide ? " wide" : ""}" data-category="${category}" href="${safeUrl(first.original_url)}" ${lightboxAttributes(item)}>
      <img src="${safeUrl(first.thumbnail_url || first.original_url)}" alt="${escapeHTML(first.alt_text || item.title)}" loading="lazy" decoding="async"><span><b>${escapeHTML(data.texts[labelKey])}</b>${escapeHTML(item.title)}${mediaFor(item).length > 1 ? ` · ${mediaFor(item).length} sertifikat` : ""}</span></a>`;
  }).join("");
  return `<section class="section-shell gallery-section" id="${escapeHTML(section.anchor)}" aria-labelledby="gallery-title">
    <div class="section-heading split-heading dark reveal"><div><p class="eyebrow"><span></span>${escapeHTML(section.eyebrow)}</p><h2 id="gallery-title">${escapeHTML(section.title)}</h2></div><p>${escapeHTML(section.description)}</p></div>
    <div class="gallery-filters reveal" aria-label="${escapeHTML(section.title)}">${filterButtons}</div><div class="gallery-grid" id="gallery-grid">${cards || `<p>${escapeHTML(data.texts.empty_message)}</p>`}</div>
  </section>`;
}

function renderContact(data, section) {
  const { settings: s, texts: t } = data;
  return `<section class="contact-section" id="${escapeHTML(section.anchor)}" aria-labelledby="contact-title"><div class="contact-flower" aria-hidden="true">✿</div>
    <div class="section-shell contact-grid"><div class="contact-copy reveal"><p class="eyebrow light"><span></span>${escapeHTML(section.eyebrow)}</p><h2 id="contact-title">${escapeHTML(section.title)}</h2><p>${escapeHTML(section.description)}</p></div>
    <div class="contact-actions reveal"><a class="contact-email" href="${safeUrl(`mailto:${s.email}`)}"><span>${escapeHTML(t.email_label)}</span><strong>${escapeHTML(s.email)}</strong></a>
      <button class="button button-white copy-email" type="button" data-email="${escapeHTML(s.email)}">${escapeHTML(t.copy_email)}</button>
      <a class="source-download" href="${safeUrl(s.profile_document_url)}" download>${escapeHTML(t.download_profile)}</a></div></div>
  </section>`;
}

function renderSection(data, section) {
  const renderers = {
    home: () => renderHero(data), profile: () => renderProfile(data, section), education: () => renderEducation(data, section),
    achievements: () => renderAchievements(data, section), activities: () => renderActivities(data, section),
    custom: () => renderCustom(data, section), gallery: () => renderGallery(data, section), contact: () => renderContact(data, section),
  };
  return renderers[section.section_key]?.() || "";
}

let currentData = normalizeData(readCache() || FALLBACK);

function renderSite(data) {
  currentData = normalizeData(data);
  const { settings: s, texts: t } = currentData;
  document.title = s.site_title;
  document.querySelector('meta[name="description"]').content = s.meta_description;
  document.querySelector('meta[name="theme-color"]').content = s.primary_color;
  document.documentElement.style.setProperty("--navy", /^#[0-9a-f]{6}$/i.test(s.primary_color) ? s.primary_color : "#123b72");
  document.documentElement.style.setProperty("--blue", /^#[0-9a-f]{6}$/i.test(s.accent_color) ? s.accent_color : "#357fbd");
  document.documentElement.style.setProperty("--blue-2", /^#[0-9a-f]{6}$/i.test(s.accent_color) ? s.accent_color : "#357fbd");
  document.querySelector("#skip-link").textContent = t.skip_link;

  const sections = currentData.sections.filter((section) => section.is_visible !== false).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const nav = document.querySelector("#site-nav");
  nav.setAttribute("aria-label", t.nav_aria);
  nav.innerHTML = `${renderBrand(s, t)}<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav-links"><span></span><span></span><span></span><span class="sr-only">${escapeHTML(t.menu_open)}</span></button>
    <div class="nav-links" id="nav-links">${sections.filter((section) => section.show_in_nav).map((section) => `<a${section.section_key === "contact" ? ' class="nav-contact"' : ""} href="#${escapeHTML(section.anchor)}">${escapeHTML(section.menu_label)}</a>`).join("")}</div>`;
  document.querySelector("#main-content").innerHTML = sections.map((section) => renderSection(currentData, section)).join("");
  document.querySelector("#site-footer").innerHTML = `<div class="section-shell footer-inner">${renderBrand(s, t, true)}<p>${escapeHTML(t.footer_note)}</p><p>© <span id="current-year">${new Date().getFullYear()}</span> ${escapeHTML(t.footer_copyright)}</p></div>`;
  initializeReveals();
  initializeSakura(s);
}

let revealObserver;
function initializeReveals() {
  revealObserver?.disconnect();
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); revealObserver.unobserve(entry.target); }
  }), { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
}

let sakuraAnimations = [];
let sakuraRateFrame = 0;
let lastScrollY = window.scrollY;
let currentRate = 1;
let targetRate = 1;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

function initializeSakura(settings) {
  const layer = document.querySelector(".sakura-layer");
  sakuraAnimations.forEach((animation) => animation.cancel());
  sakuraAnimations = [];
  layer.replaceChildren();
  layer.hidden = !settings.sakura_enabled;
  if (!settings.sakura_enabled) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const random = seededRandom(20261124);
  const requested = Math.min(60, Math.max(8, Number(settings.sakura_density) || 42));
  const count = innerWidth < 560 ? Math.min(25, requested) : requested;
  layer.classList.toggle("is-static", reduced);
  for (let index = 0; index < count; index += 1) {
    const petal = document.createElement("span");
    const size = 9 + random() * 15;
    const opacity = .28 + random() * .38;
    const duration = (13500 + random() * 12500) / Math.max(.5, Number(settings.sakura_speed) || 1);
    const drift = (random() - .5) * 260;
    const rotation = (random() > .5 ? 1 : -1) * (320 + random() * 540);
    const scale = .72 + random() * .5;
    petal.className = "sakura-petal";
    petal.style.setProperty("--petal-x", `${random() * 100}%`);
    petal.style.setProperty("--petal-size", `${size.toFixed(1)}px`);
    petal.style.setProperty("--petal-opacity", opacity.toFixed(2));
    petal.style.setProperty("--static-y", `${random() * 96}%`);
    petal.style.setProperty("--static-rotation", `${Math.round(random() * 360)}deg`);
    layer.append(petal);
    if (reduced || typeof petal.animate !== "function") continue;
    sakuraAnimations.push(petal.animate([
      { transform: `translate3d(0,-14vh,0) rotate(0deg) scale(${scale})`, opacity: 0 },
      { opacity, offset: .08 },
      { transform: `translate3d(${drift * .42}px,45vh,0) rotate(${rotation * .48}deg) scale(${scale * .92})`, opacity, offset: .48 },
      { transform: `translate3d(${drift}px,116vh,0) rotate(${rotation}deg) scale(${scale})`, opacity: .08 },
    ], { duration, delay: -random() * duration, iterations: Infinity, easing: "linear" }));
  }
}

function applySakuraRate(rate) {
  sakuraAnimations.forEach((animation) => typeof animation.updatePlaybackRate === "function" ? animation.updatePlaybackRate(rate) : (animation.playbackRate = rate));
}

function settleSakuraSpeed() {
  targetRate += (1 - targetRate) * .075;
  currentRate += (targetRate - currentRate) * .16;
  applySakuraRate(currentRate);
  if (Math.abs(currentRate - 1) > .015 || Math.abs(targetRate - 1) > .015) sakuraRateFrame = requestAnimationFrame(settleSakuraSpeed);
  else { currentRate = 1; targetRate = 1; applySakuraRate(1); sakuraRateFrame = 0; }
}

const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxTitle = document.querySelector("#lightbox-title");
const lightboxCounter = document.querySelector("#lightbox-counter");
let lightboxSlides = [];
let lightboxIndex = 0;
let touchStartX = null;

function renderLightbox() {
  const slide = lightboxSlides[lightboxIndex];
  if (!slide) return;
  lightboxImage.src = slide.src;
  lightboxImage.alt = slide.title;
  lightboxTitle.textContent = slide.title;
  lightboxCounter.textContent = lightboxSlides.length > 1 ? `${lightboxIndex + 1} / ${lightboxSlides.length}` : "";
  document.querySelector(".lightbox-prev").hidden = lightboxSlides.length < 2;
  document.querySelector(".lightbox-next").hidden = lightboxSlides.length < 2;
}

function moveLightbox(direction) {
  if (lightboxSlides.length < 2) return;
  lightboxIndex = (lightboxIndex + direction + lightboxSlides.length) % lightboxSlides.length;
  renderLightbox();
}

function closeLightbox() {
  if (lightbox.open) lightbox.close();
  lightboxImage.src = "";
  lightboxSlides = [];
  document.body.classList.remove("no-scroll");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

document.addEventListener("click", async (event) => {
  const menu = event.target.closest(".menu-toggle");
  if (menu) {
    const open = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!open));
    menu.classList.toggle("active", !open);
    document.querySelector("#nav-links")?.classList.toggle("open", !open);
    return;
  }
  if (event.target.closest(".nav-links a")) {
    document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
    document.querySelector(".menu-toggle")?.classList.remove("active");
    document.querySelector("#nav-links")?.classList.remove("open");
  }
  const tab = event.target.closest(".tab-button");
  if (tab) {
    document.querySelectorAll(".tab-button").forEach((button) => { const active = button === tab; button.classList.toggle("active", active); button.setAttribute("aria-selected", active); });
    document.querySelectorAll(".activity-panel").forEach((panel) => { const active = panel.id === `panel-${tab.dataset.tab}`; panel.hidden = !active; panel.classList.toggle("active", active); });
    return;
  }
  const filter = event.target.closest(".filter-button");
  if (filter) {
    document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("active", button === filter));
    document.querySelectorAll(".gallery-item").forEach((item) => item.classList.toggle("is-hidden", filter.dataset.filter !== "all" && item.dataset.category !== filter.dataset.filter));
    return;
  }
  const link = event.target.closest(".lightbox-link");
  if (link) {
    event.preventDefault();
    try { lightboxSlides = JSON.parse(link.dataset.lightbox || "[]"); } catch { lightboxSlides = []; }
    if (!lightboxSlides.length) lightboxSlides = [{ src: link.href, title: link.dataset.title || "Lampiran" }];
    lightboxIndex = 0; renderLightbox(); lightbox.showModal(); document.body.classList.add("no-scroll");
    return;
  }
  const copy = event.target.closest(".copy-email");
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.email); showToast(currentData.texts.copy_success); }
    catch { showToast(copy.dataset.email); }
  }
});

document.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
document.querySelector(".lightbox-prev").addEventListener("click", () => moveLightbox(-1));
document.querySelector(".lightbox-next").addEventListener("click", () => moveLightbox(1));
lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
lightbox.addEventListener("close", () => document.body.classList.remove("no-scroll"));
lightbox.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") moveLightbox(-1); if (event.key === "ArrowRight") moveLightbox(1); });
lightboxImage.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
lightboxImage.addEventListener("touchend", (event) => {
  if (touchStartX === null) return;
  const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
  if (Math.abs(distance) > 45) moveLightbox(distance < 0 ? 1 : -1);
  touchStartX = null;
}, { passive: true });

window.addEventListener("scroll", () => {
  document.querySelector(".site-header")?.classList.toggle("scrolled", scrollY > 12);
  const distance = Math.abs(scrollY - lastScrollY);
  lastScrollY = scrollY;
  targetRate = Math.max(targetRate, Math.min(4.6, 1.35 + distance / 14));
  if (!sakuraRateFrame && sakuraAnimations.length) sakuraRateFrame = requestAnimationFrame(settleSakuraSpeed);
}, { passive: true });

document.addEventListener("visibilitychange", () => sakuraAnimations.forEach((animation) => document.hidden ? animation.pause() : animation.play()));

renderSite(currentData);
fetchRemoteData().then((remote) => {
  if (!remote) return;
  writeCache(remote);
  if (remote.content_version !== currentData.content_version) renderSite(remote);
}).catch(() => { /* cached or bundled data remains visible */ });
