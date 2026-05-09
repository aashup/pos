<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ThermalTemplate extends Model
{
    use BelongsToCompany, HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'html_content',
        'paper_size',
        'is_default',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'synced_at' => 'datetime',
        'updated_at_local' => 'datetime',
    ];

    /**
     * Get the user who created this template.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this template.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scope: Get templates for a specific paper size.
     */
    public function scopeForPaperSize($query, string $paperSize)
    {
        return $query->where('paper_size', $paperSize);
    }

    /**
     * Scope: Get the default template for the company.
     */
    public function scopeIsDefault($query)
    {
        return $query->where('is_default', true);
    }
}
