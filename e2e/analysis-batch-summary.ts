/** Complete the episode-only summary contract in older page fixtures. */
export function withEpisodeBatchSummaries(data: unknown): unknown {
  if (!data || typeof data !== 'object' || !('content' in data) || !Array.isArray(data.content)) return data;
  return { ...data, content: data.content.map(batch => {
    if (!batch || typeof batch !== 'object' || !('batchId' in batch) || !('jobGroups' in batch)) return batch;
    return { ...batch, episodeStatus: batch.status, episodeJobGroups: batch.jobGroups, settingBooks: [] };
  }) };
}
