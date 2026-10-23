package com.flowershop.user.controller;

import com.flowershop.security.UserPrincipal;
import com.flowershop.user.dto.UserDtos.AddressRequest;
import com.flowershop.user.dto.UserDtos.AddressResponse;
import com.flowershop.user.dto.UserDtos.ChangePasswordRequest;
import com.flowershop.user.dto.UserDtos.UpdateProfileRequest;
import com.flowershop.user.dto.UserDtos.UserResponse;
import com.flowershop.user.service.AddressService;
import com.flowershop.user.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Me - hồ sơ & sổ địa chỉ")
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final UserService userService;
    private final AddressService addressService;

    @GetMapping("/profile")
    public UserResponse profile(@AuthenticationPrincipal UserPrincipal me) {
        return userService.getProfile(me.id());
    }

    @PutMapping("/profile")
    public UserResponse updateProfile(@AuthenticationPrincipal UserPrincipal me,
                                      @Valid @RequestBody UpdateProfileRequest req) {
        return userService.updateProfile(me.id(), req);
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal UserPrincipal me,
                               @Valid @RequestBody ChangePasswordRequest req) {
        userService.changePassword(me.id(), req);
    }

    @GetMapping("/addresses")
    public List<AddressResponse> addresses(@AuthenticationPrincipal UserPrincipal me) {
        return addressService.list(me.id());
    }

    @PostMapping("/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    public AddressResponse createAddress(@AuthenticationPrincipal UserPrincipal me,
                                         @Valid @RequestBody AddressRequest req) {
        return addressService.create(me.id(), req);
    }

    @PutMapping("/addresses/{id}")
    public AddressResponse updateAddress(@AuthenticationPrincipal UserPrincipal me, @PathVariable Long id,
                                         @Valid @RequestBody AddressRequest req) {
        return addressService.update(me.id(), id, req);
    }

    @DeleteMapping("/addresses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAddress(@AuthenticationPrincipal UserPrincipal me, @PathVariable Long id) {
        addressService.delete(me.id(), id);
    }
}
