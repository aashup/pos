<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\User;

class ActivityPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('audit.view');
    }

    public function view(User $user, Activity $entry): bool
    {
        return $user->company_id === $entry->company_id && $user->hasPermissionTo('audit.view');
    }
}
