import fs from "fs/promises";
import * as cheerio from "cheerio";

const INPUT_FILE = "./app/data/afl_players26.json";
const OUTPUT_FILE = "./app/data/afl_players26_with_ages_and_numbers.json";

const CLUB_URLS = {
  Adelaide: "https://www.afc.com.au/teams/afl",
  Brisbane: "https://www.lions.com.au/teams/afl/squad",
  Carlton: "https://www.carltonfc.com.au/teams/afl",
  Collingwood: "https://www.collingwoodfc.com.au/teams/afl",
  Essendon: "https://www.essendonfc.com.au/teams/afl",
  Fremantle: "https://www.fremantlefc.com.au/teams/afl",
  Geelong: "https://www.geelongcats.com.au/teams/afl",
  "Gold Coast": "https://www.goldcoastfc.com.au/teams/afl/players",
  GWS: "https://www.gwsgiants.com.au/teams/afl",
  Hawthorn: "https://www.hawthornfc.com.au/teams/afl",
  Melbourne: "https://www.melbournefc.com.au/teams/afl",
  "North Melbourne": "https://www.nmfc.com.au/teams/afl/players/",
  "Port Adelaide": "https://www.portadelaidefc.com.au/teams/afl",
  Richmond: "https://www.richmondfc.com.au/football/afl/squad",
  "St Kilda": "https://www.saints.com.au/afl/squad",
  Sydney: "https://www.sydneyswans.com.au/afl",
  "West Coast": "https://www.westcoasteagles.com.au/teams/afl",
  "Western Bulldogs": "https://www.westernbulldogs.com.au/teams/afl",
};

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.]/g, "")
    .replace(/-/g, " ")
    .replace(/\bjunior\b/g, "jr")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClub(club) {
  const map = {
    "GWS Giants": "GWS",
    "Greater Western Sydney": "GWS",
    "Brisbane Lions": "Brisbane",
    "West Coast Eagles": "West Coast",
    "Gold Coast Suns": "Gold Coast",
    "Sydney Swans": "Sydney",
    "Adelaide Crows": "Adelaide",
  };
  return map[club] || club;
}

function makeKey(club, name) {
  return `${normalizeClub(club)}|${normalizeName(name)}`;
}

function aliasVariants(name) {
  const n = normalizeName(name);
  const set = new Set([n]);

  const swaps = [
 [/^zac /, "zachary "],
[/^zachary /, "zac "],
[/^dan /, "daniel "],
[/^daniel /, "dan "],
[/^cam /, "cameron "],
[/^cameron /, "cam "],
[/^charlie /, "charles "],
[/^charles /, "charlie "],
[/^cal /, "callum "],
[/^callum /, "cal "],
[/^brayden /, "braden "],
[/^braden /, "brayden "],
[/^matt /, "matthew "],
[/^matthew /, "matt "],
[/^jack /, "jackson "],
[/^jackson /, "jack "],
[/^will /, "william "],
[/^william /, "will "],
[/^alex /, "alexander "],
[/^alexander /, "alex "],
[/^bodhi /, "bodie "],
[/^bodie /, "bodhi "],
];

  for (const [pattern, replacement] of swaps) {
    if (pattern.test(n)) set.add(n.replace(pattern, replacement));
  }

  return [...set];
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  return await res.text();
}

function extractPlayersFromText(club, text) {
  const map = new Map();

  const cleaned = text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Matches:
  // 01 Chayce Jones Defender
  // 01. Chayce Jones Defender
  // 10 Mitch Owens Key Forward
  const regex =
    /\b(\d{1,2})\.?\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+?)\s+(?:Defender|Midfielder|Forward|Ruck|Wing|Utility|Follower|Key Forward|Key Defender)\b/g;

  for (const match of cleaned.matchAll(regex)) {
    const number = Number(match[1]);
    const name = match[2].trim();

    if (number < 1 || number > 60) continue;

    const key = makeKey(club, name);
    if (!map.has(key)) map.set(key, number);

    for (const variant of aliasVariants(name)) {
      map.set(`${normalizeClub(club)}|${variant}`, number);
    }
  }

  return map;
}

async function scrapeClubNumbers(club, url) {
  console.log(`Scraping ${club}...`);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const text = $("body").text();
  const found = extractPlayersFromText(club, text);
  console.log(`  Found ${found.size} entries`);
  return found;
}

async function main() {
  const raw = await fs.readFile(INPUT_FILE, "utf8");
  const players = JSON.parse(raw);

  const numberMap = new Map();

  for (const [club, url] of Object.entries(CLUB_URLS)) {
    try {
      const clubMap = await scrapeClubNumbers(club, url);
      for (const [key, value] of clubMap.entries()) {
        numberMap.set(key, value);
      }
    } catch (err) {
      console.error(`Failed ${club}:`, err.message);
    }
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = [];

  const updated = players.map((player) => {
    const club = normalizeClub(player.club);
    let number = null;

    for (const variant of aliasVariants(player.name)) {
      const key = `${club}|${variant}`;
      if (numberMap.has(key)) {
        number = numberMap.get(key);
        break;
      }
    }

    if (number != null) {
      matched++;
      return { ...player, number };
    }

    unmatched++;
    unmatchedNames.push(`${player.club} - ${player.name}`);
    return player;
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(updated, null, 2), "utf8");

  console.log("\nDone.");
  console.log("Matched:", matched);
  console.log("Unmatched:", unmatched);
  console.log("Saved to:", OUTPUT_FILE);

  if (unmatchedNames.length) {
    console.log("\nSome unmatched players:");
    unmatchedNames.slice(0, 50).forEach((name) => console.log("-", name));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});