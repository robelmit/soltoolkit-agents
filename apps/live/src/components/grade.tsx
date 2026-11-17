import { QuestionIcon, ShieldCheckIcon, ShieldWarningIcon, SkullIcon, WarningIcon } from '@phosphor-icons/react';
import { Badge, type BadgeProps } from '@/components/reui/badge';
import type { SafetyGrade } from '@/lib/api';

const GRADES: Record<SafetyGrade, { label: string; variant: BadgeProps['variant']; Icon: typeof ShieldCheckIcon; meaning: string }> = {
  safe: { label: 'Safe', variant: 'success-light', Icon: ShieldCheckIcon, meaning: 'Every check that ran passed.' },
  caution: { label: 'Caution', variant: 'warning-light', Icon: ShieldWarningIcon, meaning: 'Some checks did not pass.' },
  risky: { label: 'Risky', variant: 'destructive-light', Icon: WarningIcon, meaning: 'Several checks failed.' },
  dangerous: { label: 'Dangerous', variant: 'destructive', Icon: SkullIcon, meaning: 'A critical check failed: someone can still mint, freeze or pull out.' },
  unknown: { label: 'Unknown', variant: 'secondary', Icon: QuestionIcon, meaning: 'Too little could be read to grade it. Unknown is not safe.' },
};

export const gradeInfo = (grade: SafetyGrade) => GRADES[grade];

/** The grade as ReUI's Badge, with its icon and word: colour is never the only carrier. */
export function GradeBadge({ grade, size = 'default' }: { grade: SafetyGrade; size?: 'default' | 'xl' }) {
  const { label, variant, Icon } = GRADES[grade];
  return (
    <Badge variant={variant} size={size} radius="full">
      <Icon weight="duotone" className={size === 'xl' ? 'size-4' : undefined} />
      {label}
    </Badge>
  );
}
