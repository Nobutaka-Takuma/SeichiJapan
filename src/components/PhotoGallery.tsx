import Link from "next/link";
import { DeleteButton } from "./DeleteButton";
import { AddPhotoForm, RemoveOwnPhoto } from "./PhotoControls";
import { removePhotoAction } from "@/app/actions";
import type { Photo } from "@/lib/photos";

/**
 * 現地の写真。何枚でも並ぶ。
 *
 * 同じ場所でも、季節・時刻・天気・訪れた年で見え方はまるで違う。
 * 1枚に絞らず積み上がっていくほうが、その場所の姿はよく伝わるし、
 * 「自分の1枚も足しておこう」と思える。
 *
 * 引用画像はここには出さない（引用は説明の裏づけとして、記述のそばに1点だけ置く）。
 */
export function PhotoGallery({
  photos,
  placeId,
  passageId,
  viewerId,
  isAdmin = false,
  title = "現地の写真",
  invite = "訪れたときの1枚を載せてみませんか。",
}: {
  photos: Photo[];
  placeId?: number;
  passageId?: number;
  viewerId: number | null;
  isAdmin?: boolean;
  title?: string;
  invite?: string;
}) {
  const shots = photos.filter((p) => p.kind === "site_photo");

  return (
    <section id="photos" className="space-y-3">
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <h2 className="font-serif text-lg font-bold tracking-wide">
          {title}
          {shots.length > 0 && <span className="ml-2 text-xs font-normal text-ink-3">{shots.length}枚</span>}
        </h2>
      </div>

      {shots.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-rule-2 px-4 py-6 text-center">
          <p className="text-sm text-ink-3">まだ写真がありません。{invite}</p>
          <div className="mx-auto max-w-xs">
            <AddPhotoForm placeId={placeId} passageId={passageId} />
          </div>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shots.map((p, i) => (
              <li key={p.id} className={i === 0 ? "col-span-full" : ""}>
                <figure className="overflow-hidden rounded-lg border border-rule bg-card">
                  <a href={p.path} target="_blank" rel="noopener noreferrer">
                    {/* 利用者が投稿した画像。大きさがまちまちなので next/image は使わない */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.path}
                      alt={p.caption || "現地の写真"}
                      loading={i === 0 ? undefined : "lazy"}
                      className={`w-full object-cover ${i === 0 ? "" : "h-28 sm:h-32"}`}
                      style={i === 0 ? { maxHeight: 380 } : undefined}
                    />
                  </a>
                  <figcaption className="space-y-1 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
                    {p.caption && <span className="block text-ink-2">{p.caption}</span>}
                    <span className="block">
                      {p.uploader_handle ? (
                        <Link href={`/users/${p.uploader_handle}`} className="hover:text-shu">
                          {p.uploader_name}
                        </Link>
                      ) : (
                        p.uploader_name || "投稿者不明"
                      )}
                      {p.taken_on && <span className="ml-1.5">{p.taken_on.replace(/-/g, "/")} 撮影</span>}
                    </span>
                    {viewerId !== null && p.created_by === viewerId ? (
                      <RemoveOwnPhoto id={p.id} />
                    ) : isAdmin ? (
                      <DeleteButton action={removePhotoAction} id={p.id} what="この写真" label="外す" />
                    ) : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <AddPhotoForm placeId={placeId} passageId={passageId} />
        </>
      )}
    </section>
  );
}
