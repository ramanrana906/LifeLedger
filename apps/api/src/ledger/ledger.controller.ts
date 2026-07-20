import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { LedgerService } from './ledger.service';

interface ActionBody {
  type?: string;
  payload?: Record<string, unknown>;
}

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('dashboard')
  async dashboard(@Headers('x-user-id') userId?: string) {
    if (!userId) throw new UnauthorizedException('Missing user context.');
    return this.ledgerService.dashboard(userId);
  }

  @Post('action')
  async action(@Headers('x-user-id') userId: string | undefined, @Body() body: ActionBody) {
    if (!userId) throw new UnauthorizedException('Missing user context.');
    if (!body.type) throw new UnauthorizedException('Missing action type.');
    return this.ledgerService.action(userId, body.type, body.payload ?? {});
  }
}
