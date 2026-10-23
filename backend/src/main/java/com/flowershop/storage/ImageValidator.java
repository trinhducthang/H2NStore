package com.flowershop.storage;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

/**
 * Kiểm tra ảnh theo magic bytes (không tin Content-Type do client gửi).
 */
public final class ImageValidator {

    public static final long MAX_SIZE = 5L * 1024 * 1024;

    private ImageValidator() {
    }

    /** @return phần mở rộng chuẩn: jpg | png | webp */
    public static String detectExtension(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_SIZE) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }
        byte[] head = new byte[12];
        try (InputStream in = file.getInputStream()) {
            if (in.readNBytes(head, 0, head.length) < head.length) {
                throw new BusinessException(ErrorCode.INVALID_FILE);
            }
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INVALID_FILE);
        }
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if ((head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
            return "png";
        }
        if (head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
            return "webp";
        }
        throw new BusinessException(ErrorCode.INVALID_FILE);
    }
}
