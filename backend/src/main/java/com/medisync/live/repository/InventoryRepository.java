package com.medisync.live.repository;

import com.medisync.live.entity.Inventory;
import com.medisync.live.enums.ResourceType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    /**
     * SELECT ... FOR UPDATE on every inventory row of one resource type, in primary-key order.
     * <p>
     * Every operation that changes inventory of a type (allocation, discharge, cancellation, admin
     * edit, transfer approval) takes these locks first and in the same order. That gives a single
     * deterministic lock order (inventory rows by id, then emergency requests), which serialises
     * competing writers for the same type and prevents both double booking and lock-order deadlocks.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inventory i join fetch i.hospital where i.resourceType = :type order by i.id")
    List<Inventory> lockByType(@Param("type") ResourceType type);

    @Query("select i from Inventory i join fetch i.hospital order by i.hospital.id, i.id")
    List<Inventory> findAllWithHospital();

    @Query("select i from Inventory i join fetch i.hospital where i.hospital.id = :hospitalId order by i.id")
    List<Inventory> findByHospitalId(@Param("hospitalId") Long hospitalId);

    @Query("select i from Inventory i join fetch i.hospital where i.id = :id")
    Optional<Inventory> findWithHospital(@Param("id") Long id);

    /** Scalar read used before locking (see EmergencyRequestRepository#findResourceTypeById). */
    @Query("select i.resourceType from Inventory i where i.id = :id")
    Optional<ResourceType> findResourceTypeById(@Param("id") Long id);

    @Query("select coalesce(sum(i.total), 0) from Inventory i")
    long sumTotal();

    @Query("select coalesce(sum(i.available), 0) from Inventory i")
    long sumAvailable();

    /**
     * Create the requester's inventory row if it does not exist yet. INSERT IGNORE relies on the
     * unique (hospital_id, resource_type) key, so concurrent callers can never create a duplicate.
     */
    @Modifying
    @Query(value = "INSERT IGNORE INTO inventory (hospital_id, resource_type, total, available) "
            + "VALUES (:hospitalId, :type, 0, 0)", nativeQuery = true)
    int insertEmptyIfMissing(@Param("hospitalId") Long hospitalId, @Param("type") String type);
}
