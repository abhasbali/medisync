package com.medisync.live.service;

import com.medisync.live.dto.AuthDtos.*;
import com.medisync.live.entity.AppUser;
import com.medisync.live.entity.Hospital;
import com.medisync.live.enums.ActivityType;
import com.medisync.live.enums.Role;
import com.medisync.live.exception.BadRequestException;
import com.medisync.live.exception.ConflictException;
import com.medisync.live.exception.NotFoundException;
import com.medisync.live.repository.AppUserRepository;
import com.medisync.live.repository.HospitalRepository;
import com.medisync.live.security.AuthUser;
import com.medisync.live.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AppUserRepository users;
    private final HospitalRepository hospitals;
    private final PasswordEncoder encoder;
    private final ActivityService activity;

    public static UserDto toDto(AppUser u) {
        Hospital h = u.getHospital();
        return new UserDto(u.getId(), u.getUsername(), u.getFullName(), u.getRole(),
                h == null ? null : h.getId(), h == null ? null : h.getName(),
                u.isEnabled(), u.getCreatedAt(), u.getLastLoginAt());
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return users.findAllWithHospital().stream().map(UserService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public UserDto get(Long id) {
        return toDto(load(id));
    }

    @Transactional
    public UserDto create(CreateUserRequest req) {
        String username = req.username().trim();
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new ConflictException("Username '" + username + "' is already taken");
        }
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setFullName(req.fullName().trim());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setRole(req.role());
        u.setHospital(resolveHospital(req.role(), req.hospitalId()));
        users.save(u);
        activity.record(ActivityType.USER_MANAGEMENT,
                "User " + u.getUsername() + " created with role " + u.getRole(), u.getId());
        return toDto(u);
    }

    @Transactional
    public UserDto update(Long id, UpdateUserRequest req) {
        AppUser u = load(id);
        boolean self = CurrentUser.get().map(AuthUser::id).filter(id::equals).isPresent();
        if (self && (!req.enabled() || req.role() != Role.ADMIN)) {
            throw new ConflictException("You cannot disable or demote your own account");
        }
        boolean revoke = (u.isEnabled() && !req.enabled()) || u.getRole() != req.role()
                || !Objects.equals(u.getHospital() == null ? null : u.getHospital().getId(), req.hospitalId());
        u.setFullName(req.fullName().trim());
        u.setRole(req.role());
        u.setHospital(resolveHospital(req.role(), req.hospitalId()));
        u.setEnabled(req.enabled());
        if (revoke) {
            u.revokeTokens(); // permissions changed: force re-login
        }
        activity.record(ActivityType.USER_MANAGEMENT, "User " + u.getUsername() + " updated ("
                + u.getRole() + (u.isEnabled() ? ", enabled" : ", disabled") + ")", u.getId());
        return toDto(u);
    }

    @Transactional
    public void resetPassword(Long id, ResetPasswordRequest req) {
        AppUser u = load(id);
        u.setPasswordHash(encoder.encode(req.newPassword()));
        u.revokeTokens();
        activity.record(ActivityType.USER_MANAGEMENT, "Password reset for user " + u.getUsername(), u.getId());
    }

    @Transactional
    public void changeOwnPassword(Long userId, ChangePasswordRequest req) {
        AppUser u = load(userId);
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        if (req.currentPassword().equals(req.newPassword())) {
            throw new BadRequestException("New password must differ from the current one");
        }
        u.setPasswordHash(encoder.encode(req.newPassword()));
        u.revokeTokens();
    }

    private AppUser load(Long id) {
        return users.findWithHospital(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    private Hospital resolveHospital(Role role, Long hospitalId) {
        if (role != Role.HOSPITAL_STAFF) {
            return null;
        }
        if (hospitalId == null) {
            throw new BadRequestException("Hospital staff must be assigned to a hospital");
        }
        return hospitals.findById(hospitalId)
                .orElseThrow(() -> new NotFoundException("Hospital " + hospitalId + " not found"));
    }
}
