package com.medisync.live.controller;

import com.medisync.live.dto.AuthDtos.*;
import com.medisync.live.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** User management. ADMIN only (enforced in SecurityConfig). */
@Tag(name = "Users (admin)")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "All users")
    @GetMapping
    public List<UserDto> list() {
        return userService.list();
    }

    @Operation(summary = "Create a user")
    @PostMapping
    public ResponseEntity<UserDto> create(@Valid @RequestBody CreateUserRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(body));
    }

    @Operation(summary = "Update name, role, hospital and enabled flag")
    @PutMapping("/{id}")
    public UserDto update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest body) {
        return userService.update(id, body);
    }

    @Operation(summary = "Set a new password (signs the user out everywhere)")
    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest body) {
        userService.resetPassword(id, body);
        return ResponseEntity.noContent().build();
    }
}
