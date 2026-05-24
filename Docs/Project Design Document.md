# Project Design Document

## ระบบวิเคราะห์เอกสารกฎระเบียบและตรวจสอบความสอดคล้องด้วย AI

## บทสรุปผู้บริหาร

ระบบนี้มีเป้าหมายเพื่อช่วยให้องค์กรในประเทศไทยนำเข้าเอกสารด้านกฎหมาย กฎระเบียบ และเอกสาร PDF ที่เกี่ยวข้อง แล้วใช้ AI เพื่ออ่าน วิเคราะห์ สรุป และแปลงเนื้อหาให้อยู่ในรูปที่อ้างอิงและใช้งานต่อได้จริง โดยออกแบบให้มี Human Review ก่อนนำผลลัพธ์ไปใช้เป็นฐานความรู้หลักขององค์กร

แนวทางของระบบคือ `Thailand-first` และ `domain-agnostic` กล่าวคือเริ่มจากบริบทภาษาไทยและกฎระเบียบไทยเป็นหลัก แต่ไม่ผูกระบบไว้กับ domain เดียว เช่น โฆษณา สินเชื่อ ประกัน ข้อมูลส่วนบุคคล หรือเอกสารสัญญา ระบบต้องรองรับการสร้างชุดกฎหลายประเภทได้ตั้งแต่โครงสร้างแรกของผลิตภัณฑ์

แกนหลักของระบบมี 4 ส่วน:
- การนำเข้าและประมวลผลเอกสารจากไฟล์อัปโหลดหรือการสแกนเว็บไซต์
- การสรุปและดึงข้อกำหนดด้วย AI พร้อม workflow การตรวจทานโดยมนุษย์
- การสร้าง Master Rulebook แบบมี governance เพื่อใช้ตรวจสอบข้อมูลภายนอกด้าน Compliance
- การเก็บ audit trail และรายงานเพื่อรองรับการตรวจสอบย้อนหลัง

## 1. ภาพรวมของระบบ

ระบบนี้มีเป้าหมายเพื่อช่วยให้องค์กรสามารถนำเข้าเอกสารที่เกี่ยวข้องกับกฎหมาย กฎข้อบังคับ ประกาศ แนวปฏิบัติ หรือเอกสาร PDF อื่น ๆ แล้วให้ AI ช่วยอ่าน วิเคราะห์ สรุป และแปลงเนื้อหาให้กลายเป็นชุดข้อมูลที่นำไปใช้อ้างอิงได้

เอกสาร PDF ที่นำเข้าอาจเป็นได้ทั้ง:
- PDF ที่มี text อยู่แล้ว
- PDF แบบ image-based / scan-based
- PDF ที่มีตาราง
- PDF ที่มีรูปภาพประกอบ
- PDF ที่มาจากเว็บไซต์ภายนอก
- PDF ที่ผู้ใช้อัปโหลดเอง

ระบบจะรองรับการรีวิวผลลัพธ์จาก AI โดยมนุษย์ สามารถ `Approve` / `Reject` / `Comment` และให้ AI สรุปใหม่ตามคำแนะนำได้

หลังจากได้เอกสารอ้างอิงหลักแล้ว ระบบจะสามารถนำข้อมูลภายนอก เช่น โฆษณา รูปภาพ โพสต์ PDF ข้อความโปรโมชัน เอกสารสัญญา หรือข้อมูลอื่น ๆ มาตรวจสอบว่าเข้าข่ายขัดต่อหลักเกณฑ์ข้อใดหรือไม่

แม้ตัวอย่างในเอกสารนี้จะใช้กรณี advertising / marketing compliance บ่อย เพราะเป็น use case ที่เห็นภาพง่าย แต่โครงสร้างระบบต้องไม่จำกัดเฉพาะ domain นี้เท่านั้น

## 2. เป้าหมายหลักของระบบ

### 2.1 เป้าหมายเชิงธุรกิจ

ระบบนี้ถูกออกแบบมาเพื่อ:
- ลดเวลาการอ่านเอกสารกฎหมายหรือกฎระเบียบจำนวนมาก
- ลดภาระของทีม Compliance / Legal / Audit
- ทำให้การตรวจสอบโฆษณา สื่อ หรือเอกสารต่าง ๆ มีหลักฐานอ้างอิงชัดเจน
- สร้างฐานความรู้กลางขององค์กรจากเอกสารทางการ
- รองรับการตรวจสอบเอกสารใหม่ซ้ำเมื่อมีการอัปเดต
- ติดตามประวัติการรีวิวและการตัดสินใจของผู้ตรวจสอบได้
- ลดความเสี่ยงจากการใช้ AI โดยไม่มีมนุษย์ตรวจสอบ

## 3. ขอบเขตของระบบ

### 3.1 สิ่งที่ระบบต้องทำได้

ระบบต้องรองรับงานหลักดังนี้:
- นำเข้าเอกสาร PDF
- สแกนเว็บไซต์เพื่อค้นหา PDF
- ป้องกันไฟล์ซ้ำหรือ URL ซ้ำ
- อ่าน PDF ทั้งแบบ text-based และ image-based
- ใช้ OCR สำหรับ PDF ที่เป็นรูปภาพ
- รองรับเอกสารภาษาไทยเป็น baseline ของระบบ
- บันทึก Prompt Template เพื่อใช้ซ้ำ วิเคราะห์ซ้ำ และ audit ได้
- จัดกลุ่มเอกสารสำหรับวิเคราะห์หลายฉบับเป็น Batch / Document Group ได้
- ประมวลผลเอกสารในกลุ่มแบบเข้าคิวทีละเอกสารตามลำดับ FIFO
- สรุปข้อมูลด้วย AI แบบทั่วไป
- สรุปข้อมูลแบบเจาะจงตาม Prompt
- แยกกฎ เงื่อนไข ข้อห้าม และข้อควรระวัง
- รองรับหลาย compliance domain ผ่าน Master Rulebook หลายชุด
- ให้ผู้ใช้รีวิวผลลัพธ์จาก AI
- `Reject` และส่งกลับให้ AI วิเคราะห์ใหม่พร้อม comment ได้
- สร้างรายงานการรีวิว
- สร้างรายงานฐานกฎจากเอกสารต้นทางที่ผ่าน OCR, AI analysis, Review และ Approval แล้ว
- สร้างเอกสารอ้างอิงหลักจากผลลัพธ์ที่ผ่านการอนุมัติ
- รองรับการอัปโหลดสื่อ เอกสาร PDF โพสต์ รูปภาพ ข้อความ หรือ URL เพื่อตรวจเทียบกับรายงานฐานกฎหรือ Master Rulebook ที่อนุมัติแล้ว
- ตรวจสอบข้อมูลภายนอกเทียบกับเอกสารอ้างอิงหลัก
- สรุปว่าข้อมูลภายนอกเข้าข่ายผิดเงื่อนไขข้อใดหรือไม่
- บันทึกผลการตรวจสื่อจริงและสร้างรายงานผลตรวจอีกประเภทหนึ่งที่แยกจากรายงานฐานกฎ
- อ้างอิงกลับไปยังเอกสารต้นทาง หน้าเอกสาร และข้อความที่เกี่ยวข้อง
- จัดการผู้ใช้และสิทธิ์การเข้าถึง
- เก็บประวัติการทำงานทั้งหมดเพื่อ Audit
- ใช้ PostgreSQL สำหรับข้อมูล metadata และ workflow state
- ใช้ MinIO สำหรับจัดเก็บไฟล์และ OCR artifacts
- ใช้ Prisma เป็น data access layer, migration tool และ schema source of truth

## 4. ประเภทข้อมูลที่ระบบรองรับ

### 4.1 เอกสารต้นทาง

เอกสารต้นทางคือเอกสารที่ใช้เป็นแหล่งข้อมูลหลัก เช่น:
- กฎหมาย
- ประกาศ
- ระเบียบ
- ข้อบังคับ
- คู่มือ
- แนวปฏิบัติ
- เอกสารจากหน่วยงานราชการ
- เอกสาร PDF จากเว็บไซต์ภายนอก

### 4.2 ข้อมูลที่ใช้ตรวจสอบภายหลัง

หลังจากมีเอกสารอ้างอิงหลักแล้ว ระบบจะรองรับข้อมูลภายนอก เช่น:
- รูปภาพโฆษณา
- Banner
- Social media post
- Web page content
- PDF โฆษณา
- เอกสารแคมเปญ
- ข้อความโปรโมชัน
- Screenshot
- Landing page
- ไฟล์รูปภาพ
- ไฟล์ข้อความ
- เอกสารภายในองค์กร

## 5. วิธีนำเข้าเอกสาร

ระบบรองรับการนำเข้าเอกสาร 2 วิธีหลัก

สองวิธีนี้ต้องแยกจากกันอย่างชัดเจนใน UI, API และ audit trail:
- Manual Upload คือการอัปโหลดไฟล์ PDF จากเครื่องผู้ใช้โดยตรง และไม่ต้องกรอก URL
- Website Source Crawler คือการกรอก URL หน้า list/search แล้วให้ระบบไล่หา PDF ตาม pagination หรือช่วงหน้าที่กำหนด

### 5.1 วิธีที่ 1: ผู้ใช้อัปโหลดไฟล์เอง

ผู้ใช้สามารถอัปโหลดไฟล์ PDF ผ่านหน้า Admin ได้

โหมดนี้ไม่ต้องใช้ `source_url` และไม่ควรบังคับให้ผู้ใช้กรอก URL เอกสาร ถ้าเป็นไฟล์ที่ผู้ใช้มีอยู่แล้ว ระบบต้องบันทึกเป็น `SourceType.UPLOAD` และเก็บ original PDF เข้า object storage เหมือนเอกสารชนิดอื่น

Workflow:
1. ผู้ใช้เข้าสู่ระบบ
2. ไปที่เมนู Document Import
3. เลือก Upload PDF
4. กรอกข้อมูลประกอบ เช่น:
   - ชื่อเอกสาร
   - ประเภทเอกสาร
   - หน่วยงานเจ้าของเอกสาร
   - วันที่ออกเอกสาร
   - หมายเหตุ
5. อัปโหลดไฟล์
6. ระบบคำนวณ hash ของไฟล์
7. ระบบตรวจสอบว่าไฟล์นี้เคยถูกอัปโหลดมาก่อนหรือไม่
8. ถ้าไม่ซ้ำ ระบบจะสร้าง Document Record
9. ระบบส่งไฟล์เข้าสู่กระบวนการอ่านเอกสาร

กรณีไฟล์ที่บันทึกไว้มีปัญหา เช่น PDF เสีย OCR อ่านไม่ได้ ผู้ใช้อัปโหลดผิดไฟล์ หรือต้องการแก้ metadata พื้นฐาน ระบบต้องมีปุ่ม `Edit` หรือ action ในหน้า Document Detail เพื่อให้อัปโหลด PDF ใหม่เป็น `DocumentVersion` ถัดไปของ `Document` เดิม โดยไม่ลบหรือเขียนทับ version เก่า ไฟล์ใหม่ต้องถูกเก็บเป็น original PDF object ใหม่ใน MinIO-compatible object storage, สร้าง OCR artifact ใหม่, ตั้ง version ใหม่เป็น `isLatest`, และบันทึก audit action เช่น `DOCUMENT_VERSION_REUPLOADED`

### 5.2 วิธีที่ 2: สแกน PDF จาก URL

ผู้ใช้สามารถกำหนด URL ของเว็บไซต์ที่ต้องการให้ระบบเข้าไปค้นหา PDF ได้

ตัวอย่าง use case:
> ผู้ใช้กำหนด URL ของหน้าเว็บไซต์หน่วยงานราชการ ระบบจะเข้าไปอ่านหน้าเว็บ ค้นหาลิงก์ PDF และตรวจสอบว่ามีเอกสารใหม่หรือเอกสารที่อัปเดตหรือไม่

