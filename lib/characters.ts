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
