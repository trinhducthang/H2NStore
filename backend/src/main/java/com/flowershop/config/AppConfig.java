package com.flowershop.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StringDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.IOException;
import java.time.Clock;

@Configuration
@EnableAsync
@EnableScheduling
public class AppConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }

    /** Tự trim mọi chuỗi trong JSON request; chuỗi rỗng sau khi trim thành null. */
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer trimStringsCustomizer() {
        SimpleModule module = new SimpleModule("trim-strings");
        module.addDeserializer(String.class, new StringDeserializer() {
            @Override
            public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
                String value = super.deserialize(p, ctxt);
                if (value == null) {
                    return null;
                }
                String trimmed = value.trim();
                return trimmed.isEmpty() ? null : trimmed;
            }
        });
        return builder -> builder.modulesToInstall(module);
    }
}
