<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockLedger extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid;

    protected $table = 'stock_ledger';

    protected $fillable = [
        'company_id',
        'item_id',
        'batch_id',
        'godown_id',
        'type',
        'date',
        'reference_type',
        'reference_id',
        'quantity',
        'rate',
        'value',
        'narration',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'datetime',
            'quantity' => 'decimal:3',
            'rate' => 'decimal:2',
            'value' => 'decimal:2',
        ];
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function godown()
    {
        return $this->belongsTo(Godown::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference()
    {
        return $this->morphTo();
    }
}
