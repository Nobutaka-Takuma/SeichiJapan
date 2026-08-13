import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { DEMO_PASSWORD } from "@/lib/data";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">ログイン</h1>
        <p className="mt-1 text-sm text-ink-3">投票・比定の投稿・議論への参加にはログインが必要です。</p>
      </div>

      <Card className="p-6">
        <AuthForm mode="login" next={next} />
      </Card>

      <p className="text-center text-sm text-ink-3">
        はじめての方は{" "}
        <Link href="/register" className="font-bold text-shu hover:underline">
          新規登録
        </Link>
      </p>

      <Card className="border-dashed p-4 text-xs leading-relaxed text-ink-3">
        <p className="font-bold text-ink-2">お試し用アカウント</p>
        <p className="mt-1">
          ID <code className="rounded bg-paper-2 px-1">kobo_map</code>（他に <code className="rounded bg-paper-2 px-1">soseki_walk</code>、
          <code className="rounded bg-paper-2 px-1">numazu_p</code> など）／ パスワード{" "}
          <code className="rounded bg-paper-2 px-1">{DEMO_PASSWORD}</code>
        </p>
      </Card>
    </div>
  );
}
