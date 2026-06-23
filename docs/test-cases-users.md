# Test Cases — หน้าจัดการผู้ใช้ (UsersView)

## สร้างผู้ใช้ใหม่

| # | Test Case | Input | Expected | ผล |
|---|-----------|-------|----------|-----|
| 1 | ฟอร์มว่างทั้งหมด กดบันทึก | email='', password='', confirm='' | แสดง inline error "กรุณาระบุอีเมล" + "กรุณาระบุรหัสผ่าน", ฟอร์มยังอยู่ ไม่ค้าง | ✅ |
| 2 | Email ผิด format | email='not-an-email' | แสดง "รูปแบบอีเมลไม่ถูกต้อง" ขอบ input เป็นสีแดง | ✅ |
| 3 | Password สั้นกว่า 6 ตัว | password='123' | แสดง "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" | ✅ |
| 4 | Password ไม่ตรงกัน | password='123456', confirm='654321' | แสดง "รหัสผ่านไม่ตรงกัน" | ✅ |
| 5 | หลาย error พร้อมกัน | email ผิด + password สั้น + ไม่ตรง | แสดง 3 errors inline ทั้งหมด | ✅ |
| 6 | Email ซ้ำ (API error) | email='admin@smartoffice.com' ถูกใช้แล้ว | Modal แสดง "อีเมลนี้ถูกใช้งานแล้ว" + ปุ่ม "ปิด" กดออกได้ | ✅ |
| 7 | กดปุ่ม "ปิด" หลัง error | กดปุ่ม "ปิด" ใน error modal | Modal ปิดสำเร็จ กลับหน้าจัดการผู้ใช้ | ✅ |
| 8 | ข้อมูลถูกต้องทั้งหมด | email ใหม่ + password 6+ ตัว + confirm ตรง | Loading 2 วิ → "บันทึกสำเร็จ" → modal ปิด → user ใหม่แสดงในตาราง | ✅ |
| 9 | กรอก error แล้วแก้ไข | กรอก email ผิด → error แสดง → แก้ email ถูก | error หายทันทีเมื่อเริ่มพิมพ์แก้ (input event clear error) | ✅ |

## แก้ไขผู้ใช้

| # | Test Case | Input | Expected | ผล |
|---|-----------|-------|----------|-----|
| 10 | แก้ไขโดยไม่เปลี่ยน password | เปลี่ยนชื่อ + กดบันทึก | Loading → "แก้ไขสำเร็จ" (ไม่ต้องใส่ password) | ✅ |
| 11 | กดเปลี่ยน password แต่ไม่กรอก | toggle password on → กดบันทึก | บันทึกได้ปกติ (password field ว่าง = ไม่เปลี่ยน) | ✅ |
| 12 | กดเปลี่ยน password กรอกสั้น | password='123' | แสดง "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" | ✅ |
| 13 | กดเปลี่ยน password ไม่ตรง | password='123456', confirm='654321' | แสดง "รหัสผ่านไม่ตรงกัน" | ✅ |
| 14 | กดยกเลิกเปลี่ยน password | toggle on → toggle off | password inputs หาย + ค่าถูก clear | ✅ |

## Modal Behavior

| # | Test Case | Expected | ผล |
|---|-----------|----------|-----|
| 15 | Validation error ไม่เข้า modal loading | ฟอร์มยังอยู่ + inline errors แสดง | ✅ |
| 16 | API error แสดง modal result + มีปุ่มปิด | error icon + ข้อความ + ปุ่ม "ปิด" | ✅ |
| 17 | API error auto-close หลัง 3 วินาที | modal ปิดอัตโนมัติ | ✅ |
| 18 | Success auto-close หลัง 1.5 วินาที | modal ปิดอัตโนมัติ | ✅ |
| 19 | กดยกเลิกปิด modal ได้ตลอด | ปุ่มยกเลิกทำงาน | ✅ |
| 20 | Double-click ป้องกัน | ปุ่มบันทึก disabled ระหว่าง saving | ✅ |

## ลบผู้ใช้

| # | Test Case | Expected | ผล |
|---|-----------|----------|-----|
| 21 | กดลบ → modal ยืนยัน | แสดง email ที่จะลบ + ปุ่มยกเลิก/ลบ | ✅ |
| 22 | กดยืนยันลบ | Loading → user หายจากตาราง | ✅ |
| 23 | กดยกเลิก | modal ปิด ไม่ลบ | ✅ |
