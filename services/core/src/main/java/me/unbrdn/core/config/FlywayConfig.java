package me.unbrdn.core.config;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    @Value("${spring.flyway.locations:classpath:db/migration/postgresql}")
    private String locations;

    @Value("${spring.flyway.enabled:true}")
    private boolean enabled;

    @Value("${spring.flyway.baseline-on-migrate:true}")
    private boolean baselineOnMigrate;

    @Bean
    public Flyway flyway(DataSource dataSource) {
        if (!enabled) {
            System.out.println("Flyway is disabled via spring.flyway.enabled");
            return null;
        }

        System.out.println("========== Starting Manual Flyway Migration ==========");
        System.out.println("Locations: " + locations);

        Flyway flyway =
                Flyway.configure()
                        .dataSource(dataSource)
                        .locations(locations)
                        .baselineOnMigrate(baselineOnMigrate)
                        .baselineVersion("0")
                        .load();

        flyway.migrate();
        System.out.println("========== Manual Flyway Migration Completed ==========");

        return flyway;
    }
}
