import { catalogApi } from '../api/catalog';
import type { LocationAddress } from '../api/types';

/** Theo GeolocationPositionError.code: 1 = bị chặn quyền, 2 = không xác định được, 3 = quá thời gian */
const POSITION_ERRORS: Record<number, string> = {
  1: 'Bạn đã chặn quyền truy cập vị trí. Hãy cho phép trong cài đặt trình duyệt rồi thử lại.',
  2: 'Không xác định được vị trí. Hãy bật định vị (GPS) rồi thử lại.',
  3: 'Lấy vị trí quá lâu, vui lòng thử lại.',
};

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    // Trình duyệt chỉ cho dùng định vị trên https (hoặc localhost)
    if (!window.isSecureContext) {
      reject(new Error('Chỉ lấy được vị trí khi mở trang bằng https://. Vui lòng nhập địa chỉ.'));
      return;
    }
    if (!('geolocation' in navigator)) {
      reject(new Error('Trình duyệt không hỗ trợ lấy vị trí. Vui lòng nhập địa chỉ.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(new Error(POSITION_ERRORS[err.code] ?? 'Không lấy được vị trí, vui lòng thử lại.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/** Tọa độ GPS của trình duyệt -> backend đổi thành địa chỉ. accuracy: bán kính sai số (mét). */
export async function locateCurrentAddress(): Promise<{ address: LocationAddress; accuracy: number }> {
  const { coords } = await currentPosition();
  const address = await catalogApi.reverseGeocode(coords.latitude, coords.longitude);
  return { address, accuracy: coords.accuracy };
}
