/**
 * 調査結果（JSON）を点検して、データパックに起こす。
 *
 *   npm run intake -- research.json              # 点検だけ
 *   npm run intake -- research.json --write      # 通ったものを packs/ に書き出す
 *   npm run intake -- research.json --by handle  # 登録者のIDを指定（既定: research_ai）
 *
 * 座標は Wikidata / OpenStreetMap のIDから引き直し、
 * 書かれてきた座標と食い違えば、その場所は取り込まない。
 * 外に出られない環境では照合を「未実施」として報告する（黙って通さない）。
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  checkPlace,
  checkScene,
  lookupWasBlocked,
  worst,
  type Finding,
  type PlaceReport,
} from "../src/lib/intake/check";
import { buildPack } from "../src/lib/intake/pack";
import { researchSchema } from "../src/lib/intake/schema";
import { reportAndExit } from "./cli.mts";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const write = args.includes("--write");
const by = args[args.indexOf("--by") + 1] ?? "research_ai";

if (!file) {
  console.error("使い方: npm run intake -- <調査結果.json> [--write] [--by <ID>]");
  process.exit(1);
}

const MARK: Record<string, string> = { error: "✗", warn: "△", info: "・" };

function show(findings: Finding[], indent = "    ") {
  for (const f of findings) {
    console.log(`${indent}${MARK[f.level]} ${f.what}`);
    if (f.detail) console.log(`${indent}   ${f.detail}`);
  }
}

try {
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  const parsed = researchSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("形式が合いません:\n");
    for (const issue of parsed.error.issues) {
      console.error(`  ✗ ${issue.path.join(".") || "(全体)"}: ${issue.message}`);
    }
    process.exit(1);
  }

  const input = parsed.data;
  const packId = input.pack_id ?? path.basename(file).replace(/\.json$/, "");

  console.log(`取り込み: ${file}`);
  console.log(`  作品 ${input.works.length} ／ 場所 ${input.places.length} ／ シーン ${input.scenes.length}\n`);

  /* ---- 場所 ---- */

  console.log("── 場所 ──");
  const reports = new Map<string, PlaceReport>();
  let placeErrors = 0;

  for (const p of input.places) {
    const r = await checkPlace(p);
    const level = worst(r.findings);
    if (level === "error") placeErrors++;
    else reports.set(p.name, r);

    const coord = r.lat !== null ? `${r.lat.toFixed(6)}, ${r.lng!.toFixed(6)}（${r.source}）` : "座標なし";
    console.log(`${MARK[level]} ${p.name}  ${coord}`);
    show(r.findings);
  }

  /* ---- シーン ---- */

  console.log("\n── シーン ──");
  let sceneErrors = 0;
  for (const s of input.scenes) {
    const r = checkScene(s, input.works);
    const missingPlace = !reports.has(s.place);
    if (missingPlace) {
      r.findings.push({
        level: "error",
        what: `場所「${s.place}」が使えません`,
        detail: "その場所が点検を通らなかったか、places にありません",
      });
    }
    const level = worst(r.findings);
    if (level === "error") sceneErrors++;
    if (level !== "info" || r.findings.length > 0) {
      console.log(`${MARK[level]} ${r.quote}…`);
      show(r.findings);
    } else {
      console.log(`${MARK[level]} ${r.quote}…`);
    }
  }

  /* ---- まとめ ---- */

  const okPlaces = reports.size;
  const okScenes = input.scenes.length - sceneErrors;
  console.log(
    `\nまとめ: 場所 ${okPlaces}/${input.places.length} ／ シーン ${okScenes}/${input.scenes.length} が取り込み可`,
  );
  if (placeErrors > 0) console.log(`  ✗ 場所 ${placeErrors}件は直すまで入りません`);
  if (sceneErrors > 0) console.log(`  ✗ シーン ${sceneErrors}件は直すまで入りません`);

  if (lookupWasBlocked()) {
    console.log(
      "\n  ※ 外部（Wikidata・OpenStreetMap）に問い合わせできませんでした。" +
        "\n     座標の照合は**行われていません**。つながる環境で流し直してください。",
    );
  }

  if (!write) {
    console.log("\n（点検のみ。書き出すには --write を付けてください）");
    process.exit(placeErrors + sceneErrors > 0 ? 1 : 0);
  }

  if (okPlaces === 0) {
    console.log("\n取り込めるものがありません。");
    process.exit(1);
  }

  const source = buildPack(input, reports, packId, by);
  const out = path.join("src", "lib", "data", "packs", `${packId}.ts`);
  await fs.writeFile(out, source);
  console.log(`\n書き出しました: ${out}`);
  console.log("次にすること:");
  console.log(`  1. ${out} を読んで、おかしなところがないか確かめる`);
  console.log("  2. src/lib/data/index.ts の PACKS に加える");
  console.log("  3. npm run db:setup（本番なら DATABASE_URL を付けて）");
} catch (e) {
  reportAndExit(e);
}

process.exit(0);
