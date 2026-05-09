<?php

namespace App\Policies;

use App\Models\Godown;
use App\Models\User;

class GodownPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('inventory.view');
    }

    public function view(User $user, Godown $godown): bool
    {
        return $user->company_id === $godown->company_id && $user->hasPermissionTo('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('inventory.create');
    }

    public function update(User $user, Godown $godown): bool
    {
        return $user->company_id === $godown->company_id && $user->hasPermissionTo('inventory.edit');
    }

    public function delete(User $user, Godown $godown): bool
    {
        return $user->company_id === $godown->company_id && $user->hasPermissionTo('inventory.delete');
    }
}
