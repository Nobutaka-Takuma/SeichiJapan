import type { Metadata } from "next";
import { NearbyExplorer } from "@/components/NearbyExplorer";

export const metadata: Metadata = {
  title: "近くの聖地",
  description: "現在地や地名から、近くにある作品の舞台を近い順に探せます。",
};

export default async function NearPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const { lat, lng } = await searchParams;
  const initial =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat && lng
      ? { lat: Number(lat), lng: Number(lng) }
      : undefined;

  return (
    <div className="space-y-5">
      <div className="border-b border-rule pb-4">
        <h1 className="font-serif text-2xl font-bold tracking-wide">近くの聖地</h1>
        <p className="mt-1 text-sm text-ink-3">
          いる場所のまわりにある作品の舞台を、近い順に。徒歩の目安つき。
        </p>
      </div>
      <NearbyExplorer initial={initial} />
    </div>
  );
}
