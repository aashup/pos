<?php

namespace App\Policies;

use App\Models\AccountingGroup;
use App\Models\User;

class AccountingGroupPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, AccountingGroup $account): bool
    {
        return $user->company_id === $account->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('accounting.create');
    }

    public function update(User $user, AccountingGroup $account): bool
    {
        return $user->company_id === $account->company_id && $user->hasPermissionTo('accounting.edit');
    }

    public function delete(User $user, AccountingGroup $account): bool
    {
        if ($account->is_system) {
            return false;
        }

        return $user->company_id === $account->company_id && $user->hasPermissionTo('accounting.delete');
    }
}
