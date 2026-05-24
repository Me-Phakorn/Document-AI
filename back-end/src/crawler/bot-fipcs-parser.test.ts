import { describe, expect, it } from 'vitest';
import { extractBotFipcsPdfLinks, parseThaiDocumentDate } from './bot-fipcs-parser';

describe('BOT FIPCS parser', () => {
  it('parses Thai Buddhist-era document dates as UTC Gregorian dates', () => {
    const parsed = parseThaiDocumentDate('20 พ.ค. 2569');

    expect(parsed?.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });

  it('extracts PDF links with row document date metadata', () => {
    const links = extractBotFipcsPdfLinks(
      `<tr class="nonebgnewsWhite">
        <td class="namenews">ประกาศ ธปท.</td>
        <td class="datenews">20 พ.ค. 2569</td>
        <td class="tx-news"><img alt="New" /></td>
        <td class="tx-news"><div>กำหนดอัตราดอกเบี้ยพันธบัตร</div></td>
        <td class="tx-news"><img alt="ใช้อยู่ มีเอกสารเกี่ยวข้อง" title="ใช้อยู่ มีเอกสารเกี่ยวข้อง" onclick="OpenWindow('PFIPCS_showrelated.aspx?DocID=25690101-01','Related')" /></td>
        <td class="tx-news"><a href="https://www.bot.or.th/content/dam/bot/fipcs/documents/DDD/2569/ThaiPDF/25690101.pdf">TH</a></td>
      </tr>`,
      3,
    );

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      listPage: 3,
      packId: '25690101',
      documentType: 'ประกาศ ธปท.',
      sourceDocumentDateText: '20 พ.ค. 2569',
      title: 'กำหนดอัตราดอกเบี้ยพันธบัตร',
      statusText: 'ใช้อยู่ มีเอกสารเกี่ยวข้อง',
      language: 'TH',
      relatedDocumentUrl: 'https://app.bot.or.th/FIPCS/Thai/PFIPCS_showrelated.aspx?DocID=25690101-01',
    });
    expect(links[0].sourceDocumentDate?.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });
});