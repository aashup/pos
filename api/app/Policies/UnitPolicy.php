<?php

namespace App\Policies;

use App\Models\Unit;
use App\Models\User;

class UnitPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('inventory.view');
    }

    public function view(User $user, Unit $unit): bool
    {
        return $user->company_id === $unit->company_id && $user->hasPermissionTo('inventory.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('inventory.create');
    }

    public function update(User $user, Unit $unit): bool
    {
        return $user->company_id === $unit->company_id && $user->hasPermissionTo('inventory.edit');
    }

    public function delete(User $user, Unit $unit): bool
    {
        return $user->company_id === $unit->company_id && $user->hasPermissionTo('inventory.delete');
    }
}
