import { IsString } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  session_id!: string;
}
