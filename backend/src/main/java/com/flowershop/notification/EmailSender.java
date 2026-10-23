package com.flowershop.notification;

import com.flowershop.config.AppProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * Gửi email HTML. Chưa cấu hình MAIL_HOST thì chỉ ghi log (dev).
 */
@Slf4j
@Component
public class EmailSender {

    private final JavaMailSender mailSender;
    private final String from;

    public EmailSender(ObjectProvider<JavaMailSender> mailSender, AppProperties props,
                       @Value("${spring.mail.host:}") String mailHost) {
        this.mailSender = mailHost.isBlank() ? null : mailSender.getIfAvailable();
        this.from = props.mail().from();
    }

    public void send(String to, String subject, String html) {
        if (to == null || to.isBlank()) {
            return;
        }
        if (mailSender == null) {
            log.info("[Email tắt] to={} subject={}", to, subject);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            log.warn("Gửi email tới {} thất bại: {}", to, e.getMessage());
        }
    }
}
