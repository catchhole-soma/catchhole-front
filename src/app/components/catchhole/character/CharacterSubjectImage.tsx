import type { WorldSettingImageResponse } from '../../../api/generated/types.gen';
import { WorldSubjectImage } from '../worldsetting/WorldSubjectImage';
import neutralImage from '../../../../assets/characters/character-neutral-v1.webp';

export { neutralImage as CHARACTER_DEFAULT_IMAGE };

export function CharacterSubjectImage({ image, className, eager = false }: {
  image?: WorldSettingImageResponse; className?: string; eager?: boolean;
}) {
  return <WorldSubjectImage category="RACE" path={eager ? image?.imageUrl : image?.thumbnailUrl}
    vaultId={image?.vaultId} fallbackSrc={neutralImage} className={className} eager={eager} />;
}
