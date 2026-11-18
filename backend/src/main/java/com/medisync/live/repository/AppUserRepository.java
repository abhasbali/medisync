package com.medisync.live.repository;

import com.medisync.live.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    @Query("select u from AppUser u left join fetch u.hospital where lower(u.username) = lower(:username)")
    Optional<AppUser> findByUsernameIgnoreCase(@Param("username") String username);

    @Query("select u from AppUser u left join fetch u.hospital where u.id = :id")
    Optional<AppUser> findWithHospital(@Param("id") Long id);

    @Query("select u from AppUser u left join fetch u.hospital order by u.username")
    List<AppUser> findAllWithHospital();

    boolean existsByUsernameIgnoreCase(String username);
}
