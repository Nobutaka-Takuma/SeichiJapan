"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { startGuessAction, submitGuessAction, type GuessResult } from "@/app/actions";
import { MapView, PlacePicker, type MapPin } from "./MapView";
import type { Clue } from "@/lib/guess";

const MAX_SCORE = 5000;

const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

/** 当たり具合のひとこと。数字だけだと味気ないので。 */
function verdict(m: number): string {
  if (m <= 200) return "ぴたり";
  if (m <= 1000) return "ほぼ正解";
  if (m <= 5000) return "惜しい";
  if (m <= 30_000) return "同じあたり";
  if (m <= 150_000) return "同じ地方";
  return "遠い";
}

/**
 * 「この場面はどこ？」
 *
 * 手がかりを見て地図を指す。答え合わせで、その場所の項目・作品・行き方へ出る。
 * 答えはサーバにしか無いので、画面を覗いても分からない。
 */
export function GuessGame() {
  const [clues, setClues] = useState<Clue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      const r = await startGuessAction();
      if (r.error) return setError(r.error);
      setClues(r.clues);
      setError(null);
      setIndex(0);
      setPicked(null);
      setResult(null);
      setTotal(0);
    });

  // 開いたら1組ぶん用意する
  useEffect(() => {
    begin();
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-rule-2 p-8 text-center">
        <p className="text-sm text-ink-2">{error}</p>
        <Link href="/scenes/new" className="mt-3 inline-block font-bold text-shu hover:underline">
          シーンを登録する →
        </Link>
      </div>
    );
  }

  if (!clues) {
    return <p className="rounded-lg border border-rule bg-card p-8 text-center text-sm text-ink-3">用意しています…</p>;
  }

  const clue = clues[index];
  const done = index >= clues.length;

  /* ---- 全問おわり ---- */
  if (done) {
    return (
      <div className="space-y-5 rounded-lg border border-rule bg-card p-6 text-center">
        <p className="text-xs text-ink-3">{clues.length}問おわり</p>
        <p className="font-serif text-4xl font-bold tabular-nums">
          {total.toLocaleString()}
          <span className="ml-1 text-base font-normal text-ink-3">/ {(clues.length * MAX_SCORE).toLocaleString()}</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={begin}
            disabled={pending}
            className="rounded bg-shu px-5 py-2.5 text-sm font-bold text-paper disabled:opacity-60"
          >
            もう一度
          </button>
          <Link
            href="/near"
            className="rounded border border-rule-2 px-5 py-2.5 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
          >
            近くの聖地を探す
          </Link>
          <Link
            href="/routes"
            className="rounded border border-rule-2 px-5 py-2.5 text-sm font-bold text-ink-2 hover:border-shu hover:text-shu"
          >
            巡礼コース
          </Link>
        </div>
      </div>
    );
  }

  const next = () => {
    if (result?.score) setTotal((t) => t + result.score!);
    setIndex((i) => i + 1);
    setPicked(null);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span>
          第 <b className="text-ink-2">{index + 1}</b> 問 / {clues.length}
        </span>
        <span className="tabular-nums">
          ここまで <b className="text-ink-2">{total.toLocaleString()}</b> 点
        </span>
      </div>

      {/* 手がかり */}
      <div className="rounded-lg border border-rule bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
          <span className="rounded bg-paper-2 px-1.5 py-0.5 font-bold text-ink-2">『{clue.work}』</span>
          {clue.chapter && <span>{clue.chapter}</span>}
          <span className="ml-auto">
            {clue.kind === "photo" ? "現地の写真" : clue.kind === "text" ? "本文より" : "場面の記述"}
          </span>
        </div>

        {clue.kind === "photo" && clue.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clue.image}
            alt="手がかりの写真"
            className="w-full rounded object-cover"
            style={{ maxHeight: 320 }}
          />
        ) : (
          <p className="font-serif text-lg leading-loose sm:text-xl">
            {clue.kind === "text" ? `「${clue.text}」` : clue.text}
          </p>
        )}

        {clue.citation && <p className="mt-2 text-[11px] text-ink-3">出典：{clue.citation}</p>}
        <p className="mt-3 text-[11px] text-ink-3">
          地名は伏せてあります。地図の上を押して、場所を指してください。
        </p>
      </div>

      {/*
        答え合わせのあとは、指した場所と正解の両方を出す。
        どれだけ外したかは、数字より二つの点の離れ方のほうが伝わる。
      */}
      <div className="overflow-hidden rounded-lg border border-rule">
        {result?.answer && picked ? (
          <MapView
            pins={[
              {
                id: -1,
                lat: picked.lat,
                lng: picked.lng,
                title: "あなたの答え",
                subtitle: `${km(result.distance_m!)} ちがい`,
                confidence: 0,
                primary: false,
              },
              {
                id: result.answer.placeId,
                lat: result.answer.lat,
                lng: result.answer.lng,
                title: result.answer.name,
                subtitle: "正解",
                confidence: 1,
                primary: true,
                href: `/places/${result.answer.placeId}`,
              } satisfies MapPin,
            ]}
            height={380}
            fit
          />
        ) : (
          <PlacePicker value={picked} onChange={setPicked} height={380} />
        )}
      </div>

      {/* 答え合わせ */}
      {result?.answer ? (
        <div className="space-y-3 rounded-lg border border-shu/40 bg-shu-soft/30 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-serif text-2xl font-bold">{verdict(result.distance_m!)}</span>
            <span className="text-sm text-ink-2">{km(result.distance_m!)} ちがい</span>
            <span className="ml-auto font-serif text-2xl font-bold tabular-nums text-shu">
              +{result.score!.toLocaleString()}
            </span>
          </div>
          <p className="text-sm">
            答えは{" "}
            <Link href={`/places/${result.answer.placeId}`} className="font-bold text-shu hover:underline">
              {result.answer.name}
            </Link>
            （{result.answer.prefecture}）でした。
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href={`/passages/${result.answer.passageId}`} className="text-ink-2 hover:text-shu">
              このシーンを読む
            </Link>
            <Link href={`/works/${result.answer.workSlug}`} className="text-ink-2 hover:text-shu">
              『{result.answer.workTitle}』の舞台
            </Link>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${result.answer.lat},${result.answer.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ai hover:underline"
            >
              行き方を調べる ↗
            </a>
          </div>
          <button
            type="button"
            onClick={next}
            className="w-full rounded bg-shu px-4 py-2.5 text-sm font-bold text-paper"
          >
            {index + 1 >= clues.length ? "結果を見る" : "次の問題へ"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!picked || pending}
          onClick={() =>
            start(async () => {
              const r = await submitGuessAction(index, picked!.lat, picked!.lng);
              if (r.error) setError(r.error);
              else setResult(r);
            })
          }
          className="w-full rounded bg-shu px-4 py-3 text-sm font-bold text-paper disabled:opacity-50"
        >
          {picked ? "ここだと思う" : "地図を押して場所を指してください"}
        </button>
      )}
    </div>
  );
}
