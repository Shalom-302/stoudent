/** Contract every virtual bench implements. */
export interface BenchProps {
  /** Live bench state, autosaved and submitted alongside the answers. */
  parameters: Record<string, unknown>;
  setParameter: (key: string, value: unknown) => void;
}
