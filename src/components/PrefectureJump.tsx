"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AreaSearch } from "./AreaSearch";
import { ALL_PREFECTURES } from "@/lib/regions";

/**
 * 行き先が決まっている人のための近道。
 *
 * 地方 → 都道府県 と辿るのは「どこに何があるか分からない人」のための順路で、
 * 「秋葉原が見たい」と分かっている人には遠回りになる。
 * 地名を入れれば、その県の地図へ一息で移れるようにしておく。
 */
export function PrefectureJump() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className={pending ? "opacity-60" : ""}>
      <AreaSearch
        placeholder="地名から探す（例：秋葉原、沼津市、飛騨市）"
        onSelect={(hit) => {
          // 県が分かるものは、その県の地図へ。分からなければ選び直してもらう。
          const pref = hit.prefecture && ALL_PREFECTURES.includes(hit.prefecture) ? hit.prefecture : null;
          if (!pref) return;
          start(() => router.push(`/map?pref=${encodeURIComponent(pref)}`));
        }}
      />
    </div>
  );
}
