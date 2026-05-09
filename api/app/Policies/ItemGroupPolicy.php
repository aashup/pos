<?php

namespace App\Policies;

use App\Models\ItemGroup;
use App\Models\User;

class ItemGroupPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('inventory.view');
    }

    public function view(User $user, ItemGroup $itemGroup): bool
    {
        return $user->company_id === $itemGroup->company_id && $user->hasPermissionTo('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('inventory.create');
    }

    public function update(User $user, ItemGroup $itemGroup): bool
    {
        return $user->company_id === $itemGroup->company_id && $user->hasPermissionTo('inventory.edit');
    }

    public function delete(User $user, ItemGroup $itemGroup): bool
    {
        return $user->company_id === $itemGroup->company_id && $user->hasPermissionTo('inventory.delete');
    }
}
