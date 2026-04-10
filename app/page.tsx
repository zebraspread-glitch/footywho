"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import rawPlayers from "./data/afl_players26.json";

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

type DailyResult = {
  solved: boolean;
  guesses: number | null;
  guessIds: string[];
};

type DailyResultsMap = Record<string, DailyResult>;

type DailyProgress = {
  guessIds: string[];
  completed: boolean;
};

type DailyProgressMap = Record<string, DailyProgress>;

const MAX_GUESSES = 8;
const DAILY_START_DATE = new Date(2026, 3, 9); // 9 Apr 2026
DAILY_START_DATE.setHours(0, 0, 0, 0);

const RESULTS_STORAGE_KEY = "footywho_daily_results_v1";
const PROGRESS_STORAGE_KEY = "footywho_daily_progress_v1";

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

const dailyEligiblePlayers: Player[] = players.filter((p) => p.disposals > 0);
const playerById = new Map(players.map((p) => [p.id, p] as const));

function getTodayLocalDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDayIndexFromStart(date: Date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);

  const diffMs = current.getTime() - DAILY_START_DATE.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

function getPlayerForDate(date: Date): Player {
  const source = dailyEligiblePlayers.length > 0 ? dailyEligiblePlayers : players;
  return source[getDayIndexFromStart(date) % source.length];
}

function getDailyPlayer(): Player {
  return getPlayerForDate(getTodayLocalDate());
}

function getHistoryEntries(results: DailyResultsMap) {
  const today = getTodayLocalDate();
  const totalDays = getDayIndexFromStart(today);

  const list: Array<{
    dateKey: string;
    dateLabel: string;
    player: Player;
    resultLabel: string;
  }> = [];

  for (let i = 0; i <= totalDays; i++) {
    const date = new Date(DAILY_START_DATE);
    date.setDate(DAILY_START_DATE.getDate() + i);

    const dateKey = formatDateKey(date);
    const result = results[dateKey];

    let resultLabel = "X";
    if (result?.solved && typeof result.guesses === "number") {
      resultLabel = `${result.guesses}/${MAX_GUESSES}`;
    } else if (
      result &&
      !result.solved &&
      Array.isArray(result.guessIds) &&
      result.guessIds.length >= MAX_GUESSES
    ) {
      resultLabel = "X";
    }

    list.push({
      dateKey,
      dateLabel: formatDateLabel(date),
      player: getPlayerForDate(date),
      resultLabel,
    });
  }

  return list.reverse();
}

function loadResults(): DailyResultsMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(RESULTS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<
      string,
      { solved?: unknown; guesses?: unknown; guessIds?: unknown }
    >;

    if (!parsed || typeof parsed !== "object") return {};

    const normalized: DailyResultsMap = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;

      normalized[key] = {
        solved: Boolean(value.solved),
        guesses: typeof value.guesses === "number" ? value.guesses : null,
        guessIds: Array.isArray(value.guessIds)
          ? value.guessIds.filter((id): id is string => typeof id === "string")
          : [],
      };
    }

    return normalized;
  } catch {
    return {};
  }
}

function saveResults(results: DailyResultsMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
}

function loadProgress(): DailyProgressMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DailyProgressMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: DailyProgressMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

const ANSWER: Player = getDailyPlayer();

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

  "gold coast": ["red", "yellow"],
  "gold coast suns": ["red", "yellow"],

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

const STATE_BORDERS: Record<
  "VIC" | "SA" | "WA" | "NSW" | "QLD",
  Array<"VIC" | "SA" | "WA" | "NSW" | "QLD">
> = {
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
      className={`flex h-full min-h-[96px] flex-col items-center justify-center rounded-md border-2 ${bgClass} px-2 py-2 transition-all duration-200 hover:-translate-y-[2px] hover:scale-[1.02]`}
    >
      <div className="flex h-10 items-center justify-center transition-transform duration-200 hover:scale-110">
        {meta ? (
          <Image
            src={meta.icon}
            alt={club}
            width={38}
            height={26}
            className="h-auto max-h-[28px] w-auto max-w-[42px] object-contain"
          />
        ) : (
          <div className="text-sm font-black">?</div>
        )}
      </div>

      <div className="mt-2 text-center text-[13px] font-black tracking-wide text-black sm:text-[15px] transition-all duration-200">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="relative w-full max-w-2xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230] animate-modal-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-transform duration-150 hover:scale-110 hover:text-[#1a1230]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            How To Play
          </h2>
        </div>

        <div className="space-y-4 px-6 py-6 text-lg font-bold text-[#1a1230]">
          <p>Guess the AFL player in 8 guesses or less.</p>
          <p>Each guess compares your player to today&apos;s answer.</p>
          <p>
            <span className="font-black text-green-600">Green</span> means exact
            match.
          </p>
          <p>
            <span className="font-black text-yellow-500">Yellow</span> means
            close.
          </p>
          <p>For age and number, arrows show if the answer is higher or lower.</p>
          <p>There is one daily player each day.</p>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}


