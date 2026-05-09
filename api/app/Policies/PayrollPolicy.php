<?php

namespace App\Policies;

use App\Models\PayrollRun;
use App\Models\User;

class PayrollPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('payroll.view');
    }

    public function view(User $user, PayrollRun $run): bool
    {
        return $user->company_id === $run->company_id && $user->hasPermissionTo('payroll.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('payroll.create');
    }

    public function update(User $user, PayrollRun $run): bool
    {
        return $user->company_id === $run->company_id && $user->hasPermissionTo('payroll.edit');
    }

    public function delete(User $user, PayrollRun $run): bool
    {
        return $user->company_id === $run->company_id && $user->hasPermissionTo('payroll.delete');
    }
}
