<?php

namespace App\Policies;

use App\Models\FinancialYear;
use App\Models\User;

class FinancialYearPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, FinancialYear $fy): bool
    {
        return $user->company_id === $fy->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function update(User $user, FinancialYear $fy): bool
    {
        return $user->company_id === $fy->company_id && $user->role === 'admin';
    }

    public function delete(User $user, FinancialYear $fy): bool
    {
        return $user->company_id === $fy->company_id && $user->role === 'admin';
    }
}
