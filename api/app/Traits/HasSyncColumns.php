<?php

namespace App\Traits;

trait HasSyncColumns
{
    public function initializeHasSyncColumns(): void
    {
        $this->fillable = array_merge($this->fillable, [
            'sync_status',
            'device_id',
            'synced_at',
            'updated_at_local',
        ]);

        $this->casts = array_merge($this->casts, [
            'synced_at' => 'datetime',
            'updated_at_local' => 'datetime',
        ]);
    }

    public function markAsSynced(): void
    {
        $this->update([
            'sync_status' => 'synced',
            'synced_at' => now(),
        ]);
    }

    public function markAsConflict(): void
    {
        $this->update(['sync_status' => 'conflict']);
    }

    public function scopePending($query)
    {
        return $query->where('sync_status', 'pending');
    }

    public function scopeSynced($query)
    {
        return $query->where('sync_status', 'synced');
    }

    public function scopeConflicts($query)
    {
        return $query->where('sync_status', 'conflict');
    }
}
