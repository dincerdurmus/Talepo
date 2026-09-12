import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3001";

async function main() {
  const lines: string[] = [];
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  const tas = await p.locator("textarea").count();
  lines.push(`textarea_count=${tas}`);
  lines.push(`url=${p.url()}`);
  if (tas > 0) {
    await p.locator("textarea").first().fill("Arçelik 55 inç televizyon arıyorum");
    await p.waitForTimeout(2500);
    const buttons = await p.getByRole("button").allTextContents();
    lines.push(
      `relevant=${JSON.stringify(buttons.filter((t) => /yayın|gözden|devam|bilgi|kritik/i.test(t)).slice(0, 30))}`,
    );
    lines.push(
      `publish_count=${await p.getByRole("button", { name: /Talebi yayınla|Yayınla/i }).count()}`,
    );
    lines.push(`finish=${await p.locator("#talep-finish").count()}`);
    lines.push(
      `summaries=${JSON.stringify(await p.locator("details summary").allTextContents())}`,
    );
    lines.push(
      `kritiks=${await p.locator("text=/kritik soru/i").count()}`,
    );
  } else {
    lines.push(`body_snip=${(await p.locator("body").innerText()).slice(0, 400)}`);
  }
  await b.close();
  writeFileSync("C:/Users/HP/AppData/Local/Temp/talep-cta.txt", lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
