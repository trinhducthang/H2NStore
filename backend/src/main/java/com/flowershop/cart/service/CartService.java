package com.flowershop.cart.service;

import com.flowershop.cart.dto.CartDtos.AddCartItemRequest;
import com.flowershop.cart.dto.CartDtos.CartItemResponse;
import com.flowershop.cart.dto.CartDtos.CartResponse;
import com.flowershop.cart.entity.Cart;
import com.flowershop.cart.entity.CartItem;
import com.flowershop.cart.repository.CartRepository;
import com.flowershop.catalog.entity.Product;
import com.flowershop.catalog.entity.ProductVariant;
import com.flowershop.catalog.service.InventoryService;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CartService {

    private static final int MAX_QUANTITY = 20;
    private static final int MAX_LINES = 20;

    private final CartRepository cartRepository;
    private final InventoryService inventoryService;

    @Transactional(readOnly = true)
    public CartResponse get(Long userId) {
        return cartRepository.findByUserId(userId).map(CartService::toResponse)
                .orElse(new CartResponse(List.of(), 0, 0));
    }

    @Transactional
    public CartResponse addItem(Long userId, AddCartItemRequest req) {
        Cart cart = getOrCreate(userId);
        ProductVariant variant = inventoryService.getPurchasableVariant(req.variantId());
        add(cart, variant, req.quantity());
        return toResponse(cartRepository.save(cart));
    }

    @Transactional
    public CartResponse updateItem(Long userId, Long itemId, int quantity) {
        Cart cart = getOrCreate(userId);
        CartItem item = findItem(cart, itemId);
        item.setQuantity(Math.min(quantity, MAX_QUANTITY));
        return toResponse(cart);
    }

    @Transactional
    public CartResponse removeItem(Long userId, Long itemId) {
        Cart cart = getOrCreate(userId);
        cart.getItems().remove(findItem(cart, itemId));
        return toResponse(cart);
    }

    /** Gộp giỏ localStorage của khách vãng lai vào giỏ server sau khi đăng nhập; bỏ qua sản phẩm không còn bán. */
    @Transactional
    public CartResponse merge(Long userId, List<AddCartItemRequest> items) {
        Cart cart = getOrCreate(userId);
        Set<Long> ids = new HashSet<>();
        items.forEach(i -> ids.add(i.variantId()));
        Map<Long, ProductVariant> variants = inventoryService.findVariants(ids);
        for (AddCartItemRequest item : items) {
            ProductVariant variant = variants.get(item.variantId());
            if (variant == null || !variant.isActive() || !variant.getProduct().isPurchasable()) {
                continue;
            }
            if (findByVariant(cart, variant.getId()).isEmpty() && cart.getItems().size() >= MAX_LINES) {
                break;
            }
            add(cart, variant, item.quantity());
        }
        return toResponse(cartRepository.save(cart));
    }

    /** Xóa khỏi giỏ các biến thể vừa đặt hàng. */
    @Transactional
    public void removeVariants(Long userId, Collection<Long> variantIds) {
        cartRepository.findByUserId(userId).ifPresent(cart ->
                cart.getItems().removeIf(i -> variantIds.contains(i.getVariant().getId())));
    }

    private void add(Cart cart, ProductVariant variant, int quantity) {
        Optional<CartItem> existing = findByVariant(cart, variant.getId());
        if (existing.isPresent()) {
            CartItem item = existing.get();
            item.setQuantity(Math.min(item.getQuantity() + quantity, MAX_QUANTITY));
            return;
        }
        if (cart.getItems().size() >= MAX_LINES) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Giỏ hàng tối đa " + MAX_LINES + " sản phẩm");
        }
        CartItem item = new CartItem();
        item.setCart(cart);
        item.setVariant(variant);
        item.setQuantity(Math.min(quantity, MAX_QUANTITY));
        cart.getItems().add(item);
    }

    private Cart getOrCreate(Long userId) {
        return cartRepository.findByUserId(userId).orElseGet(() -> {
            Cart cart = new Cart();
            cart.setUserId(userId);
            return cartRepository.save(cart);
        });
    }

    private static Optional<CartItem> findByVariant(Cart cart, Long variantId) {
        return cart.getItems().stream().filter(i -> Objects.equals(i.getVariant().getId(), variantId)).findFirst();
    }

    private static CartItem findItem(Cart cart, Long itemId) {
        return cart.getItems().stream().filter(i -> Objects.equals(i.getId(), itemId)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("sản phẩm trong giỏ"));
    }

    private static CartResponse toResponse(Cart cart) {
        List<CartItemResponse> items = cart.getItems().stream().map(CartService::toItem).toList();
        long subtotal = items.stream().filter(CartItemResponse::available).mapToLong(CartItemResponse::lineTotal).sum();
        int totalQuantity = items.stream().mapToInt(CartItemResponse::quantity).sum();
        return new CartResponse(items, subtotal, totalQuantity);
    }

    private static CartItemResponse toItem(CartItem item) {
        ProductVariant v = item.getVariant();
        Product p = v.getProduct();
        boolean available = v.isActive() && p.isPurchasable() && v.getStock() >= item.getQuantity();
        long unitPrice = v.effectivePrice();
        return new CartItemResponse(item.getId(), v.getId(), p.getId(), p.getName(), p.getSlug(), v.getName(),
                p.thumbnailUrl(), unitPrice, v.getSalePrice() != null ? v.getPrice() : null, item.getQuantity(),
                unitPrice * item.getQuantity(), v.getStock(), available);
    }
}
