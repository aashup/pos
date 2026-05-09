<?php

namespace App\Models;

use App\Models\Ledger;
use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'company_id',
        'employee_code',
        'name',
        'gender',
        'date_of_birth',
        'phone',
        'email',
        'address',
        'city',
        'state',
        'department_id',
        'designation_id',
        'joining_date',
        'employment_type',
        'bank_account_name',
        'bank_account_no',
        'bank_ifsc',
        'bank_name',
        'pan',
        'pf_number',
        'esi_number',
        'is_pf_applicable',
        'is_esi_applicable',
        'is_active',
        'salary_ledger_id',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'joining_date' => 'date',
            'is_pf_applicable' => 'boolean',
            'is_esi_applicable' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function designation()
    {
        return $this->belongsTo(Designation::class);
    }

    public function salaryStructure()
    {
        return $this->hasOne(SalaryStructure::class)->where('is_active', true)->latestOfMany('effective_from');
    }

    public function salaryStructures()
    {
        return $this->hasMany(SalaryStructure::class)->orderByDesc('effective_from');
    }

    public function payrollEntries()
    {
        return $this->hasMany(PayrollEntry::class);
    }

    public function salaryLedger()
    {
        return $this->belongsTo(Ledger::class, 'salary_ledger_id');
    }
}
