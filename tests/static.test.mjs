import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("halaman publik tidak memuat bundle admin", async () => {
  const html = await read("index.html");
  assert.match(html, /data\/fallback-data\.js/);
  assert.match(html, /script\.js/);
  assert.doesNotMatch(html, /admin\.js|supabase-js/);
});

test("konfigurasi browser tidak berisi secret key", async () => {
  const config = await read("site-config.js");
  assert.doesNotMatch(config, /service[_-]?role|secret[_-]?key/i);
});

test("aset tampilan awal tetap ringan", async () => {
  const files = ["styles.css", "script.js", "data/fallback-data.js"];
  const codeSize = (await Promise.all(files.map((file) => stat(new URL(file, root))))).reduce((sum, item) => sum + item.size, 0);
  assert.ok(codeSize < 250_000, `Kode awal terlalu besar: ${codeSize} byte`);
  const images = ["assets/siti-syariah-arafah.webp", "assets/uin-kediri.webp"];
  const imageSize = (await Promise.all(images.map((file) => stat(new URL(file, root))))).reduce((sum, item) => sum + item.size, 0);
  assert.ok(imageSize < 500_000, `Gambar awal terlalu besar: ${imageSize} byte`);
});

test("migration mengaktifkan RLS, RPC publik, dan aturan Storage", async () => {
  const sql = await read("supabase/migrations/202611240001_portfolio_cms.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /get_public_portfolio/);
  assert.match(sql, /portfolio-media/);
  assert.match(sql, /public\.is_admin\(\)/);
});

test("hanya email pemilik yang dapat menjadi admin", async () => {
  const [sql, adminScript, adminHtml] = await Promise.all([
    read("supabase/migrations/202611240001_portfolio_cms.sql"),
    read("admin/admin.js"),
    read("admin/index.html"),
  ]);
  const ownerEmail = "cantiksyariah348@gmail.com";
  assert.match(sql, new RegExp(ownerEmail.replace(".", "\\.")));
  assert.match(adminScript, new RegExp(ownerEmail.replace(".", "\\.")));
  assert.match(adminHtml, new RegExp(ownerEmail.replace(".", "\\.")));
  assert.doesNotMatch(sql, /arafahsitisyariah@gmail\.com/);
});
