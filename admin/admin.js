const CONFIG = window.PORTFOLIO_CONFIG || {};
const FALLBACK = window.PORTFOLIO_FALLBACK;
const TEXT_FIELDS = window.PORTFOLIO_TEXT_FIELDS || [];
const DEMO_KEY = "portfolio-admin-demo-v2";
const OWNER_EMAIL = "arafahsitisyariah@gmail.com";
const SUPABASE_LIBRARY = "https://esm.sh/@supabase/supabase-js@2.119.2?bundle";

const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHTML = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const sortByOrder = (items = []) => [...items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

const viewMeta = {
  dashboard: ["Admin portofolio", "Ringkasan"], identity: ["Isi utama", "Identitas & beranda"],
  sections: ["Isi utama", "Judul setiap bagian"], profile: ["Isi utama", "Biodata"],
  education: ["Isi utama", "Riwayat pendidikan"], achievements: ["Pengalaman", "Pencapaian"],
  seminars: ["Pengalaman", "Seminar & pelatihan"], teaching: ["Pengalaman", "Pengalaman mengajar"],
  organization: ["Pengalaman", "Organisasi"], custom: ["Isi tambahan", "Bagian tambahan"],
  media: ["Pengaturan", "Foto & dokumen"], appearance: ["Pengaturan", "Warna & sakura"],
};

let supabase = null;
let demoMode = false;
let state = clone(FALLBACK);
let currentView = "dashboard";
let recoveryMode = false;

const authPage = document.querySelector("#auth-page");
const adminApp = document.querySelector("#admin-app");
const content = document.querySelector("#admin-content");
const authMessage = document.querySelector("#auth-message");

function toast(message, error = false) {
  const element = document.querySelector("#admin-toast");
  element.textContent = message;
  element.style.background = error ? "#8d3044" : "#0c2d55";
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 2600);
}

function setSaving(message = "Menyimpan…", dirty = true) {
  const status = document.querySelector("#save-state");
  status.textContent = message;
  status.classList.toggle("dirty", dirty);
}

function markSaved() {
  document.querySelectorAll("form.dirty").forEach((form) => form.classList.remove("dirty"));
  setSaving("Semua perubahan tersimpan", false);
}

function persistDemo() {
  if (!demoMode) return;
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch { toast("Penyimpanan demo penuh. Hapus gambar demo besar.", true); }
}

function configured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
}

async function initialize() {
  if (!configured()) {
    document.querySelector("#setup-notice").hidden = false;
    document.querySelector("#login-form").hidden = true;
    document.querySelector(".auth-links").hidden = true;
    return;
  }
  try {
    const { createClient } = await import(SUPABASE_LIBRARY);
    supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") showRecoveryForm();
    });
    const { data } = await supabase.auth.getSession();
    if (data.session && !location.hash.includes("type=recovery")) await enterSupabaseAdmin(data.session.user);
  } catch (error) {
    authMessage.textContent = `Tidak dapat menyiapkan login: ${error.message}`;
  }
}

function showRecoveryForm() {
  recoveryMode = true;
  document.querySelector("#login-title").textContent = "Buat kata sandi baru";
  const form = document.querySelector("#login-form");
  form.hidden = false;
  form.innerHTML = `<label>Kata sandi baru<input type="password" name="password" minlength="8" autocomplete="new-password" required><small>Minimal 8 karakter.</small></label><button class="button button-primary" type="submit">Simpan kata sandi baru</button>`;
  document.querySelector(".auth-links").hidden = true;
}

