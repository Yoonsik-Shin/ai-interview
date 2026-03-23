import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envValidationSchema } from "./env-validation.schema";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: [
                `.env.${process.env.NODE_ENV}.local`,
                `.env.${process.env.NODE_ENV}`,
                ".env",
            ],
            validationSchema: envValidationSchema,
        }),
    ],
    exports: [ConfigModule],
})
export class AppConfigModule {}
