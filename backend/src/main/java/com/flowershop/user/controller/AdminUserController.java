package com.flowershop.user.controller;

import com.flowershop.common.dto.PageResponse;
import com.flowershop.security.UserPrincipal;
import com.flowershop.user.dto.UserDtos.AdminCreateUserRequest;
import com.flowershop.user.dto.UserDtos.UpdateEnabledRequest;
import com.flowershop.user.dto.UserDtos.UpdateRoleRequest;
import com.flowershop.user.dto.UserDtos.UserResponse;
import com.flowershop.user.entity.Role;
import com.flowershop.user.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin - người dùng")
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    public PageResponse<UserResponse> list(@RequestParam(required = false) String q,
                                           @RequestParam(required = false) Role role,
                                           @RequestParam(required = false) Integer page,
                                           @RequestParam(required = false) Integer size) {
        return userService.search(q, role, page, size);
    }

    /** Tạo tài khoản nhân viên (STAFF) hoặc admin khác. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody AdminCreateUserRequest req) {
        return userService.adminCreate(req);
    }

    @PatchMapping("/{id}/enabled")
    public UserResponse setEnabled(@PathVariable Long id, @RequestBody UpdateEnabledRequest req,
                                   @AuthenticationPrincipal UserPrincipal me) {
        return userService.setEnabled(id, req.enabled(), me.id());
    }

    @PatchMapping("/{id}/role")
    public UserResponse setRole(@PathVariable Long id, @Valid @RequestBody UpdateRoleRequest req,
                                @AuthenticationPrincipal UserPrincipal me) {
        return userService.setRole(id, req.role(), me.id());
    }
}