ตัวอย่าง URL เริ่มต้นที่ต้องรองรับ:
- `https://app.bot.or.th/FIPCS/Thai/PFIPCS_list.aspx`

URL นี้เป็นระบบข้อมูลประกาศและหนังสือเวียนของธนาคารแห่งประเทศไทย มีลักษณะเป็นหน้ารายการเอกสารที่มีตารางข้อมูล เช่น ประเภท วันที่ เรื่อง สถานะ และภาษา โดยบางรายการมีสถานะว่า "มีเอกสารเกี่ยวข้อง" ซึ่งระบบ crawler ต้องเข้าไปตรวจสอบเอกสารแนบหรือ PDF ที่เกี่ยวข้องต่อ

ข้อสังเกตสำหรับ crawler จากตัวอย่าง BOT:
- เป็นหน้า list ของประกาศและหนังสือเวียน ไม่ใช่ direct PDF URL
- มี pagination เช่น `PAGE 1 OF 372`
- มีข้อมูลวันที่เป็นปี พ.ศ.
- มีประเภทเอกสาร เช่น ประกาศกระทรวง ประกาศ ธปท. หนังสือเวียน และอื่น ๆ
- มีสถานะเอกสาร เช่น ใช้อยู่ และมีเอกสารเกี่ยวข้อง
- มีภาษาเอกสาร เช่น `TH`
- อาจต้องเข้า detail page หรือ related document page เพื่อหา PDF จริง

ข้อมูล metadata ที่ควรเก็บจากแหล่งนี้:
- source_url
- document_type
- announced_date
- title
- status
- language
- has_related_document
- related_document_url
- pdf_url ถ้าพบ
- crawl_page_number
- source_document_date / source_document_date_text โดยต้องแยกจากเวลาที่ระบบ import (`createdAt`)
- crawled_at

Workflow:
1. ผู้ใช้สร้าง Website Source
2. กำหนด URL เริ่มต้น
3. กำหนดกฎการสแกน เช่น:
   - สแกนเฉพาะ domain นี้
   - สแกนเฉพาะ path ที่กำหนด
  - กำหนดหน้าเริ่มต้นและหน้าสิ้นสุด หรือปล่อยให้ crawler ไล่ next page ไปจนสุดภายใต้ operational cap
   - จำกัด depth ของ crawler
   - เปิด/ปิดการ next page
4. ระบบเริ่ม scan
5. ระบบค้นหา link ที่เป็น PDF
6. ระบบตรวจสอบ pagination / next page
7. ระบบป้องกันการ scan หน้าเดิมซ้ำ
8. ระบบป้องกันการ import PDF ซ้ำ
9. ระบบดาวน์โหลดและบันทึก PDF ที่พบเข้า MinIO-compatible object storage พร้อม `StoredObject` metadata
10. ถ้าเป็น PDF ใหม่หรือมีการเปลี่ยนแปลง จะส่งเข้ากระบวนการอ่านเอกสาร

Workflow เฉพาะกรณี BOT FIPCS:
1. เริ่มจาก `PFIPCS_list.aspx`
2. อ่านรายการในตารางประกาศและหนังสือเวียน
3. เก็บ metadata ของแต่ละรายการ
4. ตรวจว่ารายการใดมีเอกสารเกี่ยวข้อง
5. เข้า detail / related document page ของรายการนั้น
6. ค้นหา PDF หรือไฟล์แนบที่เกี่ยวข้อง
7. ดาวน์โหลด PDF และคำนวณ file hash
8. ตรวจ URL duplicate, file hash duplicate และ content hash duplicate
9. สแกนหน้าถัดไปตาม pagination ภายใน limit ที่กำหนด
10. สร้าง Document Record หรือ Document Version ตามผลการตรวจซ้ำ

สำหรับเอกสารที่มี `source_url` หรือ `pdf_url` อยู่แล้ว หน้า Document Detail ต้องมี action สำหรับกลับไปดาวน์โหลดไฟล์จาก URL เดิมอีกครั้งและบันทึกกลับเข้า storage ของระบบเป็น `DocumentVersion` ใหม่ ใช้สำหรับกรณีไฟล์เดิมเสียหาย ไฟล์ต้นทางถูกแก้ไข หรือผู้ใช้ต้องการ refresh จากแหล่งข้อมูลจริง การ refetch นี้ต้องไม่ทับ original artifact เดิม ต้องสร้าง object key ใหม่, OCR artifact ใหม่, และ audit action เช่น `DOCUMENT_VERSION_REFETCHED_FROM_SOURCE_URL`

### 5.3 การจัดกลุ่มเอกสารสำหรับวิเคราะห์ด้วย AI

นอกจากการนำเข้าเอกสารทีละไฟล์หรือจาก website crawler แล้ว ระบบควรรองรับการจัดกลุ่มเอกสารเป็น `Document Group` หรือ `Batch Analysis Job` เพื่อให้ผู้ใช้สามารถวางแผนการวิเคราะห์เอกสารหลายฉบับพร้อมกันในเชิงงาน แต่ระบบยังคงประมวลผลจริงทีละเอกสารตามคิว

จุดประสงค์ของ Document Group:
- รวมเอกสารที่เกี่ยวข้องกันเป็นชุดเดียว เช่น เอกสารจากหน่วยงานเดียวกัน ชุดประกาศเรื่องเดียวกัน หรือเอกสารของ compliance domain เดียวกัน
- แสดงจำนวนไฟล์และจำนวนเอกสารในกลุ่ม
- ติดตามความคืบหน้าระดับกลุ่มและระดับเอกสาร
- ใช้ Prompt Template เดียวกันกับเอกสารหลายฉบับได้
- ช่วยจัดลำดับงานของ AI worker และ review queue

ข้อมูลที่ควรเก็บใน Document Group:

```json
{
  "group_id": "uuid",
  "name": "ชุดเอกสารประกาศสินเชื่อ 2026",
  "description": "เอกสารประกาศและแนวปฏิบัติที่เกี่ยวข้องกับสินเชื่อ",
  "domain": "credit",
  "owner_id": "analyst_user_id",
  "prompt_template_id": "uuid",
  "prompt_template_version": 3,
  "total_files": 12,
  "total_documents": 12,
  "status": "QUEUED",
  "created_at": "2026-05-19T10:00:00Z"
}
```

Workflow:
1. Analyst สร้าง Document Group
2. เลือกหรือเพิ่มเอกสารเข้า group
3. เลือก Prompt Template ที่ต้องการใช้กับ group นั้น
4. ระบบนับจำนวนไฟล์และจำนวนเอกสารใน group
5. Analyst กดส่งเข้าคิว AI Analysis
6. ระบบ enqueue เอกสารทุกฉบับใน group
7. Worker ประมวลผลทีละเอกสารตามลำดับ FIFO ภายใน group
8. ระบบบันทึกสถานะรายเอกสารและสรุป progress ระดับ group
9. เมื่อวิเคราะห์ครบแล้ว ระบบส่งผลลัพธ์ที่ต้อง review เข้าสู่ Review Center

ข้อกำหนดสำหรับ MVP:
- เอกสารใน group ต้องประมวลผลแบบ FIFO ภายใน group
- Worker ทำทีละเอกสาร ไม่ประมวลผลหลายเอกสารใน group พร้อมกัน
- ผู้ใช้สามารถ `Cancel` group job ได้
- MVP ยังไม่ต้องรองรับ `Pause` / `Resume`
- ถ้าเอกสารบางฉบับล้มเหลว group ควรเป็น `PARTIAL_FAILED` ไม่ใช่ล้มเหลวทั้ง group เสมอไป

## 6. การป้องกันข้อมูลซ้ำ

ระบบควรมีการตรวจสอบซ้ำหลายระดับ เพราะไฟล์เดียวกันอาจมาจากคนละ URL หรือ URL เดิมอาจชี้ไปไฟล์ที่เปลี่ยนแล้ว

### 6.1 ระดับการตรวจสอบซ้ำ

1. URL Duplicate
   - ตรวจสอบว่า URL นี้เคยถูกบันทึกมาก่อนหรือไม่
   - ตัวอย่าง: `pdf_url = https://example.com/doc1.pdf`
   - ถ้า URL ซ้ำ ระบบจะไม่สร้างเอกสารใหม่ทันที แต่จะตรวจสอบต่อว่าไฟล์เปลี่ยนหรือไม่

2. File Hash Duplicate
   - ระบบคำนวณ hash จาก binary ของไฟล์ เช่น `SHA-256`
   - ถ้า hash เหมือนกัน แปลว่าเป็นไฟล์เดียวกันจริง แม้ว่าจะมาจากคนละ URL

3. Content Hash Duplicate
   - หลังจาก OCR หรือ extract text แล้ว ระบบอาจคำนวณ hash จากเนื้อหาภายในเอกสารอีกชั้นหนึ่ง
   - เหมาะกับกรณีที่ไฟล์ถูกสร้างใหม่แต่เนื้อหาเหมือนเดิม เช่น:
     - metadata เปลี่ยน
     - วันที่ดาวน์โหลดเปลี่ยน
     - PDF ถูก export ใหม่
     - ขนาดไฟล์เปลี่ยนเล็กน้อย แต่เนื้อหาเหมือนเดิม

4. Document Version
   - ถ้า URL เดิมแต่ hash เปลี่ยน ระบบควรสร้างเป็น version ใหม่ของเอกสารเดิม
  - ถ้าผู้ใช้ตั้งใจ re-upload หรือ refetch จาก URL เดิมเพื่อซ่อมหรือ refresh เอกสาร ระบบสามารถสร้าง version ใหม่ของเอกสารเดิมได้ แม้ deduplication ปกติจะพบว่า URL หรือ hash เคยมีอยู่แล้ว เพราะ action นี้เป็นการซ่อม/ปรับปรุง artifact แบบ audit ได้ ไม่ใช่การ import เอกสารใหม่โดยไม่ตั้งใจ
  - ถ้าเอกสารต้นทาง version ใหม่ถูกใช้เป็น source ของ rules ใน Master Rulebook ระบบต้อง flag rules ที่เกี่ยวข้องให้ re-review ก่อนนำ version ใหม่ไปใช้จริง
   - ตัวอย่าง:
     - `Document: ประกาศหลักเกณฑ์โฆษณา`
     - `Version 1: uploaded on 2026-01-01`
     - `Version 2: updated on 2026-03-01`

## 7. กระบวนการอ่าน PDF

PDF อาจมีหลายรูปแบบ ระบบจึงต้องมี pipeline สำหรับตรวจสอบและอ่านเอกสารอย่างเป็นขั้นตอน

### 7.1 PDF Processing Pipeline

```text
Upload / Crawl PDF
-> Detect PDF Type
-> ถ้ามี text: Extract Text
-> ถ้าเป็น image-based PDF: OCRmyPDF / Tesseract
-> Clean Text
-> Split by Page / Section / Chunk
-> Store:
   - original PDF
   - page image
   - OCR text
   - OCR confidence
   - OCR warning / partial flag
   - searchable PDF
-> Send to AI Analysis
-> Reviewer ตรวจ
```

### 7.2 การตรวจสอบว่า PDF เป็น image-based หรือไม่

ระบบควรตรวจสอบได้ว่าแต่ละหน้าเป็น:
- text-based
- image-based
- mixed content
- scanned document
- low-quality scan
- rotated page
- table-heavy page

เอกสารบางฉบับอาจมีทั้งหน้าที่เป็น text และหน้าที่เป็น scan image ปนกัน ดังนั้นควรประมวลผลเป็นรายหน้า ไม่ใช่สรุปทั้งไฟล์ว่าเป็นแบบเดียวกันทั้งหมด

### 7.3 OCR Strategy

