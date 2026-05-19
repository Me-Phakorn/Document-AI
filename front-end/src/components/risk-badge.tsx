import type { RiskLevel } from '@/lib/types';

const riskStyles: Record<RiskLevel, string> = {
  HIGH: 'border-[rgba(207,46,53,0.2)] bg-[rgba(207,46,53,0.1)] text-red',
  MEDIUM: 'border-[rgba(181,106,9,0.2)] bg-[rgba(181,106,9,0.1)] text-amber',
  LOW: 'border-[rgba(22,138,74,0.2)] bg-[rgba(22,138,74,0.1)] text-green',
  INFO: 'border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.1)] text-blue',
};

export function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  return <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${riskStyles[riskLevel]}`}>{riskLevel}</span>;
}