import { Module } from '@nestjs/common';
import { OperationsController } from './operation.controller';
import { OperationsService } from './operation.service';
import { MailModule } from '../nodemailer/mail.module';

@Module({
  imports: [MailModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}