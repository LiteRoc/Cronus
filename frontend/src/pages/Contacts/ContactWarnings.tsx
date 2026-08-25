import type { ContactDuplicateWarning } from "@/types/Contact";

export default function ContactWarnings({ warnings }: { warnings: ContactDuplicateWarning[] }) {
  if (!warnings.length) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <h3 className="font-semibold">Possible duplicate saved</h3>
      <p className="mt-1">The Contact was saved. Review these advisory matches before creating another record.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {warnings.flatMap((warning, warningIndex) => {
          const visible = (warning.matches ?? []).map((match) => (
            <li key={`${warningIndex}-${match.id}`}>
              {match.firstName} {match.lastName}
              {match.email ? ` — ${match.email}` : ""} ({match.matchedOn.join(", ")})
            </li>
          ));
          if (warning.hasRestrictedMatches) {
            visible.push(<li key={`${warningIndex}-restricted`}>Another possible match exists outside this Facility view.</li>);
          }
          return visible;
        })}
      </ul>
    </div>
  );
}
