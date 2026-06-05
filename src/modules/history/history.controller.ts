import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { CurrentUser } from '../auth';

@ApiTags('History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @ApiOperation({ summary: 'Barcha harakatlar tarixi' })
  @Get()
  findAll(@Query() query: HistoryQueryDto, @CurrentUser() user: any) {
    return this.historyService.findAll(query, user.id, user.role);
  }
}
