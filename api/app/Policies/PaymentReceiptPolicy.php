<?php

namespace App\Policies;

use App\Models\PaymentReceipt;
use App\Models\User;

class PaymentReceiptPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('accounting.view');
    }

    public function view(User $user, PaymentReceipt $receipt): bool
    {
        return $user->company_id === $receipt->company_id && $user->hasPermissionTo('accounting.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('accounting.create');
    }

    public function update(User $user, PaymentReceipt $receipt): bool
    {
        return $user->company_id === $receipt->company_id && $user->hasPermissionTo('accounting.edit');
    }

    public function delete(User $user, PaymentReceipt $receipt): bool
    {
        return $user->company_id === $receipt->company_id && $user->hasPermissionTo('accounting.delete');
    }
}
