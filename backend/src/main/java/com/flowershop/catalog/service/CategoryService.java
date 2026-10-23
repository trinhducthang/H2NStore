package com.flowershop.catalog.service;

import com.flowershop.catalog.dto.CatalogDtos.CategoryRequest;
import com.flowershop.catalog.dto.CatalogDtos.CategoryResponse;
import com.flowershop.catalog.entity.Category;
import com.flowershop.catalog.entity.CategoryType;
import com.flowershop.catalog.repository.CategoryRepository;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.SlugUtils;
import com.flowershop.config.CacheConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    /** Cây danh mục đang hoạt động, lọc theo type (null = tất cả). */
    @Cacheable(cacheNames = CacheConfig.CATEGORIES, key = "#type == null ? 'ALL' : #type.name()")
    @Transactional(readOnly = true)
    public List<CategoryResponse> publicTree(CategoryType type) {
        List<Category> all = categoryRepository.findAllByOrderByTypeAscSortOrderAscIdAsc().stream()
                .filter(Category::isActive)
                .filter(c -> type == null || c.getType() == type)
                .toList();
        return buildTree(all);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> adminList() {
        return buildTree(categoryRepository.findAllByOrderByTypeAscSortOrderAscIdAsc());
    }

    @Transactional(readOnly = true)
    public List<Category> findAllById(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Category> found = categoryRepository.findAllById(ids);
        if (found.size() != ids.stream().distinct().count()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Có danh mục không tồn tại");
        }
        return found;
    }

    @CacheEvict(cacheNames = CacheConfig.CATEGORIES, allEntries = true)
    @Transactional
    public CategoryResponse create(CategoryRequest req) {
        Category category = new Category();
        apply(category, req);
        return toResponse(categoryRepository.save(category), List.of());
    }

    @CacheEvict(cacheNames = CacheConfig.CATEGORIES, allEntries = true)
    @Transactional
    public CategoryResponse update(Long id, CategoryRequest req) {
        Category category = get(id);
        if (Objects.equals(req.parentId(), id)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Danh mục cha không hợp lệ");
        }
        apply(category, req);
        return toResponse(category, List.of());
    }

    @CacheEvict(cacheNames = CacheConfig.CATEGORIES, allEntries = true)
    @Transactional
    public void delete(Long id) {
        Category category = get(id);
        if (categoryRepository.existsByParentId(id)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Danh mục còn danh mục con, hãy xóa danh mục con trước");
        }
        // Liên kết product_categories bị xóa theo ON DELETE CASCADE
        categoryRepository.delete(category);
    }

    private Category get(Long id) {
        return categoryRepository.findById(id).orElseThrow(() -> BusinessException.notFound("danh mục"));
    }

    private void apply(Category category, CategoryRequest req) {
        String slug = req.slug() != null ? req.slug() : SlugUtils.slugify(req.name());
        boolean taken = category.getId() == null ? categoryRepository.existsBySlug(slug)
                : categoryRepository.existsBySlugAndIdNot(slug, category.getId());
        if (taken) {
            throw new BusinessException(ErrorCode.DUPLICATE, "Slug danh mục đã tồn tại");
        }
        if (req.parentId() != null) {
            Category parent = get(req.parentId());
            if (parent.getParentId() != null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Chỉ hỗ trợ danh mục 2 cấp");
            }
        }
        category.setName(req.name());
        category.setSlug(slug);
        category.setType(req.type());
        category.setParentId(req.parentId());
        category.setSortOrder(req.sortOrder() != null ? req.sortOrder() : 0);
        category.setActive(req.active() == null || req.active());
    }

    private static List<CategoryResponse> buildTree(List<Category> categories) {
        Map<Long, List<Category>> childrenByParent = new LinkedHashMap<>();
        for (Category c : categories) {
            if (c.getParentId() != null) {
                childrenByParent.computeIfAbsent(c.getParentId(), k -> new ArrayList<>()).add(c);
            }
        }
        return categories.stream()
                .filter(c -> c.getParentId() == null)
                .map(c -> toResponse(c, childrenByParent.getOrDefault(c.getId(), List.of()).stream()
                        .map(child -> toResponse(child, List.of())).toList()))
                .toList();
    }

    private static CategoryResponse toResponse(Category c, List<CategoryResponse> children) {
        return new CategoryResponse(c.getId(), c.getName(), c.getSlug(), c.getType(), c.getParentId(),
                c.getSortOrder(), c.isActive(), children);
    }
}
