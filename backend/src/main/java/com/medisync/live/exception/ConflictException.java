package com.medisync.live.exception;

/** A business rule or state transition does not allow the operation (HTTP 409). */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
