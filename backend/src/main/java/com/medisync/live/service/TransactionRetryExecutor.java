package com.medisync.live.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Re-runs a whole transactional operation when MySQL aborts it because of a deadlock or lock wait
 * timeout. Each attempt is a fresh transaction (the supplier must call a @Transactional bean method),
 * so a retried operation re-reads the latest committed state before deciding anything.
 */
@Slf4j
@Component
public class TransactionRetryExecutor {

    private static final int MAX_ATTEMPTS = 4;

    public <T> T execute(Supplier<T> operation) {
        ConcurrencyFailureException last = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return operation.get();
            } catch (ConcurrencyFailureException ex) {
                last = ex;
                log.warn("Concurrency conflict (attempt {}/{}): {}", attempt, MAX_ATTEMPTS, ex.getMostSpecificCause().getMessage());
                backoff(attempt);
            }
        }
        throw last;
    }

    private static void backoff(int attempt) {
        try {
            Thread.sleep(25L * attempt + (long) (Math.random() * 25));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
