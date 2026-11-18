package com.medisync.live.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medisync.live.dto.ErrorResponse;
import com.medisync.live.repository.AppUserRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;
import java.time.Instant;

/**
 * Stateless JWT security. Role rules:
 * <ul>
 *   <li>ADMIN - everything, including /api/users</li>
 *   <li>DISPATCHER - create / discharge / cancel emergency requests</li>
 *   <li>HOSPITAL_STAFF - emergency requests, plus inventory and transfer decisions of their own hospital</li>
 * </ul>
 * Hospital scoping is enforced by {@link AccessGuard}.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, AppUserRepository users,
                                                   ObjectMapper mapper) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable) // stateless bearer tokens, no cookies
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/ws/**", "/actuator/health/**", "/actuator/health", "/actuator/info",
                                "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/error").permitAll()
                        .requestMatchers("/api/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/requests/**").hasAnyRole("ADMIN", "DISPATCHER", "HOSPITAL_STAFF")
                        .requestMatchers(HttpMethod.PATCH, "/api/inventory/**").hasAnyRole("ADMIN", "HOSPITAL_STAFF")
                        .requestMatchers(HttpMethod.POST, "/api/transfers/**").hasAnyRole("ADMIN", "HOSPITAL_STAFF")
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                write(res, mapper, HttpStatus.UNAUTHORIZED, "Authentication required", req.getRequestURI()))
                        .accessDeniedHandler((req, res, ex) ->
                                write(res, mapper, HttpStatus.FORBIDDEN, "You do not have permission for this action", req.getRequestURI())))
                .addFilterBefore(new JwtAuthFilter(jwtService, users), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private static void write(HttpServletResponse res, ObjectMapper mapper, HttpStatus status, String msg, String path)
            throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getOutputStream(),
                new ErrorResponse(Instant.now(), status.value(), status.getReasonPhrase(), msg, path, null));
    }
}
