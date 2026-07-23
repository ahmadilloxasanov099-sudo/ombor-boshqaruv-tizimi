import { Module } from '@nestjs/common';
import { DeletionRequestsService } from './deletion-requests.service';
import { DeletionRequestsController } from './deletion-requests.controller';
import { PrismaModule } from 'src/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService],
  exports: [DeletionRequestsService],
})
export class DeletionRequestsModule {}
