<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;

class EmployeePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('payroll.view');
    }

    public function view(User $user, Employee $employee): bool
    {
        return $user->company_id === $employee->company_id && $user->hasPermissionTo('payroll.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('payroll.create');
    }

    public function update(User $user, Employee $employee): bool
    {
        return $user->company_id === $employee->company_id && $user->hasPermissionTo('payroll.edit');
    }

    public function delete(User $user, Employee $employee): bool
    {
        return $user->company_id === $employee->company_id && $user->hasPermissionTo('payroll.delete');
    }
}
