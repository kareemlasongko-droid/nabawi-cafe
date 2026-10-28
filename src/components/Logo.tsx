import { Trees } from "lucide-react";
import { BRAND } from "@/lib/constants";

export default function Logo({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-xl text-white ${
          light ? "bg-white/15" : "bg-forest-600 shadow-sm"
        }`}
      >
        <Trees className="size-5" />
      </span>
      <span className="leading-tight">
        <span className={`block text-[17px] font-extrabold tracking-tight ${light ? "text-white" : "text-stone-900"}`}>
          {BRAND.name}
        </span>
        <span className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${light ? "text-forest-200" : "text-forest-700"}`}>
          {BRAND.tagline}
        </span>
      </span>
    </span>
  );
}