สำหรับ PDF แบบ image-based ระบบต้องใช้ OCR ก่อนส่งเข้า AI แต่ในระยะเริ่มต้นไม่ควรเริ่มจาก OCR stack ที่ซับซ้อนเกินไป เพราะระบบยังมีส่วนงานสำคัญอื่นที่มีขอบเขตใหญ่กว่า OCR มาก เช่น:
- document import
- crawler
- AI summary
- review workflow
- master rulebook
- compliance checker
- report
- audit log

ดังนั้นแนวทางที่เหมาะสมคือเริ่มจาก OCR แบบเรียบง่ายที่ deploy ได้เร็ว ดูแลง่าย และเพียงพอสำหรับ MVP ก่อน แล้วค่อยขยายภายหลัง

### 7.4 OCR MVP และ Rollout Plan

#### 7.4.1 Phase 1: MVP

สำหรับ MVP แนะนำให้ใช้ stack ดังนี้:
- `Tesseract OCR` เป็น OCR engine หลัก
- `OCRmyPDF` สำหรับสร้าง searchable PDF และ orchestrate OCR pipeline ของไฟล์ PDF
- `Poppler` สำหรับงานช่วยด้าน PDF utilities และ page-level processing

เหตุผลของการเริ่มต้นชุดนี้:
- ติดตั้งและ deploy ได้ง่ายใน worker container
- รองรับเอกสารภาษาไทยและภาษาอังกฤษได้ในระดับเริ่มต้น
- ลดความซับซ้อนของระบบในช่วงที่ทีมยังต้องพัฒนาส่วนหลักอื่นควบคู่กัน
- ได้ searchable PDF กลับมาเป็น artifact มาตรฐานสำหรับใช้งานต่อ

#### 7.4.2 Phase 2: Optional OCR Engine

เมื่อระบบหลักเริ่มนิ่งแล้ว ควรเพิ่ม `PaddleOCR` เป็น optional OCR engine เพื่อใช้กับเอกสารบางประเภทที่ Tesseract ให้ผลลัพธ์ไม่ดีพอ เช่น:
- เอกสาร scan คุณภาพต่ำ
- เอกสารที่มี layout ซับซ้อน
- เอกสารที่มีตารางหรือข้อความหลายคอลัมน์

ในระยะนี้ระบบควรรองรับการเลือก OCR engine ตาม document profile หรือ job configuration

#### 7.4.3 Phase 3: OCR Quality Comparison

หลังจากรองรับมากกว่า 1 OCR engine แล้ว ควรเพิ่มความสามารถในการเปรียบเทียบคุณภาพ OCR ต่อเอกสาร เพื่อช่วยตัดสินใจว่า engine ใดเหมาะกับเอกสารประเภทใด โดยเปรียบเทียบอย่างน้อย:
- OCR confidence
- ความครบถ้วนของข้อความที่ extract ได้
- ความถูกต้องของภาษาไทย
- ความถูกต้องของโครงสร้างหน้าเอกสาร
- เวลาในการประมวลผลต่อเอกสาร

### 7.5 OCR Architecture ที่แนะนำ

```text
Upload PDF
-> Detect PDF Type
-> ถ้ามี text: Extract Text
-> ถ้าเป็น image PDF: OCRmyPDF / Tesseract
-> Store:
   - original PDF
   - page image
   - OCR text
   - OCR confidence
  - OCR warning / partial flag
   - searchable PDF
-> AI วิเคราะห์
-> Reviewer ตรวจ
```

แนวทางนี้ทำให้ระบบแยก artifact ที่สำคัญของ OCR ออกจากผลการวิเคราะห์ AI อย่างชัดเจน และช่วยให้สามารถ audit, reprocess, และเปรียบเทียบผล OCR ในอนาคตได้ง่ายขึ้น

### 7.6 Docker ตัวอย่างสำหรับ OCR Worker

ตัวอย่าง container image สำหรับ worker:

```dockerfile
FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-tha \
  tesseract-ocr-eng \
  poppler-utils \
  ghostscript \
  ocrmypdf \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "start:worker"]
```

จาก image นี้ worker จะมีเครื่องมือหลักดังนี้:
- `tesseract`
- ภาษาไทย (`tesseract-ocr-tha`)
- ภาษาอังกฤษ (`tesseract-ocr-eng`)
- `poppler-utils`
- `ocrmypdf`

### 7.7 OCR Failure และ Low Confidence Policy

ใน MVP หาก OCR ล้มเหลวบางหน้า หรือได้ผลลัพธ์ที่ confidence ต่ำ ระบบไม่ควรหยุดเอกสารทันที แต่ควรส่งต่อด้วยข้อมูลเท่าที่มี พร้อมติดธงเตือนให้ AI และ Reviewer ทราบอย่างชัดเจน

แนวทางการทำงาน:
1. ถ้าเอกสารมี text บางส่วน ให้ extract text ส่วนนั้นและเก็บ OCR result แยกตามหน้า
2. ถ้า OCR สำเร็จบางหน้า ให้ mark เอกสารเป็น partial OCR result และเก็บหน้าที่ล้มเหลวไว้ใน processing log
3. ถ้า OCR confidence ต่ำ ให้ส่งต่อ AI analysis ได้ แต่ต้องแนบ warning ว่าผลลัพธ์อาจไม่ครบถ้วน
4. Reviewer ต้องเห็น OCR warning, หน้าที่มีปัญหา, และ OCR confidence ก่อนตัดสินใจ approve / reject ผล AI
5. เอกสารที่มี OCR warning ควรถูกนับแยกใน report เพื่อให้ทีมตรวจสอบคุณภาพ OCR ภายหลังได้

สถานะหรือ flag ที่ควรเก็บเพิ่มเติม:
- `ocr_status`: เช่น `COMPLETED`, `PARTIAL`, `FAILED`
- `ocr_confidence`: ค่าเฉลี่ยหรือค่าต่อหน้า
- `ocr_warning`: ข้อความอธิบายปัญหา OCR
- `failed_pages`: เลขหน้าที่ OCR ไม่สำเร็จ

สำหรับเอกสารกฎหมายภาษาไทย ควรทดสอบคุณภาพ OCR กับเอกสารจริงขององค์กรก่อนใช้งาน production เพราะคำผิดเพียงเล็กน้อยอาจทำให้การตีความกฎหมายผิดได้

## 8. ระบบสรุปข้อมูลด้วย AI

ระบบควรรองรับการสรุป 2 รูปแบบหลัก

### 8.1 การสรุปแบบทั่วไป

ใช้สำหรับให้ AI อ่านเอกสารแล้วสรุปภาพรวม

ตัวอย่างผลลัพธ์:

```json
{
  "document_title": "ประกาศเรื่องหลักเกณฑ์การโฆษณา",
  "summary": "เอกสารนี้กล่าวถึงหลักเกณฑ์เกี่ยวกับการโฆษณา...",
  "main_topics": [
    "ข้อห้ามในการโฆษณา",
    "การเปิดเผยข้อมูล",
    "การใช้ข้อความชักจูง",
    "บทลงโทษ"
  ],
  "important_sections": [
    {
      "section": "ข้อ 5",
      "title": "ข้อห้าม",
      "summary": "ห้ามใช้ข้อความที่ทำให้เข้าใจผิด..."
    }
  ]
}
```

### 8.2 การสรุปแบบเจาะจงตาม Prompt

ผู้ใช้สามารถกำหนดได้ว่าต้องการให้ AI หาอะไรจากเอกสาร

ตัวอย่าง Prompt:
- ช่วยหาเฉพาะข้อกำหนดที่เกี่ยวข้องกับการโฆษณา การตลาด การชักชวนลูกค้า และการใช้ข้อความที่อาจทำให้เข้าใจผิด
- หรือช่วยสรุปเฉพาะข้อที่เกี่ยวข้องกับการใช้รูปภาพ ดอกเบี้ย ผลตอบแทน โปรโมชั่น และข้อความเปรียบเทียบ

ผลลัพธ์ที่ควรได้:

```json
{
  "target": "advertising_rules",
  "rules": [
    {
      "rule_title": "ห้ามใช้ข้อความที่ทำให้เข้าใจผิด",
      "rule_detail": "การโฆษณาต้องไม่ใช้ข้อความที่ทำให้ผู้บริโภคเข้าใจผิดเกี่ยวกับเงื่อนไข...",
      "source_page": 12,
      "source_section": "ข้อ 7.2",
      "risk_level": "high",
      "example_violation": "โฆษณาว่าได้รับผลตอบแทนแน่นอนโดยไม่มีเงื่อนไข"
    }
  ]
}
```

### 8.3 ขั้นตอนการวิเคราะห์เอกสารด้วย AI

ระบบควรแยกการวิเคราะห์เอกสารด้วย AI ออกจากการพิมพ์ prompt แบบครั้งเดียว โดยให้ผู้ใช้เลือก Prompt Template และ Prompt Version ที่บันทึกไว้ แล้วนำไปใช้กับเอกสารเดี่ยวหรือ Document Group ได้ซ้ำ ๆ Prompt Version ที่ถูกใช้ต้องระบุ `AI Model` ที่เลือกไว้ด้วย เพื่อให้ผลวิเคราะห์ trace กลับได้ว่าใช้ prompt, model, document version และ OCR artifact ใด

Workflow สำหรับเอกสารเดี่ยว:

```text
เลือกเอกสาร
-> เลือก Prompt Template และ version
-> ระบบอ่าน AI provider / AI model จาก Prompt Version
-> ระบบสร้าง Prompt Instance สำหรับการรันครั้งนี้
-> ตรวจสอบ OCR text / extracted text / source references
-> ส่งเข้า AI Analysis Queue
-> AI วิเคราะห์เอกสาร
-> เก็บผลลัพธ์พร้อม prompt_template_id, prompt_template_version, provider, model และ rendered_prompt_hash
-> ส่งผลลัพธ์เข้าสู่ Review Center
```

Workflow สำหรับ Document Group:

```text
เลือก Document Group
-> เลือก Prompt Template และ version
-> ระบบใช้ AI provider / AI model จาก Prompt Version เดียวกันสำหรับงานใน group
-> ระบบสร้าง Batch Analysis Job
-> Enqueue เอกสารทุกฉบับใน group
-> Worker ดึงเอกสารทีละฉบับตาม FIFO
-> วิเคราะห์เอกสารทีละฉบับ
-> อัปเดต progress ระดับเอกสารและระดับ group
-> ส่งผลลัพธ์แต่ละฉบับเข้าสู่ Review Center
-> สรุปผลการวิเคราะห์ระดับ group
```

ข้อมูลที่ควรเก็บในแต่ละ AI Analysis Job:
- document_id
- group_id ถ้าเป็นงานแบบกลุ่ม
- prompt_template_id
- prompt_template_version
- prompt_instance_id
- ai_provider
- ai_model
- queue_position
- status
- started_at
- completed_at
- token_usage
- estimated_cost
- error_message ถ้ามี

### 8.4 หลักการประมวลผลแบบ Queue

AI worker ควรประมวลผลเอกสารจาก queue ทีละฉบับ เพื่อควบคุม resource, token usage และการ retry ได้ง่าย โดยเฉพาะเมื่อเอกสารมีขนาดใหญ่หรือมี OCR warning

หลักการ queue สำหรับ MVP:
- ภายใน Document Group ใช้ FIFO เป็นหลัก
- เอกสารแต่ละฉบับมีสถานะของตัวเอง เช่น `QUEUED`, `AI_PROCESSING`, `AI_COMPLETED`, `FAILED`
- Document Group มี progress รวม เช่น `total_documents`, `queued_documents`, `processing_documents`, `completed_documents`, `failed_documents`
- ถ้า group ถูก cancel ระบบไม่ควรเริ่มงานเอกสารใหม่ใน group นั้น แต่เอกสารที่กำลังประมวลผลอยู่ควรปล่อยให้จบหรือ mark ตาม policy ของ worker
- ผลลัพธ์ของแต่ละเอกสารต้อง trace กลับไปยัง prompt, document, group และ reviewer decision ได้

## 9. ระบบ Review ผลลัพธ์จาก AI