function StatsModal({
  open,
  onClose,
  results,
}: {
  open: boolean;
  onClose: () => void;
  results: DailyResultsMap;
}) {
  if (!open) return null;

  const entries = Object.values(results);
  const played = entries.length;
  const wins = entries.filter((r) => r.solved).length;
  const losses = played - wins;
  const averageGuesses =
    wins > 0
      ? (
          entries
            .filter((r) => r.solved && typeof r.guesses === "number")
            .reduce((sum, r) => sum + (r.guesses ?? 0), 0) / wins
        ).toFixed(2)
      : "0.00";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="relative w-full max-w-2xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230] animate-modal-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-transform duration-150 hover:scale-110 hover:text-[#1a1230]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            Your Stats
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 px-6 py-6 sm:grid-cols-4">
          <div className="border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Played</div>
            <div className="mt-2 text-3xl font-black">{played}</div>
          </div>

          <div className="border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Wins</div>
            <div className="mt-2 text-3xl font-black">{wins}</div>
          </div>

          <div className="border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Losses</div>
            <div className="mt-2 text-3xl font-black">{losses}</div>
          </div>

          <div className="border-4 border-[#1a1230] bg-white p-4 text-center shadow-[4px_4px_0_#c6b79a]">
            <div className="text-sm font-black uppercase text-[#5f5870]">Avg Win</div>
            <div className="mt-2 text-3xl font-black">{averageGuesses}</div>
          </div>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

function ResultModal({
  open,
  player,
  guessesCount,
  won,
  onClose,
}: {
  open: boolean;
  player: Player | null;
  guessesCount: number;
  won: boolean;
  onClose: () => void;
}) {
  if (!open || !player) return null;

  const meta = getTeamMeta(player.club);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="relative w-full max-w-2xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230] animate-modal-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-transform duration-150 hover:scale-110 hover:text-[#1a1230]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 pb-10 pt-8">
          <div className="flex items-center justify-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-[#1a1230] bg-white shadow-[4px_4px_0_#c6b79a]">
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
          <p className="text-2xl font-bold t ext-[#1a1230]">
            {won ? "Correct!" : "You Lost"}
          </p>

          <h2
            className="mt-3 text-5xl font-black uppercase tracking-tight text-[#1a1230] sm:text-6xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            {player.name}
          </h2>

          <p className="mt-5 text-2xl font-bold text-[#1a1230] sm:text-3xl">
            {won ? (
              <>
                You solved it in{" "}
                <span className="text-[#10d66f]">{guessesCount}</span>{" "}
                {guessesCount === 1 ? "guess" : "guesses"}
              </>
            ) : (
              <>
                The answer was <span className="text-[#c43d3d]">{player.name}</span>
              </>
            )}
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="border-4 border-[#1a1230] bg-white px-8 py-4 text-2xl font-black text-[#1a1230] shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
            >
              Done
            </button>
          </div>
        </div>

        <div className={`h-3 w-full ${won ? "bg-[#10d66f]" : "bg-[#c43d3d]"}`} />
      </div>
    </div>
  );
}

