<?php

namespace App\Policies;

use App\Models\SalesReturn;
use App\Models\User;

class SalesReturnPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('sales.view');
    }

    public function view(User $user, SalesReturn $return): bool
    {
        return $user->company_id === $return->company_id && $user->hasPermissionTo('sales.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('sales.create');
    }

    public function update(User $user, SalesReturn $return): bool
    {
        return $user->company_id === $return->company_id && $user->hasPermissionTo('sales.edit');
    }

    public function delete(User $user, SalesReturn $return): bool
    {
        return $user->company_id === $return->company_id && $user->hasPermissionTo('sales.delete');
    }
}
