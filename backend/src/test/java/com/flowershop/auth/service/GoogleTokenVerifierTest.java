package com.flowershop.auth.service;

import com.flowershop.auth.service.GoogleTokenVerifier.GoogleUser;
import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Ký token bằng khóa tự sinh thay cho khóa của Google, kiểm tra các điều kiện chặn token giả/của app khác. */
class GoogleTokenVerifierTest {

    private static final String CLIENT_ID = "shop.apps.googleusercontent.com";
    private static final Instant NOW = Instant.parse("2026-10-27T03:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private static RSAKey googleKey;
    private static RSAKey otherKey;

    @BeforeAll
    static void keys() throws JOSEException {
        googleKey = new RSAKeyGenerator(2048).keyID("google").generate();
        otherKey = new RSAKeyGenerator(2048).keyID("google").generate();
    }

    private static GoogleTokenVerifier verifier(String clientId) throws JOSEException {
        return new GoogleTokenVerifier(clientId, CLOCK,
                NimbusJwtDecoder.withPublicKey(googleKey.toRSAPublicKey()).build());
    }

    private static String token(RSAKey key, Consumer<JWTClaimsSet.Builder> customize) throws JOSEException {
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(CLIENT_ID)
                .subject("110248495921238986420")
                .claim("email", "lan.nguyen@gmail.com")
                .claim("email_verified", true)
                .claim("name", "Nguyễn Lan")
                .issueTime(Date.from(NOW.minusSeconds(60)))
                .expirationTime(Date.from(NOW.plusSeconds(3540)));
        customize.accept(claims);
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
                claims.build());
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private static void assertRejected(GoogleTokenVerifier verifier, String token) {
        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.GOOGLE_LOGIN_FAILED));
    }

    @Test
    void readsUserFromValidToken() throws JOSEException {
        GoogleUser user = verifier(CLIENT_ID).verify(token(googleKey, c -> {
        }));

        assertThat(user).isEqualTo(new GoogleUser("110248495921238986420", "lan.nguyen@gmail.com", true,
                "Nguyễn Lan"));
    }

    @Test
    void acceptsIssuerWithoutScheme() throws JOSEException {
        GoogleUser user = verifier(CLIENT_ID).verify(token(googleKey, c -> c.issuer("accounts.google.com")
                .claim("email_verified", false)));

        assertThat(user.emailVerified()).isFalse();
    }

    @Test
    void rejectsTokenIssuedForAnotherApp() throws JOSEException {
        assertRejected(verifier(CLIENT_ID), token(googleKey, c -> c.audience("other-app.apps.googleusercontent.com")));
    }

    @Test
    void rejectsTokenNotFromGoogle() throws JOSEException {
        assertRejected(verifier(CLIENT_ID), token(googleKey, c -> c.issuer("https://evil.example.com")));
        assertRejected(verifier(CLIENT_ID), token(otherKey, c -> {
        }));
    }

    @Test
    void rejectsExpiredAndMalformedTokens() throws JOSEException {
        assertRejected(verifier(CLIENT_ID), token(googleKey, c -> c.expirationTime(Date.from(NOW.minusSeconds(120)))));
        assertRejected(verifier(CLIENT_ID), "not-a-jwt");
    }

    @Test
    void refusesWhenClientIdNotConfigured() throws JOSEException {
        String token = token(googleKey, c -> {
        });

        assertThatThrownBy(() -> verifier("").verify(token))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
    }
}
