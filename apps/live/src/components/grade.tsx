import { QuestionIcon, ShieldCheckIcon, ShieldWarningIcon, SkullIcon, WarningIcon } from '@phosphor-icons/react';
import { cn } from 'cn';
import type { SafetyGrade } from '@/lib/api';

const GRADES: Record<SafetyGrade, { label: string; tone: string; Icon: typeof ShieldCheckIcon; meaning: string }> = {
  safe: { label: 'Safe', tone: 'text-safe bg-safe/12 ring-safe/25', Icon: ShieldCheckIcon, meaning: 'Every check that ran passed.' },
  caution: { label: 'Caution', tone: 'text-caution bg-caution/12 ring-caution/25', Icon: ShieldWarningIcon, meaning: 'Some checks did not pass.' },
  risky: { label: 'Risky', tone: 'text-risky bg-risky/12 ring-risky/25', Icon: WarningIcon, meaning: 'Several checks failed.' },
  dangerous: { label: 'Dangerous', tone: 'text-danger bg-danger/12 ring-danger/25', Icon: SkullIcon, meaning: 'A critical check failed: someone can still mint, freeze or pull out.' },
  unknown: { label: 'Unknown', tone: 'text-muted-foreground bg-muted ring-border', Icon: QuestionIcon, meaning: 'Too little could be read to grade it. Unknown is not safe.' },
};

export const gradeInfo = (grade: SafetyGrade) => GRADES[grade];

/** The grade with its icon and word: colour is never the only carrier. */
export function GradeBadge({ grade, size = 'md' }: { grade: SafetyGrade; size?: 'md' | 'lg' }) {
  const { label, tone, Icon } = GRADES[grade];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-semibold ring-1', tone, size === 'lg' ? 'px-3 py-1.5 text-base' : 'px-2 py-0.5 text-xs')}>
      <Icon weight="duotone" className={size === 'lg' ? 'size-5' : 'size-3.5'} />
      {label}
    </span>
  );
}
