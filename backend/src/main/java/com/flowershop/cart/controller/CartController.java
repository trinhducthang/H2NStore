package com.flowershop.cart.controller;

import com.flowershop.cart.dto.CartDtos.AddCartItemRequest;
import com.flowershop.cart.dto.CartDtos.CartResponse;
import com.flowershop.cart.dto.CartDtos.MergeCartRequest;
import com.flowershop.cart.dto.CartDtos.UpdateCartItemRequest;
import com.flowershop.cart.service.CartService;
import com.flowershop.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Cart")
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public CartResponse get(@AuthenticationPrincipal UserPrincipal me) {
        return cartService.get(me.id());
    }

    @PostMapping("/items")
    public CartResponse add(@AuthenticationPrincipal UserPrincipal me, @Valid @RequestBody AddCartItemRequest req) {
        return cartService.addItem(me.id(), req);
    }

    @PatchMapping("/items/{id}")
    public CartResponse update(@AuthenticationPrincipal UserPrincipal me, @PathVariable Long id,
                               @Valid @RequestBody UpdateCartItemRequest req) {
        return cartService.updateItem(me.id(), id, req.quantity());
    }

    @DeleteMapping("/items/{id}")
    public CartResponse remove(@AuthenticationPrincipal UserPrincipal me, @PathVariable Long id) {
        return cartService.removeItem(me.id(), id);
    }

    @PostMapping("/merge")
    public CartResponse merge(@AuthenticationPrincipal UserPrincipal me, @Valid @RequestBody MergeCartRequest req) {
        return cartService.merge(me.id(), req.items());
    }
}
