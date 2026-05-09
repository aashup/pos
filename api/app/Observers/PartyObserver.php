<?php

namespace App\Observers;

use App\Models\AccountingGroup;
use App\Models\Ledger;
use App\Models\Party;

class PartyObserver
{
    /**
     * When a party is created, auto-create ledger(s) under
     * Sundry Debtors (customer/buyer) or Sundry Creditors (vendor).
     *
     * type='customer' → 1 ledger under Sundry Debtors
     * type='vendor'   → 1 ledger under Sundry Creditors
     * type='both'     → 2 ledgers: "{name} (Buyer)" + "{name} (Vendor)"
     */
    public function created(Party $party): void
    {
        $companyId = $party->company_id;
        $userId = auth()->id();

        $updates = [];

        if ($party->type === 'customer' || $party->type === 'both') {
            $debtorLedger = $this->createLedger(
                $companyId,
                'sundry_debtors',
                $party->type === 'both' ? "{$party->name} (Buyer)" : $party->name,
                $party,
                $party->type === 'customer' ? (float) ($party->opening_balance ?? 0) : 0,
                $party->type === 'customer' ? ($party->balance_type ?: 'dr') : 'dr',
                $userId,
            );
            if ($debtorLedger) {
                $updates['debtor_ledger_id'] = $debtorLedger->id;
            }
        }

        if ($party->type === 'vendor' || $party->type === 'both') {
            $creditorLedger = $this->createLedger(
                $companyId,
                'sundry_creditors',
                $party->type === 'both' ? "{$party->name} (Vendor)" : $party->name,
                $party,
                $party->type === 'vendor' ? (float) ($party->opening_balance ?? 0) : 0,
                $party->type === 'vendor' ? ($party->balance_type ?: 'cr') : 'cr',
                $userId,
            );
            if ($creditorLedger) {
                $updates['creditor_ledger_id'] = $creditorLedger->id;
            }
        }

        if (! empty($updates)) {
            Party::withoutEvents(function () use ($party, $updates) {
                $party->update($updates);
            });
        }
    }

    /**
     * When a party name is updated, sync ledger names.
     * When type changes, create missing ledger.
     */
    public function updated(Party $party): void
    {
        $companyId = $party->company_id;
        $userId = auth()->id();

        // Sync name changes
        if ($party->isDirty('name')) {
            if ($party->debtor_ledger_id) {
                $suffix = $party->creditor_ledger_id ? ' (Buyer)' : '';
                $party->debtorLedger?->update(['name' => $party->name.$suffix]);
            }
            if ($party->creditor_ledger_id) {
                $suffix = $party->debtor_ledger_id ? ' (Vendor)' : '';
                $party->creditorLedger?->update(['name' => $party->name.$suffix]);
            }
        }

        // Handle type change — create missing ledger
        if ($party->isDirty('type')) {
            $updates = [];

            if (in_array($party->type, ['customer', 'both']) && ! $party->debtor_ledger_id) {
                $ledger = $this->createLedger(
                    $companyId,
                    'sundry_debtors',
                    $party->type === 'both' ? "{$party->name} (Buyer)" : $party->name,
                    $party,
                    0,
                    'dr',
                    $userId,
                );
                if ($ledger) {
                    $updates['debtor_ledger_id'] = $ledger->id;
                }
            }

            if (in_array($party->type, ['vendor', 'both']) && ! $party->creditor_ledger_id) {
                $ledger = $this->createLedger(
                    $companyId,
                    'sundry_creditors',
                    $party->type === 'both' ? "{$party->name} (Vendor)" : $party->name,
                    $party,
                    0,
                    'cr',
                    $userId,
                );
                if ($ledger) {
                    $updates['creditor_ledger_id'] = $ledger->id;
                }
            }

            if (! empty($updates)) {
                Party::withoutEvents(function () use ($party, $updates) {
                    $party->update($updates);
                });
            }
        }
    }

    /**
     * Create a ledger under the given parent group system key.
     */
    private function createLedger(
        string $companyId,
        string $parentSystemKey,
        string $name,
        Party $party,
        float $openingBalance,
        string $openingType,
        ?string $userId,
    ): ?Ledger {
        $parentGroup = AccountingGroup::findBySystemKey($companyId, $parentSystemKey);

        if (! $parentGroup) {
            return null;
        }

        return Ledger::create([
            'company_id' => $companyId,
            'name' => $name,
            'group_id' => $parentGroup->id,
            'opening_balance' => $openingBalance,
            'opening_type' => $openingType,
            'is_system' => false,
            'allow_manual_entry' => true,
            'ledgerable_type' => Party::class,
            'ledgerable_id' => $party->id,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
    }
}
