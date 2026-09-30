import fs from "node:fs";

const res = await fetch("https://lis-skins.com/market_export_json/api_csgo_full.json", {
  headers: { "user-agent": "Mozilla/5.0" },
});
if (!res.ok) throw new Error("HTTP " + res.status);
const data = await res.json();

let rows = data.items ?? data.data ?? data;
if (!Array.isArray(rows)) rows = Object.values(rows);

const items = {};
for (const x of rows) {
  const name = x.name || x.market_hash_name;
  const price = Number(x.price ?? x.min_price);
  if (!name || !(price > 0)) continue;
  if (name.startsWith("StatTrak") || name.startsWith("Souvenir")) continue;
  if (!(name in items) || price < items[name]) items[name] = price;
}
const count = Object.keys(items).length;
if (count < 500) throw new Error("Слишком мало предметов: " + count);
fs.writeFileSync("prices.json", JSON.stringify({ updated: Date.now(), count, items }));
console.log("Готово:", count);
