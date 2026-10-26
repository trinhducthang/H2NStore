// Tải danh sách tỉnh/thành và phường/xã (sau sắp xếp ĐVHC 01/07/2025: 34 tỉnh, không còn cấp huyện)
// từ provinces.open-api.vn rồi ghi thành file tĩnh cho form địa chỉ: public/data/vn-wards.json.
// Chạy lại khi có thay đổi đơn vị hành chính: npm run update-wards
import { writeFile, mkdir } from 'node:fs/promises';

const SOURCE = 'https://provinces.open-api.vn/api/v2/?depth=2';
const OUT = new URL('../public/data/vn-wards.json', import.meta.url);

/** Khóa sắp xếp: bỏ "Phường/Xã/Đặc khu", bỏ dấu */
const sortKey = (name) =>
  name
    .replace(/^(Phường|Xã|Đặc khu|Thị trấn)\s+/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} -> HTTP ${res.status}`);
const provinces = await res.json();

const data = provinces
  .map((p) => ({
    // "Thành phố Hà Nội" -> "Hà Nội" (khớp giá trị city đang lưu trong địa chỉ)
    name: p.name.replace(/^(Thành phố|Tỉnh)\s+/, ''),
    wards: p.wards.map((w) => w.name).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
  }))
  .sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));

const wardCount = data.reduce((n, p) => n + p.wards.length, 0);
if (data.length < 30 || wardCount < 3000) throw new Error(`Dữ liệu bất thường: ${data.length} tỉnh, ${wardCount} phường/xã`);

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data));
console.log(`Đã ghi ${data.length} tỉnh/thành, ${wardCount} phường/xã -> public/data/vn-wards.json`);
