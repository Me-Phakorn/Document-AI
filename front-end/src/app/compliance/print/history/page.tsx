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
  FAILED: { background: '#f3f4f6', color: '#374151' },
};

const RISK_STYLE: Record<string, React.CSSProperties> = {
  HIGH: { background: '#fee2e2', color: '#b91c1c' },
  MEDIUM: { background: '#fef3c7', color: '#92400e' },
  LOW: { background: '#dcfce7', color: '#166534' },
  INFO: { background: '#dbeafe', color: '#1e40af' },
};

const FINDING_BORDER: Record<string, React.CSSProperties> = {
  VIOLATED: { background: '#fff5f5', borderLeft: '4px solid #ef4444', padding: '8px 10px', marginBottom: '6px', borderRadius: '4px' },
  POTENTIAL: { background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '8px 10px', marginBottom: '6px', borderRadius: '4px' },
  COMPLIANT: { background: '#f0fdf4', borderLeft: '4px solid #22c55e', padding: '8px 10px', marginBottom: '6px', borderRadius: '4px' },
};

export default async function ComplianceHistoryPrintPage() {
  let checks: ComplianceCheckRecord[] = [];
  try {
    const result = await apiGet<{ items: ComplianceCheckRecord[]; total: number }>(
      '/compliance/checks?limit=100&offset=0',
    );
    checks = result.items;
  } catch {
    // render empty state if fetch fails
  }

  const now = new Date().toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });

  const s = {
    page: {
      fontFamily: "'Sarabun', 'Helvetica Neue', Arial, sans-serif",
      fontSize: '12px',
      color: '#111',
      background: '#fff',
      padding: '28px 32px',
      maxWidth: '820px',
      margin: '0 auto',
    } as React.CSSProperties,
    reportHeader: {
      borderBottom: '2px solid #1e40af',
      paddingBottom: '12px',
      marginBottom: '20px',
    } as React.CSSProperties,
    reportTitle: { fontSize: '18px', fontWeight: 700, color: '#1e40af', marginBottom: '2px' } as React.CSSProperties,
    reportMeta: { fontSize: '11px', color: '#6b7280' } as React.CSSProperties,
    summaryBar: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap' as const,
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      padding: '10px 14px',
      marginBottom: '20px',
    } as React.CSSProperties,
    summaryItem: { fontSize: '12px', color: '#374151' } as React.CSSProperties,
    checkCard: {
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      marginBottom: '16px',
      breakInside: 'avoid' as const,
      pageBreakInside: 'avoid' as const,
    } as React.CSSProperties,
    checkHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      background: '#f9fafb',
      borderRadius: '6px 6px 0 0',
      padding: '10px 12px',
      borderBottom: '1px solid #e5e7eb',
    } as React.CSSProperties,
    checkBody: { padding: '10px 12px' } as React.CSSProperties,
    badge: {
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 600,
      whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    h2: {
      fontSize: '13px',
      fontWeight: 600,
      margin: '10px 0 6px',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '3px',
    } as React.CSSProperties,
    counts: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '8px' } as React.CSSProperties,
    pill: (bg: string, color: string) =>
      ({ background: bg, color, padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 500 }) as React.CSSProperties,
    findingHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap' as const,
      marginBottom: '3px',
    } as React.CSSProperties,
    code: { fontFamily: 'monospace', fontSize: '10px', color: '#6b7280' } as React.CSSProperties,
    explanation: { fontSize: '11px', color: '#374151', marginTop: '2px' } as React.CSSProperties,
    evidence: { fontSize: '10px', color: '#6b7280', marginTop: '1px', fontStyle: 'italic' as const } as React.CSSProperties,
  };

  // Aggregate summary counts
  const totalViolations = checks.reduce((sum, c) => sum + (c.metadata?.violationsCount ?? 0), 0);
  const totalPotential = checks.reduce((sum, c) => sum + (c.metadata?.potentialCount ?? 0), 0);
  const totalCompliant = checks.reduce((sum, c) => sum + (c.metadata?.compliantCount ?? 0), 0);
  const nonCompliantChecks = checks.filter((c) => c.status === 'NON_COMPLIANT').length;
  const compliantChecks = checks.filter((c) => c.status === 'COMPLIANT').length;

  return (
    <div style={s.page}>
      {/* Report header */}
      <div style={s.reportHeader}>
        <h1 style={s.reportTitle}>รายงานประวัติการตรวจสอบความสอดคล้อง (Compliance History)</h1>
        <p style={s.reportMeta}>สร้างเมื่อ: {now} · ทั้งหมด {checks.length} รายการ</p>
      </div>

      {/* Summary bar */}
      {checks.length > 0 ? (
        <div style={s.summaryBar}>
          <span style={s.summaryItem}>
            <strong>{checks.length}</strong> รายการทั้งหมด
          </span>
          <span style={s.summaryItem}>
            <strong style={{ color: '#b91c1c' }}>{nonCompliantChecks}</strong> ไม่ผ่าน
          </span>
          <span style={s.summaryItem}>
            <strong style={{ color: '#166534' }}>{compliantChecks}</strong> ผ่าน
          </span>
          <span style={s.summaryItem}>
            <strong style={{ color: '#b91c1c' }}>{totalViolations}</strong> กฎที่ละเมิดสะสม
          </span>
          <span style={s.summaryItem}>
            <strong style={{ color: '#92400e' }}>{totalPotential}</strong> อาจละเมิดสะสม
          </span>
          <span style={s.summaryItem}>
            <strong style={{ color: '#166534' }}>{totalCompliant}</strong> ปฏิบัติตามสะสม
          </span>
        </div>
      ) : null}

      {checks.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>ไม่มีรายการตรวจสอบ</p>
      ) : (
        checks.map((check, idx) => {
          const latest = check.results[0];
          const findings: AiFinding[] = Array.isArray(latest?.matchedRules) ? (latest.matchedRules as AiFinding[]) : [];
          const violations = findings.filter((f) => f.status === 'VIOLATED');
          const potentials = findings.filter((f) => f.status === 'POTENTIAL');
          const meta = check.metadata;
          const title = meta?.title ?? check.inputType;
          const statusStyle = STATUS_BG[check.status] ?? STATUS_BG.AMBIGUOUS;

          return (
            <div key={check.id} style={s.checkCard}>
              {/* Card header */}
              <div style={s.checkHeader}>
                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', marginRight: '8px' }}>#{idx + 1}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{title}</span>
                  {meta?.hasImage ? (
                    <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '6px' }}>(ภาพ)</span>
                  ) : null}
                  {meta?.rulebookTitle ? (
                    <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginTop: '2px' }}>
                      กฎระเบียบ: {meta.rulebookTitle}
                    </span>
                  ) : null}
                  <span style={{ fontSize: '10px', color: '#9ca3af', display: 'block', marginTop: '1px' }}>
                    {formatDateTime(check.createdAt)}
                  </span>
                </div>
                <span style={{ ...s.badge, ...statusStyle }}>{STATUS_TH[check.status] ?? check.status}</span>
              </div>

              {/* Card body */}
              <div style={s.checkBody}>
                {/* Source image */}
                {meta?.inputImageKey ? (
                  <div style={{ marginBottom: '8px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/api/backend/compliance/checks/${check.id}/image`}
                      alt={title}
                      style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                    />
                  </div>
                ) : null}
                {/* Count pills */}
                {typeof meta?.totalRulesChecked === 'number' ? (
                  <div style={s.counts}>
                    <span style={s.pill('#fee2e2', '#b91c1c')}>{meta.violationsCount ?? 0} ละเมิด</span>
                    <span style={s.pill('#fef3c7', '#92400e')}>{meta.potentialCount ?? 0} อาจละเมิด</span>
                    <span style={s.pill('#dcfce7', '#166534')}>{meta.compliantCount ?? 0} ปฏิบัติตาม</span>
                    <span style={s.pill('#f3f4f6', '#374151')}>จาก {meta.totalRulesChecked} กฎ</span>
                  </div>
                ) : null}

                {/* Summary */}
                {latest?.summary ? (
                  <p style={{ fontSize: '12px', color: '#374151', marginBottom: '8px', fontStyle: 'italic' }}>
                    {latest.summary}
                  </p>
                ) : null}

                {/* Violations */}
                {violations.length > 0 ? (
                  <>
                    <h2 style={s.h2}>กฎที่ละเมิด ({violations.length} ข้อ)</h2>
                    {violations.map((f) => (
                      <div key={f.ruleCode} style={FINDING_BORDER.VIOLATED}>
                        <div style={s.findingHeader}>
                          <span
                            style={{
                              ...s.badge,
                              ...(RISK_STYLE[f.riskLevel] ?? RISK_STYLE.INFO),
                              fontSize: '10px',
                              padding: '1px 5px',
                            }}
                          >
                            {RISK_TH[f.riskLevel] ?? f.riskLevel}
                          </span>
                          <span style={s.code}>{f.ruleCode}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600 }}>{f.ruleTitle}</span>
                        </div>
                        <p style={s.explanation}>{f.explanation}</p>
                        {f.evidence ? <p style={s.evidence}>หลักฐาน: {f.evidence}</p> : null}
                      </div>
                    ))}
                  </>
                ) : null}

                {/* Potentials */}
                {potentials.length > 0 ? (
                  <>
                    <h2 style={s.h2}>กฎที่อาจละเมิด ({potentials.length} ข้อ)</h2>
                    {potentials.map((f) => (
                      <div key={f.ruleCode} style={FINDING_BORDER.POTENTIAL}>
                        <div style={s.findingHeader}>
                          <span
                            style={{
                              ...s.badge,
                              ...(RISK_STYLE[f.riskLevel] ?? RISK_STYLE.INFO),
                              fontSize: '10px',
                              padding: '1px 5px',
                            }}
                          >
                            {RISK_TH[f.riskLevel] ?? f.riskLevel}
                          </span>
                          <span style={s.code}>{f.ruleCode}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600 }}>{f.ruleTitle}</span>
                        </div>
                        <p style={s.explanation}>{f.explanation}</p>
                        {f.evidence ? <p style={s.evidence}>หลักฐาน: {f.evidence}</p> : null}
                      </div>
                    ))}
                  </>
                ) : null}

                {/* Recommended action */}
                {latest?.recommendedAction ? (
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    คำแนะนำ: {latest.recommendedAction}
                  </p>
                ) : null}

                {findings.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '11px' }}>ไม่มีรายละเอียดผลการตรวจสอบ</p>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
