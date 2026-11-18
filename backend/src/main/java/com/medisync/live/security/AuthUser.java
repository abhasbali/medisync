package com.medisync.live.security;

import com.medisync.live.enums.Role;

/** Authenticated principal stored in the SecurityContext. */
public record AuthUser(Long id, String username, String fullName, Role role, Long hospitalId) {
}
