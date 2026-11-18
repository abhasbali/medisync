package com.medisync.live.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Slf4j
@Service
public class JwtService {

    static final String DEV_SECRET = "medisync-live-dev-only-secret-change-me-in-production-0123456789";

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(@Value("${medisync.jwt.secret}") String secret,
                      @Value("${medisync.jwt.ttl:PT8H}") Duration ttl) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("medisync.jwt.secret (JWT_SECRET) must be at least 32 bytes");
        }
        if (DEV_SECRET.equals(secret)) {
            log.warn("Using the built-in development JWT secret. Set JWT_SECRET before deploying.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttl = ttl;
    }

    public record Issued(String token, Instant expiresAt) {
    }

    public record Parsed(Long userId, int tokenVersion) {
    }

    public Issued issue(Long userId, String username, String role, int tokenVersion) {
        Instant now = Instant.now();
        Instant exp = now.plus(ttl);
        String token = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("role", role)
                .claim("ver", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key)
                .compact();
        return new Issued(token, exp);
    }

    public Optional<Parsed> parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            Integer ver = c.get("ver", Integer.class);
            return Optional.of(new Parsed(Long.valueOf(c.getSubject()), ver == null ? 0 : ver));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
