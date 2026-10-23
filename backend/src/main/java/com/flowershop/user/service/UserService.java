package com.flowershop.user.service;

import com.flowershop.common.dto.PageQuery;
import com.flowershop.common.dto.PageResponse;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.PhoneUtils;
import com.flowershop.user.dto.UserDtos.AdminCreateUserRequest;
import com.flowershop.user.dto.UserDtos.ChangePasswordRequest;
import com.flowershop.user.dto.UserDtos.UpdateProfileRequest;
import com.flowershop.user.dto.UserDtos.UserResponse;
import com.flowershop.user.entity.Role;
import com.flowershop.user.entity.User;
import com.flowershop.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    @Transactional(readOnly = true)
    public User getById(Long id) {
        return userRepository.findById(id).orElseThrow(() -> BusinessException.notFound("người dùng"));
    }

    @Transactional(readOnly = true)
    public Map<Long, String> findFullNames(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));
    }

    @Transactional
    public User create(String email, String rawPassword, String fullName, String phone, Role role) {
        String normalizedEmail = email.toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException(ErrorCode.DUPLICATE, "Email đã được sử dụng");
        }
        User user = new User();
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setFullName(fullName);
        user.setPhone(PhoneUtils.normalize(phone));
        user.setRole(role);
        return userRepository.save(user);
    }

    @Transactional
    public void changePasswordUnchecked(User user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getProfile(Long userId) {
        return UserResponse.from(getById(userId));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest req) {
        User user = getById(userId);
        user.setFullName(req.fullName());
        user.setPhone(PhoneUtils.normalize(req.phone()));
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = getById(userId);
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Mật khẩu hiện tại không đúng");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
    }

    // ---------------------------------------------------------------- admin

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> search(String q, Role role, Integer page, Integer size) {
        var pageable = PageQuery.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.of(userRepository.search(q, role, pageable), UserResponse::from);
    }

    @Transactional
    public UserResponse adminCreate(AdminCreateUserRequest req) {
        return UserResponse.from(create(req.email(), req.password(), req.fullName(), req.phone(), req.role()));
    }

    @Transactional
    public UserResponse setEnabled(Long id, boolean enabled, Long actorId) {
        if (id.equals(actorId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Không thể tự khóa tài khoản của mình");
        }
        User user = getById(id);
        user.setEnabled(enabled);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse setRole(Long id, Role role, Long actorId) {
        if (id.equals(actorId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Không thể tự đổi vai trò của mình");
        }
        User user = getById(id);
        user.setRole(role);
        return UserResponse.from(user);
    }
}
