const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const DISPOSALS_URL =
  "https://www.footywire.com/afl/footy/ft_player_rankings?year=2026&rt=LA&pt=&st=DI&mg=1";
const GOALS_URL =
  "https://www.footywire.com/afl/footy/ft_player_rankings?year=2026&rt=LT&pt=&st=GO&mg=1";

const DATA_PATH = path.join(__dirname, "../app/data/afl_players26.json");

const TEAM_PATTERN =
  "(Crows|Lions|Blues|Magpies|Bombers|Dockers|Cats|Suns|Giants|Hawks|Demons|Kangaroos|Power|Tigers|Saints|Swans|Eagles|Bulldogs)";

const CLUB_ALIASES = {
  crows: "Adelaide",
  lions: "Brisbane",
  blues: "Carlton",
  magpies: "Collingwood",
  bombers: "Essendon",
  dockers: "Fremantle",
  cats: "Geelong",
  suns: "Gold Coast",
  giants: "GWS",
  hawks: "Hawthorn",
  demons: "Melbourne",
  kangaroos: "North Melbourne",
  power: "Port Adelaide",
  tigers: "Richmond",
  saints: "St Kilda",
  swans: "Sydney",
  eagles: "West Coast",
  bulldogs: "Western Bulldogs",

  "brisbane lions": "Brisbane",
  "gold coast suns": "Gold Coast",
  "greater western sydney": "GWS",
  "gws giants": "GWS",
  "western bulldogs": "Western Bulldogs",
  "north melbourne": "North Melbourne",
  "port adelaide": "Port Adelaide",
  "west coast": "West Coast",
  "west coast eagles": "West Coast",
};

const NAME_ALIASES = {
  "thomas liberatore": "tom liberatore",
  "matthew crouch": "matt crouch",
  "zach bailey": "zac bailey",
  "alexander neal bullen": "alex neal bullen",
  "samuel powell pepper": "sam powell pepper",
  "edward richards": "ed richards",
  "cameron rayner": "cam rayner",
  "cameron zurhaar": "cam zurhaar",
  "benjamin king": "ben king",
  "maxwell king": "max king",
  "thomas liberatore": "tom liberatore",
  "matthew crouch": "matt crouch",
  "zach bailey": "zac bailey",
  "alexander neal bullen": "alex neal bullen",
  "samuel powell pepper": "sam powell pepper",
  "edward richards": "ed richards",
  "cameron rayner": "cam rayner",
  "cameron zurhaar": "cam zurhaar",
  "benjamin king": "ben king",
  "maxwell king": "max king",

  "matt johnson": "matthew johnson",
  "matt carroll": "matthew carroll",
  "lachlan schultz": "lachie schultz",
  "timothy english": "tim english",
  "nick murray": "nicholas murray",
  "oliver wines": "olli wines",
  "lachlan fogarty": "lachie fogarty",
  "maurice rioli": "maurice rioli jr",
  "oliver wines": "ollie wines",

};

