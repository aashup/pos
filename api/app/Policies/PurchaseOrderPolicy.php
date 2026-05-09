<?php

namespace App\Policies;

use App\Models\PurchaseOrder;
use App\Models\User;

class PurchaseOrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('purchase.view');
    }

    public function view(User $user, PurchaseOrder $po): bool
    {
        return $user->company_id === $po->company_id && $user->hasPermissionTo('purchase.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('purchase.create');
    }

    public function update(User $user, PurchaseOrder $po): bool
    {
        return $user->company_id === $po->company_id && $user->hasPermissionTo('purchase.edit');
    }

    public function delete(User $user, PurchaseOrder $po): bool
    {
        return $user->company_id === $po->company_id && $user->hasPermissionTo('purchase.delete');
    }
}
