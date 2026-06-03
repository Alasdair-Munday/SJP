const longDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const formatDate = (value: Date | string) =>
  longDateFormatter.format(typeof value === "string" ? new Date(value) : value);

export const formatShortDate = (value: Date | string) =>
  shortDateFormatter.format(typeof value === "string" ? new Date(value) : value);

export const formatTalkDuration = (durationInSeconds: number) => {
  if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) {
    return "";
  }

  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.round((durationInSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};
