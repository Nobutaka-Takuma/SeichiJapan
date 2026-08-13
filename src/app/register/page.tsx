import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "新規登録" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-wide">参加する</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">
          読んで気づいたことを、根拠と一緒に置いていってください。ひとつの投票でも地図は変わります。
        </p>
      </div>

      <Card className="p-6">
        <AuthForm mode="register" next={next} />
      </Card>

      <p className="text-center text-sm text-ink-3">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-bold text-shu hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
