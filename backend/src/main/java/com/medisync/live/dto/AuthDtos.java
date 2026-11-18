package com.medisync.live.dto;

import com.medisync.live.enums.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/** Request/response records for authentication and user management. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "Username is required") String username,
            @NotBlank(message = "Password is required") String password) {
    }

    public record LoginResponse(String token, Instant expiresAt, UserDto user) {
    }

    public record UserDto(Long id, String username, String fullName, Role role, Long hospitalId, String hospitalName,
                          boolean enabled, Instant createdAt, Instant lastLoginAt) {
    }

    public record CreateUserRequest(
            @NotBlank(message = "Username is required")
            @Pattern(regexp = "^[a-zA-Z0-9._-]{3,50}$", message = "Username must be 3-50 letters, digits, dots, dashes or underscores")
            String username,
            @NotBlank(message = "Full name is required") @Size(max = 100, message = "Full name must be at most 100 characters")
            String fullName,
            @NotBlank(message = "Password is required") @Size(min = 8, max = 100, message = "Password must be 8-100 characters")
            String password,
            @NotNull(message = "Role is required") Role role,
            Long hospitalId) {
    }

    public record UpdateUserRequest(
            @NotBlank(message = "Full name is required") @Size(max = 100, message = "Full name must be at most 100 characters")
            String fullName,
            @NotNull(message = "Role is required") Role role,
            Long hospitalId,
            @NotNull(message = "Enabled is required") Boolean enabled) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "Password is required") @Size(min = 8, max = 100, message = "Password must be 8-100 characters")
            String newPassword) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required") String currentPassword,
            @NotBlank(message = "New password is required") @Size(min = 8, max = 100, message = "Password must be 8-100 characters")
            String newPassword) {
    }
}
