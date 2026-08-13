"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { editPlaceAction, type FormState } from "@/app/actions";
import { PlacePicker } from "./MapView";
import type { Place } from "@/lib/queries";

const field = "w-full rounded border border-rule-2 bg-card px-3 py-2.5 text-sm outline-none focus:border-shu";

export function PlaceEditForm({ place }: { place: Place }) {
  const [state, action, pending] = useActionState<FormState, FormData>(editPlaceAction, {});
  const [coords, setCoords] = useState({ lat: place.lat, lng: place.lng });
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="place_id" value={place.id} />
      <input type="hidden" name="lat" value={coords.lat} />
      <input type="hidden" name="lng" value={coords.lng} />
      <input type="hidden" name="remove_photo" value={removePhoto ? "1" : "0"} />

      <section className="space-y-3">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">基本情報</h2>
        <label className="block">
          <span className="text-xs font-bold text-ink-2">名前 *</span>
          <input name="name" required defaultValue={place.name} className={`${field} mt-1`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-ink-2">都道府県</span>
            <input name="prefecture" defaultValue={place.prefecture} className={`${field} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-ink-2">住所・所在地</span>
            <input name="address" defaultValue={place.address} className={`${field} mt-1`} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-bold text-ink-2">リード文</span>
          <input
            name="note"
            defaultValue={place.note}
            placeholder="一行で。一覧や地図の吹き出しに出ます"
            className={`${field} mt-1`}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">位置</h2>
        <div className="overflow-hidden rounded border border-rule">
          <PlacePicker value={coords} onChange={setCoords} height={280} />
          <p className="border-t border-rule bg-card px-3 py-2 text-xs tabular-nums text-ink-3">
            {coords.lat}, {coords.lng}（地図をクリック、またはピンをドラッグ）
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">解説</h2>
        <p className="text-xs leading-relaxed text-ink-3">
          行頭に <code className="rounded bg-paper-2 px-1">■</code> を置くと小見出しになります。段落は空行で区切ります。
        </p>
        <textarea
          name="body"
          rows={14}
          defaultValue={place.body}
          placeholder={"どんな場所か、作品との関わり、いつからこう呼ばれているか。\n\n■ 作品での扱い\n……"}
          className={`${field} resize-y leading-loose`}
        />
      </section>

      <section className="space-y-2">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">行き方・訪問時の注意</h2>
        <textarea
          name="access"
          rows={4}
          defaultValue={place.access}
          placeholder="最寄り駅からの経路、開いている時間、撮影の可否など。近隣の迷惑にならない訪問のための情報を。"
          className={`${field} resize-y leading-relaxed`}
        />
      </section>

      <section className="space-y-2">
        <h2 className="border-b border-rule pb-1.5 font-serif text-base font-bold">現地の写真</h2>
        {place.photo_path && !removePhoto && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.photo_path} alt="" className="h-20 w-32 rounded object-cover" />
            <button
              type="button"
              onClick={() => setRemovePhoto(true)}
              className="text-xs text-ink-3 hover:text-shu"
            >
              この写真を外す
            </button>
          </div>
        )}
        {removePhoto && (
          <p className="text-xs text-ink-3">
            写真を外します。
            <button type="button" onClick={() => setRemovePhoto(false)} className="ml-2 font-bold text-shu">
              取り消す
            </button>
          </p>
        )}
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="block w-full text-xs text-ink-2 file:mr-3 file:rounded file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink-2"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="h-32 w-full rounded object-cover" />}
        <p className="text-[11px] leading-relaxed text-ink-3">
          自分で撮影した写真を使ってください。作品の映像・挿絵の転載は避けてください。
        </p>
      </section>

      <section className="space-y-2">
        <label className="block">
          <span className="text-xs font-bold text-ink-2">編集要約</span>
          <input
            name="summary"
            placeholder="何をどう直したか（例：住所を修正、行き方を追記）"
            className={`${field} mt-1`}
          />
        </label>
      </section>

      {state.error && <p className="rounded bg-shu-soft px-3 py-2 text-sm text-shu">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-rule pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "保存中…" : "変更を保存する"}
        </button>
        <Link
          href={`/places/${place.id}`}
          className="rounded border border-rule-2 px-4 py-2.5 text-sm text-ink-2 hover:border-shu hover:text-shu"
        >
          やめる
        </Link>
      </div>
    </form>
  );
}
