<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Combo extends Model
{
    use BelongsToCompany, HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'price',
        'cgst',
        'sgst',
        'igst',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'cgst' => 'decimal:2',
            'sgst' => 'decimal:2',
            'igst' => 'decimal:2',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function comboItems()
    {
        return $this->hasMany(ComboItem::class)->orderBy('sort_order');
    }

    public function modifierGroups()
    {
        return $this->belongsToMany(ModifierGroup::class, 'combo_modifier_groups')
            ->withPivot('sort_order')
            ->withTimestamps()
            ->orderBy('combo_modifier_groups.sort_order');
    }

    public function media()
    {
        return $this->hasMany(Media::class, 'entity_id')
            ->where('entity_type', 'combo')
            ->orderBy('sort_order');
    }
}