หลังจาก AI วิเคราะห์เอกสาร ระบบต้องไม่ถือว่าผลลัพธ์ถูกต้องทันที ควรมี Human Review ก่อนนำไปใช้เป็นเอกสารอ้างอิงหลัก

หลัก governance สำหรับ MVP:
- `Analyst` เป็นผู้รันหรือเตรียมผลวิเคราะห์ และส่งผลลัพธ์เข้าสู่ review
- `Reviewer` เป็นผู้ตรวจสอบผลลัพธ์ AI และตัดสินใจ approve / reject
- `Admin` สามารถมอบหมาย reviewer และดูภาพรวมสถานะได้ แต่ไม่ควรแทนที่การ review เชิงเนื้อหาโดยไม่มีสิทธิ์ที่เหมาะสม
- การ reject ใช้ freeform comment เป็นหลักใน MVP เพื่อให้ reviewer อธิบายข้อผิดพลาดหรือสิ่งที่ต้องวิเคราะห์ใหม่ได้อย่างยืดหยุ่น

### 9.1 สถานะของผลลัพธ์ AI

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `REPROCESSING`
- `ARCHIVED`

### 9.2 Workflow การ Review

```text
AI Analysis Completed
-> Analyst ส่งผลลัพธ์เข้าสู่ Review Center
-> Reviewer ตรวจสอบผลลัพธ์
  -> ตรวจ OCR warning / source reference / extracted rules
-> Approve หรือ Reject
  -> ถ้า Approve: ผลลัพธ์ใช้เป็นข้อมูลอ้างอิงหรือใช้สร้าง Rulebook draft ได้
  -> ถ้า Reject: Reviewer ใส่ freeform comment
-> ส่ง Comment + ผลลัพธ์เดิม + เอกสารต้นทาง ให้ AI วิเคราะห์ใหม่
-> สร้าง Review Round ใหม่
```

### 9.3 ข้อมูลที่ต้องเก็บในการ Review

ระบบควรเก็บข้อมูลดังนี้:

```json
{
  "review_id": "uuid",
  "document_id": "uuid",
  "ai_result_id": "uuid",
  "round": 2,
  "status": "REJECTED",
  "reviewer_id": "uuid",
  "reviewer_name": "Compliance Officer",
  "comment": "AI ยังสรุปข้อกำหนดเกี่ยวกับข้อความโฆษณาที่ทำให้เข้าใจผิดไม่ครบ",
  "created_at": "2026-05-19T10:00:00Z"
}
```

### 9.4 การ Reject พร้อม Comment

เมื่อผู้ใช้ Reject ระบบต้องให้ใส่ freeform comment เพื่อบอก AI ว่าพลาดตรงไหน ใน MVP ยังไม่บังคับ structured reject reason เช่น `missing rule`, `wrong citation`, หรือ `wrong interpretation` แต่ระบบควรเก็บ comment ให้ค้นหาและแสดงใน review history ได้

ตัวอย่าง comment:
> AI ยังไม่ได้ดึงเงื่อนไขเกี่ยวกับการแสดงอัตราดอกเบี้ย และไม่ได้ระบุหน้าที่อ้างอิง ขอให้วิเคราะห์ใหม่โดยเน้นเรื่องดอกเบี้ย โปรโมชั่น และข้อความที่อาจทำให้ลูกค้าเข้าใจผิด

ระบบควรส่งข้อมูลให้ AI ใหม่ในรูปแบบนี้:

```text
เอกสารต้นทาง: ...
ผลลัพธ์รอบก่อนหน้า: ...
Comment จาก Reviewer: ...
คำสั่ง: วิเคราะห์ใหม่โดยแก้ไขตาม comment และระบุหน้าอ้างอิงทุกข้อ
```

## 10. ระบบ Report

ระบบต้องมี Report สำหรับติดตามทั้งเอกสาร ผลการวิเคราะห์ และการรีวิว โดยต้องแยกความหมายของรายงานออกเป็น 2 กลุ่มหลัก:

1. `Rule Extraction / Regulatory Intelligence Report` คือรายงานฐานกฎที่เกิดจากการนำเข้า PDF หรือ URL ของเอกสารต้นทาง แล้วผ่าน OCR, AI analysis, Human Review และ Approval เพื่อรวบรวมข้อกำหนด เงื่อนไข ข้อห้าม และ source citation ไว้เป็นฐานอ้างอิง
2. `Compliance Usage / Content Check Report` คือรายงานผลตรวจสื่อจริงที่เกิดหลังจากผู้ใช้อัปโหลดสื่อ เอกสาร PDF โพสต์ รูปภาพ ข้อความ หรือ URL แล้วระบบนำไปตรวจเทียบกับรายงานฐานกฎหรือ Master Rulebook ที่อนุมัติแล้ว

รายงานกลุ่มแรกตอบคำถามว่า "กฎและเงื่อนไขจากเอกสารทางการคืออะไร" ส่วนรายงานกลุ่มที่สองตอบคำถามว่า "สื่อหรือเอกสารที่องค์กรจะนำไปใช้ตรงตามเงื่อนไขเหล่านั้นหรือไม่"

### 10.1 รายงานเอกสาร

แสดงข้อมูล เช่น:
- จำนวนเอกสารทั้งหมด
- จำนวนเอกสารที่นำเข้าจาก Upload
- จำนวนเอกสารที่นำเข้าจาก Website Scan
- จำนวนเอกสารใหม่
- จำนวนเอกสารซ้ำ
- จำนวนเอกสารที่มี version ใหม่
- จำนวนเอกสารที่ OCR สำเร็จ
- จำนวนเอกสารที่ OCR สำเร็จบางส่วน / มี warning
- จำนวนเอกสารที่ OCR ล้มเหลว
- จำนวนเอกสารที่รอ AI วิเคราะห์
- จำนวน Document Group ทั้งหมด
- จำนวนเอกสารต่อ Document Group

### 10.2 รายงาน Review

แสดงข้อมูล เช่น:
- เอกสารที่รอรีวิว
- เอกสารที่ Approve แล้ว
- เอกสารที่ Reject แล้ว
- จำนวนรอบการ Reject ต่อเอกสาร
- Reviewer แต่ละคนรีวิวกี่รายการ
- Average review time
- เอกสารที่ถูก reject บ่อยที่สุด
- freeform comment จากการ reject ที่พบบ่อยหรือควรถูกจัดกลุ่มภายหลัง

### 10.3 รายงาน AI Analysis

แสดงข้อมูล เช่น:
- AI วิเคราะห์สำเร็จกี่รายการ
- AI วิเคราะห์ล้มเหลวกี่รายการ
- Token usage
- ค่าใช้จ่ายโดยประมาณ
- เวลาที่ใช้ต่อเอกสาร
- Prompt template ที่ใช้
- Model ที่ใช้
- Confidence score
- จำนวน rule ที่ extract ได้
- จำนวน AI Analysis Job ที่อยู่ใน queue
- ระยะเวลารอคิวเฉลี่ย
- Prompt Template version ที่ถูกใช้บ่อยที่สุด
- จำนวนการใช้งาน Prompt Template ต่อ domain

### 10.3.1 รายงาน Batch / Document Group

แสดงข้อมูล เช่น:
- จำนวน Document Group ทั้งหมด
- จำนวน group ที่อยู่ในสถานะ `QUEUED`, `PROCESSING`, `COMPLETED`, `PARTIAL_FAILED`, `CANCELLED`
- จำนวนเอกสารทั้งหมดในแต่ละ group
- จำนวนเอกสารที่ประมวลผลสำเร็จ / ล้มเหลว / ถูกยกเลิก
- progress percentage ต่อ group
- เวลาเฉลี่ยต่อเอกสารใน group
- Prompt Template ที่ใช้กับ group
- owner ของ group

### 10.4 รายงาน Compliance Check

แสดงข้อมูล เช่น:
- ข้อมูลภายนอกที่ถูกตรวจสอบทั้งหมด
- ผ่านกี่รายการ
- ไม่ผ่านกี่รายการ
- กำกวมกี่รายการ
- ข้อกฎที่ถูกละเมิดบ่อยที่สุด
- ประเภทสื่อที่มีปัญหาบ่อยที่สุด
- Reviewer ที่อนุมัติหรือ reject ผลตรวจสอบ
- จำนวนรายการที่ถูกส่ง notification หลัง Reviewer approve
- จำนวนรายการที่อยู่ในสถานะ `AMBIGUOUS` และ `NEED_HUMAN_REVIEW`

### 10.5 รายงานฐานกฎและรายงานผลตรวจสื่อจริง

เพื่อให้ workflow การใช้งานชัดเจน ระบบควรแสดงและ export รายงาน 2 ประเภทนี้แยกกัน:

| ประเภท Report | เกิดจาก | ใช้เพื่อ | ตัวอย่างข้อมูลสำคัญ |
| --- | --- | --- | --- |
| Rule Extraction / Regulatory Intelligence Report | PDF หรือ URL เอกสารต้นทางที่ผ่าน OCR, AI analysis, Review และ Approval | รวบรวมกฎ เงื่อนไข ข้อห้าม ความเสี่ยง และ source citation เพื่อใช้เป็นฐานตรวจสอบ | document version, approved findings, rule candidates, source page, reviewer decision, not relevant documents |
| Compliance Usage / Content Check Report | สื่อหรือเอกสารที่ผู้ใช้อัปโหลดเพื่อนำไปใช้จริง เช่น PDF, social post, image, screenshot, URL หรือข้อความ | ตรวจว่าสื่อจริงตรงตามเงื่อนไขในรายงานฐานกฎหรือ Master Rulebook หรือไม่ | input artifact, extracted content, matched rules, result, evidence, reviewer decision, recommended action |

รายงานฐานกฎสามารถนำไปสร้างหรืออัปเดต Master Rulebook ได้ ส่วนรายงานผลตรวจสื่อจริงต้องอ้างอิง version ของรายงานฐานกฎหรือ Master Rulebook ที่ใช้ตรวจ เพื่อให้ audit ได้ว่าผลตรวจอ้างอิงกฎชุดใด ณ เวลานั้น

## 11. เอกสารอ้างอิงหลัก

หลังจาก AI วิเคราะห์เอกสารหลายฉบับ และผลลัพธ์ผ่านการรีวิวแล้ว ระบบจะสามารถรวบรวมออกมาเป็น "เอกสารอ้างอิงหลัก" ได้

Master Rulebook ต้องออกแบบให้รองรับหลาย domain ตั้งแต่ต้น เช่น โฆษณา สินเชื่อ ประกัน ข้อมูลส่วนบุคคล การตลาดออนไลน์ หรือเอกสารสัญญา โดยแต่ละ Rulebook สามารถมี owner, version, lifecycle และ approval workflow ของตัวเอง

### 11.1 จุดประสงค์ของเอกสารอ้างอิงหลัก

ใช้เป็นฐานความรู้กลางสำหรับตรวจสอบข้อมูลภายนอกในอนาคต เช่น:
- Advertising Compliance Master Rulebook
- Credit Compliance Master Rulebook
- Insurance Compliance Master Rulebook
- Data Privacy Compliance Master Rulebook
- คู่มือหลักเกณฑ์การตรวจสอบโฆษณา

### 11.2 โครงสร้างเอกสารอ้างอิงหลัก

