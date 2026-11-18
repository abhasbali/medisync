package com.medisync.live.service;

import com.medisync.live.dto.AuthDtos.LoginRequest;
import com.medisync.live.dto.AuthDtos.LoginResponse;
import com.medisync.live.entity.AppUser;
import com.medisync.live.exception.TooManyAttemptsException;
import com.medisync.live.repository.AppUserRepository;
import com.medisync.live.security.JwtService;
import com.medisync.live.security.LoginAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginAttemptService attempts;

    /** Hash compared against when the user does not exist, so response time does not reveal valid usernames. */
    private volatile String dummyHash;

    private String dummyHash() {
        if (dummyHash == null) {
            dummyHash = encoder.encode("not-a-real-password");
        }
        return dummyHash;
    }

    @Transactional(noRollbackFor = BadCredentialsException.class)
    public LoginResponse login(LoginRequest req) {
        String username = req.username().trim();
        long locked = attempts.lockedForSeconds(username);
        if (locked > 0) {
            throw new TooManyAttemptsException("Too many failed attempts. Try again in " + locked + " seconds.");
        }
        Optional<AppUser> found = users.findByUsernameIgnoreCase(username);
        boolean ok = encoder.matches(req.password(), found.map(AppUser::getPasswordHash).orElseGet(this::dummyHash));
        if (found.isEmpty() || !ok || !found.get().isEnabled()) {
            attempts.failed(username);
            log.info("Failed login for '{}'", username);
            throw new BadCredentialsException("Invalid username or password");
        }
        attempts.succeeded(username);
        AppUser u = found.get();
        u.setLastLoginAt(Instant.now());
        JwtService.Issued issued = jwt.issue(u.getId(), u.getUsername(), u.getRole().name(), u.getTokenVersion());
        return new LoginResponse(issued.token(), issued.expiresAt(), UserService.toDto(u));
    }
}
