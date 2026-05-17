import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Unit extends Model {
  static table = 'units';

  @field('server_id') serverId!: string;
  @field('value') value!: string;
  @field('label') label!: string;
  @field('status') status!: string;
}
