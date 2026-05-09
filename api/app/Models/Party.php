<?php

namespace App\Models;

use App\Observers\PartyObserver;
use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

#[ObservedBy(PartyObserver::class)]
class Party extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'type',
        'name',
        'gstin',
        'pan',
        'address',
        'city',
        'state',
        'state_code',
        'pincode',
        'phone',
        'email',
        'contact_person',
        'credit_limit',
        'opening_balance',
        'balance_type',
        'debtor_ledger_id',
        'creditor_ledger_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'decimal:2',
            'opening_balance' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function debtorLedger()
    {
        return $this->belongsTo(Ledger::class, 'debtor_ledger_id');
    }

    public function creditorLedger()
    {
        return $this->belongsTo(Ledger::class, 'creditor_ledger_id');
    }

    /**
     * Get the appropriate ledger for a given context.
     */
    public function getLedgerForContext(string $context): ?Ledger
    {
        return match ($context) {
            'sales', 'receipt' => $this->debtorLedger,
            'purchase', 'payment' => $this->creditorLedger,
            default => $this->debtorLedger ?? $this->creditorLedger,
        };
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function purchaseInvoices()
    {
        return $this->hasMany(PurchaseInvoice::class);
    }

    public function salesOrders()
    {
        return $this->hasMany(SalesOrder::class);
    }

    public function salesInvoices()
    {
        return $this->hasMany(SalesInvoice::class);
    }

    public function paymentReceipts()
    {
        return $this->hasMany(PaymentReceipt::class);
    }
}
