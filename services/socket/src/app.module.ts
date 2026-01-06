import { Module } from "@nestjs/common";
import { EventsGateway } from "./events/events.gateway";
import { SocketLoggingService } from "./events/socket-logging.service";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  providers: [EventsGateway, SocketLoggingService],
})
export class AppModule {}

