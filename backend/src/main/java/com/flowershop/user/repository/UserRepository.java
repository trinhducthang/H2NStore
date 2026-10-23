package com.flowershop.user.repository;

import com.flowershop.user.entity.Role;
import com.flowershop.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Query("""
            SELECT u FROM User u
            WHERE (:role IS NULL OR u.role = :role)
              AND (:q IS NULL OR lower(u.email) LIKE lower(concat('%', CAST(:q AS string), '%'))
                   OR lower(u.fullName) LIKE lower(concat('%', CAST(:q AS string), '%'))
                   OR u.phone LIKE concat('%', CAST(:q AS string), '%'))
            """)
    Page<User> search(@Param("q") String q, @Param("role") Role role, Pageable pageable);
}
