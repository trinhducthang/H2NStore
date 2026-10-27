package com.flowershop.delivery.service;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.config.AppProperties;
import com.flowershop.delivery.dto.DeliveryDtos.LocationResponse;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Đổi tọa độ GPS của khách thành địa chỉ giao hàng qua Nominatim (OpenStreetMap).
 * Dữ liệu OSM ở Việt Nam đã theo ĐVHC mới (Tỉnh/Thành -> Phường/Xã), vùng chưa cập nhật mới còn Quận/Huyện.
 * Chính sách Nominatim công cộng: tối đa 1 request/giây, User-Agent riêng, nên cache kết quả.
 */
@Slf4j
@Component
public class ReverseGeocoder {

    // Khung bao Việt Nam (rộng hơn một chút): ngoài vùng này không gọi Nominatim
    private static final double MIN_LAT = 8.0;
    private static final double MAX_LAT = 23.5;
    private static final double MIN_LNG = 102.0;
    private static final double MAX_LNG = 110.0;
    private static final int CACHE_SIZE = 500;

    /** Các key cấp hành chính của Nominatim, theo thứ tự từ nhỏ đến lớn như trong response */
    private static final Set<String> ADMIN_KEYS = Set.of("hamlet", "neighbourhood", "quarter", "suburb", "village",
            "town", "city_district", "district", "county", "municipality", "city", "state_district", "state");
    private static final List<String> WARD_PREFIXES = List.of("Phường ", "Xã ", "Thị trấn ", "Đặc khu ");
    private static final List<String> DISTRICT_PREFIXES = List.of("Quận ", "Huyện ", "Thị xã ", "Thành phố ");
    private static final List<String> PROVINCE_PREFIXES = List.of("Thành phố ", "Tỉnh ");

    record NominatimResult(String name, Map<String, String> address, String error) {
    }

    private final RestClient restClient;
    // Mọi khách dùng chung hạn mức 1 request/giây của Nominatim
    private final Bucket throttle = Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(1).refillGreedy(1, Duration.ofSeconds(1)).build())
            .build();
    // Tọa độ làm tròn ~11m -> địa chỉ; giới hạn số mục để không phình bộ nhớ
    private final Map<String, LocationResponse> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, LocationResponse> eldest) {
                    return size() > CACHE_SIZE;
                }
            });

    public ReverseGeocoder(RestClient.Builder builder, AppProperties props) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = builder
                .baseUrl(props.geocoding().baseUrl())
                .defaultHeader(HttpHeaders.USER_AGENT, props.geocoding().userAgent())
                .requestFactory(requestFactory)
                .build();
    }

    public LocationResponse reverse(double lat, double lng) {
        // Viết dạng !(...) để NaN cũng bị chặn
        if (!(lat >= MIN_LAT && lat <= MAX_LAT && lng >= MIN_LNG && lng <= MAX_LNG)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Vị trí nằm ngoài Việt Nam, vui lòng nhập địa chỉ");
        }
        String key = String.format(Locale.ROOT, "%.4f,%.4f", lat, lng);
        LocationResponse cached = cache.get(key);
        if (cached != null) {
            return cached;
        }
        LocationResponse location = toLocation(lat, lng, fetch(lat, lng));
        cache.put(key, location);
        return location;
    }

    private NominatimResult fetch(double lat, double lng) {
        try {
            if (!throttle.asBlocking().tryConsume(1, Duration.ofSeconds(3))) {
                throw new BusinessException(ErrorCode.GEOCODING_UNAVAILABLE);
            }
            NominatimResult result = restClient.get()
                    .uri(b -> b.path("/reverse")
                            .queryParam("format", "jsonv2")
                            .queryParam("addressdetails", 1)
                            .queryParam("zoom", 18)
                            .queryParam("accept-language", "vi")
                            .queryParam("lat", lat)
                            .queryParam("lon", lng)
                            .build())
                    .retrieve()
                    .body(NominatimResult.class);
            if (result == null) {
                throw new BusinessException(ErrorCode.GEOCODING_UNAVAILABLE);
            }
            return result;
        } catch (RestClientException e) {
            // Không log message: có URL chứa tọa độ của khách
            log.warn("Reverse geocode thất bại: {}",
                    e instanceof RestClientResponseException r ? r.getStatusCode() : e.getClass().getSimpleName());
            throw new BusinessException(ErrorCode.GEOCODING_UNAVAILABLE);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.GEOCODING_UNAVAILABLE);
        }
    }

    /**
     * Tách địa chỉ Nominatim thành số nhà + đường, phường/xã, quận/huyện, tỉnh/thành.
     * Key của Nominatim cho từng cấp không cố định ở Việt Nam (phường có thể là suburb, quarter hay city_district),
     * nên nhận diện cấp theo tiền tố tên: "Phường/Xã..." là cấp xã, "Quận/Huyện..." là cấp huyện cũ.
     */
    static LocationResponse toLocation(double lat, double lng, NominatimResult result) {
        Map<String, String> a = result.address();
        if (result.error() != null || a == null || !"vn".equalsIgnoreCase(a.get("country_code"))) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Không tìm được địa chỉ tại vị trí này, vui lòng nhập tay");
        }
        String province = firstNonBlank(a.get("state"), a.get("city"));
        String ward = null;
        String district = null;
        for (Map.Entry<String, String> e : a.entrySet()) {
            String value = e.getValue();
            if (!ADMIN_KEYS.contains(e.getKey()) || value == null || value.equals(province)) {
                continue;
            }
            if (ward == null && startsWithAny(value, WARD_PREFIXES)) {
                ward = value;
            } else if (district == null && startsWithAny(value, DISTRICT_PREFIXES)) {
                district = value;
            }
        }
        String road = a.get("road");
        String houseNumber = a.get("house_number");
        String street = road != null
                ? (houseNumber != null ? houseNumber + " " + road : road)
                : firstNonBlank(a.get("hamlet"), a.get("neighbourhood"), result.name());
        if (street != null && (street.equals(ward) || street.equals(district))) {
            street = null;
        }
        if (street == null && ward == null && district == null && province == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Không tìm được địa chỉ tại vị trí này, vui lòng nhập tay");
        }
        return new LocationResponse(lat, lng, street, ward, district, stripPrefix(province));
    }

    /** "Thành phố Hồ Chí Minh" -> "Hồ Chí Minh", "Tỉnh Ninh Bình" -> "Ninh Bình" (giống danh sách tỉnh ở frontend) */
    private static String stripPrefix(String province) {
        if (province == null) {
            return null;
        }
        for (String prefix : PROVINCE_PREFIXES) {
            if (province.startsWith(prefix)) {
                return province.substring(prefix.length());
            }
        }
        return province;
    }

    private static boolean startsWithAny(String value, List<String> prefixes) {
        return prefixes.stream().anyMatch(value::startsWith);
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }
}
