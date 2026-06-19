type JsonRecord = Record<string, unknown>;

type SupabaseIdentityLike = {
  provider?: string;
  id?: string;
  user_id?: string;
  identity_data?: JsonRecord | null;
};

type SupabaseUserLike = {
  app_metadata?: JsonRecord | null;
  user_metadata?: JsonRecord | null;
  identities?: SupabaseIdentityLike[] | null;
};

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function hasDiscordProvider(appMetadata: JsonRecord | null | undefined): boolean {
  if (!appMetadata) return false;
  if (appMetadata.provider === 'discord') return true;
  const providers = appMetadata.providers;
  return Array.isArray(providers) && providers.includes('discord');
}

/**
 * Supabase Discord OAuth metadata has differed across GoTrue versions.
 * Prefer direct user metadata, then identity metadata when available.
 */
export function extractDiscordUserId(user: SupabaseUserLike): string | null {
  const metadata = user.user_metadata ?? {};
  const directId = firstNonEmptyString(
    metadata.provider_id,
    metadata.sub,
    metadata.id,
    metadata.user_id,
  );

  if (directId && hasDiscordProvider(user.app_metadata)) return directId;

  const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');
  if (!discordIdentity) return directId;

  return firstNonEmptyString(
    discordIdentity.identity_data?.provider_id,
    discordIdentity.identity_data?.sub,
    discordIdentity.identity_data?.id,
    discordIdentity.identity_data?.user_id,
    discordIdentity.id,
    discordIdentity.user_id,
    directId,
  );
}
