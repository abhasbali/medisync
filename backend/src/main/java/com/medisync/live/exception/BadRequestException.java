package com.medisync.live.exception;

/** Input is well-formed but semantically invalid (HTTP 400). */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
