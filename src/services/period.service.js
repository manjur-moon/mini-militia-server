import { DateTime, IANAZone } from "luxon";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const DEFAULT_WEEK_STARTS_ON = 1;

function assertTimezone(timezone) {
  if (!IANAZone.isValidZone(timezone)) {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_TIMEZONE",
      message: "A valid IANA league timezone is required.",
    });
  }
}

function toDateTime(input, timezone) {
  let value;
  if (input === undefined || input === null || input === "") {
    value = DateTime.now().setZone(timezone);
  } else if (input instanceof Date) {
    value = DateTime.fromJSDate(input, { zone: timezone });
  } else if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // A date-only filter represents a calendar date in the configured league zone.
    value = DateTime.fromISO(input, { zone: timezone });
  } else if (typeof input === "string") {
    value = DateTime.fromISO(input, { setZone: true }).setZone(timezone);
  } else {
    value = DateTime.fromJSDate(new Date(input), { zone: timezone });
  }
  if (!value.isValid) {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_PERIOD_DATE",
      message: "The requested analytics date is invalid.",
    });
  }
  return value;
}

function serializePeriod({ type, key, start, end, timezone, seasonId = null, label }) {
  return Object.freeze({
    type,
    key,
    startAt: start.toUTC().toJSDate(),
    endAt: end.toUTC().toJSDate(),
    timezone,
    seasonId,
    label,
  });
}

export function resolveWeeklyPeriod({
  date,
  timezone = env.LEAGUE_TIMEZONE,
  weekStartsOn = DEFAULT_WEEK_STARTS_ON,
} = {}) {
  assertTimezone(timezone);
  const localDate = toDateTime(date, timezone).startOf("day");
  const currentWeekday = localDate.weekday % 7;
  const daysSinceStart = (currentWeekday - weekStartsOn + 7) % 7;
  const start = localDate.minus({ days: daysSinceStart });
  const end = start.plus({ days: 7 });
  return serializePeriod({
    type: "weekly",
    key: start.toFormat("yyyy-LL-dd"),
    start,
    end,
    timezone,
    label: `${start.toFormat("dd LLL yyyy")} – ${end.minus({ milliseconds: 1 }).toFormat("dd LLL yyyy")}`,
  });
}

export function resolveMonthlyPeriod({ date, timezone = env.LEAGUE_TIMEZONE } = {}) {
  assertTimezone(timezone);
  const start = toDateTime(date, timezone).startOf("month");
  const end = start.plus({ months: 1 });
  return serializePeriod({
    type: "monthly",
    key: start.toFormat("yyyy-LL"),
    start,
    end,
    timezone,
    label: start.toFormat("LLLL yyyy"),
  });
}

export function resolveAllTimePeriod({
  startAt = new Date(0),
  endAt = new Date(),
  timezone = env.LEAGUE_TIMEZONE,
} = {}) {
  assertTimezone(timezone);
  const start = toDateTime(startAt, timezone);
  const requestedEnd = toDateTime(endAt, timezone);
  const end = requestedEnd <= start ? start.plus({ milliseconds: 1 }) : requestedEnd;
  return serializePeriod({
    type: "all_time",
    key: "all-time",
    start,
    end,
    timezone,
    label: "All time",
  });
}

export function resolveSeasonPeriod(season) {
  if (!season) {
    throw new AppError({
      statusCode: 404,
      code: "SEASON_NOT_FOUND",
      message: "Season was not found.",
    });
  }
  const timezone = season.timezone || env.LEAGUE_TIMEZONE;
  assertTimezone(timezone);
  const start = toDateTime(season.startAt, timezone);
  const end = toDateTime(season.endAt, timezone);
  return serializePeriod({
    type: "season",
    key: season.slug ?? `season-${season._id}`,
    start,
    end,
    timezone,
    seasonId: season._id,
    label: season.name,
  });
}

export function resolvePreviousPeriod(period) {
  if (period.type === "weekly") {
    return resolveWeeklyPeriod({
      date: DateTime.fromJSDate(period.startAt).minus({ days: 1 }).toJSDate(),
      timezone: period.timezone,
    });
  }
  if (period.type === "monthly") {
    return resolveMonthlyPeriod({
      date: DateTime.fromJSDate(period.startAt)
        .setZone(period.timezone)
        .minus({ months: 1 })
        .toJSDate(),
      timezone: period.timezone,
    });
  }
  return null;
}

export function periodContains(period, date) {
  const instant = new Date(date).getTime();
  return instant >= period.startAt.getTime() && instant < period.endAt.getTime();
}

export function formatLeagueDateKey(date, timezone = env.LEAGUE_TIMEZONE) {
  assertTimezone(timezone);
  return DateTime.fromJSDate(new Date(date), { zone: timezone }).toFormat("yyyy-LL-dd");
}
