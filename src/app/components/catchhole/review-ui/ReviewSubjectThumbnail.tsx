import { useQuery } from '@tanstack/react-query';
import { getCharacterOptions, getWorldSettingOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { WorldSettingImageResponse, WorldSettingDetailResponse } from '../../../api/generated/types.gen';
import { CharacterSubjectImage } from '../character/CharacterSubjectImage';
import { WorldSubjectImage } from '../worldsetting/WorldSubjectImage';

/** One cached query per known subject; unknown candidates use the existing genre/neutral fallback. */
export function ReviewSubjectThumbnail({ kind, workId, characterId, worldSettingId, category, image, enabled = true }: {
  kind: 'character' | 'world'; workId?: string; characterId?: string | null; worldSettingId?: string | null;
  category?: WorldSettingDetailResponse['category']; image?: WorldSettingImageResponse; enabled?: boolean;
}) {
  const character = useQuery({
    ...getCharacterOptions({ path: { workId: workId ?? '', characterId: characterId ?? '' } }),
    enabled: enabled && kind === 'character' && Boolean(workId && characterId) && !image,
    staleTime: 60_000, retry: false,
  });
  const world = useQuery({
    ...getWorldSettingOptions({ path: { workId: workId ?? '', worldSettingId: worldSettingId ?? '' } }),
    enabled: enabled && kind === 'world' && Boolean(workId && worldSettingId) && !image,
    staleTime: 60_000, retry: false,
  });
  const resolved = image ?? (kind === 'character' ? character.data?.data?.image : world.data?.data?.image);
  return kind === 'character'
    ? <CharacterSubjectImage image={resolved} className="review-cb-subject-image" />
    : <WorldSubjectImage category={category} path={resolved?.thumbnailUrl} vaultId={resolved?.vaultId} className="review-cb-subject-image" />;
}
