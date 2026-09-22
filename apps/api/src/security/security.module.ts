import { Module } from '@nestjs/common';
import { SecurityBootstrapService } from './security-bootstrap.service';

@Module({
  providers: [SecurityBootstrapService],
  exports: [SecurityBootstrapService],
})
export class SecurityModule {}
