import fs from "node:fs";

const res = await fetch("https://lis-skins.com/market_export_json/api_csgo_full.json", {
  headers: { "user-agent": "Mozilla/5.0" },
});
if (!res.ok) throw new Error("HTTP " + res.status);

const items = {};
let seen = 0, sample = "", head = "", bytes = 0;

function take(o) {
  seen++;
  if (!sample) sample = JSON.stringify(o).slice(0, 400);
  const name = o.name || o.market_hash_name;
  const price = Number(o.price ?? o.min_price);
  if (!name || !(price > 0)) return;
  if (name.startsWith("StatTrak") || name.startsWith("Souvenir")) return;
  if (!(name in items) || price < items[name]) items[name] = price;
}

const decoder = new TextDecoder("utf-8");
const st = [];
let capDepth = -1, capturing = false, inStr = false, esc = false, buf = "", sIdx = 0;

for await (const chunk of res.body) {
  bytes += chunk.length;
  const value = decoder.decode(chunk, { stream: true });
  if (head.length < 800) head += value.slice(0, 800 - head.length);
  if (capturing) sIdx = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (c === 92) esc = true;
      else if (c === 34) inStr = false;
      continue;
    }
    if (c === 34) { inStr = true; continue; }
    if (c === 91) { st.push(91); continue; }
    if (c === 93) { st.pop(); continue; }
    if (c === 123) {
      if (!capturing && st[st.length - 1] === 91 && (capDepth < 0 || st.length === capDepth)) {
        capDepth = st.length; capturing = true; sIdx = i;
      }
      st.push(123);
      continue;
    }
    if (c === 125) {
      st.pop();
      if (capturing && st.length === capDepth) {
        const text = buf + value.slice(sIdx, i + 1);
        buf = ""; capturing = false;
        try { take(JSON.parse(text)); } catch (e) {}
      }
    }
  }
  if (capturing) buf += value.slice(sIdx);
}

const count = Object.keys(items).length;
console.log("v2 МБ:", Math.round(bytes / 1048576), "объектов:", seen, "уникальных:", count);
if (count < 500) {
  throw new Error("v2 Мало предметов: " + count + "\nПример объекта: " + sample + "\nНачало файла: " + head);
}
fs.writeFileSync("prices.json", JSON.stringify({ updated: Date.now(), count, items }));
console.log("Готово:", count);
