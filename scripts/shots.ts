// bun run shots: run each command, render its real output as a dark terminal about 800 pixels wide, and save
// a screenshot. Uses Playwright's Chromium; set CHROMIUM_PATH to use a browser installed elsewhere.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { ROOT } from "./structure";

type Shot = { out: string[]; cmd: string; title: string; tail?: number; env?: Record<string, string> };
const SHOTS: Shot[] = [
  { cmd: "bun run storm", title: "bun run storm", tail: 16, out: ["images/finished-system.png", "00-orientation/images/storm-board.png", "parts/00-meet-the-desk/01-meet-the-outage-desk/images/expected.png"] },
  { cmd: "bun run verify meet-the-outage-desk", title: "bun run verify meet-the-outage-desk", tail: 22, out: ["00-orientation/images/first-run.png"] },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const color = (l: string) =>
  /^\s*PASS\b/.test(l) ? `<span class="ok">${esc(l)}</span>`
  : /^\s*(FAIL|ERROR)\b/.test(l) || /BLOCKED/.test(l) ? `<span class="bad">${esc(l)}</span>`
  : /Try next:/.test(l) ? `<span class="hint">${esc(l)}</span>`
  : esc(l);

const page = (title: string, lines: string[]) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0d1117;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e6edf3}
.win{width:800px;box-sizing:border-box;padding:0 0 16px}
.bar{background:#161b22;padding:8px 14px;color:#8b949e;font-size:12px;border-bottom:1px solid #30363d}
pre{margin:0;padding:14px 16px 0;white-space:pre-wrap;word-break:break-word}
.p{color:#7ee787}.ok{color:#7ee787}.bad{color:#ff7b72}.hint{color:#d2a8ff}
</style></head><body><div class="win"><div class="bar">copperbeck-storm-desk</div><pre><span class="p">$ ${esc(title)}</span>
${lines.map(color).join("\n")}</pre></div></body></html>`;

const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
for (const s of SHOTS) {
  const p = Bun.spawnSync(["bash", "-c", s.cmd], { cwd: ROOT, env: { ...process.env, LLM_PROVIDER: "replay", ...s.env } });
  let lines = (p.stdout.toString() + p.stderr.toString()).split("\n").filter((l) => !/^\$ bun /.test(l) && !/^error: script/.test(l));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (s.tail && lines.length > s.tail) lines = ["...", ...lines.slice(-s.tail)];
  const pg = await browser.newPage({ viewport: { width: 800, height: 200 }, deviceScaleFactor: 1 });
  await pg.setContent(page(s.title, lines));
  for (const o of s.out) {
    const file = join(ROOT, o);
    mkdirSync(dirname(file), { recursive: true });
    await pg.locator(".win").screenshot({ path: file });
    console.log(`Saved ${o}`);
  }
  await pg.close();
}
await browser.close();
