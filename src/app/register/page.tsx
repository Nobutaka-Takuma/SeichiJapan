import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { anonIdentity, currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "新規登録" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;
  const anon = await anonIdentity();
  const backTo = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">参加する</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          <strong className="font-bold text-ink-2">書くだけならアカウントは要りません。</strong>
          アカウントを作ると、いいね・投票と、
          <strong className="font-bold text-ink-2">旅の記録</strong>（行った場所・コースの踏破）が
          自分のものとして残ります。
        </p>
      </div>

      {anon && (
        <Card className="border-shu/30 bg-shu-soft/30 p-4 text-sm leading-relaxed text-ink-2">
          いまは <b className="font-bold text-ink">{anon.display_name}</b> として書いています。
          ここでアカウントを作ると、
          <b className="font-bold text-ink">それまでの編集や投稿もそのまま引き継がれます。</b>
        </Card>
      )}

      <Card className="p-6">
        <AuthForm mode="register" next={next} />
      </Card>

      <p className="text-center text-sm text-ink-3">
        すでにアカウントをお持ちの方は{" "}
        <Link href={`/login${backTo}`} className="font-bold text-shu hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
