import { useSearchParams } from 'react-router';
import { CharacterSettingReview } from './characterreview/CharacterSettingReview';
import { WorldSettingReview } from './worldsetting/WorldSettingReview';

export default function SSettingReview() {
  const [searchParams] = useSearchParams();
  return searchParams.get('candidateType') === 'world'
    ? <WorldSettingReview />
    : <CharacterSettingReview />;
}
