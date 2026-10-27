package com.flowershop.delivery.service;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.delivery.dto.DeliveryDtos.LocationResponse;
import com.flowershop.delivery.service.ReverseGeocoder.NominatimResult;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReverseGeocoderTest {

    /** Giữ thứ tự key như JSON của Nominatim (từ nhỏ đến lớn) */
    private static Map<String, String> address(String... keyValues) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put(keyValues[i], keyValues[i + 1]);
        }
        return map;
    }

    @Test
    void parsesNewAdministrativeUnits() {
        // Response thật của Nominatim tại TP.HCM, đã theo ĐVHC mới
        NominatimResult result = new NominatimResult("Sở Nông nghiệp và Môi trường Thành phố Hồ Chí Minh",
                address("office", "Sở Nông nghiệp và Môi trường Thành phố Hồ Chí Minh", "house_number", "63",
                        "road", "Đường Lý Tự Trọng", "neighbourhood", "Khu phố 3", "suburb", "Phường Sài Gòn",
                        "city", "Thành phố Hồ Chí Minh", "postcode", "71016", "country", "Việt Nam",
                        "country_code", "vn"),
                null);

        LocationResponse location = ReverseGeocoder.toLocation(10.777, 106.7006, result);

        assertThat(location.addressLine()).isEqualTo("63 Đường Lý Tự Trọng");
        assertThat(location.ward()).isEqualTo("Phường Sài Gòn");
        assertThat(location.district()).isNull();
        assertThat(location.city()).isEqualTo("Hồ Chí Minh");
    }

    @Test
    void findsWardUnderAnyNominatimKey() {
        // Hà Nội: phường/xã nằm ở city_district, không có số nhà
        NominatimResult result = new NominatimResult(null,
                address("road", "Đường N16", "industrial", "Khu Công nghệ cao Hòa Lạc", "city_district", "Xã Hòa Lạc",
                        "city", "Hà Nội", "country_code", "vn"),
                null);

        LocationResponse location = ReverseGeocoder.toLocation(21.0122, 105.5269, result);

        assertThat(location.addressLine()).isEqualTo("Đường N16");
        assertThat(location.ward()).isEqualTo("Xã Hòa Lạc");
        assertThat(location.city()).isEqualTo("Hà Nội");
    }

    @Test
    void keepsOldDistrictWhereMapIsNotUpdated() {
        NominatimResult result = new NominatimResult("Thôn Đông",
                address("hamlet", "Thôn Đông", "village", "Xã Yên Bằng", "county", "Huyện Ý Yên",
                        "state", "Tỉnh Nam Định", "country_code", "vn"),
                null);

        LocationResponse location = ReverseGeocoder.toLocation(20.3, 106.0, result);

        assertThat(location.addressLine()).isEqualTo("Thôn Đông");
        assertThat(location.ward()).isEqualTo("Xã Yên Bằng");
        assertThat(location.district()).isEqualTo("Huyện Ý Yên");
        assertThat(location.city()).isEqualTo("Nam Định");
    }

    @Test
    void rejectsUnknownOrForeignLocation() {
        assertThatThrownBy(() -> ReverseGeocoder.toLocation(21, 105, new NominatimResult(null, null,
                "Unable to geocode"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> ReverseGeocoder.toLocation(22.9, 104.9, new NominatimResult(null,
                address("city", "Hà Giang", "country_code", "cn"), null))).isInstanceOf(BusinessException.class);
    }
}