function cleanText(str) {
  return String(str || "")
    .replace(/\u00a0/g, " ")
    .replace(/[’']/g, "")
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeClub(club) {
  const cleaned = cleanText(club);
  return CLUB_ALIASES[cleaned] || String(club || "").trim();
}

function normalizeName(name) {
  const cleaned = cleanText(name);
  return NAME_ALIASES[cleaned] || cleaned;
}

function makeKey(name, club) {
  return `${normalizeName(name)}|${cleanText(normalizeClub(club))}`;
}

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }

  return await res.text();
}

function getRowTexts(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $("tr").each((_, tr) => {
    const text = $(tr).text().replace(/\s+/g, " ").trim();
    if (text) rows.push(text);
  });

  return rows;
}

function extractDisposals(html) {
  const rows = getRowTexts(html);

  const rowRegex = new RegExp(
    `^\\d+\\s+(.+?)\\s+${TEAM_PATTERN}\\s+(\\d+)\\s+(\\d+)\\s+v\\s+.+?,\\s+Round\\s+\\d+\\s+(\\d+(?:\\.\\d+)?)$`
  );

  const results = new Map();

  for (const row of rows) {
    const match = row.match(rowRegex);
    if (!match) continue;

    const [, player, club, games, lastGameValue, average] = match;
    const value = parseNumber(average);

    results.set(makeKey(player, club), {
      player: player.trim(),
      club: normalizeClub(club),
      games: parseNumber(games),
      lastGameValue: parseNumber(lastGameValue),
      value,
    });
  }

  if (!results.size) {
    throw new Error("Could not parse any disposals rows.");
  }

  return results;
}

function extractGoals(html) {
  const rows = getRowTexts(html);

  const rowRegex = new RegExp(
    `^\\d+\\s+(.+?)\\s+${TEAM_PATTERN}\\s+(\\d+)\\s+(\\d+)\\s+v\\s+.+?,\\s+Round\\s+\\d+\\s+(\\d+)$`
  );

  const results = new Map();

  for (const row of rows) {
    const match = row.match(rowRegex);
    if (!match) continue;

    const [, player, club, games, lastGameValue, total] = match;
    const value = parseNumber(total);

    results.set(makeKey(player, club), {
      player: player.trim(),
      club: normalizeClub(club),
      games: parseNumber(games),
      lastGameValue: parseNumber(lastGameValue),
      value,
    });
  }

  if (!results.size) {
    throw new Error("Could not parse any goals rows.");
  }

  return results;
}

function loadPlayers() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function savePlayers(players) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(players, null, 2) + "\n", "utf8");
}

async function main() {
  console.log("Fetching FootyWire disposals...");
  const disposalsHtml = await fetchHtml(DISPOSALS_URL);

  console.log("Fetching FootyWire goals...");
  const goalsHtml = await fetchHtml(GOALS_URL);

  console.log("Parsing disposals...");
  const disposalMap = extractDisposals(disposalsHtml);

  console.log("Parsing goals...");
  const goalMap = extractGoals(goalsHtml);

  console.log("Loading afl_players26.json...");
  const players = loadPlayers();

  let disposalsUpdated = 0;
  let goalsUpdated = 0;
  const unmatchedDisposals = [];
  const unmatchedGoals = [];

  for (const player of players) {
    const key = makeKey(player.name, player.club);

    if (disposalMap.has(key)) {
      const newVal = disposalMap.get(key).value;
      if (player.disposals !== newVal) {
        player.disposals = newVal;
        disposalsUpdated++;
      }
      disposalMap.delete(key);
    }

    if (goalMap.has(key)) {
      const newVal = goalMap.get(key).value;
      if (player.goals !== newVal) {
        player.goals = newVal;
        goalsUpdated++;
      }
      goalMap.delete(key);
    }
  }

  for (const [, item] of disposalMap) {
    unmatchedDisposals.push(`${item.player} (${item.club})`);
  }

  for (const [, item] of goalMap) {
    unmatchedGoals.push(`${item.player} (${item.club})`);
  }

  savePlayers(players);

  console.log("");
  console.log("Done.");
  console.log(`Disposals updated: ${disposalsUpdated}`);
  console.log(`Goals updated: ${goalsUpdated}`);
  console.log(`Unmatched disposals: ${unmatchedDisposals.length}`);
  console.log(`Unmatched goals: ${unmatchedGoals.length}`);

  if (unmatchedDisposals.length) {
    console.log("");
    console.log("Some unmatched disposals:");
    unmatchedDisposals.slice(0, 20).forEach((x) => console.log(`- ${x}`));
  }

  if (unmatchedGoals.length) {
    console.log("");
    console.log("Some unmatched goals:");
    unmatchedGoals.slice(0, 20).forEach((x) => console.log(`- ${x}`));
  }
}

main().catch((err) => {
  console.error("");
  console.error("Update failed:");
  console.error(err);
  process.exit(1);
});