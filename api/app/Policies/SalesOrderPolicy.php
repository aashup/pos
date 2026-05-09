<?php

namespace App\Policies;

use App\Models\SalesOrder;
use App\Models\User;

class SalesOrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('sales.view');
    }

    public function view(User $user, SalesOrder $so): bool
    {
        return $user->company_id === $so->company_id && $user->hasPermissionTo('sales.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('sales.create');
    }

    public function update(User $user, SalesOrder $so): bool
    {
        return $user->company_id === $so->company_id && $user->hasPermissionTo('sales.edit');
    }

    public function delete(User $user, SalesOrder $so): bool
    {
        return $user->company_id === $so->company_id && $user->hasPermissionTo('sales.delete');
    }
}
