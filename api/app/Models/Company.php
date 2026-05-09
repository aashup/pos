<?php

namespace App\Models;

use App\Observers\CompanyObserver;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

#[ObservedBy(CompanyObserver::class)]
class Company extends Model
{
    use HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
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
        'logo_path',
    ];

    protected $appends = ['logo_url'];

    public function getLogoUrlAttribute(): ?string
    {
        return $this->logo_path
            ? Storage::disk('public')->url($this->logo_path)
            : null;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function branches()
    {
        return $this->hasMany(Branch::class);
    }

    public function parties()
    {
        return $this->hasMany(Party::class);
    }

    public function items()
    {
        return $this->hasMany(Item::class);
    }

    public function godowns()
    {
        return $this->hasMany(Godown::class);
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function salesOrders()
    {
        return $this->hasMany(SalesOrder::class);
    }

    public function purchaseInvoices()
    {
        return $this->hasMany(PurchaseInvoice::class);
    }

    public function salesInvoices()
    {
        return $this->hasMany(SalesInvoice::class);
    }

    public function vouchers()
    {
        return $this->hasMany(Voucher::class);
    }

    public function financialYears()
    {
        return $this->hasMany(FinancialYear::class);
    }

    public function accountingGroups()
    {
        return $this->hasMany(AccountingGroup::class);
    }

    public function paymentReceipts()
    {
        return $this->hasMany(PaymentReceipt::class);
    }

    public function settings()
    {
        return $this->hasMany(CompanySetting::class);
    }
}
