<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Modifier extends Model
{
    use HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'modifier_group_id',
        'name',
        'price',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function group()
    {
        return $this->belongsTo(ModifierGroup::class, 'modifier_group_id');
    }
}