function HistoryModal({
  open,
  onClose,
  results,
}: {
  open: boolean;
  onClose: () => void;
  results: DailyResultsMap;
}) {
  if (!open) return null;

  const history = getHistoryEntries(results);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="relative w-full max-w-3xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230] animate-modal-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-transform duration-150 hover:scale-110 hover:text-[#1a1230]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            Previous Daily Players
          </h2>
          <p className="mt-2 text-lg font-bold text-[#1a1230]">
            Daily answers since 9 Apr 2026
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          <div className="space-y-3">
            {history.map((entry, index) => {
              const meta = getTeamMeta(entry.player.club);
              const success = entry.resultLabel !== "X";

              return (
                <div
                  key={`${entry.dateKey}-${entry.player.id}-${index}`}
                  className="flex items-center justify-between gap-4 border-4 border-[#1a1230] bg-white px-4 py-4 shadow-[4px_4px_0_#c6b79a]"
                >
                  <div className="min-w-[120px] text-lg font-black text-[#1a1230]">
                    {entry.dateLabel}
                  </div>

                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#1a1230] bg-[#f8f1e6]">
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

                  <div
                    className={`min-w-[68px] rounded-md border-4 px-4 py-2 text-center text-xl font-black ${
                      success
                        ? "border-green-500 bg-green-400 text-black"
                        : "border-[#1a1230] bg-[#f8f1e6] text-[#1a1230]"
                    }`}
                  >
                    {entry.resultLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

function PrivacyPolicyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="relative w-full max-w-3xl overflow-hidden border-4 border-[#1a1230] bg-[#f5efe3] shadow-[8px_8px_0_#1a1230] animate-modal-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 text-4xl font-black leading-none text-[#6d6d6d] transition-transform duration-150 hover:scale-110 hover:text-[#1a1230]"
          aria-label="Close"
        >
          ×
        </button>

        <div className="border-b-4 border-[#1a1230] bg-[#efe5d4] px-6 py-6">
          <h2
            className="text-4xl font-black tracking-tight text-[#1a1230] sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #c6b79a" }}
          >
            Privacy Policy
          </h2>
        </div>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 px-6 py-6 text-base font-bold text-[#1a1230] sm:text-lg">
          <p>
            FootyWho stores limited game data in your browser so your daily progress,
            guesses, and stats can stay saved on your device.
          </p>

          <p>
            We may use analytics, advertising, and similar services to understand site
            usage and support the website.
          </p>

          <p>
            Third-party providers such as Google may use cookies or similar technology
            to serve ads, measure performance, and improve their services.
          </p>

          <p>
            We do not sell your personal information. If you contact us directly, any
            information you send is only used to reply to you or help with support.
          </p>

          <p>
  By using FootyWho, you agree to this privacy policy. This policy may be
  updated over time as the site changes.
</p>

          <p className="text-sm font-black text-[#5f5870] sm:text-base">
            Last updated: 10 April 2026
          </p>
        </div>

        <div className="h-3 w-full bg-[#10d66f]" />
      </div>
    </div>
  );
}

export default function Home() {
  const todayKey = formatDateKey(getTodayLocalDate());

  const [query, setQuery] = useState("");
  const [guesses, setGuesses] = useState<Player[]>([]);
  const [results, setResults] = useState<DailyResultsMap>({});
  const [progress, setProgress] = useState<DailyProgressMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);

  useEffect(() => {
    const loadedResults = loadResults();
    const loadedProgress = loadProgress();

    const todaysProgress = loadedProgress[todayKey];
    const todaysResult = loadedResults[todayKey];

    setResults(loadedResults);
    setProgress(loadedProgress);

    const restoredIds =
      todaysProgress?.guessIds?.length
        ? todaysProgress.guessIds
        : todaysResult?.guessIds?.length
        ? todaysResult.guessIds
        : [];

    if (restoredIds.length) {
      const restoredGuesses = restoredIds
        .map((id) => playerById.get(id))
        .filter((player): player is Player => Boolean(player));

      setGuesses(restoredGuesses);
    } else {
      setGuesses([]);
    }

    if (
      todaysResult &&
      Array.isArray(todaysResult.guessIds) &&
      todaysResult.guessIds.length > 0
    ) {
      setShowResultModal(true);
    }

    setHydrated(true);
  }, [todayKey]);

  const won = guesses.some((g) => g.id === ANSWER.id);
  const todayResult = results[todayKey] ?? null;
  const alreadyPlayedToday = Boolean(progress[todayKey]?.completed || todayResult);
  const completed = won || guesses.length >= MAX_GUESSES || alreadyPlayedToday;
  const canViewHistory = !!todayResult;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || completed) return [];

    return players
      .filter((p) => p.name.toLowerCase().includes(q))
      .filter((p) => !guesses.some((g) => g.id === p.id))
      .slice(0, 8);
  }, [query, guesses, completed]);

  function writeProgress(nextGuesses: Player[], nextCompleted: boolean) {
    setProgress((prev) => {
      const next: DailyProgressMap = {
        ...prev,
        [todayKey]: {
          guessIds: nextGuesses.map((g) => g.id),
          completed: nextCompleted,
        },
      };
      saveProgress(next);
      return next;
    });
  }

  function writeResult(
    result: Omit<DailyResult, "guessIds">,
    nextGuesses: Player[]
  ) {
    const fullResult: DailyResult = {
      ...result,
      guessIds: nextGuesses.map((g) => g.id),
    };

    setResults((prev) => {
      const next = { ...prev, [todayKey]: fullResult };
      saveResults(next);
      return next;
    });

    writeProgress(nextGuesses, true);
  }

  function submitGuess(player: Player) {
    if (!player || completed || alreadyPlayedToday || !hydrated) return;

    if (guesses.some((g) => g.id === player.id)) {
      setQuery("");
      return;
    }

    const next = [player, ...guesses];
    const guessCount = next.length;

    setGuesses(next);
    setQuery("");

    if (player.id === ANSWER.id) {
      writeResult({ solved: true, guesses: guessCount }, next);
      setShowResultModal(true);
      return;
    }

    if (guessCount >= MAX_GUESSES) {
      writeResult({ solved: false, guesses: null }, next);
      setShowResultModal(true);
      return;
    }

    writeProgress(next, false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && suggestions.length > 0) {
      submitGuess(suggestions[0]);
    }
  }

  const scoreLabel =
    todayResult?.solved && typeof todayResult.guesses === "number"
      ? `${todayResult.guesses}/${MAX_GUESSES}`
      : todayResult &&
        !todayResult.solved &&
        todayResult.guessIds.length >= MAX_GUESSES
      ? `X/${MAX_GUESSES}`
      : `${guesses.length}/${MAX_GUESSES}`;
      
  return (
    <main className="min-h-screen bg-[#f5efe3] text-[#1a1230]">
      <HelpModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      <StatsModal
        open={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        results={results}
      />

      <ResultModal
        open={showResultModal}
        player={ANSWER}
        guessesCount={todayResult?.guesses ?? guesses.length}
        won={todayResult ? todayResult.solved : won}
        onClose={() => setShowResultModal(false)}
      />

      <HistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        results={results}
      />

      <PrivacyPolicyModal
  open={showPrivacyPolicyModal}
  onClose={() => setShowPrivacyPolicyModal(false)}
/>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <header className="border-b-4 border-[#1a1230] pb-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1
                className="text-5xl font-black leading-none tracking-tight transition-transform duration-300 hover:translate-x-[2px] hover:-translate-y-[2px] sm:text-7xl"
                style={{ textShadow: "4px 4px 0 #c6b79a" }}
              >
                FootyWho
              </h1>

              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-[3px] bg-[#1a1230] transition-all duration-300 hover:h-14" />
                <p className="max-w-md text-xl font-bold leading-tight transition-all duration-200 hover:translate-x-[2px] sm:text-2xl">
                  Guess the AFL player
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                onClick={() => {
                  if (canViewHistory) setShowHistoryModal(true);
                }}
                disabled={!canViewHistory}
                className={`border-4 px-6 py-3 text-xl font-black shadow-[4px_4px_0_#1a1230] transition-all duration-150 ${
                  canViewHistory
                    ? "border-[#1a1230] bg-white hover:-translate-y-[2px] hover:translate-x-[1px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
                    : "cursor-not-allowed border-[#8e8a95] bg-[#e8e1d3] text-[#8e8a95] shadow-[4px_4px_0_#8e8a95]"
                }`}
                title={
                  canViewHistory
                    ? "View previous daily players"
                    : "Finish today's game to unlock history"
                }
              >
                History
              </button>

              <Link
                href="/unlimited"
                className="border-4 border-[#1a1230] bg-white px-6 py-3 text-center text-xl font-black shadow-[4px_4px_0_#1a1230] transition-all duration-150 hover:-translate-y-[2px] hover:translate-x-[1px] hover:shadow-[6px_6px_0_#1a1230] active:translate-y-[1px] active:shadow-[2px_2px_0_#1a1230]"
              >
                Unlimited
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-10">
          <div className="relative">
            <div className="flex flex-col gap-4 xl:flex-row">
              <div className="flex flex-1 items-center overflow-hidden border-4 border-[#1a1230] bg-white transition-all duration-200 focus-within:-translate-y-[2px] focus-within:shadow-[6px_6px_0_#1a1230]">
                <div className="flex h-16 w-16 items-center justify-center border-r-4 border-[#1a1230] text-3xl font-black transition-transform duration-200 hover:scale-110">
                  ?
                </div>

                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    alreadyPlayedToday
                      ? todayResult?.solved
                        ? "You already played today"
                        : "Come back tomorrow"
                      : won
                      ? "You got it!"
                      : guesses.length >= MAX_GUESSES
                      ? "Game over"
                      : "Guess a player..."
                  }
                  disabled={!hydrated || completed}
                  className="h-16 w-full bg-transparent px-5 text-2xl font-bold outline-none placeholder:text-[#8e8a95] disabled:opacity-60"
                />
              </div>

              <div className="flex h-16 min-w-[150px] items-center justify-center border-4 border-[#1a1230] bg-white px-4 text-2xl font-black transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[4px_4px_0_#1a1230]">
                {scoreLabel}
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[76px] z-20 overflow-hidden rounded-md border-4 border-[#1a1230] bg-white shadow-[6px_6px_0_#1a1230] xl:right-[170px]">
                {suggestions.map((player) => {
                  const meta = getTeamMeta(player.club);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => submitGuess(player)}
                      className="flex w-full items-center justify-between border-b-2 border-[#1a1230] px-4 py-3 text-left text-lg font-bold transition-all duration-150 hover:bg-[#efe5d4] hover:pl-6 last:border-b-0"
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
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    Name
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    Team
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    State
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    Pos
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    Age
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    #
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    Disp
  </div>
  <div className="transition-transform duration-200 hover:-translate-y-[2px]">
    Goals
  </div>
</div>

            <div className="mt-4 space-y-3">
              {guesses.map((guess) => {
                const exactPos = positionsExactlyMatch(guess.pos, ANSWER.pos);
                const partialPos =
                  !exactPos && positionsPartiallyMatch(guess.pos, ANSWER.pos);

                const ageDiff = Math.abs(guess.age - ANSWER.age);
                const numberDiff = Math.abs(guess.number - ANSWER.number);
                const disposalsDiff = Math.abs(guess.disposals - ANSWER.disposals);
                const goalsDiff = Math.abs(guess.goals - ANSWER.goals);


                const guessedState = getTeamState(guess.club);
const answerState = getTeamState(ANSWER.club);
                const nameCorrect = guess.id === ANSWER.id;
                const clubCorrect = normalizeClubName(guess.club) === normalizeClubName(ANSWER.club);
                const clubClose =
                  !clubCorrect && teamSharesColor(guess.club, ANSWER.club);

                return (
                  <div
                    key={guess.id}
                    className="grid grid-cols-8 gap-3 rounded-md border-4 border-[#1a1230] bg-white p-3 shadow-[4px_4px_0_#c6b79a]"
                  >
                    <div
                      className={`flex min-h-[96px] items-center justify-center flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
                        nameCorrect,
                        false
                      )}`}
                    >
                      {guess.name}
                    </div>


                    <TeamTile
                      club={guess.club}
                      correct={clubCorrect}
                      close={clubClose}
                    />

                    <div
  className={`flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
    guessedState === answerState,
    stateBorders(guessedState, answerState)
  )}`}
>
  {guessedState ?? "-"}
</div>

                    <div
                      className={`flex min-h-[96px] items-center justify-center flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
                        exactPos,
                        partialPos
                      )}`}
                    >
                      {normalizePositions(guess.pos).join(", ")}
                    </div>

                    <div
                      className={`flex min-h-[96px] flex-col items-center justify-center flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
                        guess.age === ANSWER.age,
                        guess.age !== ANSWER.age && ageDiff <= 2
                      )}`}
                    >
                      <span>{guess.age}</span>
                      {guess.age !== ANSWER.age && (
                        <span className="mt-1 text-2xl leading-none">
                          {arrowForNumber(guess.age, ANSWER.age)}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex min-h-[96px] flex-col items-center justify-center flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
                        guess.number === ANSWER.number,
                        guess.number !== ANSWER.number && numberDiff <= 2
                      )}`}
                    >
                      <span>{guess.number}</span>
                      {guess.number !== ANSWER.number && (
                        <span className="mt-1 text-2xl leading-none">
                          {arrowForNumber(guess.number, ANSWER.number)}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex min-h-[96px] flex-col items-center justify-center flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
                        guess.disposals === ANSWER.disposals,
                        guess.disposals !== ANSWER.disposals && disposalsDiff <= 5
                      )}`}
                    >
                      <span>{guess.disposals}</span>
                      {guess.disposals !== ANSWER.disposals && (
                        <span className="mt-1 text-2xl leading-none">
                          {arrowForNumber(guess.disposals, ANSWER.disposals)}
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex min-h-[96px] flex-col items-center justify-center flex h-full min-h-[96px] items-center justify-center rounded-md border-2 px-2 py-2 text-center text-lg font-black ${statClass(
                        guess.goals === ANSWER.goals,
                        guess.goals !== ANSWER.goals && goalsDiff <= 1
                      )}`}
                    >
                      <span>{guess.goals}</span>
                      {guess.goals !== ANSWER.goals && (
                        <span className="mt-1 text-2xl leading-none">
                          {arrowForNumber(guess.goals, ANSWER.goals)}
                        </span>
                      )}
                    </div>

                  </div>
                );
              })}
              <div className="mt-16 pb-6 text-center">
  <button
    type="button"
    onClick={() => setShowPrivacyPolicyModal(true)}
    className="text-[11px] font-bold text-[#5f5870] underline underline-offset-2 hover:text-[#1a1230]"
  >
    Privacy Policy
  </button>
</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}