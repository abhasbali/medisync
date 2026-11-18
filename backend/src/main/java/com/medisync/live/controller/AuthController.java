package com.medisync.live.controller;

import com.medisync.live.dto.AuthDtos.*;
import com.medisync.live.security.AuthUser;
import com.medisync.live.security.CurrentUser;
import com.medisync.live.service.AuthService;
import com.medisync.live.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @Operation(summary = "Log in and receive a JWT bearer token")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest body) {
        return authService.login(body);
    }

    @Operation(summary = "The currently authenticated user")
    @GetMapping("/me")
    public UserDto me() {
        return userService.get(currentId());
    }

    @Operation(summary = "Change your own password (signs out other sessions)")
    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest body) {
        userService.changeOwnPassword(currentId(), body);
        return ResponseEntity.noContent().build();
    }

    private static Long currentId() {
        return CurrentUser.get().map(AuthUser::id)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Authentication required"));
    }
}
