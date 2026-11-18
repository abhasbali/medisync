package com.medisync.live.config;

import com.medisync.live.entity.AppUser;
import com.medisync.live.entity.Hospital;
import com.medisync.live.enums.Role;
import com.medisync.live.repository.AppUserRepository;
import com.medisync.live.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Creates demo accounts on first start (when app_users is empty). Disable with SEED_DEMO_USERS=false.
 * admin / Admin@123, dispatcher / Dispatch@123, staff1..staffN / Staff@123 (one per hospital).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserSeeder implements ApplicationRunner {

    private final AppUserRepository users;
    private final HospitalRepository hospitals;
    private final PasswordEncoder encoder;

    @Value("${medisync.seed-demo-users:true}")
    private boolean enabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled || users.count() > 0) {
            return;
        }
        users.save(user("admin", "System Administrator", "Admin@123", Role.ADMIN, null));
        users.save(user("dispatcher", "Emergency Dispatcher", "Dispatch@123", Role.DISPATCHER, null));
        List<Hospital> all = hospitals.findAll();
        all.sort((a, b) -> a.getId().compareTo(b.getId()));
        for (int i = 0; i < all.size(); i++) {
            Hospital h = all.get(i);
            users.save(user("staff" + (i + 1), "Staff - " + h.getName(), "Staff@123", Role.HOSPITAL_STAFF, h));
        }
        log.warn("Seeded demo users: admin/Admin@123, dispatcher/Dispatch@123, staff1..staff{}/Staff@123. "
                + "Change these passwords before any real use.", all.size());
    }

    private AppUser user(String username, String name, String password, Role role, Hospital hospital) {
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setFullName(name);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        u.setHospital(hospital);
        return u;
    }
}
