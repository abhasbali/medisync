package com.medisync.live.entity;

import com.medisync.live.enums.ResourceType;
import com.medisync.live.exception.ConflictException;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Total and available units of one resource type in one hospital.
 * <p>
 * Mutating methods enforce {@code 0 <= available <= total}; the MySQL CHECK constraint enforces the
 * same rule if anything bypasses the application. Callers must hold a pessimistic write lock on the
 * row (see {@code InventoryRepository#lockByType}) so the guard and the write are atomic.
 */
@Entity
@Table(name = "inventory")
@Getter
@Setter
@NoArgsConstructor
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false)
    private ResourceType resourceType;

    @Column(nullable = false)
    private int total;

    @Column(nullable = false)
    private int available;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Inventory(Hospital hospital, ResourceType type, int total, int available) {
        this.hospital = hospital;
        this.resourceType = type;
        this.total = total;
        this.available = available;
        this.updatedAt = Instant.now();
    }

    /** Guarded decrement: reserve one unit, or return false and change nothing when none is free. */
    public boolean tryReserveOne() {
        if (available <= 0) {
            return false;
        }
        available--;
        touch();
        return true;
    }

    /** Release one previously reserved unit. */
    public void releaseOne() {
        if (available >= total) {
            throw new ConflictException("Cannot release a " + resourceType + " unit at " + hospital.getName()
                    + ": the available count already equals total capacity");
        }
        available++;
        touch();
    }

    /** Donor side of a transfer: remove free units from this hospital. */
    public void giveAway(int quantity) {
        if (quantity <= 0 || available < quantity) {
            throw new ConflictException("Donor does not have enough available units: requested "
                    + quantity + ", available " + available);
        }
        total -= quantity;
        available -= quantity;
        touch();
    }

    /** Requester side of a transfer: add free units to this hospital. */
    public void receive(int quantity) {
        total += quantity;
        available += quantity;
        touch();
    }

    public int getOccupied() {
        return total - available;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
