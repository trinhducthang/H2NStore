package com.flowershop.storage;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Kiểm tra video theo magic bytes (không tin Content-Type do client gửi).
 * Không chuyển mã (server ít RAM), nên chỉ nhận định dạng trình duyệt phát được.
 */
public final class VideoValidator {

    public static final long MAX_SIZE = 30L * 1024 * 1024;

    /** Ảnh HEIF/AVIF cũng bắt đầu bằng hộp "ftyp", không được coi là video */
    private static final Set<String> IMAGE_BRANDS = Set.of("heic", "heix", "heim", "heis", "hevc", "hevx",
            "mif1", "msf1", "avif", "avis");

    private VideoValidator() {
    }

    /** @return phần mở rộng chuẩn: mp4 | mov | webm */
    public static String detectExtension(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_SIZE) {
            throw new BusinessException(ErrorCode.INVALID_VIDEO);
        }
        byte[] head = new byte[12];
        try (InputStream in = file.getInputStream()) {
            if (in.readNBytes(head, 0, head.length) < head.length) {
                throw new BusinessException(ErrorCode.INVALID_VIDEO);
            }
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INVALID_VIDEO);
        }
        String ext = extensionOf(head);
        if (ext == null) {
            throw new BusinessException(ErrorCode.INVALID_VIDEO);
        }
        return ext;
    }

    /** @return mp4 | mov | webm, hoặc null nếu 12 byte đầu không phải video được hỗ trợ */
    public static String extensionOf(byte[] head) {
        if (head.length < 12) {
            return null;
        }
        // MP4/MOV: hộp đầu tiên là "ftyp", 4 byte sau là brand
        if (head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p') {
            String brand = new String(head, 8, 4, StandardCharsets.US_ASCII);
            if (IMAGE_BRANDS.contains(brand)) {
                return null;
            }
            return "qt  ".equals(brand) ? "mov" : "mp4";
        }
        // WebM (EBML)
        if ((head[0] & 0xFF) == 0x1A && (head[1] & 0xFF) == 0x45 && (head[2] & 0xFF) == 0xDF
                && (head[3] & 0xFF) == 0xA3) {
            return "webm";
        }
        return null;
    }
}
