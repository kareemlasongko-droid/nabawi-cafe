import type { ReactNode } from "react";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="container-app">
      <div className="mx-auto max-w-md pb-14 pt-6 sm:pt-10">
        <div className="card p-5 sm:p-7">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>
          <p className="mb-6 mt-1.5 text-sm text-stone-500">{subtitle}</p>
          {children}
        </div>
        <p className="mt-5 text-center text-xs italic text-stone-400">
          &ldquo;Kopi hangat, udara sejuk, dan senja yang tak terlupakan.&rdquo;
        </p>
      </div>
    </div>
  );
}
