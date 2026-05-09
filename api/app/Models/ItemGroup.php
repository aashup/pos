<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ItemGroup extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'parent_id',
        'name',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function parent()
    {
        return $this->belongsTo(ItemGroup::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(ItemGroup::class, 'parent_id');
    }

    public function items()
    {
        return $this->hasMany(Item::class);
    }
}
