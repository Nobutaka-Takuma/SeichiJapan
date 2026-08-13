import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapView } from "@/components/MapView";
import { Card, ConfidenceBar, Empty, MediumBadge, PassageQuote } from "@/components/ui";
import { getAppearances, getPlace } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = getPlace(Number(id));
  if (!place) return { title: "場所が見つかりません" };
  return {
    title: `${place.name}に重なる物語`,
    description: `${place.prefecture}${place.address}。${place.name}を舞台とする作品と、その根拠となる記述。`,
  };
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placeId = Number(id);
  if (!Number.isInteger(placeId)) notFound();

  const place = getPlace(placeId);
  if (!place) notFound();
  const appearances = getAppearances(placeId);

  return (
    <div className="space-y-8">
      <nav className="text-xs text-ink-3">
        <Link href="/places" className="hover:text-shu">
          場所
        </Link>
        <span className="mx-1.5">／</span>
        <span>{place.name}</span>
      </nav>

      <header>
        <h1 className="font-serif text-3xl font-bold tracking-wide">{place.name}</h1>
        <p className="mt-1 text-sm text-ink-3">
          {place.prefecture} {place.address}
          <span className="ml-3 tabular-nums">
            {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
          </span>
        </p>
        {place.note && <p className="mt-4 max-w-2xl leading-loose text-ink-2">{place.note}</p>}
      </header>

      <Card className="overflow-hidden">
        <MapView
          pins={[
            {
              id: place.id,
              lat: place.lat,
              lng: place.lng,
              title: place.name,
              subtitle: place.prefecture,
              confidence: appearances[0]?.confidence ?? 0.5,
              primary: true,
            },
          ]}
          height={340}
          center={[place.lat, place.lng]}
          zoom={15}
          fit={false}
        />
        <div className="flex flex-wrap gap-3 border-t border-rule px-4 py-2.5 text-xs">
          <a
            href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ai hover:underline"
          >
            OpenStreetMapで開く ↗
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ai hover:underline"
          >
            経路を調べる ↗
          </a>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 border-b border-rule pb-2 font-serif text-lg font-bold tracking-wide">
          ここに重なる物語
          <span className="ml-2 text-xs font-normal text-ink-3">{appearances.length}件</span>
        </h2>

        {appearances.length === 0 ? (
          <Empty>この場所は、まだどの記述とも結びついていません。</Empty>
        ) : (
          <ol className="space-y-3">
            {appearances.map((a) => (
              <li key={a.passage_id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <MediumBadge medium={a.medium} />
                    <Link href={`/works/${a.work_slug}`} className="font-bold text-ink-2 hover:text-shu">
                      『{a.work_title}』
                    </Link>
                    <span>{a.work_author}</span>
                    {a.chapter && <span>／{a.chapter}</span>}
                  </div>
                  <Link href={`/passages/${a.passage_id}`} className="group mt-2 block">
                    <PassageQuote kind={a.kind} quote={a.quote} className="group-hover:text-shu" />
                  </Link>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="shrink-0 text-xs text-ink-3">この場所である確度</span>
                    <ConfidenceBar share={a.confidence} />
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