```json
{
  "master_document_id": "uuid",
  "title": "คู่มือหลักเกณฑ์การตรวจสอบโฆษณา",
  "domain": "advertising",
  "version": 1,
  "status": "PUBLISHED",
  "drafted_by": "analyst_user_id",
  "approved_by": "reviewer_user_id",
  "published_by": "admin_user_id",
  "rules": [
    {
      "rule_id": "R001",
      "variant_group_id": "VG001",
      "category": "Misleading Advertising",
      "rule_title": "ห้ามใช้ข้อความที่ทำให้เข้าใจผิด",
      "rule_description": "ห้ามใช้ข้อความ รูปภาพ หรือข้อมูลใด ๆ ที่อาจทำให้ผู้บริโภคเข้าใจผิด...",
      "risk_level": "high",
      "context": {
        "domain": "advertising",
        "product_type": "general",
        "jurisdiction": "TH"
      },
      "source_documents": [
        {
          "document_id": "uuid",
          "document_version": 1,
          "document_title": "ประกาศ...",
          "page": 12,
          "section": "ข้อ 7.2"
        }
      ],
      "requires_re_review": false,
      "examples": [
        "รับผลตอบแทนแน่นอน",
        "ดอกเบี้ยต่ำที่สุดโดยไม่ระบุเงื่อนไข"
      ]
    }
  ]
}
```

### 11.3 เอกสารอ้างอิงหลักควรทำได้หลายฉบับ

ระบบควรรองรับการสร้าง Master Rulebook หลายชุด เช่น:
- ชุดตรวจสอบโฆษณา
- ชุดตรวจสอบสินเชื่อ
- ชุดตรวจสอบประกัน
- ชุดตรวจสอบข้อมูลส่วนบุคคล
- ชุดตรวจสอบการตลาดออนไลน์
- ชุดตรวจสอบเอกสารสัญญา

### 11.4 Governance และ Lifecycle ของ Master Rulebook

Master Rulebook ควรมี workflow การอนุมัติที่ชัดเจน:

```text
Analyst สร้าง Rulebook Draft
-> ดึง rules จาก AI results ที่ผ่าน review แล้ว
-> Reviewer ตรวจและ approve rulebook
-> Admin publish rulebook
-> Rulebook พร้อมใช้ใน Compliance Checker
```

สถานะของ Rulebook ที่ควรมี:
- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `PUBLISHED`
- `NEEDS_REVIEW`
- `SUPERSEDED`
- `ARCHIVED`

### 11.5 การจัดการเมื่อเอกสารต้นทางมี Version ใหม่

เมื่อเอกสารต้นทางมี version ใหม่ ระบบไม่ควรอัปเดต Master Rulebook อัตโนมัติทันที แต่ควร flag rules ที่อ้างอิงเอกสารนั้นให้กลับเข้าสู่การ review ก่อนนำกลับไปใช้

แนวทางการทำงาน:
1. ตรวจพบ source document version ใหม่
2. ค้นหา rules และ rule variants ที่อ้างอิง source document เดิม
3. ตั้งค่า `requires_re_review = true`
4. เปลี่ยน Rulebook หรือ rule ที่เกี่ยวข้องเป็น `NEEDS_REVIEW`
5. Analyst / Reviewer ตรวจสอบผลกระทบของเอกสาร version ใหม่
6. Admin publish Rulebook version ใหม่เมื่อผ่าน approval แล้ว

### 11.6 การจัดการ Rule ที่ขัดกันหรือคล้ายกัน

เมื่อเอกสารต้นทางหลายฉบับให้ rule ที่คล้ายกันหรือขัดกัน ระบบไม่ควรบังคับ merge เป็น rule เดียวโดยอัตโนมัติ แต่ควรเก็บเป็นหลาย variant ภายใต้ `variant_group_id` เดียวกัน แล้วใช้ context เพื่อเลือก rule ที่เหมาะสมตอนตรวจสอบ

ตัวอย่าง context ที่ใช้แยก variant:
- domain
- product type
- campaign type
- customer segment
- jurisdiction
- effective date

ถ้า rule ขัดกันและ context ยังไม่ชัดเจน ระบบควรแสดงเป็น ambiguity และส่งให้ Reviewer ตัดสินใจ ไม่ควรเลือก rule เองโดยไม่มีหลักฐาน

## 12. ระบบตรวจสอบข้อมูลภายนอกเทียบกับเอกสารอ้างอิงหลัก

นี่คือส่วนสำคัญที่สุดของระบบหลังจากมี Master Rulebook แล้ว

### 12.1 เป้าหมาย

นำข้อมูลภายนอกมาตรวจสอบว่าเข้าข่ายละเมิด หรือไม่ตรงตามหลักเกณฑ์ข้อใดหรือไม่

ข้อมูลภายนอก เช่น:
- รูปภาพโฆษณา
- ข้อความโปรโมชัน
- PDF แคมเปญ
- Social media post
- Web page
- Banner
- Screenshot
- เอกสารการตลาด
- Video caption
- Landing page content

### 12.2 Workflow

```text
Upload External Content
  -> รองรับสื่อ เอกสาร PDF รูปภาพ screenshot social media post ข้อความ และ URL
-> Extract Content
   -> ถ้าเป็นรูปภาพ: OCR / Vision AI
   -> ถ้าเป็น PDF: PDF Extract / OCR
   -> ถ้าเป็น URL: Web Extract
-> Normalize Content
-> เลือก Approved Rule Extraction Report หรือ Master Rulebook version ที่ต้องการใช้ตรวจ
-> AI Compliance Analysis
-> AI ระบุว่าเข้าข่ายข้อใด
-> ถ้ากำกวม: Retrieve Source Document
-> AI ตรวจซ้ำจากเอกสารต้นทาง
-> ถ้ายังไม่ชัดเจน: ตั้งสถานะ AMBIGUOUS
-> Route ให้ Reviewer: ตั้งสถานะ NEED_HUMAN_REVIEW
-> Reviewer ตรวจสอบ
-> Approve / Reject
-> Save Compliance Check Result
-> Generate Compliance Usage / Content Check Report
-> ถ้า Approved และเป็น NON_COMPLIANT หรือ high-risk: ส่ง notification
```

รายงานที่ใช้เป็นฐานตรวจต้องเป็นรายงานหรือ Rulebook ที่ผ่าน Review และ Approval แล้วเท่านั้น ระบบไม่ควรนำ AI result ที่ยังไม่ผ่านมนุษย์ตรวจสอบไปใช้ตัดสินสื่อจริง

### 12.3 ผลลัพธ์การตรวจสอบ

```json
{
  "check_id": "uuid",
  "input_type": "image",
  "result": "POTENTIAL_VIOLATION",
  "summary": "โฆษณานี้อาจเข้าข่ายทำให้ผู้บริโภคเข้าใจผิดเกี่ยวกับผลตอบแทน",
  "matched_rules": [
    {
      "rule_id": "R001",
      "rule_title": "ห้ามใช้ข้อความที่ทำให้เข้าใจผิด",
      "confidence": 0.86,
      "reason": "ข้อความในภาพใช้คำว่า 'ผลตอบแทนแน่นอน' โดยไม่ระบุเงื่อนไข",
      "source_reference": {
        "document_title": "ประกาศ...",
        "page": 12,
        "section": "ข้อ 7.2"
      }
    }
  ],
  "ambiguous_points": [
    "ไม่พบรายละเอียดเงื่อนไขดอกเบี้ยในภาพ"
  ],
  "recommendation": "ควรให้ทีม Compliance ตรวจสอบก่อนเผยแพร่"
}
```

### 12.4 Notification Policy

ใน MVP ระบบควรลด noise ของ notification โดยไม่แจ้งเตือนทุกผลลัพธ์ที่ AI พบความเสี่ยงทันที แต่ให้แจ้งเตือนเฉพาะผลที่ผ่านการ review แล้วเท่านั้น

เงื่อนไขที่ควร trigger notification:
- Compliance check ถูก `APPROVED` แล้ว
- ผลลัพธ์สุดท้ายเป็น `NON_COMPLIANT`
- หรือผลลัพธ์สุดท้ายเป็น high-risk ที่ Reviewer ยืนยันแล้ว

ผลลัพธ์ที่ยังเป็น `POTENTIAL_VIOLATION`, `AMBIGUOUS`, หรือ `NEED_HUMAN_REVIEW` ควรแสดงใน dashboard / review queue ก่อน แต่ยังไม่ควรส่ง notification แบบ final ไปยัง stakeholder ภายนอก workflow review

กลุ่มผู้รับ notification ควรกำหนดตาม configuration ขององค์กร เช่น Compliance, Legal, Marketing Owner หรือ Admin

## 13. การจัดการกรณีกำกวม

AI ไม่ควรสรุปว่า "ผิดแน่นอน" หากข้อมูลไม่ครบหรือกฎตีความได้หลายแบบ

ระบบควรมีสถานะผลลัพธ์ เช่น:
- `COMPLIANT`
- `NON_COMPLIANT`
- `POTENTIAL_VIOLATION`
- `AMBIGUOUS`
- `NEED_HUMAN_REVIEW`
- `INSUFFICIENT_INFORMATION`

ความหมายของสถานะที่อาจสับสน:
- `AMBIGUOUS`: AI ยังไม่สามารถสรุปได้ชัดเจน แม้จะ retrieve rule หรือ source document เพิ่มแล้ว
- `NEED_HUMAN_REVIEW`: ระบบ route รายการนั้นเข้าสู่คิวของ Reviewer แล้ว และกำลังรอการตัดสินใจจากมนุษย์
- `INSUFFICIENT_INFORMATION`: ข้อมูลที่นำมาตรวจสอบไม่เพียงพอ เช่น ภาพไม่ชัด ข้อความไม่ครบ หรือไม่มี context สำคัญ

### 13.1 Rule สำหรับกรณีกำกวม

ถ้า AI พบว่าข้อมูลไม่ชัดเจน ต้องทำขั้นตอนเพิ่มดังนี้:
1. ค้นหา rule ที่เกี่ยวข้องใน Master Rulebook
2. ย้อนกลับไปอ่านเอกสารต้นทาง
3. ตรวจสอบหน้าหรือ section ที่เกี่ยวข้อง
4. วิเคราะห์ซ้ำ
5. ถ้ายังไม่ชัดเจน ให้สรุปเป็น `AMBIGUOUS`
6. Route เข้าคิว Reviewer และเปลี่ยนสถานะ workflow เป็น `NEED_HUMAN_REVIEW`

ข้อกำหนดสำคัญ:
- ห้ามฟันธงโดยไม่มีหลักฐานอ้างอิง
- ห้ามส่ง notification แบบ final จนกว่า Reviewer จะ approve ผลลัพธ์

## 14. Role และ Permission

ระบบควรมี Role หลักดังนี้

### 14.1 Super Admin

ทำได้ทุกอย่าง เช่น:
- จัดการ user
- จัดการ role
- จัดการ source
- ลบเอกสาร
- ตั้งค่า AI
- ตั้งค่า crawler
- ตั้งค่า notification policy
- ตั้งค่า storage / integration ที่เกี่ยวข้องกับ PostgreSQL, MinIO และ worker
- ดู report ทั้งหมด

### 14.2 Admin

ทำงานด้านจัดการระบบทั่วไป เช่น:
- เพิ่มเอกสาร
- สร้าง website source
- ดูผลวิเคราะห์
- มอบหมาย reviewer
- publish Master Rulebook หลังผ่าน approval
- ตั้งค่าผู้รับ notification ตาม policy ขององค์กร
- ดูและจัดการ Batch Analysis Queue
- ดู report

### 14.3 Reviewer

ทำหน้าที่ตรวจสอบผลลัพธ์จาก AI

ทำได้ เช่น:
- ดูเอกสารที่ได้รับมอบหมาย
- Approve AI result
- Reject AI result
- ใส่ comment
- ตรวจสอบ compliance check result
- approve / reject Master Rulebook ก่อน publish
- ตัดสินใจกรณี `NEED_HUMAN_REVIEW`

### 14.4 Analyst

ทำหน้าที่วิเคราะห์และใช้งานข้อมูล

ทำได้ เช่น:
- สร้าง prompt วิเคราะห์
- สร้างและ version Prompt Template
- รัน AI analysis
- สร้าง Document Group และส่งเข้า Batch Analysis Queue
- สร้าง master rulebook draft
- ส่ง AI result หรือ Rulebook draft เข้าสู่ review
- ตรวจสอบ external content

