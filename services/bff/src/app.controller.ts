import { Controller, Get, InternalServerErrorException, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Kafka, Producer } from 'kafkajs';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'node:fs';

@Controller()
export class AppController {
  private readonly kafka: Kafka;
  private readonly producer: Producer;

  constructor(private readonly appService: AppService) {
    const kafkaBroker = process.env.KAFKA_BROKER || 'kafka:29092';
    this.kafka = new Kafka({
      clientId: 'bff-node',
      brokers: [kafkaBroker],
      retry: {
        retries: 5,
        initialRetryTime: 1000,
      },
    });
    this.producer = this.kafka.producer();
    // 비동기로 연결 시도, 실패해도 앱은 시작됨
    this.producer.connect().catch((error) => {
      console.error('Failed to connect to Kafka:', error);
      console.log('Will retry when Kafka is available...');
    });
  }

  @Get('/ping')
  async getPing(): Promise<{
    result: string;
    python_response: string;
    timestamp: string;
    kafkaStatus: string;
  }> {
    let python_response: string | null = null;
    try {
      const pythonWorkerUrl =
        process.env.PYTHON_WORKER_URL || 'http://inference:8000';
      const response = await fetch(`${pythonWorkerUrl}/ping`);
      const data = (await response.json()) as {
        message: string;
        timestamp: string;
      };
      python_response = JSON.stringify(data);
    } catch (error) {
      console.error('Error calling Python API', error);
      python_response = 'Error calling Python API';
    }

    await this.producer.send({
      topic: 'test-topic',
      messages: [
        {
          value: JSON.stringify({
            messages: [
              {
                value: `node responded with: ${python_response} from python api`,
              },
            ],
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    return {
      result: 'Success',
      python_response: python_response,
      timestamp: new Date().toISOString(),
      kafkaStatus: 'Message sent to Kafka',
    };
  }

  @Get('/test-client')
  getTestClient(@Res() res: Response): void {
    // 프로젝트 루트의 test-client.html 파일 제공
    const htmlPath = join(process.cwd(), 'test-client.html');
    
    if (existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('test-client.html 파일을 찾을 수 없습니다.');
    }
  }
}
