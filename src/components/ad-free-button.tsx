import { useState } from 'react';

import { Button } from '@/components/ui';
import { adFreeRemainingMs, formatRemaining } from '@/lib/ads/ad-policy';
import { useAds } from '@/lib/ads/ads-context';
import { useT } from '@/lib/settings';
import { useNow } from '@/lib/use-now';

/** The rewarded "1 hour ad-free" pass: the only way to turn ads off. Stacks to 3 hours, 6 a day. */
export function AdFreeButton() {
  const ads = useAds();
  const t = useT();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const left = adFreeRemainingMs(ads.state, now);
  if (!ads.ready && left <= 0) return null;

  const remaining = left > 0 ? formatRemaining(left) : null;
  const remainingText = remaining
    ? remaining.hours > 0
      ? t('time.hoursMinutes', { h: remaining.hours, m: remaining.minutes })
      : t('time.minutes', { m: remaining.minutes })
    : null;
  const canOffer = ads.offers.ad_free;
  const detail = note ?? (canOffer ? t('adFree.offerDetail') : left > 0 ? t('adFree.capped') : t('adFree.dailyCap'));

  return (
    <Button
      kind="secondary"
      icon={left > 0 ? 'leaf' : 'play-circle-outline'}
      label={remainingText ? t('adFree.active', { left: remainingText }) : t('adFree.offer')}
      detail={detail}
      disabled={!canOffer && left <= 0}
      busy={busy}
      onPress={async () => {
        if (!canOffer) return;
        setBusy(true);
        const earned = await ads.showRewarded('ad_free');
        setBusy(false);
        setNote(earned ? t('adFree.thanks') : null);
      }}
    />
  );
}
