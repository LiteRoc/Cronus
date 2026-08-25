const validZone = (zone: string | undefined) => {
  if (!zone) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); return zone; } catch { return null; }
};

export const effectiveTimeZone = (facilityZone?: string) =>
  validZone(facilityZone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

const partsAt = (date: Date, timeZone: string) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
);

export function localDateTimeToIso(value: string, facilityZone?: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Enter a valid due date and time.");
  const wanted = match.slice(1).map(Number);
  const zone = effectiveTimeZone(facilityZone);
  let instant = Date.UTC(wanted[0], wanted[1] - 1, wanted[2], wanted[3], wanted[4]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsAt(new Date(instant), zone);
    const represented = Date.UTC(+actual.year, +actual.month - 1, +actual.day, +actual.hour, +actual.minute);
    instant += Date.UTC(...[wanted[0], wanted[1] - 1, wanted[2], wanted[3], wanted[4]]) - represented;
  }
  const resolved = partsAt(new Date(instant), zone);
  const wallKey = (parts: Record<string, string>) => [parts.year, parts.month, parts.day, parts.hour, parts.minute].join("-");
  if (wallKey(partsAt(new Date(instant - 3600000), zone)) === wallKey(resolved)
    || wallKey(partsAt(new Date(instant + 3600000), zone)) === wallKey(resolved)) {
    throw new Error("That local time occurs twice in the selected time zone; choose another time.");
  }
  if ([resolved.year, resolved.month, resolved.day, resolved.hour, resolved.minute].join("-")
    !== [match[1], match[2], match[3], match[4], match[5]].join("-")) {
    throw new Error("That local time does not exist in the selected time zone.");
  }
  return new Date(instant).toISOString();
}

export function isoToLocalInput(value: string, facilityZone?: string) {
  const parts = partsAt(new Date(value), effectiveTimeZone(facilityZone));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function displayDueAt(value: string, facilityZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: effectiveTimeZone(facilityZone), dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
}
