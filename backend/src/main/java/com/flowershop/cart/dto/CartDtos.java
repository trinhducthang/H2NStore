package com.flowershop.cart.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class CartDtos {

    private CartDtos() {
    }

    public record AddCartItemRequest(@NotNull Long variantId, @NotNull @Min(1) @Max(20) Integer quantity) {
    }

    public record UpdateCartItemRequest(@NotNull @Min(1) @Max(20) Integer quantity) {
    }

    public record MergeCartRequest(@NotNull @Size(max = 50) List<@Valid @NotNull AddCartItemRequest> items) {
    }

    /** available=false: sản phẩm đã ngừng bán / hết hàng, frontend nên báo và cho xóa. */
    public record CartItemResponse(Long id, Long variantId, Long productId, String productName, String productSlug,
                                   String variantName, String thumbnailUrl, long unitPrice, Long originalPrice,
                                   int quantity, long lineTotal, int stock, boolean available) {
    }

    public record CartResponse(List<CartItemResponse> items, long subtotal, int totalQuantity) {
    }
}
