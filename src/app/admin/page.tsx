import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Card, Empty, Stat } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { DELETABLE_LABEL, listAdmins, listDeletions, type Deletable } from "@/lib/admin";
import { siteStats } from "@/lib/queries";

export const metadata: Metadata = {
  title: "管理",
  robots: { index: false, follow: false },
};

/** 削除されたものへの、いま有効な行き先（もう無いものはリンクにしない）。 */
const GONE: Record<Deletable, string> = {
  place: "/places",
  passage: "/works",
  identification: "/works",
  comment: "/works",
  route: "/routes",
  work: "/works",
};

export default async function AdminPage() {
  const user = await currentUser();
  // 管理者でなければ、この画面があること自体を見せない
  if (!user?.is_admin) notFound();

  const [deletions, admins, stats] = await Promise.all([listDeletions(), listAdmins(), siteStats()]);

  return (
    <div className="space-y-8">
      <header className="border-b border-rule pb-5">
        <h1 className="font-serif text-2xl font-bold tracking-wide">管理</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          荒らしの片づけと、権利者からの申し立てへの対応のための画面です。
          削除は取り消せません。かわりに、消したものの中身をここに控えています。
        </p>
        <dl className="mt-5 flex flex-wrap gap-8">
          <Stat label="場所の項目" value={stats.places} unit="件" />
          <Stat label="作品" value={stats.works} unit="件" />
          <Stat label="記述" value={stats.passages} unit="件" />
          <Stat label="削除の記録" value={deletions.length} unit="件" />
        </dl>
      </header>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
          削除の記録
          <span className="ml-2 text-xs font-normal text-ink-3">新しい順</span>
        </h2>
        {deletions.length === 0 ? (
          <Empty>まだ何も削除されていません。</Empty>
        ) : (
          <Card className="divide-y divide-rule">
            {deletions.map((d) => (
              <div key={d.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span className="rounded bg-paper-2 px-1.5 py-0.5 font-bold text-ink-2">
                    {DELETABLE_LABEL[d.kind] ?? d.kind}
                  </span>
                  <span>#{d.target_id}</span>
                  <span>{String(d.created_at).slice(0, 16).replace("T", " ")}</span>
                  {d.admin_handle && (
                    <Link href={`/users/${d.admin_handle}`} className="hover:text-shu">
                      {d.admin_name}
                    </Link>
                  )}
                  <Link href={GONE[d.kind] ?? "/"} className="ml-auto text-ink-3 hover:text-shu">
                    一覧へ
                  </Link>
                </div>
                <p className="mt-1 text-sm font-bold text-ink">{d.label || "（名前なし）"}</p>
                <p className="mt-0.5 text-sm text-ink-2">理由：{d.reason}</p>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">管理者</h2>
        <ul className="flex flex-wrap gap-2">
          {admins.map((a) => (
            <li key={a.id}>
              <Link
                href={`/users/${a.handle}`}
                className="rounded-full border border-rule-2 px-3 py-1.5 text-xs text-ink-2 hover:border-shu hover:text-shu"
              >
                {a.display_name}
                <span className="ml-1 text-ink-3">@{a.handle}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          管理者は環境変数 <code className="rounded bg-paper-2 px-1">SEICHI_ADMINS</code>
          （カンマ区切りのID）で決まります。起動のたびに反映されるので、
          ここから外した人はその場で権限を失います。
          手元で試すときは <code className="rounded bg-paper-2 px-1">npm run admin -- 付与 &lt;ID&gt;</code>{" "}
          が使えます。
        </p>
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <h2 className="font-serif text-lg font-bold tracking-wide">削除できるもの</h2>
        <p className="text-sm leading-relaxed text-ink-2">
          削除の入口は、それぞれの項目のページにあります。管理者としてログインしているときだけ出ます。
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            <b>場所の項目</b>（<Link href="/places" className="text-shu hover:underline">場所のページ</Link>）
            — 結びついた説・版の履歴・いいね・訪問記録・コースの停留点も一緒に消えます
          </li>
          <li>
            <b>記述</b>（シーンのページ）— 説・票・コメント・版の履歴も一緒に消えます。画像も実体ごと
          </li>
          <li>
            <b>説</b>（シーンのページの候補ごと）— その説に投じられた票も
          </li>
          <li>
            <b>コメント</b>（シーンのページの議論）
          </li>
          <li>
            <b>巡礼コース</b>（<Link href="/routes" className="text-shu hover:underline">コースのページ</Link>）
            — 地点そのものは消えません
          </li>
          <li>
            <b>作品</b>（<Link href="/works" className="text-shu hover:underline">作品のページ</Link>）
            — その作品の記述がすべて消えます。取り違え防止に作品名の入力を求めます
          </li>
        </ul>
      </section>
    </div>
  );
}
