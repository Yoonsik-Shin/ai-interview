package me.unbrdn.core.config;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;

@Slf4j
@Configuration
public class MongoConfig extends AbstractMongoClientConfiguration {

    @Value("${spring.data.mongodb.host:localhost}")
    private String host;

    @Value("${spring.data.mongodb.port:27017}")
    private int port;

    @Value("${spring.data.mongodb.database:unbrdn}")
    private String database;

    @Value("${spring.data.mongodb.username:}")
    private String username;

    @Value("${spring.data.mongodb.password:}")
    private String password;

    @Value("${spring.data.mongodb.authentication-database:admin}")
    private String authDatabase;

    @Override
    protected String getDatabaseName() {
        return database;
    }

    @Override
    @Bean
    public MongoClient mongoClient() {
        log.info(
                "Creating MongoClient manually with host: {}, port: {}, database: {}",
                host,
                port,
                database);

        String connectionString;
        if (username != null && !username.isEmpty()) {
            connectionString =
                    String.format(
                            "mongodb://%s:%s@%s:%d/%s?authSource=%s",
                            username, password, host, port, database, authDatabase);
        } else {
            connectionString = String.format("mongodb://%s:%d/%s", host, port, database);
        }

        log.info(
                "MongoDB Connection String (sanitized): {}",
                connectionString.replaceAll(":[^:]+@", ":***@"));

        ConnectionString connStr = new ConnectionString(connectionString);
        MongoClientSettings settings =
                MongoClientSettings.builder().applyConnectionString(connStr).build();

        return MongoClients.create(settings);
    }
}
