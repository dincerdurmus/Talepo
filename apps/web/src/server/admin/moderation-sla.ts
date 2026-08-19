const SLA_HOURS = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
} as const;

export function moderationSla(priority: string, createdAt: Date, now = new Date()) {
  const targetHours = SLA_HOURS[priority as keyof typeof SLA_HOURS] ?? SLA_HOURS.MEDIUM;
  const dueAt = new Date(createdAt.getTime() + targetHours * 60 * 60 * 1000);
  const remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  return { targetHours, dueAt, remainingMinutes, breached: remainingMinutes <= 0 };
}
