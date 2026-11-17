package com.medisync.live;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MediSyncApplication {
    public static void main(String[] args) {
        SpringApplication.run(MediSyncApplication.class, args);
    }
}
