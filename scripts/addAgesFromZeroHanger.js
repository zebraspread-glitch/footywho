import fs from "fs/promises";
import * as cheerio from "cheerio";

const INPUT_FILE = "./app/data/afl_players26_clean.json";
const OUTPUT_FILE = "./app/data/afl_players26_with_ages.json";
const URL = "https://www.zerohanger.com/afl/players/oldest-youngest/see-all-age/";

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPlayerName(text) {
  if (!text) return false;
  if (text.length < 3) return false;
  if (!/[a-z]/i.test(text)) return false;
  if (/\bYEARS OLD\b/i.test(text)) return false;
  if (/\bAFL\b/i.test(text)) return false;
  return true;
}

async function fetchAgeMap() {
  console.log("Fetching Zero Hanger ages page...");

  const res = await fetch(URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const ageMap = new Map();

  // Grab the full page text in DOM order.
  const pageText = $("body").text().replace(/\u00a0/g, " ");
  const ageRegex = /(\d{2})\s+YEARS\s+OLD/g;

  const matches = [...pageText.matchAll(ageRegex)];

  if (matches.length === 0) {
    console.log("Found 0 age headings.");
    return ageMap;
  }

  for (let i = 0; i < matches.length; i++) {
    const age = Number(matches[i][1]);
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : pageText.length;

    const sectionText = pageText.slice(start, end);

    // In each age section, linked names appear as plain text separated by commas/newlines.
    const rawNames = sectionText
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(isLikelyPlayerName);

    for (const rawName of rawNames) {
      const name = normalizeName(rawName);
      if (!ageMap.has(name)) {
        ageMap.set(name, age);
      }
    }
  }

  console.log(`Found ${ageMap.size} scraped age entries.`);
  return ageMap;
}

function buildAliases(ageMap) {
  const aliases = new Map();

  for (const [name, age] of ageMap.entries()) {
    aliases.set(name, age);

    // Convert "callum m brown" -> "callum brown"
    const noMiddleInitial = name.replace(/\b[a-z]\b/g, "").replace(/\s+/g, " ").trim();
    if (noMiddleInitial) aliases.set(noMiddleInitial, age);

    // Convert "cameron mackenzie" and "cam mackenzie" between each other
    if (name.startsWith("cam ")) aliases.set(name.replace(/^cam /, "cameron "), age);
    if (name.startsWith("cameron ")) aliases.set(name.replace(/^cameron /, "cam "), age);

    if (name.startsWith("matt ")) aliases.set(name.replace(/^matt /, "matthew "), age);
    if (name.startsWith("matthew ")) aliases.set(name.replace(/^matthew /, "matt "), age);

    if (name.startsWith("jackson ")) aliases.set(name.replace(/^jackson /, "jack "), age);
    if (name.startsWith("jack ")) aliases.set(name.replace(/^jack /, "jackson "), age);
  }

  return aliases;
}

async function main() {
  const raw = await fs.readFile(INPUT_FILE, "utf8");
  const players = JSON.parse(raw);

  const ageMap = await fetchAgeMap();
  const aliases = buildAliases(ageMap);

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = [];

  const updated = players.map((player) => {
    const normalized = normalizeName(player.name);

    let age = aliases.get(normalized);

    // fallback: exact first+last token match
    if (age == null) {
      const parts = normalized.split(" ");
      if (parts.length >= 2) {
        const shortForm = `${parts[0]} ${parts[parts.length - 1]}`;
        age = aliases.get(shortForm);
      }
    }

    if (age != null) {
      matched++;
      return { ...player, age };
    }

    unmatched++;
    unmatchedNames.push(player.name);
    return player;
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(updated, null, 2), "utf8");

  console.log("Done.");
  console.log("Matched:", matched);
  console.log("Unmatched:", unmatched);
  console.log("Saved to:", OUTPUT_FILE);

  if (unmatchedNames.length) {
    console.log("\nSome unmatched names:");
    for (const name of unmatchedNames.slice(0, 50)) {
      console.log("-", name);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});