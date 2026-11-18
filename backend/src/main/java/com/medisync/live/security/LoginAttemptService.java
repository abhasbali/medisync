package com.medisync.live.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Brute-force protection: 5 failed logins lock the username for 5 minutes (in-memory, per instance). */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK = Duration.ofMinutes(5);

    private record State(int failures, Instant lockedUntil) {
    }

    private final Map<String, State> attempts = new ConcurrentHashMap<>();

    private static String key(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    /** Seconds left on the lock, or 0 when not locked. */
    public long lockedForSeconds(String username) {
        State s = attempts.get(key(username));
        if (s == null || s.lockedUntil() == null) return 0;
        return Math.max(0, Duration.between(Instant.now(), s.lockedUntil()).getSeconds());
    }

    public void failed(String username) {
        attempts.compute(key(username), (k, s) -> {
            boolean expired = s == null || (s.lockedUntil() != null && s.lockedUntil().isBefore(Instant.now()));
            int n = expired ? 1 : s.failures() + 1;
            return new State(n, n >= MAX_FAILURES ? Instant.now().plus(LOCK) : null);
        });
    }

    public void succeeded(String username) {
        attempts.remove(key(username));
    }
}
