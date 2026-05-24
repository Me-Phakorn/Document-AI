# Frontend Dashboard Design References

เอกสารนี้สรุป reference สำหรับออกแบบ `front-end` ของ DocAI โดยเน้น dashboard/admin workspace ที่เหมาะกับงานเอกสาร กฎระเบียบ AI analysis, review, audit และ compliance ไม่ใช่ landing page หรือ marketing site

## Design Direction ที่แนะนำ

DocAI ควรใช้แนวทาง `operational admin workspace`:
- โครงสร้างหลักเป็น sidebar + top bar + content workspace
- หน้าหลักเน้นตาราง รายการงาน queue, filter, status badge, review panel และรายละเอียดเอกสาร
- สีและ layout ควรสงบ อ่านง่าย และเหมาะกับงานซ้ำของ analyst/reviewer/admin/auditor
- ใช้ Tailwind CSS เป็น styling foundation และสร้าง reusable components สำหรับ pattern ที่ใช้บ่อย
- ใช้ visual density ระดับกลางถึงสูง เพื่อให้ดูข้อมูลจำนวนมากได้โดยไม่รู้สึกแน่นเกินไป

## Shortlist References

| Reference | URL | เหมาะกับ DocAI แค่ไหน | ใช้เป็นแรงบันดาลใจส่วนไหน |
|---|---|---:|---|
| shadcn/ui Dashboard Example | `https://ui.shadcn.com/examples/dashboard` | สูง | sidebar, dashboard cards, chart area, data table, clean Tailwind-compatible composition |
| shadcn/ui Blocks Dashboard | `https://ui.shadcn.com/blocks` | สูง | application shell, sidebar dashboard block, responsive preview, copyable component structure |
| Tailwind Plus Application Shells | `https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar` | สูง | sidebar layout, responsive navigation, application shell patterns |
| Tailwind Plus Tables | `https://tailwindcss.com/plus/ui-blocks/application-ui/lists/tables` | สูง | document lists, review queues, audit tables, user/role tables, dense tabular UI |
| Tremor Blocks | `https://www.tremor.so/blocks` | กลางถึงสูง | KPI cards, queue metrics, charts, operational analytics, report dashboard components |
| Preline Blocks/Examples | `https://preline.co/examples.html` | กลาง | isolated UI blocks, content navigation, stats cards; less useful for full DocAI shell |
| Tailwind Plus Templates | `https://tailwindcss.com/plus/templates` | ต่ำถึงกลาง | overall Tailwind quality bar; most templates are more marketing/product-site oriented than DocAI needs |

## Recommended Blend

อย่าเลือก template เดียวทั้งก้อน ให้ใช้แนวทางผสมดังนี้:

1. ใช้ `shadcn/ui Dashboard` หรือ `shadcn/ui Blocks Dashboard` เป็น base mental model สำหรับ application shell
2. ใช้ `Tailwind Plus Application Shells` เป็น reference สำหรับ sidebar behavior, responsive navigation และ layout discipline
3. ใช้ `Tailwind Plus Tables` เป็น reference สำหรับตารางเอกสาร review queue, audit log, compliance checks และ source crawler runs
4. ใช้ `Tremor Blocks` เป็น reference สำหรับ chart/KPI dashboard เช่น queue lag, OCR success rate, AI job failures, review backlog และ compliance risk trends
5. ใช้ Preline เฉพาะ isolated blocks ที่ช่วยเรื่อง content navigation หรือ stats card แต่ไม่ใช้เป็น shell หลัก

## Visual Language

### Layout

- Left sidebar สำหรับ product areas: Dashboard, Documents, Website Sources, AI Analysis, Prompt Library, Review Center, Rulebooks, Compliance, Reports, Users, Audit, Settings
- Top bar สำหรับ global search, create/import action, queue status, notifications และ user menu
- Main content ใช้ page header + primary action + tabs/filter bar + table/detail workspace
- Review-heavy pages ใช้ split pane หรือ detail drawer เพื่อดู source text, AI result, citation และ reviewer comment พร้อมกัน

### Color And Tone

- ใช้ neutral base: white, zinc/slate/stone gray, subtle borders
- ใช้ accent สีฟ้า/indigo แบบ restrained สำหรับ primary action และ focus state
- ใช้ semantic colors เฉพาะ status: green approved/success, amber warning/pending review, red failed/high risk, blue processing/info, gray archived/draft
- หลีกเลี่ยง gradient hero, decorative blobs, large marketing typography และ palette ที่ครอบด้วยสีเดียวทั้งระบบ

### Components ที่ควรสร้างก่อน

