<?php

namespace App\Policies;

use App\Models\Ledger;
use App\Models\User;

class LedgerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, Ledger $ledger): bool
    {
        return $user->company_id === $ledger->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('accounting.create');
    }

    public function update(User $user, Ledger $ledger): bool
    {
        return $user->company_id === $ledger->company_id && $user->hasPermissionTo('accounting.edit');
    }

    public function delete(User $user, Ledger $ledger): bool
    {
        return $user->company_id === $ledger->company_id && $user->hasPermissionTo('accounting.delete');
    }
}