async function verifyAdmin(user) {
  const { data, error } = await supabase.from("admin_users").select("user_id,email").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function enterSupabaseAdmin(user) {
  authMessage.textContent = "Memeriksa hak akses…";
  try {
    if (!(await verifyAdmin(user))) {
      await supabase.auth.signOut();
      throw new Error("Akun ini tidak memiliki izin admin.");
    }
    demoMode = false;
    await openAdmin();
  } catch (error) { authMessage.textContent = error.message; }
}

async function openAdmin() {
  authPage.hidden = true;
  adminApp.hidden = false;
  document.querySelector("#demo-banner").hidden = !demoMode;
  document.querySelector("#mode-label").textContent = demoMode ? "Demo lokal" : "Tersambung ke Supabase";
  content.innerHTML = `<div class="loading-state">Memuat isi portofolio…</div>`;
  if (demoMode) {
    try { state = JSON.parse(localStorage.getItem(DEMO_KEY)) || clone(FALLBACK); } catch { state = clone(FALLBACK); }
  } else {
    state = await loadSupabaseData();
  }
  renderView("dashboard");
}

async function loadSupabaseData() {
  const queries = await Promise.all([
    supabase.from("site_settings").select("*").eq("id", "main").maybeSingle(),
    supabase.from("site_texts").select("*").order("sort_order"),
    supabase.from("page_sections").select("*").order("sort_order"),
    supabase.from("profile_facts").select("*").order("sort_order"),
    supabase.from("education").select("*").order("sort_order"),
    supabase.from("portfolio_items").select("*, media:portfolio_media(*)").order("sort_order"),
    supabase.from("custom_sections").select("*, entries:custom_entries(*)").order("sort_order"),
  ]);
  const failed = queries.find((query) => query.error);
  if (failed) throw failed.error;
  const texts = Object.fromEntries((queries[1].data || []).map((row) => [row.key, row.value]));
  return {
    content_version: new Date().toISOString(),
    settings: queries[0].data || clone(FALLBACK.settings),
    texts: { ...FALLBACK.texts, ...texts },
    sections: queries[2].data || [], profile_facts: queries[3].data || [], education: queries[4].data || [],
    portfolio_items: (queries[5].data || []).map((item) => ({ ...item, media: sortByOrder(item.media || []) })),
    custom_sections: (queries[6].data || []).map((section) => ({ ...section, entries: sortByOrder(section.entries || []) })),
  };
}

function pageIntro(title, description, action = "") {
  return `<div class="page-intro"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>${action}</div>`;
}

function renderDashboard() {
  const published = state.portfolio_items.filter((item) => item.is_published !== false);
  const counts = [
    [state.education.length, "Riwayat pendidikan", "education"],
    [published.filter((item) => item.section_type === "achievement").length, "Pencapaian", "achievements"],
    [published.filter((item) => item.section_type === "seminar").length, "Seminar & pelatihan", "seminars"],
    [published.filter((item) => item.section_type === "teaching").length, "Pengalaman mengajar", "teaching"],
    [published.filter((item) => item.section_type === "organization").length, "Organisasi", "organization"],
    [state.portfolio_items.reduce((sum, item) => sum + (item.media?.length || 0), 0), "Gambar sertifikat", "media"],
  ];
  const databaseEmpty = !demoMode && state.sections.length === 0;
  return `${pageIntro("Selamat datang", "Pilih bagian yang ingin diubah. Setiap perubahan baru tampil setelah tombol Simpan ditekan.")}
    ${databaseEmpty ? `<div class="panel"><div class="panel-title"><div><h3>Masukkan isi portofolio saat ini</h3><p>Database masih kosong. Tombol ini menyalin seluruh isi, foto, dan urutan dari versi lokal.</p></div></div><button class="button button-primary" id="import-fallback" type="button">Masukkan data awal</button></div>` : ""}
    <div class="dashboard-grid">${counts.map(([count, label, view]) => `<button class="dashboard-card" data-go-view="${view}"><strong>${String(count).padStart(2, "0")}</strong><span>${escapeHTML(label)}</span></button>`).join("")}</div>
    <div class="panel" style="margin-top:20px"><div class="panel-title"><div><h3>Cara mengubah situs</h3><p>Tiga langkah sederhana.</p></div></div><div class="quick-guide">
      <div class="guide-step"><b>1</b><p>Pilih bagian dari menu di sebelah kiri.</p></div><div class="guide-step"><b>2</b><p>Ubah tulisan atau gambar, lalu periksa kembali.</p></div><div class="guide-step"><b>3</b><p>Tekan “Simpan Perubahan”, kemudian buka “Lihat Situs”.</p></div>
    </div></div>`;
}

function inputField(label, name, value, options = {}) {
  const full = options.full ? " full" : "";
  if (options.type === "textarea") return `<label class="${full}">${escapeHTML(label)}<textarea name="${name}"${options.required ? " required" : ""}>${escapeHTML(value)}</textarea>${options.help ? `<small>${escapeHTML(options.help)}</small>` : ""}</label>`;
  if (options.type === "select") return `<label class="${full}">${escapeHTML(label)}<select name="${name}">${options.choices.map(([key, text]) => `<option value="${escapeHTML(key)}"${String(value) === String(key) ? " selected" : ""}>${escapeHTML(text)}</option>`).join("")}</select></label>`;
  if (options.type === "checkbox") return `<label class="check-label${full}"><input type="checkbox" name="${name}"${value ? " checked" : ""}>${escapeHTML(label)}</label>`;
  return `<label class="${full}">${escapeHTML(label)}<input type="${options.type || "text"}" name="${name}" value="${escapeHTML(value)}"${options.required ? " required" : ""}${options.min !== undefined ? ` min="${options.min}"` : ""}${options.max !== undefined ? ` max="${options.max}"` : ""}>${options.help ? `<small>${escapeHTML(options.help)}</small>` : ""}</label>`;
}

function renderIdentity() {
  const s = state.settings;
  const t = state.texts;
  return `${pageIntro("Identitas & beranda", "Ubah nama, email, peran, ringkasan, tombol, dan domisili yang tampil paling atas.")}
    <form class="panel" data-form="identity"><div class="panel-title"><div><h3>Identitas situs</h3><p>Informasi yang dipakai pada judul browser dan bagian utama.</p></div></div>
      <div class="form-grid two">
        ${inputField("Judul situs", "site_title", s.site_title, { full: true, required: true })}
        ${inputField("Deskripsi untuk mesin pencari", "meta_description", s.meta_description, { type: "textarea", full: true })}
        ${inputField("Huruf logo", "brand_mark", s.brand_mark)}${inputField("Nama merek", "brand_name", s.brand_name)}
        ${inputField("Tulisan kecil merek", "brand_tagline", s.brand_tagline)}${inputField("Alamat email", "email", s.email, { type: "email", required: true })}
        ${inputField("Nama kampus", "campus_name", s.campus_name, { full: true })}
      </div><h4 class="group-heading">Tulisan beranda</h4><div class="form-grid two">
        ${inputField("Tulisan kecil", "hero_eyebrow", t.hero_eyebrow)}${inputField("Nama bagian pertama", "hero_title", t.hero_title)}
        ${inputField("Nama bagian kedua", "hero_emphasis", t.hero_emphasis)}${inputField("Peran atau profesi", "hero_role", t.hero_role)}
        ${inputField("Ringkasan", "hero_summary", t.hero_summary, { type: "textarea", full: true })}
        ${inputField("Tulisan tombol perjalanan", "hero_primary_button", t.hero_primary_button)}${inputField("Tulisan tombol email", "hero_secondary_button", t.hero_secondary_button)}
        ${inputField("Label domisili", "hero_location_label", t.hero_location_label)}${inputField("Isi domisili", "hero_location", t.hero_location)}
        ${inputField("Pengantar profil", "profile_intro", t.profile_intro, { type: "textarea", full: true })}
      </div><div class="form-actions"><a class="button button-ghost" href="../" target="_blank">Pratinjau situs</a><button class="button button-primary" type="submit">Simpan perubahan</button></div>
    </form>`;
}

function renderSections() {
  const grouped = TEXT_FIELDS.reduce((result, field) => { (result[field.group] ||= []).push(field); return result; }, {});
  const staticTexts = Object.entries(grouped).map(([group, fields]) => `<h4 class="group-heading">${escapeHTML(group)}</h4><div class="form-grid two">${fields.map((field) => inputField(field.label, field.key, state.texts[field.key] || "", { type: field.input, full: field.input === "textarea" })).join("")}</div>`).join("");
  const sections = sortByOrder(state.sections).map((section, index) => `<details class="entity-card"${index === 0 ? " open" : ""}><summary><span class="entity-number">${index + 1}</span><span class="entity-summary"><strong>${escapeHTML(section.title || section.menu_label)}</strong><small>${escapeHTML(section.menu_label)}</small></span><span class="status-pill${section.is_visible ? "" : " draft"}">${section.is_visible ? "Ditampilkan" : "Disembunyikan"}</span></summary><div class="entity-body">
    <form data-section-form data-id="${escapeHTML(section.section_key)}"><div class="form-grid two">
      ${inputField("Nama menu", "menu_label", section.menu_label)}${inputField("Tulisan kecil", "eyebrow", section.eyebrow)}
      ${inputField("Judul bagian", "title", section.title, { full: true })}${inputField("Penjelasan bagian", "description", section.description, { type: "textarea", full: true })}
      ${inputField("Tampilkan bagian", "is_visible", section.is_visible, { type: "checkbox" })}${inputField("Tampilkan di menu", "show_in_nav", section.show_in_nav, { type: "checkbox" })}
    </div><div class="form-actions"><button class="button button-primary" type="submit">Simpan bagian ini</button></div></form>
  </div></details>`).join("");
  return `${pageIntro("Semua tulisan umum", "Di sini Anda dapat mengubah label tombol, filter galeri, footer, pesan, nama menu, dan judul setiap bagian.")}
    <form class="panel" data-form="texts"><div class="panel-title"><div><h3>Tulisan tombol dan label</h3><p>Semua tulisan pendek yang digunakan di seluruh halaman publik.</p></div></div>${staticTexts}<div class="form-actions"><button class="button button-primary" type="submit">Simpan semua tulisan</button></div></form>
    <div class="panel-title"><div><h3>Judul setiap bagian</h3><p>Bagian dapat disembunyikan tanpa menghapus isinya.</p></div></div>${sections || `<div class="empty-state">Belum ada bagian. Masukkan data awal dari Ringkasan.</div>`}`;
}

const collectionDefinitions = {
  profile: { title: "Biodata", description: "Ubah label dan isi informasi pribadi. Anda dapat menambah, menyembunyikan, atau mengurutkannya.", key: "profile_facts", table: "profile_facts", prefix: "fact", fields: [
    ["Label", "label", "text"], ["Isi", "value", "text"], ["Jenis isi", "value_type", "select", [["text", "Teks biasa"], ["email", "Alamat email"]]], ["Tampilkan", "is_published", "checkbox"],
  ] },
  education: { title: "Riwayat pendidikan", description: "Tuliskan periode, jenjang, nama sekolah atau kampus, dan keterangannya.", key: "education", table: "education", prefix: "edu", fields: [
    ["Periode", "period", "text"], ["Jenjang", "level", "text"], ["Nama sekolah atau kampus", "institution", "text"], ["Keterangan", "description", "textarea"], ["Pendidikan saat ini", "is_current", "checkbox"], ["Tampilkan", "is_published", "checkbox"],
  ] },
};

const portfolioViewTypes = { achievements: "achievement", seminars: "seminar", teaching: "teaching", organization: "organization" };

function entityFields(item, definition) {
  return definition.fields.map(([label, name, type, choices]) => inputField(label, name, item[name] ?? "", { type, choices, full: type === "textarea" })).join("");
}

function renderCollection(view) {
  const definition = collectionDefinitions[view];
  const list = sortByOrder(state[definition.key] || []);
  const cards = list.map((item, index) => `<details class="entity-card"${index === 0 ? " open" : ""}><summary><span class="entity-number">${index + 1}</span><span class="entity-summary"><strong>${escapeHTML(item.label || item.institution || "Item baru")}</strong><small>${escapeHTML(item.value || item.period || "Belum diisi")}</small></span><span class="status-pill${item.is_published ? "" : " draft"}">${item.is_published ? "Tayang" : "Draft"}</span></summary><div class="entity-body">
    <form data-entity-form data-key="${definition.key}" data-table="${definition.table}" data-id="${escapeHTML(item.id)}"><div class="form-grid two">${entityFields(item, definition)}</div>${entityActions(index, list.length)}</form>
  </div></details>`).join("");
  return `${pageIntro(definition.title, definition.description, `<button class="button button-primary" type="button" data-add-entity="${view}">Tambah baru</button>`)}${cards || `<div class="empty-state">Belum ada data. Tekan “Tambah baru” untuk mulai mengisi.</div>`}`;
}

function entityActions(index, length) {
  return `<div class="form-actions"><button class="button button-ghost" type="button" data-move="up"${index === 0 ? " disabled" : ""}>Naik</button><button class="button button-ghost" type="button" data-move="down"${index === length - 1 ? " disabled" : ""}>Turun</button><button class="button button-danger" type="button" data-delete-entity>Hapus</button><button class="button button-primary" type="submit">Simpan perubahan</button></div>`;
}

function renderMediaStrip(item) {
  const cards = sortByOrder(item.media || []).map((entry) => `<form class="media-card" data-media-form data-item-id="${escapeHTML(item.id)}" data-media-id="${escapeHTML(entry.id)}"><img src="${escapeHTML(entry.thumbnail_url || entry.original_url)}" alt="${escapeHTML(entry.alt_text || item.title)}"><div class="media-card-body"><input name="alt_text" value="${escapeHTML(entry.alt_text || "")}" aria-label="Keterangan gambar"><div class="media-card-actions"><button type="submit">Simpan teks</button><button type="button" data-delete-media>Hapus</button></div></div></form>`).join("");
  return `<div class="media-strip">${cards}</div><label class="upload-box">Tambah gambar sertifikat<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-media-upload data-item-id="${escapeHTML(item.id)}"><small>Maksimal 10 MB per gambar. Thumbnail WebP dibuat otomatis.</small></label>`;
}

function renderPortfolio(view) {
  const type = portfolioViewTypes[view];
  const title = viewMeta[view][1];
  const descriptions = {
    achievements: "Kelola prestasi beserta tanggal, penjelasan, dan lampirannya.", seminars: "Kelola semua seminar, workshop, pelatihan, dan sertifikatnya.",
    teaching: "Satu pengalaman dapat memiliki beberapa sertifikat yang dibuka sebagai slider.", organization: "Kelola pengalaman organisasi dan bukti sertifikatnya.",
  };
  const list = sortByOrder(state.portfolio_items.filter((item) => item.section_type === type));
  const cards = list.map((item, index) => `<details class="entity-card"${index === 0 ? " open" : ""}><summary><span class="entity-number">${index + 1}</span><span class="entity-summary"><strong>${escapeHTML(item.title || "Item baru")}</strong><small>${escapeHTML(item.date_label || "Tanggal belum diisi")}</small></span><span class="status-pill${item.is_published ? "" : " draft"}">${item.is_published ? "Tayang" : "Draft"}</span></summary><div class="entity-body">
    <form data-entity-form data-key="portfolio_items" data-table="portfolio_items" data-type="${type}" data-id="${escapeHTML(item.id)}"><div class="form-grid two">
      ${inputField("Tanggal atau periode", "date_label", item.date_label)}${inputField("Judul", "title", item.title, { required: true })}${inputField("Penjelasan", "description", item.description, { type: "textarea", full: true })}
      ${type === "achievement" ? inputField("Jadikan kartu unggulan", "is_featured", item.is_featured, { type: "checkbox" }) : ""}${inputField("Tampilkan di situs", "is_published", item.is_published, { type: "checkbox" })}
    </div>${entityActions(index, list.length)}</form><h4 class="group-heading">Gambar sertifikat</h4>${renderMediaStrip(item)}
  </div></details>`).join("");
  return `${pageIntro(title, descriptions[view], `<button class="button button-primary" type="button" data-add-portfolio="${type}">Tambah baru</button>`)}${cards || `<div class="empty-state">Belum ada data. Tekan “Tambah baru” untuk mulai mengisi.</div>`}`;
}

function renderCustom() {
  const groups = sortByOrder(state.custom_sections || []);
  const output = groups.map((group, groupIndex) => `<div class="panel"><form data-custom-section-form data-id="${escapeHTML(group.id)}"><div class="panel-title"><div><h3>${escapeHTML(group.title || "Bagian baru")}</h3><p>Judul kelompok dan kartu-kartu di dalamnya.</p></div></div><div class="form-grid two">
    ${inputField("Judul kelompok", "title", group.title, { required: true })}${inputField("Tampilkan kelompok", "is_visible", group.is_visible, { type: "checkbox" })}${inputField("Penjelasan", "description", group.description, { type: "textarea", full: true })}
    </div><div class="form-actions"><button class="button button-danger" type="button" data-delete-custom-section>Hapus kelompok</button><button class="button button-primary" type="submit">Simpan kelompok</button></div></form>
    <h4 class="group-heading">Isi kelompok</h4>${sortByOrder(group.entries || []).map((entry, index) => `<details class="entity-card"><summary><span class="entity-number">${index + 1}</span><span class="entity-summary"><strong>${escapeHTML(entry.title || "Kartu baru")}</strong><small>${escapeHTML(entry.badge || "")}</small></span></summary><div class="entity-body"><form data-custom-entry-form data-section-id="${escapeHTML(group.id)}" data-id="${escapeHTML(entry.id)}"><div class="form-grid two">
      ${inputField("Label kecil", "badge", entry.badge)}${inputField("Ikon", "icon", entry.icon)}${inputField("Judul kartu", "title", entry.title, { full: true, required: true })}${inputField("Penjelasan", "description", entry.description, { type: "textarea", full: true })}${inputField("Tampilkan", "is_published", entry.is_published, { type: "checkbox" })}
      </div>${entityActions(index, group.entries.length)}</form></div></details>`).join("") || `<div class="empty-state">Belum ada kartu.</div>`}
    <button class="button button-soft" type="button" data-add-custom-entry="${escapeHTML(group.id)}">Tambah kartu di kelompok ini</button></div>`).join("");
  return `${pageIntro("Bagian tambahan", "Buat kelompok baru seperti keterampilan, proyek, pengalaman kerja, atau informasi lain.", `<button class="button button-primary" type="button" id="add-custom-section">Tambah kelompok</button>`)}${output || `<div class="empty-state">Belum ada kelompok tambahan.</div>`}`;
}

function renderMedia() {
  const s = state.settings;
  const mediaItems = [
    ["Foto utama", "profile_image_url", s.profile_image_url, s.profile_image_alt, "image/*", "profile"],
    ["Logo kampus", "campus_logo_url", s.campus_logo_url, s.campus_logo_alt, "image/*", "logos"],
    ["Dokumen profil", "profile_document_url", "", s.profile_document_url, ".pdf,.doc,.docx", "documents"],
  ];
  return `${pageIntro("Foto & dokumen", "Ganti foto utama, logo kampus, atau dokumen profil. Sertifikat diunggah dari menu pengalaman masing-masing.")}${mediaItems.map(([title, key, preview, description, accept, folder]) => `<div class="panel"><div class="panel-title"><div><h3>${title}</h3><p>${escapeHTML(description || "Belum ada berkas")}</p></div></div><div class="current-media">${preview ? `<img src="${escapeHTML(preview)}" alt="${escapeHTML(title)}">` : `<div class="empty-state">DOCX / PDF</div>`}<div><label class="upload-box">Pilih berkas baru<input type="file" accept="${accept}" data-setting-upload="${key}" data-folder="${folder}"><small>${folder === "documents" ? "Maksimal 15 MB." : "Gambar akan dioptimalkan otomatis."}</small></label></div></div></div>`).join("")}`;
}

function renderAppearance() {
  const s = state.settings;
  return `${pageIntro("Warna & sakura", "Atur warna utama dan gerakan bunga tanpa mengubah desain halaman.")}
    <form class="panel" data-form="appearance"><div class="panel-title"><div><h3>Tampilan situs</h3><p>Perubahan warna dan animasi berlaku untuk seluruh halaman publik.</p></div></div><div class="form-grid two">
      ${inputField("Warna biru tua", "primary_color", s.primary_color, { type: "color" })}${inputField("Warna biru aksen", "accent_color", s.accent_color, { type: "color" })}
      ${inputField("Tampilkan sakura", "sakura_enabled", s.sakura_enabled, { type: "checkbox" })}${inputField("Jumlah bunga sakura", "sakura_density", s.sakura_density, { type: "number", min: 8, max: 60 })}
      ${inputField("Kecepatan dasar", "sakura_speed", s.sakura_speed, { type: "number", min: .5, max: 2 })}
    </div><div class="form-actions"><button class="button button-primary" type="submit">Simpan tampilan</button></div></form>`;
}

function renderView(view) {
  currentView = view;
  const [kicker, title] = viewMeta[view];
  document.querySelector("#view-kicker").textContent = kicker;
  document.querySelector("#view-title").textContent = title;
  document.querySelectorAll(".admin-nav button[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const renderers = {
    dashboard: renderDashboard, identity: renderIdentity, sections: renderSections,
    profile: () => renderCollection("profile"), education: () => renderCollection("education"),
    achievements: () => renderPortfolio("achievements"), seminars: () => renderPortfolio("seminars"),
    teaching: () => renderPortfolio("teaching"), organization: () => renderPortfolio("organization"),
    custom: renderCustom, media: renderMedia, appearance: renderAppearance,
  };
  content.innerHTML = renderers[view]();
  document.querySelector("#sidebar").classList.remove("open");
  markSaved();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formValue(form, name, fallback = "") {
  const field = form.elements[name];
  if (!field) return fallback;
  return field.type === "checkbox" ? field.checked : field.value.trim();
}

async function upsert(table, rows) {
  if (demoMode) { persistDemo(); return; }
  const list = Array.isArray(rows) ? rows : [rows];
  const { error } = await supabase.from(table).upsert(list);
  if (error) throw error;
}

async function removeRow(table, id) {
  if (demoMode) { persistDemo(); return; }
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

async function saveSettings(fields) {
  Object.assign(state.settings, fields, { id: "main" });
  await upsert("site_settings", state.settings);
}

async function saveTextKeys(keys) {
  const rows = keys.map((key) => {
    const definition = TEXT_FIELDS.find((field) => field.key === key) || {};
    return { key, value: state.texts[key] || "", group_key: definition.group || "Lainnya", label: definition.label || key, input_type: definition.input || "text", sort_order: TEXT_FIELDS.findIndex((field) => field.key === key), is_public: true };
  });
  await upsert("site_texts", rows);
}

function findEntity(key, id) {
  return state[key]?.find((item) => item.id === id);
}

async function saveEntityForm(form) {
  const { key, table, id } = form.dataset;
  const item = findEntity(key, id);
  if (!item) return;
  if (key === "profile_facts") Object.assign(item, { label: formValue(form, "label"), value: formValue(form, "value"), value_type: formValue(form, "value_type", "text"), is_published: formValue(form, "is_published", true) });
  if (key === "education") Object.assign(item, { period: formValue(form, "period"), level: formValue(form, "level"), institution: formValue(form, "institution"), description: formValue(form, "description"), is_current: formValue(form, "is_current"), is_published: formValue(form, "is_published", true) });
  if (key === "portfolio_items") Object.assign(item, { date_label: formValue(form, "date_label"), title: formValue(form, "title"), description: formValue(form, "description"), is_featured: formValue(form, "is_featured", false), is_published: formValue(form, "is_published", true) });
  const row = { ...item }; delete row.media;
  await upsert(table, row);
}

async function reorder(key, type, id, direction, table, nestedSection = null) {
  let list = nestedSection ? nestedSection.entries : state[key];
  if (type) list = list.filter((item) => item.section_type === type);
  list = sortByOrder(list);
  const index = list.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return;
  [list[index].sort_order, list[target].sort_order] = [list[target].sort_order, list[index].sort_order];
  await upsert(table, [list[index], list[target]].map((item) => { const row = { ...item }; delete row.media; return row; }));
  persistDemo();
}

async function importFallback() {
  const source = clone(FALLBACK);
  setSaving("Memasukkan data awal…");
  await upsert("site_settings", source.settings);
  state = source;
  await saveTextKeys(Object.keys(source.texts));
  await upsert("page_sections", source.sections);
  await upsert("profile_facts", source.profile_facts);
  await upsert("education", source.education);
  await upsert("portfolio_items", source.portfolio_items.map((item) => { const row = { ...item }; delete row.media; return row; }));
  await upsert("portfolio_media", source.portfolio_items.flatMap((item) => item.media));
  await upsert("custom_sections", source.custom_sections.map((section) => { const row = { ...section }; delete row.entries; return row; }));
  await upsert("custom_entries", source.custom_sections.flatMap((section) => section.entries));
  state = await loadSupabaseData();
  toast("Data awal berhasil dimasukkan");
  renderView("dashboard");
}

function sanitizeName(name) {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
}

async function compressImage(file, maxWidth = 720, quality = .82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Gambar tidak dapat diproses")), "image/webp", quality));
}

async function uploadFile(path, file, contentType = file.type) {
  const { error } = await supabase.storage.from(CONFIG.storageBucket || "portfolio-media").upload(path, file, { cacheControl: "31536000", contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(CONFIG.storageBucket || "portfolio-media").getPublicUrl(path).data.publicUrl;
}

async function uploadItemMedia(itemId, files) {
  const item = findEntity("portfolio_items", itemId);
  if (!item) return;
  for (const file of files) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: gunakan gambar maksimal 10 MB`);
    setSaving(`Mengunggah ${file.name}…`);
    const id = uid("media");
    if (demoMode) {
      item.media ||= [];
      item.media.push({ id, item_id: itemId, original_url: URL.createObjectURL(file), thumbnail_url: URL.createObjectURL(file), alt_text: `Sertifikat ${item.title}`, sort_order: item.media.length, is_wide: false });
      continue;
    }
    const unique = `${Date.now()}-${crypto.randomUUID()}`;
    const originalPath = `certificates/${itemId}/${unique}-${sanitizeName(file.name)}`;
    const thumbPath = `certificates/${itemId}/${unique}-thumb.webp`;
    const thumbnail = await compressImage(file);
    const [originalUrl, thumbnailUrl] = await Promise.all([uploadFile(originalPath, file), uploadFile(thumbPath, thumbnail, "image/webp")]);
    const row = { id, item_id: itemId, original_url: originalUrl, thumbnail_url: thumbnailUrl, original_path: originalPath, thumbnail_path: thumbPath, alt_text: `Sertifikat ${item.title}`, sort_order: item.media?.length || 0, is_wide: false };
    await upsert("portfolio_media", row);
    (item.media ||= []).push(row);
  }
  persistDemo();
  toast("Gambar sertifikat berhasil ditambahkan");
  renderView(currentView);
}

async function uploadSetting(field, folder, file) {
  const maxSize = folder === "documents" ? 15 : 10;
  if (file.size > maxSize * 1024 * 1024) throw new Error(`Ukuran berkas maksimal ${maxSize} MB`);
  setSaving(`Mengunggah ${file.name}…`);
  let upload = file;
  let extension = sanitizeName(file.name);
  let contentType = file.type;
  if (folder !== "documents") { upload = await compressImage(file, 1200, .86); extension = `${crypto.randomUUID()}.webp`; contentType = "image/webp"; }
  let url;
  if (demoMode) url = URL.createObjectURL(upload);
  else url = await uploadFile(`${folder}/${Date.now()}-${extension}`, upload, contentType);
  await saveSettings({ [field]: url });
  persistDemo();
  toast("Berkas berhasil diganti");
  renderView("media");
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  authMessage.textContent = "";
  try {
    if (recoveryMode) {
      const { error } = await supabase.auth.updateUser({ password: form.password.value });
      if (error) throw error;
      recoveryMode = false; location.hash = ""; toast("Kata sandi berhasil diperbarui");
      const { data } = await supabase.auth.getUser(); await enterSupabaseAdmin(data.user); return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
    if (error) throw error;
    await enterSupabaseAdmin(data.user);
  } catch (error) { authMessage.textContent = error.message === "Invalid login credentials" ? "Email atau kata sandi belum benar." : error.message; }
  finally { button.disabled = false; }
});

document.querySelector("#demo-button").addEventListener("click", async () => { demoMode = true; await openAdmin(); });
document.querySelectorAll("[data-auth-action]").forEach((button) => button.addEventListener("click", async () => {
  const form = document.querySelector("#login-form");
  const email = form.email.value.trim();
  const password = form.password.value;
  authMessage.textContent = "";
  try {
    if (button.dataset.authAction === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("./", location.href).href });
      if (error) throw error;
      authMessage.style.color = "#267052"; authMessage.textContent = "Tautan pemulihan telah dikirim ke email admin.";
    } else {
      if (email.toLowerCase() !== OWNER_EMAIL) throw new Error("Akun pertama hanya dapat memakai email pemilik.");
      if (password.length < 8) throw new Error("Isi kata sandi minimal 8 karakter terlebih dahulu.");
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL("./", location.href).href } });
      if (error) throw error;
      authMessage.style.color = "#267052";
      authMessage.textContent = data.session ? "Akun aktif. Menyiapkan admin…" : "Periksa email untuk mengonfirmasi akun admin pertama.";
      if (data.session) await enterSupabaseAdmin(data.user);
    }
  } catch (error) { authMessage.style.color = "#b93d56"; authMessage.textContent = error.message; }
}));

document.querySelector("#logout-button").addEventListener("click", async () => {
  if (!demoMode) await supabase.auth.signOut();
  location.reload();
});
document.querySelector("#sidebar-toggle").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelectorAll(".admin-nav button[data-view]").forEach((button) => button.addEventListener("click", () => {
  if (document.querySelector("form.dirty") && !confirm("Ada perubahan yang belum disimpan. Tetap pindah menu?")) return;
  renderView(button.dataset.view);
}));

content.addEventListener("input", (event) => {
  const form = event.target.closest("form");
  if (form) { form.classList.add("dirty"); setSaving("Ada perubahan yang belum disimpan"); }
});

content.addEventListener("click", async (event) => {
  const go = event.target.closest("[data-go-view]"); if (go) return renderView(go.dataset.goView);
  if (event.target.closest("#import-fallback")) { try { await importFallback(); } catch (error) { toast(error.message, true); markSaved(); } return; }
  const addCollection = event.target.closest("[data-add-entity]");
  if (addCollection) {
    const definition = collectionDefinitions[addCollection.dataset.addEntity];
    const item = definition.key === "profile_facts"
      ? { id: uid(definition.prefix), label: "Label baru", value: "", value_type: "text", sort_order: state[definition.key].length, is_published: false }
      : { id: uid(definition.prefix), period: "", level: "", institution: "Pendidikan baru", description: "", is_current: false, sort_order: state[definition.key].length, is_published: false };
    state[definition.key].push(item); renderView(addCollection.dataset.addEntity); return;
  }
  const addPortfolio = event.target.closest("[data-add-portfolio]");
  if (addPortfolio) {
    const type = addPortfolio.dataset.addPortfolio;
    state.portfolio_items.push({ id: uid(type), section_type: type, date_label: "", title: "Item baru", description: "", sort_order: state.portfolio_items.filter((item) => item.section_type === type).length, is_featured: false, is_published: false, media: [] });
    renderView(currentView); return;
  }
  if (event.target.closest("#add-custom-section")) {
    state.custom_sections.push({ id: uid("section"), title: "Bagian baru", description: "", sort_order: state.custom_sections.length, is_visible: false, entries: [] });
    renderView("custom"); return;
  }
  const addCustomEntry = event.target.closest("[data-add-custom-entry]");
  if (addCustomEntry) {
    const group = state.custom_sections.find((section) => section.id === addCustomEntry.dataset.addCustomEntry);
    group.entries.push({ id: uid("entry"), custom_section_id: group.id, badge: "Konten baru", icon: "✦", title: "Kartu baru", description: "", sort_order: group.entries.length, is_published: false });
    renderView("custom"); return;
  }
  const deleteEntity = event.target.closest("[data-delete-entity]");
  if (deleteEntity) {
    const form = deleteEntity.closest("form[data-entity-form]");
    if (!confirm("Hapus item ini beserta lampirannya? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      await removeRow(form.dataset.table, form.dataset.id);
      state[form.dataset.key] = state[form.dataset.key].filter((item) => item.id !== form.dataset.id);
      persistDemo(); toast("Item berhasil dihapus"); renderView(currentView);
    } catch (error) { toast(error.message, true); }
    return;
  }
  const move = event.target.closest("[data-move]");
  if (move) {
    const form = move.closest("form");
    try {
      if (form.matches("[data-entity-form]")) await reorder(form.dataset.key, form.dataset.type, form.dataset.id, move.dataset.move, form.dataset.table);
      else if (form.matches("[data-custom-entry-form]")) { const group = state.custom_sections.find((section) => section.id === form.dataset.sectionId); await reorder("custom_entries", null, form.dataset.id, move.dataset.move, "custom_entries", group); }
      renderView(currentView);
    } catch (error) { toast(error.message, true); }
    return;
  }
  const deleteMedia = event.target.closest("[data-delete-media]");
  if (deleteMedia) {
    const form = deleteMedia.closest("[data-media-form]");
    const item = findEntity("portfolio_items", form.dataset.itemId);
    const entry = item.media.find((media) => media.id === form.dataset.mediaId);
    if (!confirm("Hapus gambar sertifikat ini?")) return;
    try {
      if (!demoMode && entry) {
        const paths = [entry.original_path, entry.thumbnail_path].filter(Boolean);
        if (paths.length) await supabase.storage.from(CONFIG.storageBucket).remove(paths);
      }
      await removeRow("portfolio_media", form.dataset.mediaId);
      item.media = item.media.filter((media) => media.id !== form.dataset.mediaId);
      persistDemo(); toast("Gambar berhasil dihapus"); renderView(currentView);
    } catch (error) { toast(error.message, true); }
    return;
  }
  const deleteCustomSection = event.target.closest("[data-delete-custom-section]");
  if (deleteCustomSection) {
    const form = deleteCustomSection.closest("[data-custom-section-form]");
    if (!confirm("Hapus kelompok ini beserta semua kartu di dalamnya?")) return;
    try { await removeRow("custom_sections", form.dataset.id); state.custom_sections = state.custom_sections.filter((section) => section.id !== form.dataset.id); persistDemo(); renderView("custom"); }
    catch (error) { toast(error.message, true); }
  }
});

content.addEventListener("change", async (event) => {
  const itemUpload = event.target.closest("[data-media-upload]");
  const settingUpload = event.target.closest("[data-setting-upload]");
  try {
    if (itemUpload?.files.length) await uploadItemMedia(itemUpload.dataset.itemId, [...itemUpload.files]);
    if (settingUpload?.files[0]) await uploadSetting(settingUpload.dataset.settingUpload, settingUpload.dataset.folder, settingUpload.files[0]);
  } catch (error) { toast(error.message, true); markSaved(); }
});

content.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector("button[type=submit]");
  if (submit) submit.disabled = true;
  setSaving();
  try {
    if (form.dataset.form === "identity") {
      await saveSettings({ site_title: formValue(form, "site_title"), meta_description: formValue(form, "meta_description"), brand_mark: formValue(form, "brand_mark"), brand_name: formValue(form, "brand_name"), brand_tagline: formValue(form, "brand_tagline"), email: formValue(form, "email"), campus_name: formValue(form, "campus_name") });
      const keys = ["hero_eyebrow", "hero_title", "hero_emphasis", "hero_role", "hero_summary", "hero_primary_button", "hero_secondary_button", "hero_location_label", "hero_location", "profile_intro"];
      keys.forEach((key) => { state.texts[key] = formValue(form, key); }); await saveTextKeys(keys);
    } else if (form.dataset.form === "texts") {
      TEXT_FIELDS.forEach((field) => { state.texts[field.key] = formValue(form, field.key); }); await saveTextKeys(TEXT_FIELDS.map((field) => field.key));
    } else if (form.dataset.form === "appearance") {
      await saveSettings({ primary_color: formValue(form, "primary_color"), accent_color: formValue(form, "accent_color"), sakura_enabled: formValue(form, "sakura_enabled"), sakura_density: Number(formValue(form, "sakura_density")), sakura_speed: Number(formValue(form, "sakura_speed")) });
    } else if (form.matches("[data-section-form]")) {
      const section = state.sections.find((item) => item.section_key === form.dataset.id);
      Object.assign(section, { menu_label: formValue(form, "menu_label"), eyebrow: formValue(form, "eyebrow"), title: formValue(form, "title"), description: formValue(form, "description"), is_visible: formValue(form, "is_visible"), show_in_nav: formValue(form, "show_in_nav") });
      await upsert("page_sections", section);
    } else if (form.matches("[data-entity-form]")) await saveEntityForm(form);
    else if (form.matches("[data-media-form]")) {
      const item = findEntity("portfolio_items", form.dataset.itemId); const media = item.media.find((entry) => entry.id === form.dataset.mediaId);
      media.alt_text = formValue(form, "alt_text"); await upsert("portfolio_media", media);
    } else if (form.matches("[data-custom-section-form]")) {
      const section = state.custom_sections.find((item) => item.id === form.dataset.id);
      Object.assign(section, { title: formValue(form, "title"), description: formValue(form, "description"), is_visible: formValue(form, "is_visible") });
      const row = { ...section }; delete row.entries; await upsert("custom_sections", row);
    } else if (form.matches("[data-custom-entry-form]")) {
      const group = state.custom_sections.find((section) => section.id === form.dataset.sectionId); const entry = group.entries.find((item) => item.id === form.dataset.id);
      Object.assign(entry, { badge: formValue(form, "badge"), icon: formValue(form, "icon"), title: formValue(form, "title"), description: formValue(form, "description"), is_published: formValue(form, "is_published") });
      await upsert("custom_entries", entry);
    }
    persistDemo(); markSaved(); toast("Perubahan berhasil disimpan"); form.classList.remove("dirty");
  } catch (error) { toast(error.message, true); setSaving("Gagal menyimpan", true); }
  finally { if (submit) submit.disabled = false; }
});

window.addEventListener("beforeunload", (event) => { if (document.querySelector("form.dirty")) { event.preventDefault(); event.returnValue = ""; } });

initialize();
