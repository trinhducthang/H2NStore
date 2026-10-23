package com.flowershop.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * Lưu file. Bản đầu dùng thư mục local; sau này thêm CloudinaryStorageService/S3StorageService
 * và chọn bằng app.storage.type mà không phải sửa code nghiệp vụ.
 */
public interface StorageService {

    /** Lưu ảnh (đã kiểm tra định dạng jpg/png/webp và dung lượng). */
    StoredFile storeImage(MultipartFile file, String folder);

    void delete(String key);

    record StoredFile(String key, String url) {
    }
}
