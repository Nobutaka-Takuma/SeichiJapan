import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { NewPassageForm } from "@/components/NewPassageForm";
import { Card } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { decodeParam } from "@/lib/params";
import { getWork } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeParam((await params).slug);
  const work = getWork(slug);
  return { title: work ? `${work.title}に記述を追加` : "記述を追加" };
}

export default async function NewPassagePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeParam((await params).slug);
  const work = getWork(slug);
  if (!work) notFound();

  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/works/${slug}/passages/new`)}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav className="text-xs text-ink-3">
        <Link href="/works" className="hover:text-shu">
          作品
        </Link>
        <span className="mx-1.5">／</span>
        <Link href={`/works/${work.slug}`} className="hover:text-shu">
          {work.title}
        </Link>
        <span className="mx-1.5">／</span>
        <span>記述の追加</span>
      </nav>

      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">『{work.title}』に記述を追加する</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          場所が特定できそうな一節を切り出してください。特定できていなくて構いません。
          むしろ「どこだか分からない記述」ほど、この地図では価値があります。
        </p>
      </div>

      <Card className="p-6">
        <NewPassageForm workSlug={work.slug} />
      </Card>
    </div>
  );
}
