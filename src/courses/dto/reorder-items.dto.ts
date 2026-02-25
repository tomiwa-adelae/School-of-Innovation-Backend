import { IsArray, IsString } from 'class-validator';

export class ReorderItemsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[]; // ordered array of IDs
}
