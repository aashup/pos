<?php

namespace App\Policies;

use App\Models\ThermalTemplate;
use App\Models\User;

class ThermalTemplatePolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, ThermalTemplate $thermalTemplate): bool
    {
        return $user->company_id === $thermalTemplate->company_id;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, ThermalTemplate $thermalTemplate): bool
    {
        return $user->company_id === $thermalTemplate->company_id;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, ThermalTemplate $thermalTemplate): bool
    {
        return $user->company_id === $thermalTemplate->company_id;
    }
}
