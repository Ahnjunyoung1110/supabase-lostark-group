alter table public.characters
  add column gem_efficiency_percent numeric(8, 2),
  add column bracelet_efficiency_percent numeric(8, 2),
  add column engraving_efficiency_percent numeric(8, 2),
  add column main_node_efficiency_percent numeric(8, 2),
  add column efficiency_stats jsonb;

create index characters_gem_efficiency_idx
  on public.characters (gem_efficiency_percent desc nulls last);

create index characters_bracelet_efficiency_idx
  on public.characters (bracelet_efficiency_percent desc nulls last);
