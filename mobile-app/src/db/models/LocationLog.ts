import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class LocationLog extends Model {
  static table = 'location_logs';

  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @field('accuracy') accuracy!: number | null;
  @field('recorded_at') recordedAt!: number;
  @field('synced') synced!: boolean;
}
