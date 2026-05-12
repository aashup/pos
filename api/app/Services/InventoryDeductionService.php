<?php

namespace App\Services;

use App\Models\Godown;
use App\Models\Recipe;
use App\Models\SalesInvoice;
use App\Models\StockLedger;

class InventoryDeductionService
{
    /**
     * Deduct raw-material stock for every line in the invoice using recipes.
     * Lines with no recipe are skipped silently.
     * Called inside DB::transaction() in RestaurantOrderController::checkout().
     */
    public function deductForOrder(SalesInvoice $invoice, string $userId): void
    {
        $defaultGodown = Godown::where('company_id', $invoice->company_id)
            ->where('is_default', true)
            ->first();

        $invoice->loadMissing('lines');

        foreach ($invoice->lines as $line) {
            $recipe = Recipe::where('company_id', $invoice->company_id)
                ->where('item_id', $line->item_id)
                ->with('ingredients')
                ->first();

            if (! $recipe) {
                continue;
            }

            foreach ($recipe->ingredients as $ingredient) {
                $deductQty = (float) $ingredient->quantity * (float) $line->quantity;

                StockLedger::create([
                    'company_id'     => $invoice->company_id,
                    'item_id'        => $ingredient->item_id,
                    'godown_id'      => $defaultGodown?->id,
                    'type'           => 'sale',
                    'date'           => $invoice->invoice_date,
                    'reference_type' => SalesInvoice::class,
                    'reference_id'   => $invoice->id,
                    'quantity'       => -$deductQty,
                    'rate'           => 0,
                    'value'          => 0,
                    'narration'      => "Recipe deduction: {$recipe->item->name ?? ''} x {$line->quantity}",
                    'created_by'     => $userId,
                ]);
            }
        }
    }
}
