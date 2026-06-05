import { Module } from '@nestjs/common';
import { OperationsController } from './operation.controller';
import { OperationsService } from './operation.service';

@Module({
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}