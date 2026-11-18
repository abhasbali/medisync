package com.medisync.live.security;

import com.medisync.live.entity.AppUser;
import com.medisync.live.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads "Authorization: Bearer &lt;jwt&gt;" and re-loads the user, so disabled accounts and revoked tokens
 * (older token_version) stop working immediately.
 */
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AppUserRepository users;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            jwtService.parse(header.substring(7).trim())
                    .flatMap(p -> users.findWithHospital(p.userId())
                            .filter(AppUser::isEnabled)
                            .filter(u -> u.getTokenVersion() == p.tokenVersion()))
                    .ifPresent(u -> {
                        AuthUser principal = new AuthUser(u.getId(), u.getUsername(), u.getFullName(), u.getRole(),
                                u.getHospital() == null ? null : u.getHospital().getId());
                        var auth = new UsernamePasswordAuthenticationToken(principal, null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
                        // Install a fresh context rather than mutating a possibly shared one.
                        var context = SecurityContextHolder.createEmptyContext();
                        context.setAuthentication(auth);
                        SecurityContextHolder.setContext(context);
                    });
        }
        chain.doFilter(request, response);
    }
}
