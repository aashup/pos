<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ModifierGroup extends Model
{
    use BelongsToCompany, HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'is_required',
        'min_selections',
        'max_selections',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'min_selections' => 'integer',
            'max_selections' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function modifiers()
    {
        return $this->hasMany(Modifier::class)->orderBy('sort_order');
    }

    public function items()
    {
        return $this->belongsToMany(Item::class, 'item_modifier_groups')
            ->withPivot('sort_order')
            ->withTimestamps();
    }

    public function combos()
    {
        return $this->belongsToMany(Combo::class, 'combo_modifier_groups')
            ->withPivot('sort_order')
            ->withTimestamps();
    }

    public function media()
    {
        return $this->hasMany(Media::class, 'entity_id')
            ->where('entity_type', 'modifier_group')
            ->orderBy('sort_order');
    }
}
