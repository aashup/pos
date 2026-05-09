<?php

namespace App\Policies;

use App\Models\Party;
use App\Models\User;

class PartyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('party.view');
    }

    public function view(User $user, Party $party): bool
    {
        return $user->company_id === $party->company_id && $user->hasPermissionTo('party.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('party.create');
    }

    public function update(User $user, Party $party): bool
    {
        return $user->company_id === $party->company_id && $user->hasPermissionTo('party.edit');
    }

    public function delete(User $user, Party $party): bool
    {
        return $user->company_id === $party->company_id && $user->hasPermissionTo('party.delete');
    }
}
