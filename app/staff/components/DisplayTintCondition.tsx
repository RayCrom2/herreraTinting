import { oldTintConditions } from "@/app/lib/quote";

//Implemented to handle multiple entry change for old tint condition
export default function DisplayTintCondition({
  currentCondition,
}: {
  currentCondition: string[] | null;
}) {
  const len = currentCondition?.length ?? 0;
  if (currentCondition && len > 0) {
    return currentCondition.map((cur, idx) => {
      const condition = oldTintConditions.find((c) => c.value === cur);
      return (
        <span className="text-rose-300" key={cur}>
          {` ${condition?.label ?? cur}${idx !== len - 1 ? ", " : ""}`}
        </span>
      );
    });
  }
  return <span> -</span>;
}
