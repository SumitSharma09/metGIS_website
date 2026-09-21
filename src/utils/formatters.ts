import dayjs from 'dayjs';

export const formatDateTime = (iso: string): string => dayjs(iso).format('DD MMM YYYY, HH:mm');

export const formatDate = (iso: string): string => dayjs(iso).format('DD MMM YYYY');

export const formatTime = (iso: string): string => dayjs(iso).format('HH:mm');

export const formatRelative = (iso: string): string => {
  const diffMinutes = dayjs().diff(dayjs(iso), 'minute');
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export const formatNumber = (value: number, fractionDigits = 1): string =>
  Number.isFinite(value) ? value.toFixed(fractionDigits) : '--';

export const formatWithUnit = (value: number, unit: string, fractionDigits = 1): string =>
  `${formatNumber(value, fractionDigits)} ${unit}`;

export const titleCase = (value: string): string =>
  value.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
