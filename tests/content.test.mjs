import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function loadFallback() {
  const source = await readFile(new URL("../data/fallback-data.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window;
}

test("seluruh konten awal tersedia", async () => {
  const { PORTFOLIO_FALLBACK: data } = await loadFallback();
  assert.equal(data.education.length, 5);
  assert.equal(data.portfolio_items.filter((item) => item.section_type === "achievement").length, 4);
  assert.equal(data.portfolio_items.filter((item) => item.section_type === "seminar").length, 14);
  assert.equal(data.portfolio_items.filter((item) => item.section_type === "teaching").length, 4);
  assert.equal(data.portfolio_items.filter((item) => item.section_type === "organization").length, 4);
  assert.equal(data.portfolio_items.reduce((total, item) => total + item.media.length, 0), 27);
});

test("PLP memiliki dua sertifikat dalam satu slider", async () => {
  const { PORTFOLIO_FALLBACK: data } = await loadFallback();
  const plp = data.portfolio_items.find((item) => item.id === "teaching-1");
  assert.equal(plp.media.length, 2);
  assert.match(plp.title, /Pengenalan Lapangan Persekolahan/);
});

test("semua tulisan umum memiliki definisi bidang admin", async () => {
  const { PORTFOLIO_FALLBACK: data, PORTFOLIO_TEXT_FIELDS: fields } = await loadFallback();
  assert.deepEqual(new Set(fields.map((field) => field.key)), new Set(Object.keys(data.texts)));
});