### 14.5 Viewer

ดูข้อมูลได้อย่างเดียว

ทำได้ เช่น:
- ดูเอกสารที่ผ่านการอนุมัติ
- ดู master rulebook
- ดู report บางส่วน

### 14.6 Authentication Baseline

ระบบระยะ local development ใช้ `Basic Auth` เป็น authentication baseline เพื่อป้องกัน Admin UI และ API ทุก endpoint ก่อนมีระบบ user/session เต็มรูปแบบ

ข้อกำหนดปัจจุบัน:
- Frontend ต้องมี middleware ดักก่อนเข้า Admin workspace
- Backend API ต้องมี middleware ดักก่อนเข้าถึง route ภายใต้ API server รวมถึง Swagger/OpenAPI
- ค่าเริ่มต้นสำหรับ local development คือ username `admin` และ password `admin`
- Credential ต้องอ่านจาก environment variables เช่น `BASIC_AUTH_USERNAME` และ `BASIC_AUTH_PASSWORD` เพื่อเปลี่ยนได้โดยไม่แก้ code
- Basic Auth เป็นเพียง authentication gate เบื้องต้น ส่วน RBAC ตาม Role ในข้อ 14.1-14.5 ยังต้อง enforce เพิ่มใน backend guards/decorators เมื่อมี user management workflow จริง
- Frontend role-aware UI เป็นเพียง UX hint และห้ามถือเป็น authorization boundary หลัก

## 15. AI Prompt Template

ระบบควรมี Prompt Template ที่แก้ไขและ version ได้

### 15.1 General Summary Prompt

```text
คุณคือผู้ช่วยวิเคราะห์เอกสารทางกฎหมายและกฎระเบียบ

ให้อ่านเนื้อหาเอกสารต่อไปนี้ และสรุปข้อมูลสำคัญโดยแบ่งเป็น:
1. ภาพรวมของเอกสาร
2. วัตถุประสงค์ของเอกสาร
3. ประเด็นสำคัญ
4. ข้อกำหนดสำคัญ
5. ข้อห้าม
6. ผลกระทบต่อองค์กร
7. หน้าที่หรือความรับผิดชอบที่เกี่ยวข้อง
8. หน้าที่ควรตรวจสอบเพิ่มเติม

ต้องระบุเลขหน้าและ section ที่เกี่ยวข้องทุกครั้ง หากข้อมูลไม่ชัดเจนให้ระบุว่า "ไม่พบข้อมูลชัดเจน"
```

### 15.2 Specific Extraction Prompt

```text
คุณคือ AI สำหรับดึงข้อกำหนดเฉพาะจากเอกสารกฎหมาย

เป้าหมายของการวิเคราะห์:
{{user_prompt}}

โปรดดึงเฉพาะข้อมูลที่เกี่ยวข้องกับเป้าหมายข้างต้น โดยจัดรูปแบบเป็น JSON ดังนี้:

{
  "rules": [
    {
      "title": "",
      "detail": "",
      "condition": "",
      "prohibition": "",
      "risk_level": "",
      "source_page": "",
      "source_section": "",
      "evidence_text": "",
      "interpretation_note": ""
    }
  ],
  "missing_or_unclear_points": []
}

ข้อกำหนด:
- ห้ามเดาข้อมูลที่ไม่มีในเอกสาร
- ต้องอ้างอิงเลขหน้า
- ถ้าข้อมูลไม่ชัดเจนให้ใส่ใน missing_or_unclear_points
- ถ้าเอกสารไม่เกี่ยวข้องกับเป้าหมาย ให้ตอบว่าไม่พบข้อมูลที่เกี่ยวข้อง
```

### 15.3 Re-analysis Prompt หลัง Reject

```text
ผลลัพธ์ก่อนหน้าถูก Reviewer ปฏิเสธ

Comment จาก Reviewer:
{{review_comment}}

ผลลัพธ์เดิม:
{{previous_ai_result}}

เอกสารต้นทาง:
{{document_content}}

โปรดวิเคราะห์ใหม่โดย:
1. แก้ไขตาม comment ของ Reviewer
2. ระบุข้อมูลที่ตกหล่นจากรอบก่อนหน้า
3. ระบุเลขหน้าและ section ทุกข้อ
4. แยกสิ่งที่เป็นข้อกำหนด ข้อห้าม เงื่อนไข และข้อควรระวัง
5. ห้ามเพิ่มข้อมูลที่ไม่มีในเอกสาร
```

### 15.4 Compliance Check Prompt

```text
คุณคือ AI สำหรับตรวจสอบว่าสื่อหรือข้อมูลภายนอกสอดคล้องกับกฎระเบียบหรือไม่

ข้อมูลที่ต้องตรวจสอบ:
{{external_content}}

เอกสารอ้างอิงหลัก:
{{master_rulebook}}

โปรดวิเคราะห์ว่าเนื้อหานี้:
1. สอดคล้องกับกฎหรือไม่
2. เข้าข่ายละเมิดข้อใดหรือไม่
3. มีจุดกำกวมใดที่ต้องให้มนุษย์ตรวจสอบหรือไม่
4. ต้องอ้างอิง rule_id และเอกสารต้นทางทุกครั้ง
5. ถ้าไม่แน่ใจ ห้ามฟันธง ให้ระบุเป็น AMBIGUOUS พร้อมอธิบาย ambiguous_points
6. AI ไม่ควรตอบ NEED_HUMAN_REVIEW โดยตรง เพราะสถานะนี้เป็น workflow status ที่ระบบใช้หลัง route รายการ AMBIGUOUS เข้าคิว Reviewer

รูปแบบคำตอบ:
{
  "status": "COMPLIANT | NON_COMPLIANT | POTENTIAL_VIOLATION | AMBIGUOUS",
  "summary": "",
  "matched_rules": [],
  "ambiguous_points": [],
  "recommended_action": ""
}
```

### 15.5 Prompt Library และการใช้ Prompt ซ้ำ

ระบบควรมี `Prompt Library` สำหรับบันทึก prompt ที่ผู้ใช้สร้างไว้ และนำกลับมาใช้ซ้ำได้เรื่อย ๆ โดยไม่ต้องเขียน prompt ใหม่ทุกครั้ง Prompt ที่ใช้กับ AI analysis ต้องเป็นข้อมูลที่ version และ audit ได้ เพราะผลวิเคราะห์เอกสารต้องย้อนกลับมาตรวจสอบได้ว่าใช้ prompt ใด ใช้ AI model ใด และใช้ OCR text ชุดใดในการวิเคราะห์

ความเข้าใจล่าสุดของหน้า Prompt Library คือหน้านี้ไม่ใช่หน้า configuration สำหรับ provider และไม่ใช่ที่ให้ผู้ใช้พิมพ์ custom model เอง แต่เป็นหน้าสร้าง Template สำหรับงานวิเคราะห์เอกสาร โดยมี field หลักเพียง 4 ส่วน:
- `Name`: ชื่อ Template ที่ผู้ใช้เข้าใจง่าย เช่น `เทมเพลตสร้าง Rule Base จากเอกสารกำกับดูแลไทย`
- `AI Model`: dropdown ที่ backend ดึงรายการ model จาก OpenRouter แล้วส่งให้ frontend แบบ sanitized
- `Tags`: capsule selector สำหรับจัดหมวดหมู่ Template เช่น `กฎระเบียบไทย`, `Rule Base`, `Compliance`, `ธนาคารแห่งประเทศไทย`, `ประกาศ/หลักเกณฑ์`, `ความเสี่ยงสูง`, `การเปิดเผยข้อมูล`
- `Text`: เนื้อหา prompt ที่จะถูก version และใช้ render กับเอกสารจริง

สิ่งที่ไม่ควรอยู่ในฟอร์มหลักของหน้า Prompt Library:
- ไม่ควรมีช่อง `custom model` เพราะผู้ใช้ควรเลือกจาก dropdown ของ OpenRouter เพื่อหลีกเลี่ยง model ID ผิดรูปแบบ และเพื่อให้ cost/traceability จัดการได้จากระบบกลาง
- ไม่ควรให้ frontend อ่านหรือ hardcode model list จาก environment variable เช่น `AI_MODEL_OPTIONS`; รายการ model ต้องมาจาก backend ที่เรียก OpenRouter `/models`
- ไม่ควรบังคับ `domain` ใน UI หลัก เพราะ DocAI ต้องเป็น domain-agnostic และ tag เพียงพอสำหรับการจัดหมวดหมู่ในช่วงนี้
- ไม่ควรแสดง `variables` เป็นช่องหลักให้ผู้ใช้ทั่วไปแก้ เพราะ Rule Base extraction ใช้ตัวแปรมาตรฐาน `{{documentTitle}}` และ `{{ocrText}}`; ถ้าต้องรองรับตัวแปรขั้นสูงในอนาคตควรออกแบบเป็น advanced workflow ที่ version และ validate ได้

คำศัพท์หลัก:
- `Prompt Template`: record ระดับ library ที่บันทึกชื่อ, tags, status และ lifecycle ของ template
- `Prompt Template Version`: version ที่ immutable ของ prompt text, variables, ai_provider และ ai_model ที่เลือกไว้ ณ เวลาสร้าง version
- `Prompt Instance`: การนำ Prompt Template Version หนึ่งไป render และใช้รันจริงกับ DocumentVersion หรือ Document Group
- `Prompt Variables`: ตัวแปรที่ระบบเติมค่าให้ตอน render prompt เช่น `{{documentTitle}}` และ `{{ocrText}}`

ข้อมูลที่ควรเก็บใน Prompt Template:

```json
{
  "prompt_template_id": "uuid",
  "name": "เทมเพลตสร้าง Rule Base จากเอกสารกำกับดูแลไทย",
  "tags": ["กฎระเบียบไทย", "Rule Base", "Compliance"],
  "status": "ACTIVE",
  "created_by": "analyst_user_id",
  "updated_by": "analyst_user_id",
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

ข้อมูลที่ควรเก็บใน Prompt Template Version:

```json
{
  "prompt_template_version_id": "uuid",
  "prompt_template_id": "uuid",
  "version_number": 1,
  "status": "ACTIVE",
  "template_text": "ชื่อเอกสาร: {{documentTitle}}\n\nคุณคือ AI สำหรับอ่านเอกสารกำกับดูแล...",
  "variables": ["documentTitle", "ocrText"],
  "ai_provider": "openrouter",
  "ai_model": "openai/gpt-4o-mini",
  "created_by": "analyst_user_id",
  "created_at": "2026-05-20T10:00:00Z"
}
```

ข้อมูลที่ควรเก็บใน Prompt Instance:

```json
{
  "prompt_instance_id": "uuid",
  "prompt_template_version_id": "uuid",
  "document_version_id": "uuid",
  "group_id": "uuid_or_null",
  "rendered_prompt_hash": "sha256",
  "variables": {
    "documentTitle": "ประกาศธนาคารแห่งประเทศไทย...",
    "textLength": 48210
  },
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini",
  "created_at": "2026-05-20T10:05:00Z"
}
```

`PromptInstance` ไม่จำเป็นต้องเก็บ full rendered prompt เป็น plain text ใน database ถ้ามีข้อจำกัดด้าน privacy หรือ storage แต่ต้องเก็บ `rendered_prompt_hash`, variables metadata, provider/model และความสัมพันธ์กับ Prompt Template Version เพื่อให้ audit ตรวจย้อนกลับได้

Workflow การสร้าง Template:

```text
ผู้ใช้เปิดหน้า Prompt Library
-> กรอก Name
-> เลือก AI Model จาก dropdown ที่ backend ได้จาก OpenRouter
-> เลือก Tags จาก capsule selector
-> แก้ Text ของ prompt ภาษาไทย
-> ระบบสร้าง Prompt Template
-> ระบบสร้าง Prompt Template Version หมายเลข 1 พร้อม variables มาตรฐาน documentTitle และ ocrText
-> ระบบบันทึก ai_provider และ ai_model ไว้กับ Prompt Template Version
-> ระบบเขียน AuditLog สำหรับการสร้าง template/version
```

Workflow การแก้ Template ที่มีอยู่แล้ว:

```text
ผู้ใช้เลือก Template ที่มีอยู่
-> ดู version ปัจจุบันและ model ที่ version นั้นใช้
-> สร้าง New draft version พร้อมเลือก AI Model จาก dropdown
-> แก้ Text ของ prompt
-> ระบบสร้าง Prompt Template Version ใหม่ ไม่เขียนทับ version เก่า
-> Reviewer/Admin หรือ role ที่ได้รับสิทธิ์ activate version ใหม่
-> version เก่าถูกเปลี่ยนสถานะตาม policy เช่น DEPRECATED หรือคงไว้เพื่อ audit
```

ตัวอย่าง Prompt Text เริ่มต้นสำหรับ Rule Base extraction ภาษาไทย:

```text
ชื่อเอกสาร: {{documentTitle}}

