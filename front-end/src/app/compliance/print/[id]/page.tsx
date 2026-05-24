import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { AiFinding, ComplianceCheckRecord } from '@/lib/api/compliance';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_TH: Record<string, string> = {
  COMPLIANT: 'ปฏิบัติตามกฎ',
  NON_COMPLIANT: 'ไม่ปฏิบัติตามกฎ',
  POTENTIAL_VIOLATION: 'อาจมีการละเมิด',
  AMBIGUOUS: 'ไม่ชัดเจน',
  NEED_HUMAN_REVIEW: 'ต้องการผู้ตรวจสอบ',
  FAILED: 'เกิดข้อผิดพลาด',
};

const RISK_TH: Record<string, string> = { HIGH: 'สูง', MEDIUM: 'กลาง', LOW: 'ต่ำ', INFO: 'ข้อมูล' };

const STATUS_BG: Record<string, React.CSSProperties> = {
  COMPLIANT: { background: '#dcfce7', color: '#166534' },
  NON_COMPLIANT: { background: '#fee2e2', color: '#b91c1c' },
  POTENTIAL_VIOLATION: { background: '#fef3c7', color: '#92400e' },
  AMBIGUOUS: { background: '#f3f4f6', color: '#374151' },
  NEED_HUMAN_REVIEW: { background: '#dbeafe', color: '#1e40af' },
};

const RISK_STYLE: Record<string, React.CSSProperties> = {
  HIGH: { background: '#fee2e2', color: '#b91c1c' },
  MEDIUM: { background: '#fef3c7', color: '#92400e' },
  LOW: { background: '#dcfce7', color: '#166534' },
  INFO: { background: '#dbeafe', color: '#1e40af' },
};

