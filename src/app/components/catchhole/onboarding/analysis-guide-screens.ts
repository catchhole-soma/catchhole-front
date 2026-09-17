import automatic1Desktop from '../../../../assets/onboarding/automatic-1-desktop.png';
import automatic1Mobile from '../../../../assets/onboarding/automatic-1-mobile.png';
import automatic2Desktop from '../../../../assets/onboarding/automatic-2-desktop.png';
import automatic2Mobile from '../../../../assets/onboarding/automatic-2-mobile.png';
import automatic3Desktop from '../../../../assets/onboarding/automatic-3-desktop.png';
import automatic3Mobile from '../../../../assets/onboarding/automatic-3-mobile.png';
import automatic4Desktop from '../../../../assets/onboarding/automatic-4-desktop.png';
import automatic4Mobile from '../../../../assets/onboarding/automatic-4-mobile.png';
import manual1Desktop from '../../../../assets/onboarding/manual-1-desktop.png';
import manual1Mobile from '../../../../assets/onboarding/manual-1-mobile.png';
import manual2Desktop from '../../../../assets/onboarding/manual-2-desktop.png';
import manual2Mobile from '../../../../assets/onboarding/manual-2-mobile.png';
import manual3Desktop from '../../../../assets/onboarding/manual-3-desktop.png';
import manual3Mobile from '../../../../assets/onboarding/manual-3-mobile.png';
import manual4Desktop from '../../../../assets/onboarding/manual-4-desktop.png';
import manual4Mobile from '../../../../assets/onboarding/manual-4-mobile.png';

export type GuideMode = 'automatic' | 'manual';

export const GUIDE_SCREENS = {
  automatic: [
    { desktop: automatic1Desktop, mobile: automatic1Mobile },
    { desktop: automatic2Desktop, mobile: automatic2Mobile },
    { desktop: automatic3Desktop, mobile: automatic3Mobile },
    { desktop: automatic4Desktop, mobile: automatic4Mobile },
  ],
  manual: [
    { desktop: manual1Desktop, mobile: manual1Mobile },
    { desktop: manual2Desktop, mobile: manual2Mobile },
    { desktop: manual3Desktop, mobile: manual3Mobile },
    { desktop: manual4Desktop, mobile: manual4Mobile },
  ],
} as const;