คุณคือ AI สำหรับอ่านเอกสารกำกับดูแลและแปลงสาระสำคัญให้เป็น Rule Base สำหรับระบบตรวจสอบ Compliance

Rule Base หมายถึงชุดกฎที่ระบบสามารถนำไปใช้ตรวจสอบเนื้อหาอื่นได้ โดยแต่ละกฎต้องมีเงื่อนไขที่ทำให้กฎมีผล หน้าที่หรือข้อกำหนดที่ต้องปฏิบัติ ข้อห้าม ข้อยกเว้น ระดับความเสี่ยง และหลักฐานอ้างอิงจากเอกสารต้นทาง

ให้อ่าน OCR text แล้วสกัดเฉพาะข้อกำหนดที่นำไปใช้เป็นกฎได้จริง เช่น ข้อกำหนดเชิงบังคับ เงื่อนไขการอนุญาต หน้าที่ของผู้ประกอบธุรกิจ ข้อห้าม ระยะเวลา เอกสารประกอบ การเปิดเผยข้อมูล เกณฑ์ความเสี่ยง หรือข้อยกเว้น

ถ้าเอกสารไม่เกี่ยวข้องกับการสร้าง Rule Base ให้ตอบ outcome เป็น NOT_RELEVANT และอธิบายเหตุผลเป็นภาษาไทย

ต้องตอบเป็น JSON ที่ถูกต้องเท่านั้น ห้ามมีข้อความอื่นนอก JSON ค่า enum เช่น outcome และ riskLevel ให้คงเป็นภาษาอังกฤษเพื่อให้ระบบอ่านได้ แต่ข้อความอธิบายทั้งหมดต้องเป็นภาษาไทย

รูปแบบผลลัพธ์ที่ต้องการ:
{
  "outcome": "RULES_FOUND|NO_RULES_FOUND|NOT_RELEVANT",
  "summary": "สรุปภาษาไทยว่าเอกสารนี้เกี่ยวกับอะไรและพบข้อกำหนดประเภทใด",
  "confidence": 0.0,
  "rules": [
    {
      "ruleCode": "R-001",
      "title": "ชื่อกฎภาษาไทยแบบสั้นและชัดเจน",
      "description": "คำอธิบายกฎเป็นภาษาไทย",
      "condition": "เงื่อนไขที่ทำให้กฎนี้มีผลเป็นภาษาไทย",
      "obligation": "หน้าที่หรือสิ่งที่ต้องปฏิบัติเป็นภาษาไทย",
      "prohibition": "ข้อห้ามหรือข้อจำกัดเป็นภาษาไทย ถ้าไม่มีให้ใส่ null",
      "exception": "ข้อยกเว้นเป็นภาษาไทย ถ้าไม่มีให้ใส่ null",
      "riskLevel": "HIGH|MEDIUM|LOW|INFO",
      "sourceReferences": [
        {
          "page": 1,
          "quote": "ข้อความอ้างอิงจากเอกสารต้นทางเป็นภาษาไทย"
        }
      ]
    }
  ],
  "notRelevantReason": "เหตุผลภาษาไทยเมื่อ outcome เป็น NOT_RELEVANT หรือ null"
}

