import type { PlaceReport } from "./check";
import type { ResearchInput } from "./schema";

/**
 * 点検を通ったものを、データパックのソースに起こす。
 *
 * JSON をそのまま読み込ませず、`packs/` に置く .ts を書き出すのは、
 * 取り込んだ内容が **git の履歴に残って読める** ようにするため。
 * あとから「この場所は誰が、いつ、どの調査から入れたのか」を追える。
 */

const q = (s: string) => JSON.stringify(s);

/** タイトルから slug を作る。英数字が無ければローマ字化はせず連番に頼る。 */
function slugFor(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length >= 2 ? base : `work-${index + 1}`;
}

export function buildPack(
  input: ResearchInput,
  places: Map<string, PlaceReport>,
  packId: string,
  handle: string,
): string {
  const workSlug = new Map<string, string>();
  input.works.forEach((w, i) => {
    const slug = w.slug || slugFor(w.title, i);
    workSlug.set(w.title, slug);
    workSlug.set(slug, slug);
  });

  // どの座標がどこから来たかを数えて、そのまま見出しに書く。
  // 「照合済み」と一括りにすると、確かめていないものが混ざったときに気づけない。
  const bySource = new Map<string, number>();
  for (const p of input.places) {
    const r = places.get(p.name);
    if (r && r.lat !== null) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
  }
  const SOURCE_LABEL: Record<string, string> = {
    wikidata: "Wikidata から引き直し",
    osm: "OpenStreetMap から引き直し",
    nominatim: "住所から引き直し（粗い）",
    declared: "**未照合**（調査結果の値そのまま。目視で確かめること）",
    none: "座標なし",
  };

  const lines: string[] = [];
  lines.push('import type { DataPack } from "../types";', "");
  lines.push("/**");
  lines.push(` * ${input.description || "取り込んだ調査結果"}`);
  lines.push(" *");
  lines.push(" * scripts/intake.mts が書き出したものです。手で直しても構いません。");
  lines.push(" *");
  lines.push(" * 座標の出どころ:");
  for (const [src, n] of [...bySource].sort((a, b) => b[1] - a[1])) {
    lines.push(` *   ${SOURCE_LABEL[src] ?? src} … ${n}件`);
  }
  lines.push(" */");
  lines.push(`export const ${packId.replace(/[^a-zA-Z0-9]/g, "_")}Pack: DataPack = {`);
  lines.push(`  id: ${q(packId)},`);
  lines.push(`  description: ${q(input.description || packId)},`);
  lines.push("");

  /* ---- 場所 ---- */
  lines.push("  places: {");
  for (const p of input.places) {
    const r = places.get(p.name);
    if (!r || r.lat === null || r.lng === null) continue;
    lines.push(`    ${q(p.name)}: {`);
    lines.push(`      // 座標: ${SOURCE_LABEL[r.source] ?? r.source}`);
    lines.push(`      lat: ${r.lat},`);
    lines.push(`      lng: ${r.lng},`);
    lines.push(`      pref: ${q(p.prefecture)},`);
    if (p.address) lines.push(`      address: ${q(p.address)},`);
    if (p.note) lines.push(`      note: ${q(p.note)},`);
    if (p.body) lines.push(`      body: ${q(p.body)},`);
    if (p.access) lines.push(`      access: ${q(p.access)},`);
    lines.push("    },");
  }
  lines.push("  },", "");

  /* ---- 作品とシーン ---- */
  lines.push("  works: [");
  for (const [i, w] of input.works.entries()) {
    const slug = w.slug || slugFor(w.title, i);
    const scenes = input.scenes.filter((s) => s.work === slug || s.work === w.title);
    if (scenes.length === 0) continue;

    lines.push("    {");
    lines.push(`      slug: ${q(slug)},`);
    lines.push(`      title: ${q(w.title)},`);
    lines.push(`      author: ${q(w.author)},`);
    lines.push(`      medium: ${q(w.medium)},`);
    lines.push(`      year: ${w.year ?? 0},`);
    lines.push(`      description: ${q(w.description)},`);
    lines.push("      passages: [");
    for (const s of scenes) {
      const r = places.get(s.place);
      if (!r || r.lat === null) continue; // 場所が決まらなかったシーンは入れない
      lines.push("        {");
      if (s.chapter) lines.push(`          chapter: ${q(s.chapter)},`);
      lines.push(`          kind: ${q(s.kind)},`);
      lines.push(`          quote: ${q(s.quote)},`);
      if (s.note) lines.push(`          note: ${q(s.note)},`);
      lines.push(`          by: ${q(handle)},`);
      lines.push("          idents: [");
      lines.push("            {");
      lines.push(`              place: ${q(s.place)},`);
      lines.push(`              rationale: ${q(s.rationale)},`);
      lines.push(`              evidence: ${q(s.evidence)},`);
      if (s.sources[0]) lines.push(`              source_url: ${q(s.sources[0])},`);
      lines.push(`              by: ${q(handle)},`);
      lines.push("              up: 1,");
      lines.push("            },");
      lines.push("          ],");
      lines.push("        },");
    }
    lines.push("      ],");
    lines.push("    },");
  }
  lines.push("  ],");
  lines.push("};", "");
  return lines.join("\n");
}
