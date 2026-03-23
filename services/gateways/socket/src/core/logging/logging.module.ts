import { Global, Module } from "@nestjs/common";
import { SocketLoggingService } from "./socket-logging.service";

@Global()
@Module({
    providers: [SocketLoggingService],
    exports: [SocketLoggingService],
})
export class LoggingModule {}