OCR text:
{{ocrText}}
```

ข้อกำหนดสำหรับ Prompt Library:
- Prompt Template ต้องมี `name`, `tags`, `status`, `created_by`, `created_at` และ `updated_at`
- Prompt Template Version ต้องมี `version_number`, `status`, `template_text`, `variables`, `ai_provider`, `ai_model`, `created_by` และ `created_at`
- เมื่อแก้ prompt ที่เคยถูกใช้งานแล้ว ต้องสร้าง version ใหม่ ไม่ควรเขียนทับ version เดิม
- AI Analysis Result ต้องอ้างอิงกลับไปยัง Prompt Instance และ Prompt Template Version เสมอ
- Prompt Version ต้องเก็บ `ai_provider` และ `ai_model` ที่เลือกไว้ เพื่อให้ Prompt Instance และ AI Analysis Result trace กลับได้ว่าใช้ model ใด ไม่ใช่พึ่งค่า global อย่างเดียว
- หน้า Prompt Library ต้องเลือก `AI Model` จากรายการ model ของ OpenRouter ผ่าน backend API แบบ sanitized ไม่ควรให้ frontend อ่าน secret หรือใช้รายการ model ที่ hardcode ใน environment variable
- ถ้า OpenRouter `/models` ใช้งานไม่ได้ backend ควร fallback เป็น model default จาก `AI_MODEL` เพียงรายการเดียว เพื่อให้ระบบยังสร้าง template ได้โดยไม่หลอกผู้ใช้ว่ามีรายการ model อื่นพร้อมใช้งาน
- Template ตัวอย่างต้องอธิบาย Rule Base เป็นภาษาไทย และกำหนดให้ผลลัพธ์เชิงเนื้อหาเป็นภาษาไทย โดยคงค่า enum ที่ระบบต้องอ่าน เช่น `outcome` และ `riskLevel` เป็นค่าคงที่ตาม contract
- Prompt Template สามารถใช้กับเอกสารเดี่ยวหรือ Document Group ได้
- Prompt Template เก่าที่ไม่ควรใช้แล้วควรเปลี่ยนสถานะเป็น `DEPRECATED` แทนการลบทิ้ง
- ระบบควรเก็บ usage history เพื่อดูว่า prompt ใดถูกใช้กับเอกสารใด ใช้ model ใด และให้ผลลัพธ์อย่างไร

สถานะของ Prompt Template และ Prompt Template Version:
- `DRAFT`: version หรือ template ที่ยังไม่ควรถูกใช้เป็น default ใน workflow จริง
- `ACTIVE`: version หรือ template ที่พร้อมใช้งานใน AI analysis
- `DEPRECATED`: version หรือ template ที่ไม่ควรเลือกใช้งานใหม่ แต่ต้องเก็บไว้เพื่อ trace ผลเก่า
- `ARCHIVED`: version หรือ template ที่ซ่อนจาก workflow ปกติ แต่ยังเก็บเพื่อ audit/history

### 15.6 AI Model และ Cost Policy

AI Model สำหรับ Prompt Library ต้องแยกระหว่าง default runtime configuration กับ model ที่ผู้ใช้เลือกใน Prompt Version

หลักการ:
- `AI_MODEL` ใน environment ใช้เป็น default และ fallback เท่านั้น ไม่ใช่ source ของ dropdown หลัก
- รายการ dropdown ของหน้า Prompt Library ต้องมาจาก OpenRouter `/models` ผ่าน backend API
- Backend เป็นผู้ถือ `OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER` และ `OPENROUTER_APP_TITLE`; frontend เห็นเฉพาะรายการ model ID ที่ sanitized แล้ว
- ไม่ใช้ `AI_MODEL_OPTIONS` หรือ environment variable ลักษณะเดียวกันเป็น model catalog เพราะทำให้รายการใน UI ไม่ตรงกับ provider จริงและดูแลยาก
- Prompt Template Version เก็บ `ai_provider` และ `ai_model` ที่เลือก ณ เวลาสร้าง version
- Prompt Instance และ AI Analysis Result ต้องเก็บ requested/actual provider/model เพื่อรองรับ audit, cost attribution และ debugging
- ถ้า primary provider ล้มเหลวและระบบใช้ fallback provider ผลลัพธ์ต้องบันทึก provider/model ที่ใช้จริง โดยยังคง trace กลับไปหา requested model จาก Prompt Version ได้

ข้อมูลที่ควรเก็บเพื่อรองรับการควบคุมค่าใช้จ่ายในอนาคต:
- model ที่ใช้
- requested model จาก Prompt Version
- actual model จาก provider response ถ้ามี
- provider ที่ใช้จริง
- prompt template version
- token usage
- latency
- ค่าใช้จ่ายโดยประมาณ
- success / failure ของ AI job

รายละเอียดเชิง implementation เช่น per-document token budget, budget cap รายเดือน, cache policy ของ OpenRouter model list, model allowlist/denylist หรือการ map model ไปยัง pricing tier ควรถูกแยกไปกำหนดใน technical design หรือ implementation plan ภายหลัง

## 16. สถานะของเอกสาร

- `UPLOADED`
- `DOWNLOADED`
- `PROCESSING`
- `OCR_PROCESSING`
- `OCR_COMPLETED`
- `OCR_PARTIAL`
- `OCR_FAILED`
- `AI_PENDING`
- `AI_PROCESSING`
- `AI_COMPLETED`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `FAILED`
- `ARCHIVED`

## 17. สถานะของ Website Scan

- `IDLE`
- `SCANNING`
- `COMPLETED`
- `FAILED`
- `PARTIAL_FAILED`

## 18. สถานะของ Compliance Check

- `PENDING`
- `PROCESSING`
- `COMPLIANT`
- `NON_COMPLIANT`
- `POTENTIAL_VIOLATION`
- `AMBIGUOUS`
- `NEED_HUMAN_REVIEW`
- `REJECTED`
- `APPROVED`
- `FAILED`

## 19. สถานะของ Batch Analysis Job

- `DRAFT`
- `QUEUED`
- `PROCESSING`
- `COMPLETED`
- `PARTIAL_FAILED`
- `CANCELLED`
- `FAILED`

คำอธิบายเพิ่มเติม:
- `DRAFT`: group ถูกสร้างแล้วแต่ยังไม่ส่งเข้าคิว
- `QUEUED`: group ถูกส่งเข้าคิวแล้ว แต่ยังไม่มีเอกสารที่ worker กำลังประมวลผล
- `PROCESSING`: worker กำลังประมวลผลเอกสารใน group อย่างน้อย 1 รายการ
- `COMPLETED`: เอกสารทั้งหมดใน group ประมวลผลเสร็จ
- `PARTIAL_FAILED`: เอกสารบางฉบับใน group ล้มเหลว แต่บางฉบับสำเร็จ
- `CANCELLED`: ผู้ใช้ยกเลิก group job แล้ว

## 20. สถานะของ Prompt Template

- `DRAFT`
- `ACTIVE`
- `DEPRECATED`
- `ARCHIVED`

## 21. หน้าจอที่ควรมีในระบบ Admin

### 21.1 Dashboard

แสดงภาพรวม เช่น:
- จำนวนเอกสารทั้งหมด
- เอกสารที่รอ OCR
- เอกสารที่มี OCR warning / partial OCR
- เอกสารที่รอ AI
- เอกสารที่รอรีวิว
- Document Group ที่กำลังประมวลผล
- AI Analysis Job ที่อยู่ใน queue
- Rulebook ที่ต้อง re-review จาก source document version ใหม่
- Compliance Check ที่มีความเสี่ยงสูง
- Website Source ที่ scan ล้มเหลว
- ค่าใช้จ่าย AI โดยประมาณ

### 21.2 Document Management

ใช้สำหรับ:
- ดูรายการเอกสาร
- Upload PDF
- ดู version
- ดู OCR text
- ดู OCR warning และ failed pages
- ดู AI result
- ดู review history
- ดาวน์โหลดเอกสารต้นฉบับ

### 21.3 Website Source Management

ใช้สำหรับ:
- เพิ่ม URL ที่ต้องการ scan
- ตั้งค่า crawler
- ตั้งค่า pagination limit และ scan depth
- ดู scan history
- ดู PDF ที่พบ
- ดูรายการประกาศ / หนังสือเวียนที่พบจาก source page
- ดู metadata เช่น ประเภท วันที่ เรื่อง สถานะ ภาษา และเอกสารเกี่ยวข้อง
- ดู PDF ที่ซ้ำ
- ดู PDF ที่มี version ใหม่

### 21.4 AI Analysis Workspace

ใช้สำหรับ:
- เลือกเอกสาร
- เลือก prompt template
- เลือก prompt template version
- ใช้ Prompt Template Version ที่ผ่าน Prompt Library เป็นหลัก ไม่ควรให้พิมพ์ adhoc custom prompt ใน workflow ปกติ
- แสดง AI provider/model ที่ version นั้นเลือกไว้ก่อน enqueue งาน
- รัน AI
- เลือก Document Group เพื่อ enqueue วิเคราะห์หลายเอกสาร
- ดู queue position และ progress รายเอกสาร
- ดูผลลัพธ์
- ส่งให้ reviewer

### 21.5 Prompt Library

ใช้สำหรับ:
- สร้าง Prompt Template ด้วย field หลัก `Name`, `AI Model`, `Tags` และ `Text`
- เลือก `AI Model` จาก dropdown ของ OpenRouter ที่ backend ส่งมา ไม่ใช่การพิมพ์ custom model เอง
- เลือก tags เป็น capsule selector เพื่อจัดหมวดหมู่ template
- สร้าง prompt text ภาษาไทยสำหรับ Rule Base extraction และกำหนดผลลัพธ์ภาษาไทย
- version prompt เมื่อมีการแก้ไข โดยสร้าง Prompt Template Version ใหม่เสมอ
- เปิด/ปิด prompt ด้วยสถานะ `ACTIVE` / `DEPRECATED`
- แสดง provider/model ที่ผูกกับแต่ละ version
- ดู usage history ของ prompt
- ดู token usage และค่าใช้จ่ายโดยประมาณต่อ prompt

### 21.6 Batch Analysis Queue

ใช้สำหรับ:
- สร้าง Document Group
- เพิ่มหรือลบเอกสารใน group ก่อนส่งเข้าคิว
- เลือก Prompt Template สำหรับ group
- ดูจำนวนไฟล์และจำนวนเอกสารใน group
- ส่ง group เข้าคิว AI Analysis
- ดู progress ราย group และรายเอกสาร
- cancel group job
- ดูรายการที่สำเร็จ ล้มเหลว หรือรอประมวลผล

### 21.7 Review Center

ใช้สำหรับ:
- ดูรายการที่รอ review
- Approve
- Reject
- Comment
- ดูรอบการ review
- เปรียบเทียบผลลัพธ์แต่ละรอบ

### 21.8 Master Rulebook

ใช้สำหรับ:
- สร้างเอกสารอ้างอิงหลัก
- รวม rules จากหลายเอกสาร
- จัดการ rule variants ตาม context
- แก้ไข rule
- ส่ง rulebook ให้ Reviewer approve
- publish rulebook หลังผ่าน approval
- version rulebook
- ดู rules ที่ต้อง re-review เมื่อ source document มี version ใหม่
- export เป็น PDF / Excel / JSON

### 21.9 Compliance Checker

ใช้สำหรับ:
- Upload รูปภาพ / PDF / ข้อความ / URL / social media post / screenshot
- เลือก approved Rule Extraction Report หรือ master rulebook version
- รันการตรวจสอบ
- ดูผลวิเคราะห์
- ดู rule ที่เกี่ยวข้อง
- ดูเหตุผลจาก AI
- ดูสถานะ `AMBIGUOUS` / `NEED_HUMAN_REVIEW`
- ส่ง review
- บันทึกผลตรวจและสร้าง Compliance Usage / Content Check Report
- แสดง notification outcome หลังผลตรวจสอบถูก approve

### 21.10 Report

ใช้สำหรับ:
- Document report
- AI report
- Review report
- Rule extraction / regulatory intelligence report
- Compliance check report
- Compliance usage / content check report
- User activity report
- Audit log
- Notification report
- Prompt usage report
- Batch analysis report

### 21.11 User & Role Management

ใช้สำหรับ:
- เพิ่ม user
- กำหนด role
- กำหนด permission
- ปิด/เปิด user
- ดู activity log

## 22. Infrastructure และ Data Architecture

ระบบควรแยกการจัดเก็บข้อมูลเชิงโครงสร้างออกจากการจัดเก็บไฟล์ binary อย่างชัดเจน โดยใช้ PostgreSQL สำหรับ metadata และ workflow state, MinIO สำหรับ object storage และ Prisma สำหรับ data access / migration / schema management

### 22.1 PostgreSQL

PostgreSQL ใช้สำหรับจัดเก็บข้อมูลที่มีโครงสร้างและต้อง query / join / audit ได้ เช่น:
- user, role, permission
- document metadata
- website source และ scan history
- file hash และ content hash
- document version
- Document Group / Batch Analysis Job
- queue state
- Prompt Template และ Prompt Instance
- OCR result metadata
- AI Analysis result metadata
- review history
- Master Rulebook, rule, rule variant และ source reference
- compliance check result
- notification log
- audit log

PostgreSQL ไม่ควรเก็บไฟล์ PDF หรือ binary artifact โดยตรง แต่ควรเก็บ object key, bucket name, hash, content type, file size และ metadata ที่ใช้ค้นหาไฟล์ใน MinIO

### 22.2 MinIO

MinIO ใช้สำหรับจัดเก็บไฟล์และ artifact ที่เป็น object storage เช่น:
- original PDF
- downloaded PDF จาก crawler
- page image ที่เกิดจาก PDF processing
- OCR text artifact
- searchable PDF ที่สร้างจาก OCRmyPDF
- external content media เช่น image, screenshot, PDF, uploaded file
- export file เช่น PDF / Excel / JSON report

Bucket ที่แนะนำสำหรับ MVP:
- `documents`: เก็บ original PDF และ downloaded PDF
- `ocr`: เก็บ OCR text, searchable PDF และ page images
- `external`: เก็บไฟล์ที่ใช้ใน Compliance Checker
- `exports`: เก็บไฟล์ export และ report ที่สร้างจากระบบ

ตัวอย่าง object key:

```text
documents/{document_id}/original.pdf
documents/{document_id}/versions/{version}/original.pdf
ocr/{document_id}/pages/page-001.png
ocr/{document_id}/text/ocr.txt
ocr/{document_id}/searchable/searchable.pdf
external/{check_id}/input/original-file
exports/{export_id}/report.xlsx
```

### 22.3 Prisma

Prisma ใช้เป็น data access layer, migration tool และ schema source of truth ของระบบ

บทบาทของ Prisma:
- กำหนด schema ของ database เป็น source of truth
- จัดการ database migration
- สร้าง type-safe client สำหรับ application และ worker
- ลดความผิดพลาดจาก raw SQL ในส่วน CRUD และ workflow state update
- ช่วยให้ entity สำคัญ เช่น Document, PromptTemplate, BatchAnalysisJob และ Review มี schema ที่ชัดเจนตั้งแต่ต้น

ข้อกำหนด:
- การเปลี่ยน schema ต้องผ่าน Prisma migration
- enum status หลักควรถูกกำหนดใน Prisma schema เพื่อให้ backend, worker และ report ใช้ค่าตรงกัน
- service layer ควรอ้างอิง Prisma model เป็นหลัก ไม่ควรกระจาย SQL logic ซ้ำหลายที่
- raw SQL สามารถใช้ได้เฉพาะกรณี reporting หรือ query ที่ซับซ้อน และควรแยกเป็นส่วนที่ตรวจสอบได้

### 22.4 Key Data Models ระดับ Design

Entity หลักที่ควรมีใน schema:

- `User`
- `Role`
- `Permission`
- `Document`
- `DocumentVersion`
- `DocumentSource`
- `WebsiteSource`
- `WebsiteScan`
- `DocumentGroup`
- `BatchAnalysisJob`
- `PromptTemplate`
- `PromptTemplateVersion`
- `PromptInstance`
- `OCRResult`
- `AIAnalysisJob`
- `AIAnalysisResult`
- `ReviewRound`
- `MasterRulebook`
- `Rule`
- `RuleVariant`
- `ComplianceCheck`
- `NotificationLog`
- `AuditLog`
- `StoredObject`

### 22.5 ความสัมพันธ์ระหว่าง Database และ Object Storage

ทุกไฟล์ที่เก็บใน MinIO ควรมี metadata ใน PostgreSQL ผ่าน entity เช่น `StoredObject`

ตัวอย่างข้อมูล StoredObject:

```json
{
  "object_id": "uuid",
  "bucket": "documents",
  "object_key": "documents/doc_123/original.pdf",
  "file_name": "original.pdf",
  "content_type": "application/pdf",
  "file_size": 2450000,
  "sha256": "...",
  "owner_type": "Document",
  "owner_id": "doc_123",
  "created_at": "2026-05-19T10:00:00Z"
}
```

แนวทางนี้ทำให้ระบบสามารถ:
- trace ไฟล์กลับไปยังเอกสารหรือ compliance check ได้
- ตรวจสอบ duplicate ด้วย hash ได้
- ลบหรือ archive object ได้อย่างมี audit trail
- ย้าย storage backend ในอนาคตได้ง่ายขึ้น

### 22.6 Queue และ Worker Architecture

สำหรับ MVP ระบบควรมี worker สำหรับงานที่ใช้เวลานาน เช่น OCR, AI analysis, crawler และ export report

งานที่ควรถูกส่งเข้า queue:
- PDF processing
- OCR processing
- AI analysis ต่อเอกสาร
- Batch Analysis Job ต่อ Document Group
- Compliance check
- report export

หลักการสำคัญ:
- Queue item ต้องมี id และ status ที่เก็บใน PostgreSQL
- Worker ต้อง update status อย่างสม่ำเสมอเพื่อให้ dashboard แสดง progress ได้
- Document Group ใช้ FIFO ภายใน group
- ถ้า group ถูก cancel worker ไม่ควรเริ่มเอกสารถัดไปใน group นั้น
- ผลลัพธ์ของ worker ต้องอ้างอิง StoredObject, PromptInstance และ AuditLog ได้

### 22.7 Frontend Styling Architecture

`front-end` ใช้ Tailwind CSS เป็น styling system หลักของ Next.js application เพื่อให้ทีมสามารถสร้าง admin workspace ที่สม่ำเสมอ ปรับแต่งได้เร็ว และควบคุม design tokens ได้จากจุดกลาง

แนวทางการใช้ Tailwind CSS:
- ใช้ Tailwind utility classes เป็น baseline ของ styling ในหน้าและ component
- ใช้ `globals.css` เฉพาะ Tailwind directives, CSS variables, theme tokens และ base styles ที่จำเป็น
- สร้าง reusable components สำหรับ pattern ที่ใช้ซ้ำ เช่น table, filter bar, status badge, review panel, queue progress และ action menu
- Component library ยังสามารถเลือกภายหลังได้ แต่ library นั้นต้องทำงานร่วมกับ Tailwind CSS และไม่แทนที่ Tailwind เป็น styling foundation
- หลีกเลี่ยง page-specific CSS files, CSS Modules หรือ styling framework อื่น เว้นแต่มีเหตุผลทาง integration ที่ชัดเจน

ดู frontend UI reference และ dashboard direction เพิ่มเติมที่ `Docs/Frontend Dashboard Design References.md`
