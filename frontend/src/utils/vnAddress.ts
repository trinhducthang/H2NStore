/** Tỉnh/thành và phường/xã sau sắp xếp ĐVHC 01/07/2025 (không còn cấp huyện) */
export interface ProvinceWards {
  name: string;
  wards: string[];
}

let provincesPromise: Promise<ProvinceWards[]> | null = null;

/**
 * File tĩnh public/data/vn-wards.json (tạo bằng npm run update-wards), chỉ tải khi mở form địa chỉ
 * và dùng chung cho các lần mở sau. Lỗi thì lần sau tải lại.
 */
export function loadProvinces(): Promise<ProvinceWards[]> {
  provincesPromise ??= fetch('/data/vn-wards.json').then((res) => {
    if (!res.ok) throw new Error('Không tải được danh sách phường/xã');
    return res.json() as Promise<ProvinceWards[]>;
  });
  provincesPromise.catch(() => {
    provincesPromise = null;
  });
  return provincesPromise;
}

/** "Phường Ba Đình" -> "phuong ba dinh": tìm kiếm không phân biệt dấu, hoa thường */
export function foldVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}
