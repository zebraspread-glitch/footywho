"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import rawPlayers from "../data/afl_players26.json";

type RawPlayer = {
  id: string;
  name: string;
  club: string;
  pos: string[];
  age: number;
  number: number;
  disposals: number;
  goals: number;
};

type Player = {
  id: string;
  name: string;
  club: string;
  pos: string[];
  age: number;
  number: number;
  disposals: number;
  goals: number;
};

const UNLIMITED_STATS_KEY = "footywho_unlimited_stats_v1";
const UNLIMITED_HISTORY_KEY = "footywho_unlimited_history_v1";

type UnlimitedStats = {
  gamesPlayed: number;
  wins: number;
  totalGuessesForWins: number;
  bestScore: number | null;
};

type UnlimitedHistoryEntry = {
  answerId: string;
  guesses: number;
  wonAt: string;
};

const players: Player[] = (rawPlayers as RawPlayer[])
  .filter(
    (p) =>
      p &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.club === "string" &&
      Array.isArray(p.pos) &&
      typeof p.age === "number" &&
      typeof p.number === "number" &&
      typeof p.disposals === "number" &&
      typeof p.goals === "number"
  )
  .map((p) => ({
    id: p.id.trim(),
    name: p.name.trim(),
    club: p.club.trim(),
    pos: p.pos.map((x) => String(x).trim()).filter(Boolean),
    age: Number(p.age),
    number: Number(p.number),
    disposals: Number(p.disposals),
    goals: Number(p.goals),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function getRandomPlayer(excludeId?: string): Player {
  const validPlayers = players.filter(
    (p) => p.disposals > 0 && p.id !== excludeId
  );

  return (
    validPlayers[Math.floor(Math.random() * validPlayers.length)] ??
    validPlayers[0] ??
    players[0]
  );
}

function normalizePositions(pos: string[]) {
  return [...new Set(pos.map((p) => p.trim().toUpperCase()).filter(Boolean))].sort();
}

function positionsExactlyMatch(a: string[], b: string[]) {
  const aa = normalizePositions(a);
  const bb = normalizePositions(b);

  if (aa.length !== bb.length) return false;
  return aa.every((pos, index) => pos === bb[index]);
}

function positionsPartiallyMatch(a: string[], b: string[]) {
  const aa = normalizePositions(a);
  const bb = normalizePositions(b);
  return aa.some((pos) => bb.includes(pos));
}

function statClass(correct: boolean, close: boolean) {
  if (correct) return "bg-green-400 text-black border-green-500";
  if (close) return "bg-yellow-300 text-black border-yellow-400";
  return "bg-[#f8f1e6] text-[#1a1230] border-[#d7ccb8]";
}

function arrowForNumber(value: number, answer: number) {
  if (value < answer) return "↑";
  if (value > answer) return "↓";
  return "";
}

function normalizeClubName(club: string) {
  return club
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function loadUnlimitedStats(): UnlimitedStats {
  if (typeof window === "undefined") {
    return {
      gamesPlayed: 0,
      wins: 0,
      totalGuessesForWins: 0,
      bestScore: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(UNLIMITED_STATS_KEY);
    if (!raw) {
      return {
        gamesPlayed: 0,
        wins: 0,
        totalGuessesForWins: 0,
        bestScore: null,
      };
    }

    const parsed = JSON.parse(raw) as Partial<UnlimitedStats>;

    return {
      gamesPlayed:
        typeof parsed.gamesPlayed === "number" ? parsed.gamesPlayed : 0,
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      totalGuessesForWins:
        typeof parsed.totalGuessesForWins === "number"
          ? parsed.totalGuessesForWins
          : 0,
      bestScore:
        typeof parsed.bestScore === "number" ? parsed.bestScore : null,
    };
  } catch {
    return {
      gamesPlayed: 0,
      wins: 0,
      totalGuessesForWins: 0,
      bestScore: null,
    };
  }
}

function saveUnlimitedStats(stats: UnlimitedStats) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UNLIMITED_STATS_KEY, JSON.stringify(stats));
}

function loadUnlimitedHistory(): UnlimitedHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(UNLIMITED_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is UnlimitedHistoryEntry =>
          !!item &&
          typeof item === "object" &&
          typeof (item as UnlimitedHistoryEntry).answerId === "string" &&
          typeof (item as UnlimitedHistoryEntry).guesses === "number" &&
          typeof (item as UnlimitedHistoryEntry).wonAt === "string"
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function saveUnlimitedHistory(history: UnlimitedHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    UNLIMITED_HISTORY_KEY,
    JSON.stringify(history.slice(0, 50))
  );
}

const TEAM_META: Record<string, { icon: string; code: string }> = {
  adelaide: { icon: "/team-icons/adelaide.png", code: "ADE" },
  "adelaide crows": { icon: "/team-icons/adelaide.png", code: "ADE" },

  brisbane: { icon: "/team-icons/brisbane.png", code: "BRI" },
  "brisbane lions": { icon: "/team-icons/brisbane.png", code: "BRI" },

  carlton: { icon: "/team-icons/carlton.png", code: "CAR" },
  "carlton blues": { icon: "/team-icons/carlton.png", code: "CAR" },

  collingwood: { icon: "/team-icons/collingwood.png", code: "COL" },
  "collingwood magpies": { icon: "/team-icons/collingwood.png", code: "COL" },

  essendon: { icon: "/team-icons/essendon.png", code: "ESS" },
  "essendon bombers": { icon: "/team-icons/essendon.png", code: "ESS" },

  fremantle: { icon: "/team-icons/fremantle.png", code: "FRE" },
  "fremantle dockers": { icon: "/team-icons/fremantle.png", code: "FRE" },

  geelong: { icon: "/team-icons/geelong.png", code: "GEE" },
  "geelong cats": { icon: "/team-icons/geelong.png", code: "GEE" },

  "gold coast": { icon: "/team-icons/gold_coast.png", code: "GCS" },
  "gold coast suns": { icon: "/team-icons/gold_coast.png", code: "GCS" },

  gws: { icon: "/team-icons/gws.png", code: "GWS" },
  "gws giants": { icon: "/team-icons/gws.png", code: "GWS" },
  "greater western sydney": { icon: "/team-icons/gws.png", code: "GWS" },
  "greater western sydney giants": {
    icon: "/team-icons/gws.png",
    code: "GWS",
  },

  hawthorn: { icon: "/team-icons/hawthorn.png", code: "HAW" },
  "hawthorn hawks": { icon: "/team-icons/hawthorn.png", code: "HAW" },

  melbourne: { icon: "/team-icons/melbourne.png", code: "MEL" },
  "melbourne demons": { icon: "/team-icons/melbourne.png", code: "MEL" },

  "north melbourne": {
    icon: "/team-icons/north_melbourne.png",
    code: "NTH",
  },
  "north melbourne kangaroos": {
    icon: "/team-icons/north_melbourne.png",
    code: "NTH",
  },

  "port adelaide": {
    icon: "/team-icons/port_adelaide.png",
    code: "PTA",
  },
  "port adelaide power": {
    icon: "/team-icons/port_adelaide.png",
    code: "PTA",
  },

  richmond: { icon: "/team-icons/richmond.png", code: "RIC" },
  "richmond tigers": { icon: "/team-icons/richmond.png", code: "RIC" },

  "st kilda": { icon: "/team-icons/st_kilda.png", code: "STK" },
  "st. kilda": { icon: "/team-icons/st_kilda.png", code: "STK" },
  "st kilda saints": { icon: "/team-icons/st_kilda.png", code: "STK" },

  sydney: { icon: "/team-icons/sydney.png", code: "SYD" },
  "sydney swans": { icon: "/team-icons/sydney.png", code: "SYD" },

  "west coast": { icon: "/team-icons/west_coast.png", code: "WCE" },
  "west coast eagles": { icon: "/team-icons/west_coast.png", code: "WCE" },

  "western bulldogs": {
    icon: "/team-icons/western_bulldogs.png",
    code: "WBD",
  },
  bulldogs: { icon: "/team-icons/western_bulldogs.png", code: "WBD" },
};

const TEAM_COLOURS: Record<string, string[]> = {
  adelaide: ["red", "blue", "yellow"],
  "adelaide crows": ["red", "blue", "yellow"],

  brisbane: ["red", "blue", "yellow"],
  "brisbane lions": ["red", "blue", "yellow"],

  carlton: ["blue"],
  "carlton blues": ["blue"],

  collingwood: ["black", "white"],
  "collingwood magpies": ["black", "white"],

  essendon: ["red", "black"],
  "essendon bombers": ["red", "black"],

  fremantle: ["purple", "white"],
  "fremantle dockers": ["purple", "white"],

  geelong: ["blue", "white"],
  "geelong cats": ["blue", "white"],

  "gold coast": ["red"],
  "gold coast suns": ["red"],

  gws: ["orange", "charcoal"],
  "gws giants": ["orange", "charcoal"],
  "greater western sydney": ["orange", "charcoal"],
  "greater western sydney giants": ["orange", "charcoal"],

  hawthorn: ["brown", "yellow"],
  "hawthorn hawks": ["brown", "yellow"],

  melbourne: ["red", "blue"],
  "melbourne demons": ["red", "blue"],

  "north melbourne": ["blue", "white"],
  "north melbourne kangaroos": ["blue", "white"],

  "port adelaide": ["teal", "black", "white"],
  "port adelaide power": ["teal", "black", "white"],

  richmond: ["yellow", "black"],
  "richmond tigers": ["yellow", "black"],

  "st kilda": ["red", "black", "white"],
  "st. kilda": ["red", "black", "white"],
  "st kilda saints": ["red", "black", "white"],

  sydney: ["red", "white"],
  "sydney swans": ["red", "white"],

  "west coast": ["blue", "yellow"],
  "west coast eagles": ["blue", "yellow"],

  "western bulldogs": ["blue", "red", "white"],
  bulldogs: ["blue", "red", "white"],
};

const TEAM_STATES: Record<string, "VIC" | "SA" | "WA" | "NSW" | "QLD"> = {
  adelaide: "SA",
  "adelaide crows": "SA",

  brisbane: "QLD",
  "brisbane lions": "QLD",

  carlton: "VIC",
  "carlton blues": "VIC",

  collingwood: "VIC",
  "collingwood magpies": "VIC",

  essendon: "VIC",
  "essendon bombers": "VIC",

  fremantle: "WA",
  "fremantle dockers": "WA",

  geelong: "VIC",
  "geelong cats": "VIC",

  "gold coast": "QLD",
  "gold coast suns": "QLD",

  gws: "NSW",
  "gws giants": "NSW",
  "greater western sydney": "NSW",
  "greater western sydney giants": "NSW",

  hawthorn: "VIC",
  "hawthorn hawks": "VIC",

  melbourne: "VIC",
  "melbourne demons": "VIC",

  "north melbourne": "VIC",
  "north melbourne kangaroos": "VIC",

  "port adelaide": "SA",
  "port adelaide power": "SA",

  richmond: "VIC",
  "richmond tigers": "VIC",

  "st kilda": "VIC",
  "st. kilda": "VIC",
  "st kilda saints": "VIC",

  sydney: "NSW",
  "sydney swans": "NSW",

  "west coast": "WA",
  "west coast eagles": "WA",

  "western bulldogs": "VIC",
  bulldogs: "VIC",
};

const STATE_BORDERS: Record<"VIC" | "SA" | "WA" | "NSW" | "QLD", Array<"VIC" | "SA" | "WA" | "NSW" | "QLD">> = {
  VIC: ["SA", "NSW"],
  SA: ["WA", "QLD", "NSW", "VIC"],
  WA: ["SA"],
  NSW: ["QLD", "SA", "VIC"],
  QLD: ["NSW", "SA"],
};

function getTeamState(club: string): "VIC" | "SA" | "WA" | "NSW" | "QLD" | null {
  return TEAM_STATES[normalizeClubName(club)] ?? null;
}

function stateBorders(guessState: string | null, answerState: string | null) {
  if (!guessState || !answerState) return false;
  if (guessState === answerState) return false;
  return STATE_BORDERS[answerState as keyof typeof STATE_BORDERS]?.includes(
    guessState as "VIC" | "SA" | "WA" | "NSW" | "QLD"
  ) ?? false;
}

function getTeamMeta(club: string) {
  return TEAM_META[normalizeClubName(club)] ?? null;
}

function teamSharesColor(guessClub: string, answerClub: string) {
  const guessColours = TEAM_COLOURS[normalizeClubName(guessClub)] ?? [];
  const answerColours = TEAM_COLOURS[normalizeClubName(answerClub)] ?? [];

  return guessColours.some((colour) => answerColours.includes(colour));
}

function TeamTile({
  club,
  correct,
  close,
}: {
  club: string;
  correct: boolean;
  close: boolean;
}) {
  const meta = getTeamMeta(club);

  const bgClass = correct
    ? "bg-green-400 border-green-500"
    : close
    ? "bg-yellow-300 border-yellow-400"
    : "bg-[#f8f1e6] border-[#d7ccb8]";

  return (
    <div
      className={`animate-fade-in flex h-full min-h-[96px] flex-col items-center justify-center rounded-md border-2 ${bgClass} px-2 py-2 transition-all duration-200 hover:-translate-y-[2px] hover:scale-[1.02]`}
    >
      <div className="flex h-10 items-center justify-center transition-transform duration-200 hover:scale-110">
        {meta ? (
          <Image
            src={meta.icon}
            alt={club}
            width={38}
            height={26}
            className="h-auto max-h-[28px] w-auto max-w-[42px] object-contain transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="text-sm font-black">?</div>
        )}
      </div>

      <div className="mt-2 text-center text-[13px] font-black tracking-wide text-black transition-all duration-200 sm:text-[15px]">
        {meta?.code ?? club.slice(0, 3).toUpperCase()}
      </div>
    </div>
  );
}

function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
      <div className="animate-modal-in relative w-full max-w-2xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-all duration-150 hover:scale-110 hover:text-[#1a1230] active:scale-95"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="animate-fade-in text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            How To Play
          </h2>
        </div>

        <div className="space-y-4 px-6 py-6 text-lg font-bold text-[#1a1230]">
          <p className="animate-fade-in-up">Guess as many random AFL players as you want.</p>
          <p className="animate-fade-in-up">Each guess compares your player to the hidden answer.</p>
          <p className="animate-fade-in-up">
            <span className="font-black text-green-600">Green</span> means exact
            match.
          </p>
          <p className="animate-fade-in-up">
            <span className="font-black text-yellow-500">Yellow</span> means
            close.
          </p>
          <p className="animate-fade-in-up">For age, number, disposals and goals, arrows show higher or lower.</p>
          <p className="animate-fade-in-up">When you get it right, you can start a new random player.</p>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

function StatsModal({
  open,
  onClose,
  stats,
}: {
  open: boolean;
  onClose: () => void;
  stats: UnlimitedStats;
}) {
  if (!open) return null;

  const averageGuesses =
    stats.wins > 0 ? (stats.totalGuessesForWins / stats.wins).toFixed(2) : "0.00";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
      <div className="animate-modal-in relative w-full max-w-2xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-all duration-150 hover:scale-110 hover:text-[#1a1230] active:scale-95"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="animate-fade-in text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            Your Stats
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 px-6 py-6 sm:grid-cols-4">
          <div className="animate-fade-in-up border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Played</div>
            <div className="mt-2 text-3xl font-black">{stats.gamesPlayed}</div>
          </div>

          <div className="animate-fade-in-up border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Wins</div>
            <div className="mt-2 text-3xl font-black">{stats.wins}</div>
          </div>

          <div className="animate-fade-in-up border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Best</div>
            <div className="mt-2 text-3xl font-black">{stats.bestScore ?? "-"}</div>
          </div>

          <div className="animate-fade-in-up border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Avg Win</div>
            <div className="mt-2 text-3xl font-black">{averageGuesses}</div>
          </div>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

function HistoryModal({
  open,
  onClose,
  history,
}: {
  open: boolean;
  onClose: () => void;
  history: UnlimitedHistoryEntry[];
}) {
  if (!open) return null;

  const historyWithPlayers = history
    .map((entry) => ({
      ...entry,
      player: players.find((p) => p.id === entry.answerId) ?? null,
    }))
    .filter(
      (
        item
      ): item is UnlimitedHistoryEntry & {
        player: Player;
      } => item.player !== null
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
      <div className="animate-modal-in relative w-full max-w-3xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-all duration-150 hover:scale-110 hover:text-[#1a1230] active:scale-95"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="animate-fade-in text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            Recent Games
          </h2>
          <p className="mt-2 text-lg font-bold text-[#1a1230]">
            Last 50 completed unlimited games
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {historyWithPlayers.length === 0 ? (
            <div className="animate-fade-in-up border-4 border-[#1a1230] bg-white px-6 py-8 text-center text-xl font-black text-[#1a1230] shadow-[4px_4px_0_#c6b79a]">
              No games yet
            </div>
          ) : (
            <div className="space-y-3">
              {historyWithPlayers.map((entry, index) => {
                const meta = getTeamMeta(entry.player.club);
                const dateLabel = new Date(entry.wonAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={`${entry.answerId}-${entry.wonAt}-${index}`}
                    className="animate-fade-in-up flex items-center justify-between gap-4 border-4 border-[#1a1230] bg-white px-4 py-4 shadow-[4px_4px_0_#c6b79a] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#c6b79a]"
                  >
                    <div className="min-w-[120px] text-lg font-black text-[#1a1230]">
                      {dateLabel}
                    </div>

                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#1a1230] bg-[#f8f1e6] transition-transform duration-200 hover:scale-105">
                        {meta ? (
                          <Image
                            src={meta.icon}
                            alt={entry.player.club}
                            width={28}
                            height={28}
                            className="h-auto max-h-[28px] w-auto max-w-[28px] object-contain"
                          />
                        ) : (
                          <span className="text-xs font-black">
                            {entry.player.club.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-xl font-black text-[#1a1230]">
                          {entry.player.name}
                        </div>
                        <div className="text-sm font-bold text-[#5f5870]">
                          {meta?.code ?? entry.player.club}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[80px] rounded-md border-4 border-green-500 bg-green-400 px-4 py-2 text-center text-xl font-black text-black transition-all duration-200 hover:scale-[1.03]">
                      {entry.guesses}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

function WinModal({
  open,
  player,
  guessesCount,
  onClose,
  onNewGame,
}: {
  open: boolean;
  player: Player | null;
  guessesCount: number;
  onClose: () => void;
  onNewGame: () => void;
}) {
  if (!open || !player) return null;

  const meta = getTeamMeta(player.club);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[1px]">
      <div className="animate-modal-pop relative w-full max-w-2xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-all duration-150 hover:scale-110 hover:text-[#1a1230] active:scale-95"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 pb-10 pt-8">
          <div className="flex items-center justify-center">
            <div className="animate-float-soft flex h-40 w-40 items-center justify-center rounded-full border-4 border-[#1a1230] bg-white shadow-[4px_4px_0_#c6b79a] transition-transform duration-200 hover:scale-[1.02]">
              {meta ? (
                <Image
                  src={meta.icon}
                  alt={player.club}
                  width={90}
                  height={90}
                  className="h-auto max-h-[90px] w-auto max-w-[90px] object-contain"
                />
              ) : (
                <div className="text-4xl font-black text-[#1a1230]">
                  {player.club.slice(0, 3).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-10 text-center">
          <p className="animate-fade-in-up text-2xl font-bold text-[#1a1230]">Correct!</p>

          <h2
            className="animate-fade-in-up mt-3 text-5xl font-black uppercase tracking-tight text-[#1a1230] sm:text-6xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            {player.name}
          </h2>

          <p className="animate-fade-in-up mt-5 text-2xl font-bold text-[#1a1230] sm:text-3xl">
            You solved it in{" "}
            <span className="text-[#10d66f]">{guessesCount}</span>{" "}
            {guessesCount === 1 ? "guess" : "guesses"}
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onNewGame}
              className="animate-fade-in-up border-4 border-[#1a1230] bg-white px-8 py-4 text-2xl font-black text-[#1a1230] shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
            >
              New Random Player
            </button>
          </div>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

export default function UnlimitedPage() {
  const [answer, setAnswer] = useState<Player>(() => getRandomPlayer());
  const [query, setQuery] = useState("");
  const [guesses, setGuesses] = useState<Player[]>([]);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [stats, setStats] = useState<UnlimitedStats>(() => loadUnlimitedStats());
  const [history, setHistory] = useState<UnlimitedHistoryEntry[]>(() =>
    loadUnlimitedHistory()
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || showWinModal) return [];

    return players
      .filter((p) => p.disposals > 0)
      .filter((p) => p.name.toLowerCase().includes(q))
      .filter((p) => !guesses.some((g) => g.id === p.id))
      .slice(0, 8);
  }, [query, guesses, showWinModal]);

  function recordWin(guessCount: number, solvedPlayer: Player) {
    setStats((prev) => {
      const next: UnlimitedStats = {
        gamesPlayed: prev.gamesPlayed + 1,
        wins: prev.wins + 1,
        totalGuessesForWins: prev.totalGuessesForWins + guessCount,
        bestScore:
          prev.bestScore === null ? guessCount : Math.min(prev.bestScore, guessCount),
      };

      saveUnlimitedStats(next);
      return next;
    });

    setHistory((prev) => {
      const next: UnlimitedHistoryEntry[] = [
        {
          answerId: solvedPlayer.id,
          guesses: guessCount,
          wonAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 50);

      saveUnlimitedHistory(next);
      return next;
    });
  }

  function submitGuess(player: Player) {
  if (!player || showWinModal) return;

  if (guesses.some((g) => g.id === player.id)) {
    setQuery("");
    return;
  }

  const next = [player, ...guesses];
  setGuesses(next);

  if (player.id === answer.id) {
    recordWin(next.length, player);
    setShowWinModal(true);
  }

  setQuery("");
}

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && suggestions.length > 0) {
      submitGuess(suggestions[0]);
    }
  }

  function startNewGame() {
    setAnswer((prev) => getRandomPlayer(prev.id));
    setGuesses([]);
    setQuery("");
    setShowWinModal(false);
  }

  const won = guesses.some((g) => g.id === answer.id);

  return (
    <main className="min-h-screen bg-[#f5efe3] text-[#1a1230]">
      <HelpModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      <StatsModal
        open={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        stats={stats}
      />

      <HistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={history}
      />

      <WinModal
        open={showWinModal}
        player={answer}
        guessesCount={guesses.length}
        onClose={() => setShowWinModal(false)}
        onNewGame={startNewGame}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <header className="border-b-4 border-[#1a1230] pb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="animate-fade-in">
              <h1
                className="text-5xl font-black leading-none tracking-tight transition-transform duration-300 hover:translate-x-[2px] hover:-translate-y-[2px] sm:text-7xl"
                style={{ textShadow: "4px 4px 0 #c6b79a" }}
              >
                FootyWho
              </h1>

              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-[3px] bg-[#1a1230] transition-all duration-300 hover:h-14" />
                <p className="max-w-md text-xl font-bold leading-tight transition-all duration-200 hover:translate-x-[2px] sm:text-2xl">
                  Unlimited Mode
                </p>
              </div>
            </div>

            <div className="animate-fade-in-up grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="border-4 border-[#1a1230] bg-white px-6 py-3 text-xl font-black shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:translate-x-[1px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
              >
                Help
              </button>

              <button
                type="button"
                onClick={() => setShowStatsModal(true)}
                className="border-4 border-[#1a1230] bg-white px-6 py-3 text-xl font-black shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:translate-x-[1px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
              >
                Stats
              </button>

              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="border-4 border-[#1a1230] bg-white px-6 py-3 text-xl font-black shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:translate-x-[1px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
              >
                History
              </button>

              <Link
                href="/"
                className="border-4 border-[#1a1230] bg-white px-6 py-3 text-center text-xl font-black shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:translate-x-[1px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
              >
                Daily
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-10">
          <div className="relative">
            <div className="flex flex-col gap-4 xl:flex-row">
              <div className="animate-fade-in-up flex flex-1 items-center overflow-hidden border-4 border-[#1a1230] bg-white transition-all duration-200 focus-within:-translate-y-[2px] focus-within:shadow-[6px_6px_0_#1a1230]">
                <div className="flex h-16 w-16 items-center justify-center border-r-4 border-[#1a1230] text-3xl font-black transition-transform duration-200 hover:scale-110">
                  ?
                </div>

                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={won ? "You got it!" : "Guess a player..."}
                  className="h-16 w-full bg-transparent px-5 text-2xl font-bold outline-none transition-all duration-200 placeholder:text-[#8e8a95]"
                />
              </div>

              <div className="animate-fade-in-up flex h-16 min-w-[150px] items-center justify-center border-4 border-[#1a1230] bg-white px-4 text-2xl font-black transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[4px_4px_0_#1a1230]">
                {guesses.length} guesses
              </div>
            </div>

            {!won && suggestions.length > 0 && (
              <div className="animate-fade-in-up absolute left-0 right-0 top-[76px] z-20 overflow-hidden rounded-md border-4 border-[#1a1230] bg-white shadow-[6px_6px_0_#1a1230] xl:right-[430px]">
                {suggestions.map((player, index) => {
                  const meta = getTeamMeta(player.club);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => submitGuess(player)}
                      className="flex w-full items-center justify-between border-b-2 border-[#1a1230] px-4 py-3 text-left text-lg font-bold transition-all duration-150 hover:bg-[#efe5d4] hover:pl-6 active:bg-[#e5dac5] last:border-b-0"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <span>{player.name}</span>

                      <span className="flex items-center gap-2 text-[#5f5870] transition-transform duration-150">
                        {meta ? (
                          <Image
                            src={meta.icon}
                            alt={player.club}
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] object-contain"
                          />
                        ) : null}
                        {meta?.code ?? player.club}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-8 gap-3 border-b-4 border-dashed border-[#1a1230] pb-3 text-center text-xl font-black sm:text-2xl">
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">Name</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">Team</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">State</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">Pos</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">Age</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">#</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">Disposals</div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">Goals</div>
</div>

            <div className="mt-4 space-y-4">
              {guesses.map((guess, index) => {
                const guessedState = getTeamState(guess.club);
const answerState = getTeamState(answer.club);
                const nameCorrect = guess.id === answer.id;

                const teamCorrect =
                  normalizeClubName(guess.club) === normalizeClubName(answer.club);
                const teamClose =
                  !teamCorrect && teamSharesColor(guess.club, answer.club);

                const posCorrect = positionsExactlyMatch(guess.pos, answer.pos);
                const posClose =
                  !posCorrect && positionsPartiallyMatch(guess.pos, answer.pos);

                const ageCorrect = guess.age === answer.age;
                const ageClose =
                  !ageCorrect && Math.abs(guess.age - answer.age) <= 2;

                const numberCorrect = guess.number === answer.number;
                const numberClose =
                  !numberCorrect && Math.abs(guess.number - answer.number) <= 2;

                const disposalsCorrect = guess.disposals === answer.disposals;
                const disposalsClose =
                  !disposalsCorrect &&
                  Math.abs(guess.disposals - answer.disposals) <= 2;

                const goalsCorrect = guess.goals === answer.goals;
                const goalsClose =
                  !goalsCorrect && Math.abs(guess.goals - answer.goals) <= 1;

                return (
                  <div
                    key={`${guess.id}-${index}`}
                    className="animate-guess-in grid min-h-[96px] grid-cols-8 items-stretch gap-3 border-4 border-[#1a1230] bg-[#f8f1e6] px-3 py-3 text-center text-lg font-black shadow-[4px_4px_0_#c6b79a] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#c6b79a] sm:text-xl"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <div
                      className={`${statClass(
                        nameCorrect,
                        false
                      )} flex items-center justify-center rounded-md border px-3 py-2 transition-all duration-200 hover:scale-[1.01]`}
                    >
                      {guess.name}
                    </div>

                    <TeamTile
                      club={guess.club}
                      correct={teamCorrect}
                      close={teamClose}
                    />

                    <div
  className={`${statClass(
    guessedState === answerState,
    stateBorders(guessedState, answerState)
  )} flex items-center justify-center rounded-md border px-3 py-2 font-black`}
>
  {guessedState ?? "-"}
</div>

                    <div
                      className={`${statClass(
                        posCorrect,
                        posClose
                      )} flex items-center justify-center rounded-md border px-3 py-2 transition-all duration-200 hover:scale-[1.01]`}
                    >
                      {guess.pos.join(", ")}
                    </div>

                    <div
                      className={`${statClass(
                        ageCorrect,
                        ageClose
                      )} flex flex-col items-center justify-center rounded-md border px-3 py-2 transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div>{guess.age}</div>
                      {!ageCorrect && (
                        <div className="text-sm">{arrowForNumber(guess.age, answer.age)}</div>
                      )}
                    </div>

                    <div
                      className={`${statClass(
                        numberCorrect,
                        numberClose
                      )} flex flex-col items-center justify-center rounded-md border px-3 py-2 transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div>{guess.number}</div>
                      {!numberCorrect && (
                        <div className="text-sm">{arrowForNumber(guess.number, answer.number)}</div>
                      )}
                    </div>

                    <div
                      className={`${statClass(
                        disposalsCorrect,
                        disposalsClose
                      )} flex flex-col items-center justify-center rounded-md border px-3 py-2 transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div>{guess.disposals}</div>
                      {!disposalsCorrect && (
                        <div className="text-sm">
                          {arrowForNumber(guess.disposals, answer.disposals)}
                        </div>
                      )}
                    </div>

                    <div
                      className={`${statClass(
                        goalsCorrect,
                        goalsClose
                      )} flex flex-col items-center justify-center rounded-md border px-3 py-2 transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div>{guess.goals}</div>
                      {!goalsCorrect && (
                        <div className="text-sm">{arrowForNumber(guess.goals, answer.goals)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes guessIn {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.97);
          }
          60% {
            opacity: 1;
            transform: translateY(-2px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes modalIn {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes modalPop {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.92);
          }
          60% {
            opacity: 1;
            transform: translateY(-2px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes floatSoft {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        .animate-guess-in {
          animation: guessIn 0.32s ease-out both;
        }

        .animate-modal-in {
          animation: modalIn 0.22s ease-out both;
        }

        .animate-modal-pop {
          animation: modalPop 0.28s ease-out both;
        }

        .animate-fade-in {
          animation: fadeIn 0.28s ease-out both;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.28s ease-out both;
        }

        .animate-float-soft {
          animation: floatSoft 2.2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}