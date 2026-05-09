<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Godown;
use App\Models\Item;
use App\Models\Party;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseInvoiceLine;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Database\Seeder;

class PurchaseInvoiceSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $vendors = Party::where('company_id', $company->id)->where('type', 'vendor')->get();
        $items = Item::where('company_id', $company->id)->get();
        $godown = Godown::where('company_id', $company->id)->first();
        $user = User::where('company_id', $company->id)->first();

        if ($vendors->isEmpty() || $items->isEmpty() || ! $godown || ! $user) {
            return;
        }

        // Create 5 confirmed purchase invoices with lines
        for ($i = 1; $i <= 5; $i++) {
            $vendor = $vendors->random();
            $isInterState = $company->state_code !== ($vendor->state_code ?? $company->state_code);
            $invoiceDate = now()->subDays(rand(1, 60));

            $invoice = PurchaseInvoice::create([
                'company_id' => $company->id,
                'party_id' => $vendor->id,
                'godown_id' => $godown->id,
                'invoice_number' => 'PI-'.str_pad($i, 6, '0', STR_PAD_LEFT),
                'vendor_invoice_number' => 'VINV/'.now()->year.'/'.str_pad($i, 4, '0', STR_PAD_LEFT),
                'invoice_date' => $invoiceDate,
                'due_date' => $invoiceDate->copy()->addDays(30),
                'is_inter_state' => $isInterState,
                'status' => 'confirmed',
                'created_by' => $user->id,
                'updated_by' => null,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);

            $lineItems = $items->random(rand(2, 4));
            $totalTaxable = $cgstTotal = $sgstTotal = $igstTotal = 0;

            foreach ($lineItems as $item) {
                $qty = rand(5, 50);
                $rate = $item->purchase_price ?? rand(50, 500);
                $taxable = $qty * $rate;

                // Calculate GST based on inter-state or intra-state
                if ($isInterState) {
                    $gstRate = $item->igst ?? 0;
                    $cgst = 0;
                    $sgst = 0;
                    $igst = $taxable * $gstRate / 100;
                } else {
                    $gstRate = ($item->sgst ?? 0) + ($item->cgst ?? 0);
                    $gstAmt = $taxable * $gstRate / 100;
                    $cgst = $gstAmt / 2;
                    $sgst = $gstAmt / 2;
                    $igst = 0;
                }
                $gstAmt = $cgst + $sgst + $igst;

                PurchaseInvoiceLine::create([
                    'purchase_invoice_id' => $invoice->id,
                    'item_id' => $item->id,
                    'quantity' => $qty,
                    'rate' => $rate,
                    'discount_percent' => 0,
                    'taxable_amount' => $taxable,
                    'gst_rate' => $gstRate,
                    'cgst' => $cgst,
                    'sgst' => $sgst,
                    'igst' => $igst,
                    'line_total' => $taxable + $gstAmt,
                    'created_by' => $user->id,
                    'updated_by' => null,
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                ]);

                // Stock in
                StockLedger::create([
                    'company_id' => $company->id,
                    'item_id' => $item->id,
                    'godown_id' => $godown->id,
                    'type' => 'purchase',
                    'reference_type' => PurchaseInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => $qty,
                    'rate' => $rate,
                    'value' => $qty * $rate,
                    'narration' => "Purchase from {$vendor->name}",
                    'created_by' => $user->id,
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                    'date' => $invoiceDate,
                ]);

                $totalTaxable += $taxable;
                $cgstTotal += $cgst;
                $sgstTotal += $sgst;
                $igstTotal += $igst;
            }

            $grandTotal = $totalTaxable + $cgstTotal + $sgstTotal + $igstTotal;
            $invoice->update([
                'total_amount' => $totalTaxable,
                'taxable_amount' => $totalTaxable,
                'cgst_total' => $cgstTotal,
                'sgst_total' => $sgstTotal,
                'igst_total' => $igstTotal,
                'grand_total' => $grandTotal,
                'balance_due' => $grandTotal,
            ]);
        }
    }
}
