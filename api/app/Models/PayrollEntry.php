<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayrollEntry extends Model
{
    use HasFactory, HasSyncColumns, HasUuid;

    protected $fillable = [
        'payroll_run_id',
        'employee_id',
        'present_days',
        'basic',
        'hra',
        'da',
        'conveyance',
        'medical',
        'special_allowance',
        'gross_salary',
        'pf_employee',
        'esi_employee',
        'professional_tax',
        'tds',
        'total_deductions',
        'net_salary',
        'pf_employer',
        'esi_employer',
        'custom_components',
        'is_paid',
        'payment_voucher_id',
    ];

    protected function casts(): array
    {
        return [
            'present_days' => 'integer',
            'basic' => 'decimal:2',
            'hra' => 'decimal:2',
            'da' => 'decimal:2',
            'conveyance' => 'decimal:2',
            'medical' => 'decimal:2',
            'special_allowance' => 'decimal:2',
            'gross_salary' => 'decimal:2',
            'pf_employee' => 'decimal:2',
            'esi_employee' => 'decimal:2',
            'professional_tax' => 'decimal:2',
            'tds' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'net_salary' => 'decimal:2',
            'pf_employer' => 'decimal:2',
            'esi_employer' => 'decimal:2',
            'custom_components' => 'array',
            'is_paid' => 'boolean',
        ];
    }

    public function payrollRun()
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function paymentVoucher()
    {
        return $this->belongsTo(Voucher::class, 'payment_voucher_id');
    }
}
