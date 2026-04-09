import { PrizeCard } from "./PrizeCard";

export default function PrizeCarousel({ prizes }: { prizes: { prize: string; image: string }[] }) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {prizes.map((p, i) => (
        <PrizeCard key={i} prize={p.prize} image={p.image} index={i} />
      ))}
    </div>
  );
}
