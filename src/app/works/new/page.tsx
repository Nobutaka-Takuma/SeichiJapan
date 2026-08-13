import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { NewWorkForm } from "@/components/NewWorkForm";
import { Card } from "@/components/ui";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "作品を追加する" };

export default async function NewWorkPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/works/new");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-xs text-ink-3">
        <Link href="/works" className="hover:text-shu">
          作品
        </Link>
        <span className="mx-1.5">／</span>
        <span>追加</span>
      </nav>

      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">作品を追加する</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          まず作品の枠をつくり、そのあとに「場所が特定できそうな記述」を登録していきます。
        </p>
      </div>

      <Card className="p-6">
        <NewWorkForm />
      </Card>
    </div>
  );
}
