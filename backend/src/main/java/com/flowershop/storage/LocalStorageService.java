package com.flowershop.storage;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private final Path root;
    private final String publicUrl;

    public LocalStorageService(AppProperties props) {
        this.root = Path.of(props.storage().localDir()).toAbsolutePath().normalize();
        this.publicUrl = props.storage().publicUrl().replaceAll("/+$", "");
    }

    @Override
    public StoredFile storeImage(MultipartFile file, String folder) {
        return store(file, folder, ImageValidator.detectExtension(file));
    }

    @Override
    public StoredFile storeVideo(MultipartFile file, String folder) {
        return store(file, folder, VideoValidator.detectExtension(file));
    }

    private StoredFile store(MultipartFile file, String folder, String ext) {
        LocalDate today = LocalDate.now();
        String key = "%s/%d/%02d/%s.%s".formatted(folder, today.getYear(), today.getMonthValue(),
                UUID.randomUUID(), ext);
        Path target = resolve(key);
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(target.getParent());
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Không lưu được file {}", key, e);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
        return new StoredFile(key, publicUrl + "/" + key);
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            log.warn("Không xóa được file {}: {}", key, e.getMessage());
        }
    }

    /** Chặn path traversal (../) */
    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST);
        }
        return path;
    }
}
