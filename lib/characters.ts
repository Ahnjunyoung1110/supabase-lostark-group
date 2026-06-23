export type CharacterEfficiencyStats = {
  cards?: Record<string, number>;
  gemEffects?: Record<string, { level: number | null; pct: number | null }>;
  gemEfficiencyBreakdown?: {
    efficiency: number;
    optionEfficiency?: number | null;
    pointEfficiency?: number | null;
  };
};

export type CharacterRankingSortKey =
  | 'spec_score'
  | 'gem_efficiency_percent'
  | 'bracelet_efficiency_percent'
  | 'item_level';

export const CHARACTER_RANKING_SORT_OPTIONS: Array<{
  key: CharacterRankingSortKey;
  label: string;
  description: string;
}> = [
  { key: 'spec_score', label: '환산점수', description: '로펙 환산점수 기준' },
  { key: 'gem_efficiency_percent', label: '젬 효율', description: 'lopec 젬/보석 효율 기준' },
  { key: 'bracelet_efficiency_percent', label: '팔찌 효율', description: 'lopec 팔찌 효율 기준' },
  { key: 'item_level', label: '아이템레벨', description: '아이템레벨 기준' },
];

export function normalizeCharacterRankingSortKey(
  value: string | string[] | undefined
): CharacterRankingSortKey {
  const key = Array.isArray(value) ? value[0] : value;
  return CHARACTER_RANKING_SORT_OPTIONS.some((option) => option.key === key)
    ? (key as CharacterRankingSortKey)
    : 'spec_score';
}

export type CharacterRow = {
  id: string;
  user_id: string;
  character_name: string;
  server_name: string | null;
  class_name: string | null;
  item_level: number | null;
  spec_score: number | null;
  tier: string | null;
  combat_stats: Record<string, { level: number; pct: number }> | null;
  gem_efficiency_percent: number | null;
  bracelet_efficiency_percent: number | null;
  engraving_efficiency_percent: number | null;
  main_node_efficiency_percent: number | null;
  efficiency_stats: CharacterEfficiencyStats | null;
  source: 'lopec' | 'official';
  source_url: string | null;
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CharacterWithProfile = CharacterRow & {
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};

export type CharacterSnapshotRow = {
  id: string;
  character_id: string;
  user_id: string;
  item_level: number | null;
  spec_score: number | null;
  tier: string | null;
  class_name: string | null;
  gem_efficiency_percent: number | null;
  bracelet_efficiency_percent: number | null;
  engraving_efficiency_percent: number | null;
  main_node_efficiency_percent: number | null;
  source: string | null;
  fetched_at: string;
  created_at: string;
};
