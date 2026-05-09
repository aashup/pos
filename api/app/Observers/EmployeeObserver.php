<?php

namespace App\Observers;

use App\Models\AccountingGroup;
use App\Models\Employee;
use App\Models\Ledger;

class EmployeeObserver
{
    /**
     * When an employee is created, auto-create a salary payable ledger
     * under the "Salary" group (system_key='salary_group').
     */
    public function created(Employee $employee): void
    {
        $salaryGroup = AccountingGroup::findBySystemKey($employee->company_id, 'salary_group');
        if (! $salaryGroup) {
            return;
        }

        $userId = auth()->check() ? auth()->id() : null;

        $ledger = Ledger::create([
            'company_id'         => $employee->company_id,
            'name'               => $employee->name,
            'group_id'           => $salaryGroup->id,
            'opening_balance'    => 0,
            'opening_type'       => 'cr',
            'is_system'          => false,
            'allow_manual_entry' => true,
            'ledgerable_type'    => Employee::class,
            'ledgerable_id'      => $employee->id,
            'created_by'         => $userId,
            'updated_by'         => $userId,
        ]);

        Employee::withoutEvents(function () use ($employee, $ledger) {
            $employee->update(['salary_ledger_id' => $ledger->id]);
        });
    }

    /**
     * When an employee name changes, sync it to their salary ledger.
     */
    public function updated(Employee $employee): void
    {
        if ($employee->isDirty('name') && $employee->salary_ledger_id) {
            $employee->salaryLedger?->update(['name' => $employee->name]);
        }
    }
}
