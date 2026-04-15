import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { ViewEntry } from "./types";

const TTL_MS = 30 * 60 * 1000; // 30분
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5분

// 영속화: /home/agent/.openclaw/view-store.jsonl (volume에 포함)
// 컨테이너 재시작에도 30분 TTL 내의 링크가 유지됨.
const STORE_DIR = process.env.VIEW_STORE_DIR || "/home/agent/.openclaw";
const STORE_FILE = path.join(STORE_DIR, "view-store.json");

const store = new Map<string, ViewEntry>();
let writeTimer: NodeJS.Timeout | null = null;

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const entries = JSON.parse(raw) as ViewEntry[];
    const now = Date.now();
    let loaded = 0;
    for (const e of entries) {
      if (typeof e?.id === "string" && typeof e?.expiresAt === "number" && e.expiresAt > now) {
        store.set(e.id, e);
        loaded++;
      }
    }
    if (loaded > 0) console.log(`[view-store] loaded ${loaded} entries from disk`);
  } catch (err) {
    console.warn(`[view-store] failed to load from disk: ${(err as Error).message}`);
  }
}

function scheduleWrite(): void {
  // Debounce: 동시 다발 저장 시 1초 후 한 번만 flush
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    writeToDisk();
  }, 1000);
}

function writeToDisk(): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
    const entries = Array.from(store.values());
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entries), { mode: 0o600 });
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    console.warn(`[view-store] failed to persist: ${(err as Error).message}`);
  }
}

export function storeView(entry: Omit<ViewEntry, "id" | "createdAt" | "expiresAt">): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  store.set(id, {
    ...entry,
    id,
    createdAt: now,
    expiresAt: now + TTL_MS,
  });
  scheduleWrite();
  return id;
}

export function getView(id: string): ViewEntry | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(id);
    scheduleWrite();
    return null;
  }
  return entry;
}

export function startViewCleanup(): void {
  loadFromDisk();

  setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of store) {
      if (now > entry.expiresAt) {
        store.delete(id);
        removed++;
      }
    }
    if (removed > 0) scheduleWrite();
  }, CLEANUP_INTERVAL_MS);

  // 종료 시 flush
  const flush = () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    writeToDisk();
  };
  process.on("SIGTERM", flush);
  process.on("SIGINT", flush);
  process.on("exit", flush);
}