const FINDING_BORDER: Record<string, React.CSSProperties> = {
  VIOLATED: { background: '#fff5f5', borderLeft: '4px solid #ef4444', padding: '10px 12px', marginBottom: '8px', borderRadius: '4px' },
  POTENTIAL: { background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '10px 12px', marginBottom: '8px', borderRadius: '4px' },
  COMPLIANT: { background: '#f0fdf4', borderLeft: '4px solid #22c55e', padding: '10px 12px', marginBottom: '8px', borderRadius: '4px' },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompliancePrintPage({ params }: Props) {
  const { id } = await params;

  let check: ComplianceCheckRecord;
  try {
    check = await apiGet<ComplianceCheckRecord>(`/compliance/checks/${id}`);
  } catch {
    notFound();
  }

  const latest = check.results[0];
  const findings: AiFinding[] = Array.isArray(latest?.matchedRules) ? (latest.matchedRules as AiFinding[]) : [];
  const violations = findings.filter((f) => f.status === 'VIOLATED');
  const potentials = findings.filter((f) => f.status === 'POTENTIAL');
  const compliant = findings.filter((f) => f.status === 'COMPLIANT');
  const meta = check.metadata;
  const title = meta?.title ?? check.inputType;

  const s = {
    page: { fontFamily: "'Sarabun', 'Helvetica Neue', Arial, sans-serif", fontSize: '13px', color: '#111', background: '#fff', padding: '32px', maxWidth: '800px', margin: '0 auto' } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '8px' } as React.CSSProperties,
    badge: { display: 'inline-block', padding: '3px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 } as React.CSSProperties,
    h1: { fontSize: '20px', fontWeight: 700, marginBottom: '2px' } as React.CSSProperties,
    meta: { fontSize: '12px', color: '#6b7280', marginBottom: '16px' } as React.CSSProperties,
    h2: { fontSize: '14px', fontWeight: 600, margin: '20px 0 8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' } as React.CSSProperties,
    summaryBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px', color: '#374151' } as React.CSSProperties,
    counts: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginBottom: '16px' },
    pill: (bg: string, color: string) => ({ background: bg, color, padding: '3px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 500 }) as React.CSSProperties,
    findingHeader: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '4px' },
    code: { fontFamily: 'monospace', fontSize: '11px', color: '#6b7280' } as React.CSSProperties,
    explanation: { fontSize: '12px', color: '#374151', marginTop: '4px' } as React.CSSProperties,
    evidence: { fontSize: '11px', color: '#6b7280', marginTop: '2px', fontStyle: 'italic' as const } as React.CSSProperties,
    recommended: { fontSize: '12px', color: '#6b7280', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>รายงานผลการตรวจสอบ Compliance</h1>
          <p style={s.meta}>
            {meta?.rulebookTitle ? `กฎระเบียบ: ${meta.rulebookTitle} · ` : ''}
            วันที่ตรวจสอบ: {formatDateTime(check.createdAt)}
          </p>
        </div>
        <span style={{ ...s.badge, ...(STATUS_BG[check.status] ?? STATUS_BG.AMBIGUOUS) }}>{STATUS_TH[check.status] ?? check.status}</span>
      </div>

      <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
        {title}
        {meta?.hasImage ? <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>(ตรวจสอบจากภาพ)</span> : null}
      </p>
      {meta?.focusPrompt ? <p style={{ ...s.meta, marginBottom: '12px' }}>โฟกัส: {meta.focusPrompt}</p> : null}

      {/* Source image */}
      {meta?.inputImageKey ? (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>ภาพต้นทาง</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/api/backend/compliance/checks/${check.id}/image`}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '4px' }}
          />
        </div>
      ) : null}

      {latest?.summary ? <div style={s.summaryBox}>{latest.summary}</div> : null}

      {typeof meta?.totalRulesChecked === 'number' ? (
        <div style={s.counts}>
          <span style={s.pill('#fee2e2', '#b91c1c')}>{meta.violationsCount ?? 0} ละเมิด</span>
          <span style={s.pill('#fef3c7', '#92400e')}>{meta.potentialCount ?? 0} อาจละเมิด</span>
          <span style={s.pill('#dcfce7', '#166534')}>{meta.compliantCount ?? 0} ปฏิบัติตาม</span>
          <span style={s.pill('#f3f4f6', '#374151')}>จาก {meta.totalRulesChecked} กฎ</span>
        </div>
      ) : null}

      {violations.length > 0 ? (
        <>
          <h2 style={s.h2}>กฎที่ละเมิด ({violations.length} ข้อ)</h2>
          {violations.map((f) => (
            <div key={f.ruleCode} style={FINDING_BORDER.VIOLATED}>
              <div style={s.findingHeader}>
                <span style={{ ...s.badge, ...(RISK_STYLE[f.riskLevel] ?? RISK_STYLE.INFO), fontSize: '11px', padding: '1px 6px' }}>{RISK_TH[f.riskLevel] ?? f.riskLevel}</span>
                <span style={s.code}>{f.ruleCode}</span>
                <span style={{ fontWeight: 600 }}>{f.ruleTitle}</span>
              </div>
              <p style={s.explanation}>{f.explanation}</p>
              {f.evidence ? <p style={s.evidence}>หลักฐาน: {f.evidence}</p> : null}
            </div>
          ))}
        </>
      ) : null}

      {potentials.length > 0 ? (
        <>
          <h2 style={s.h2}>กฎที่อาจละเมิด ({potentials.length} ข้อ)</h2>
          {potentials.map((f) => (
            <div key={f.ruleCode} style={FINDING_BORDER.POTENTIAL}>
              <div style={s.findingHeader}>
                <span style={{ ...s.badge, ...(RISK_STYLE[f.riskLevel] ?? RISK_STYLE.INFO), fontSize: '11px', padding: '1px 6px' }}>{RISK_TH[f.riskLevel] ?? f.riskLevel}</span>
                <span style={s.code}>{f.ruleCode}</span>
                <span style={{ fontWeight: 600 }}>{f.ruleTitle}</span>
              </div>
              <p style={s.explanation}>{f.explanation}</p>
              {f.evidence ? <p style={s.evidence}>หลักฐาน: {f.evidence}</p> : null}
            </div>
          ))}
        </>
      ) : null}

      {compliant.length > 0 ? (
        <>
          <h2 style={s.h2}>กฎที่ปฏิบัติตาม ({compliant.length} ข้อ)</h2>
          {compliant.map((f) => (
            <div key={f.ruleCode} style={FINDING_BORDER.COMPLIANT}>
              <div style={s.findingHeader}>
                <span style={s.code}>{f.ruleCode}</span>
                <span style={{ fontWeight: 600 }}>{f.ruleTitle}</span>
              </div>
              <p style={s.explanation}>{f.explanation}</p>
            </div>
          ))}
        </>
      ) : null}

      {findings.length === 0 ? <p style={{ color: '#6b7280' }}>ไม่มีรายละเอียดผลการตรวจสอบ</p> : null}

      {latest?.recommendedAction ? <div style={s.recommended}>คำแนะนำ: {latest.recommendedAction}</div> : null}
    </div>
  );
}
