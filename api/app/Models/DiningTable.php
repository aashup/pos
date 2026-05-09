<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class DiningTable extends Model
{
    use BelongsToCompany, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'floor_plan_id',
        'name',
        'capacity',
        'shape',
        'pos_x',
        'pos_y',
        'status',
        'current_order_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'capacity'  => 'integer',
            'pos_x'     => 'integer',
            'pos_y'     => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function floorPlan()
    {
        return $this->belongsTo(FloorPlan::class);
    }

    public function currentOrder()
    {
        return $this->belongsTo(SalesInvoice::class, 'current_order_id');
    }

    public function isVacant(): bool
    {
        return $this->status === 'vacant';
    }

    public function isOccupied(): bool
    {
        return $this->status === 'occupied';
    }
}
