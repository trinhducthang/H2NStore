package com.flowershop;

import com.flowershop.common.util.TimeUtils;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.util.TimeZone;

// Xác thực bằng JWT tự viết, không cần user mặc định của Spring Security
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class FlowerShopApplication {

    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone(TimeUtils.ZONE));
        SpringApplication.run(FlowerShopApplication.class, args);
    }
}
