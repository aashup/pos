<?php

namespace App\Policies;

use App\Models\Item;
use App\Models\User;

class ItemPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('inventory.view');
    }

    public function view(User $user, Item $item): bool
    {
        return $user->company_id === $item->company_id && $user->hasPermissionTo('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('inventory.create');
    }

    public function update(User $user, Item $item): bool
    {
        return $user->company_id === $item->company_id && $user->hasPermissionTo('inventory.edit');
    }

    public function delete(User $user, Item $item): bool
    {
        return $user->company_id === $item->company_id && $user->hasPermissionTo('inventory.delete');
    }
}
