// bun run shots: run each command, show its real output as a dark terminal about 800 pixels wide,
// and save a screenshot. It uses Playwright's Chromium; set CHROMIUM_PATH to use another browser.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { ROOT } from "./structure";

// One screenshot: the command to run, the title on the window, the last lines to keep,
// and every image file to save it as.
type Shot = {
  outputFiles: string[];
  command: string;
  title: string;
  lastLines?: number;
  env?: Record<string, string>;
};

const SHOTS: Shot[] = [
  {
    command: "bun run storm",
    title: "bun run storm",
    lastLines: 16,
    outputFiles: [
      "images/finished-system.png",
      "00-orientation/images/storm-board.png",
      "parts/00-meet-the-desk/01-meet-the-outage-desk/images/expected.png",
    ],
  },
  {
    command: "bun run verify meet-the-outage-desk",
    title: "bun run verify meet-the-outage-desk",
    lastLines: 22,
    outputFiles: ["00-orientation/images/first-run.png"],
  },
];

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Colour a line the way a terminal would: green for PASS, red for FAIL, purple for a hint.
function colourLine(line: string): string {
  const escaped = escapeHtml(line);
  if (/^\s*PASS\b/.test(line)) return `<span class="ok">${escaped}</span>`;
  if (/^\s*(FAIL|ERROR)\b/.test(line) || /BLOCKED/.test(line)) {
    return `<span class="bad">${escaped}</span>`;
  }
  if (/Try next:/.test(line)) return `<span class="hint">${escaped}</span>`;
  return escaped;
}

const STYLE = `
body {
  margin: 0; background: #0d1117; color: #e6edf3;
  font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.win { width: 800px; box-sizing: border-box; padding: 0 0 16px }
.bar {
  background: #161b22; padding: 8px 14px; color: #8b949e; font-size: 12px;
  border-bottom: 1px solid #30363d;
}
pre { margin: 0; padding: 14px 16px 0; white-space: pre-wrap; word-break: break-word }
.p { color: #7ee787 } .ok { color: #7ee787 } .bad { color: #ff7b72 } .hint { color: #d2a8ff }
`;

function terminalPage(title: string, lines: string[]): string {
  const prompt = `<span class="p">$ ${escapeHtml(title)}</span>`;
  const body = lines.map(colourLine).join("\n");
  const terminal = `<div class="bar">copperbeck-storm-desk</div><pre>${prompt}\n${body}</pre>`;
  const head = `<head><meta charset="utf-8"><style>${STYLE}</style></head>`;
  return `<!doctype html><html>${head}<body><div class="win">${terminal}</div></body></html>`;
}

// Run the command in replay mode and keep the lines worth showing.
function outputOf(shot: Shot): string[] {
  // Screenshots use the recorded replies, so they never need a key.
  const env = { ...process.env };
  env.LLM_PROVIDER = "replay";
  Object.assign(env, shot.env);
  const result = Bun.spawnSync(["bash", "-c", shot.command], { cwd: ROOT, env });
  const allOutput = result.stdout.toString() + result.stderr.toString();
  let lines = allOutput.split("\n").filter((line) => {
    return !/^\$ bun /.test(line) && !/^error: script/.test(line);
  });
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (shot.lastLines && lines.length > shot.lastLines) {
    lines = ["...", ...lines.slice(-shot.lastLines)];
  }
  return lines;
}

const browserPath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
for (const shot of SHOTS) {
  const lines = outputOf(shot);
  const page = await browser.newPage({
    viewport: { width: 800, height: 200 },
    deviceScaleFactor: 1,
  });
  await page.setContent(terminalPage(shot.title, lines));
  for (const outputFile of shot.outputFiles) {
    const file = join(ROOT, outputFile);
    mkdirSync(dirname(file), { recursive: true });
    await page.locator(".win").screenshot({ path: file });
    console.log(`Saved ${outputFile}`);
  }
  await page.close();
}
await browser.close();
