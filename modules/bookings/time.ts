const WEEKDAY_BY_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateKey(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localWeekday(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone);
  return WEEKDAY_BY_NAME[String(parts.weekday).toLowerCase()] ?? 0;
}

export function localTimeToUtc(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const actualParts = dateParts(new Date(naiveUtc), timeZone);
  const actualAsUtc = Date.UTC(
    Number(actualParts.year),
    Number(actualParts.month) - 1,
    Number(actualParts.day),
    Number(actualParts.hour),
    Number(actualParts.minute),
    Number(actualParts.second),
  );
  const offset = actualAsUtc - naiveUtc;
  return new Date(naiveUtc - offset);
}

export function utcToLocalTime(date: Date, timeZone: string) {
  const parts = dateParts(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function enumerateLocalDateKeys(start: Date, end: Date, timeZone: string) {
  const keys: string[] = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const limit = new Date(end);
  limit.setUTCDate(limit.getUTCDate() + 2);
  while (cursor <= limit) {
    const key = localDateKey(cursor, timeZone);
    if (!keys.includes(key)) keys.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}
