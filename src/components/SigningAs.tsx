import Link from "next/link";
import { anonIdentity, currentUser } from "@/lib/auth";

/**
 * 「いま誰として書いているか」の一行。
 *
 * 編集や投稿のフォームの脇に置く。名乗らずに書けることを、
 * 断りではなく前提として伝えるためのもの。
 * アカウントへの誘いは、そのすぐ横に小さく添えるだけにする。
 */
export async function SigningAs({ next }: { next: string }) {
  const user = await currentUser();
  const anon = await anonIdentity();

  if (user) {
    return (
      <p className="text-xs text-ink-3">
        <Link href={`/users/${user.handle}`} className="font-bold text-ink-2 hover:text-shu">
          {user.display_name}
        </Link>
        として書いています。
      </p>
    );
  }

  return (
    <p className="text-xs leading-relaxed text-ink-3">
      ログインせずに書けます。
      {anon ? (
        <>
          いまは <b className="font-bold text-ink-2">{anon.display_name}</b> という名前で記録されます。
        </>
      ) : (
        <>この編集は「匿名」として記録されます。</>
      )}{" "}
      <Link
        href={`/register?next=${encodeURIComponent(next)}`}
        className="font-bold text-shu hover:underline"
      >
        アカウントを作る
      </Link>
      と、{anon ? "ここまでの分もまとめて自分の記録になり、" : "自分の記録として残り、"}
      旅の記録も付けられます。
    </p>
  );
}
