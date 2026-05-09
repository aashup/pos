<?php

namespace App\Policies;

use App\Models\SalesInvoice;
use App\Models\User;

class SalesInvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('sales.view');
    }

    public function view(User $user, SalesInvoice $invoice): bool
    {
        return $user->company_id === $invoice->company_id && $user->hasPermissionTo('sales.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('sales.create');
    }

    public function update(User $user, SalesInvoice $invoice): bool
    {
        return $user->company_id === $invoice->company_id && $user->hasPermissionTo('sales.edit');
    }

    public function delete(User $user, SalesInvoice $invoice): bool
    {
        return $user->company_id === $invoice->company_id && $user->hasPermissionTo('sales.delete');
    }
}
