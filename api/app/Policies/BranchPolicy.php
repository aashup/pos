<?php

namespace App\Policies;

use App\Models\Branch;
use App\Models\User;

class BranchPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('branch.view');
    }

    public function view(User $user, Branch $branch): bool
    {
        return $user->company_id === $branch->company_id && $user->hasPermissionTo('branch.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('branch.create');
    }

    public function update(User $user, Branch $branch): bool
    {
        return $user->company_id === $branch->company_id && $user->hasPermissionTo('branch.edit');
    }

    public function delete(User $user, Branch $branch): bool
    {
        return $user->company_id === $branch->company_id && $user->hasPermissionTo('branch.delete');
    }
}
