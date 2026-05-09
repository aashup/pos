<?php

namespace App\Policies;

use App\Models\PurchaseReturn;
use App\Models\User;

class PurchaseReturnPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('purchase.view');
    }

    public function view(User $user, PurchaseReturn $return): bool
    {
        return $user->company_id === $return->company_id && $user->hasPermissionTo('purchase.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('purchase.create');
    }

    public function update(User $user, PurchaseReturn $return): bool
    {
        return $user->company_id === $return->company_id && $user->hasPermissionTo('purchase.edit');
    }

    public function delete(User $user, PurchaseReturn $return): bool
    {
        return $user->company_id === $return->company_id && $user->hasPermissionTo('purchase.delete');
    }
}
