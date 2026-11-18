package com.medisync.live.exception;

/** Login temporarily locked after repeated failures (HTTP 429). */
public class TooManyAttemptsException extends RuntimeException {
    public TooManyAttemptsException(String message) {
        super(message);
    }
}
