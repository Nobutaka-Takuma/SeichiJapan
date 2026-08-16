import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RouteEditor } from "@/components/RouteEditor";
import { Card } from "@/components/ui";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "コースを作る" };

export default async function NewRoutePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/routes/new");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <nav className="text-xs text-ink-3">
        <Link href="/routes" className="hover:text-shu">
          巡礼コース
        </Link>
        <span className="mx-1.5">／</span>
        <span>新しいコース</span>
      </nav>

      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">コースを作る</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          回る順に地点を並べてください。距離は自動で出ます。
          迎える側が「うちの町の回り方」を示すのにも使えます。
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <RouteEditor />
      </Card>
    </div>
  );
}
