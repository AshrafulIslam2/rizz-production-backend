import { BadRequestException } from '@nestjs/common';

/** The shop runs on Bangladesh time (UTC+6, no daylight saving). */
const DHAKA_OFFSET = '+06:00';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn what the admin entered into the exact moment a campaign starts or ends.
 *
 * A bare date ("2026-11-13") used to become midnight UTC — 6 AM in Dhaka — so a
 * campaign set to start and end on the 13th lasted zero seconds and never
 * showed. A bare date now means the whole day in Dhaka: a start is 00:00, an
 * end is 23:59:59.999. A full date-time is taken as given.
 *
 * Returns undefined when the field wasn't sent, null when it was cleared.
 */
export function parseCampaignDate(value: unknown, edge: 'start' | 'end'): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const raw = String(value).trim();
  const iso = DATE_ONLY.test(raw)
    ? `${raw}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}${DHAKA_OFFSET}`
    : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${edge} date: ${raw}`);
  }
  return date;
}

/** A campaign must end after it starts — otherwise it can never be live. */
export function assertCampaignWindow(start: Date | null | undefined, end: Date | null | undefined): void {
  if (start && end && end.getTime() <= start.getTime()) {
    throw new BadRequestException('End date and time must be after the start.');
  }
}
