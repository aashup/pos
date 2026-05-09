<?php

namespace App\Policies;

use App\Models\PurchaseInvoice;
use App\Models\User;

class PurchaseInvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('purchase.view');
    }

    public function view(User $user, PurchaseInvoice $invoice): bool
    {
        return $user->company_id === $invoice->company_id && $user->hasPermissionTo('purchase.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('purchase.create');
    }

    public function update(User $user, PurchaseInvoice $invoice): bool
    {
        return $user->company_id === $invoice->company_id && $user->hasPermissionTo('purchase.edit');
    }

    public function delete(User $user, PurchaseInvoice $invoice): bool
    {
        return $user->company_id === $invoice->company_id && $user->hasPermissionTo('purchase.delete');
    }
}
