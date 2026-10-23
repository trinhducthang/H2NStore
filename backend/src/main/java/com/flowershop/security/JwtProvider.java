package com.flowershop.security;

import com.flowershop.config.AppProperties;
import com.flowershop.user.entity.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;

@Component
public class JwtProvider {

    private final SecretKey key;
    private final Duration accessTtl;
    private final Clock clock;

    public JwtProvider(AppProperties props, Clock clock) {
        byte[] secret = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("app.jwt.secret phải dài tối thiểu 32 byte cho HS256");
        }
        this.key = Keys.hmacShaKeyFor(secret);
        this.accessTtl = props.jwt().accessTtl();
        this.clock = clock;
    }

    public String createAccessToken(Long userId, String email, Role role) {
        Date now = Date.from(clock.instant());
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("role", role.name())
                .issuedAt(now)
                .expiration(Date.from(clock.instant().plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }

    public Optional<UserPrincipal> parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(new UserPrincipal(Long.valueOf(claims.getSubject()),
                    claims.get("email", String.class), Role.valueOf(claims.get("role", String.class))));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
