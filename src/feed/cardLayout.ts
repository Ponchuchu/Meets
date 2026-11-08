export interface FeedCardMeasurement {
  height: number;
  mediaHeight: number;
  width: number;
  maxHeight: number;
  fontScale: number;
}

/** Content-height card within the viewport; aspect comes from the decoded source, never a hard-coded screen width. */
export function fitFeedCard(width: number, maxHeight: number, bodyHeight: number, aspect: number | null, fallbackAspect = 1.35) {
  const cap = Math.max(1, maxHeight);
  const body = Math.max(0, bodyHeight);
  const remaining = Math.max(0, cap - body);
  const ratio = aspect != null && Number.isFinite(aspect) && aspect > 0 ? aspect : fallbackAspect;
  const natural = Math.max(1, width) / ratio;
  const mediaHeight = Math.round(Math.min(remaining, Math.max(Math.min(90, remaining), natural)));
  return { mediaHeight, height: Math.min(cap, Math.round(body + mediaHeight)) };
}

export function sameFeedMeasurement(a: FeedCardMeasurement | undefined, b: FeedCardMeasurement) {
  return !!a && a.height === b.height && a.mediaHeight === b.mediaHeight && a.width === b.width && a.maxHeight === b.maxHeight && a.fontScale === b.fontScale;
}
