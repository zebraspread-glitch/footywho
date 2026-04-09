import fs from "fs";

const INPUT = "./app/data/afl_players26.json";
const OUTPUT = "./app/data/afl_players26_clean.json";

const rawText = fs.readFileSync(INPUT, "utf-8");

// 🧠 FIX BROKEN JSON (missing commas between objects)
const fixedText = rawText.replace(/}\s*{/g, "},{");

const data = JSON.parse(fixedText);

// 🧹 CLEAN + FORMAT
const clean = data
  .filter((p) => {
    return (
      p &&
      typeof p.name === "string" &&
      typeof p.club === "string" &&
      Array.isArray(p.pos) &&
      p.club !== "✓" &&
      !p.name.includes("Appearance") &&
      !p.name.includes("Rankings")
    );
  })
  .map((p) => ({
    id: p.id,
    name: p.name.trim(),
    club: p.club.trim(),
    pos: p.pos,

    // you can replace later with real scraped values
    age: p.age ?? 25,
    number: p.number ?? 10,

    disposals: Number(p.disposals) || 0,
    goals: Number(p.goals) || 0,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// 💾 SAVE CLEAN FILE
fs.writeFileSync(OUTPUT, JSON.stringify(clean, null, 2));

console.log("✅ FIXED + CLEAN JSON CREATED");