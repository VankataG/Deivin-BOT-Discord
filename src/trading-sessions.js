const SOFIA_TIME_ZONE = 'Europe/Sofia';

const SESSION_DEFINITIONS = [
  {
    name: 'Азиатска сесия',
    timeZone: SOFIA_TIME_ZONE,
    openHour: 1,
    openMinute: 0,
    closeHour: 7,
    closeMinute: 0,
  },
  {
    name: 'Лондонска сесия',
    timeZone: SOFIA_TIME_ZONE,
    openHour: 9,
    openMinute: 30,
    closeHour: 15,
    closeMinute: 0,
  },
  {
    name: 'Нюйоркска сесия',
    timeZone: SOFIA_TIME_ZONE,
    openHour: 14,
    openMinute: 30,
    closeHour: 23,
    closeMinute: 0,
  },
];

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function localTimeToInstant({ year, month, day, hour, minute }, timeZone) {
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = targetWallTime;

  // Refine the UTC guess until it represents the requested wall time in the IANA zone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = getZonedParts(new Date(instant), timeZone);
    const representedWallTime = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
    );
    const adjustment = targetWallTime - representedWallTime;

    instant += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(instant);
}

function formatSofiaTime(date) {
  return new Intl.DateTimeFormat('bg-BG', {
    timeZone: SOFIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function getTradingSessions(now = new Date()) {
  return SESSION_DEFINITIONS.map((session) => {
    const localNow = getZonedParts(now, session.timeZone);
    const date = {
      year: localNow.year,
      month: localNow.month,
      day: localNow.day,
    };
    const opensAt = localTimeToInstant(
      { ...date, hour: session.openHour, minute: session.openMinute },
      session.timeZone,
    );
    const closesAt = localTimeToInstant(
      { ...date, hour: session.closeHour, minute: session.closeMinute },
      session.timeZone,
    );
    const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    const isWeekday = weekday >= 1 && weekday <= 5;

    return {
      name: session.name,
      isOpen: isWeekday && now >= opensAt && now < closesAt,
      opensAtSofia: formatSofiaTime(opensAt),
      closesAtSofia: formatSofiaTime(closesAt),
    };
  });
}
