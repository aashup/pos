import {Model} from '@nozbe/watermelondb';
import {text, date, readonly} from '@nozbe/watermelondb/decorators';
import type {SyncState} from './Item';

export default class FloorPlan extends Model {
  static table = 'floor_plans';

  @text('server_id') serverId!: string | null;
  @text('name') name!: string;
  @text('sync_state') syncState!: SyncState;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