- `AppShell` พร้อม sidebar และ top bar
- `PageHeader` พร้อม title, description สั้น, primary action และ secondary actions
- `StatusBadge` สำหรับ workflow states
- `RiskBadge` สำหรับ compliance risk
- `DataTable` พร้อม filter, sort, pagination, row actions และ empty/error/loading states
- `MetricCard` สำหรับ operational counters
- `QueueProgress` สำหรับ crawler/OCR/AI/export jobs
- `ReviewSplitPane` สำหรับ source text, AI result, citations, comments และ reviewer actions
- `ArtifactPreview` สำหรับ PDF/OCR/text/source references
- `TagCapsuleSelector` สำหรับ Prompt Library tags ที่เลือกได้หลายค่าและแสดง selected state ชัดเจน
- `ModelSelect` สำหรับเลือก AI model จาก backend-sanitized OpenRouter model list โดยไม่ให้ผู้ใช้พิมพ์ custom model เอง
- `AuditTimeline` สำหรับ state changes และ reviewer history

## Mapping To DocAI Screens

| DocAI Screen | Reference Pattern | Notes |
|---|---|---|
| Dashboard | shadcn dashboard + Tremor metrics | แสดง document counts, OCR status, AI queue, review backlog, compliance risk, crawler activity |
| Document Management | Tailwind Plus tables + shadcn table | เน้น filters, duplicate warnings, source URL/hash/version status |
| Website Sources | Tailwind Plus table + queue progress cards | แสดง source config, last crawl, new PDFs, failures, rate limits |
| AI Analysis Workspace | shadcn dashboard shell + split detail panel | แสดง document group progress, prompt version, AI job status, retry/failure actions |
| Prompt Library | Compact form + capsule selector + version badges | Template form มีเฉพาะ Name, AI Model dropdown จาก OpenRouter, Tag capsules และ Text; แสดง active/draft/deprecated versions พร้อม provider/model ที่ผูกกับ version |
| Review Center | Custom split pane inspired by shadcn shell | ต้องให้ดู source/OCR/AI/citations/comments พร้อมกัน จึงไม่ควรใช้ simple table อย่างเดียว |
| Master Rulebook | Table + detail drawer + version timeline | ต้องเน้น immutable versions, variants, citations, publish status |
| Compliance Checker | Form workspace + evidence panel + risk cards | เลือก rulebook version, upload/input content, show matched rules and reviewer gate |
| Reports | Tremor charts + Tailwind table | ใช้ charts สำหรับ trend และ table สำหรับ drilldown/export |
| Audit/Settings | Tailwind Plus tables | เน้น permissions, audit log, user/role management |

## What To Avoid

- ไม่ใช้ marketing templates เป็นหน้าแรกของ app
- ไม่ใช้ hero sections, oversized headlines, decorative gradients, bokeh/orbs หรือ landing-page composition ใน admin workspace
- ไม่ใช้ card-heavy layout ทุกอย่างจนข้อมูลจริงถูกดันลงไปไกล
- ไม่ copy proprietary template code โดยตรง เว้นแต่ license อนุญาตและ project ตัดสินใจแล้ว
- ไม่สร้าง UI ที่อธิบาย feature ด้วย text ยาว ๆ ในหน้าจอจริง ให้ workflow และ labels ชัดพอแทน
- ไม่ใส่ custom model text input ใน Prompt Library; model ต้องมาจาก dropdown ที่ backend ดึงจาก OpenRouter
- ไม่ทำ Prompt Library เป็น settings/config page; หน้านี้คือ template editor สำหรับ prompt text และ metadata ที่ต้อง version/audit ได้

## Implementation Notes

- Tailwind CSS เป็น styling foundation ของ `front-end`
- Component library ยังไม่ล็อก แต่ `shadcn/ui` เข้ากับ reference direction มากที่สุดเพราะเป็น Tailwind-first, copyable, composable และเหมาะกับ admin workspace
- ถ้าเลือกใช้ paid/proprietary source เช่น Tailwind Plus ต้องตรวจ license ก่อนนำ code มาใช้จริง
- References ใช้เพื่อ pattern และ design direction ไม่ใช่การคัดลอกหน้าตาแบบ pixel-perfect

## Recommendation

สำหรับ DocAI ให้เริ่ม build frontend ด้วย design direction นี้:

> `shadcn-style operational shell` + `Tailwind Plus table/sidebar discipline` + `Tremor-like metrics and charts`

แนวนี้เข้ากับระบบที่ต้องจัดการเอกสารจำนวนมาก มี queue หลายประเภท ต้อง review ผล AI และต้อง audit ย้อนหลัง โดยไม่ดูเป็น template SaaS ทั่วไปหรือ landing page ที่ไม่เหมาะกับงาน compliance จริง
