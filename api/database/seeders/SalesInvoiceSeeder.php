<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Godown;
use App\Models\Item;
use App\Models\Party;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceLine;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Database\Seeder;

class SalesInvoiceSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $customers = Party::where('company_id', $company->id)->where('type', 'customer')->get();
        $items = Item::where('company_id', $company->id)->get();
        $godown = Godown::where('company_id', $company->id)->first();
        $user = User::where('company_id', $company->id)->first();

        if ($customers->isEmpty() || $items->isEmpty() || ! $godown || ! $user) {
            return;
        }

        for ($i = 1; $i <= 8; $i++) {
            $customer = $customers->random();
            $isInterState = $company->state_code !== ($customer->state_code ?? $company->state_code);
            $invoiceDate = now()->subDays(rand(1, 45));

            $invoice = SalesInvoice::create([
                'company_id' => $company->id,
                'party_id' => $customer->id,
                'godown_id' => $godown->id,
                'invoice_number' => 'SI-'.str_pad($i, 6, '0', STR_PAD_LEFT),
                'invoice_date' => $invoiceDate,
                'due_date' => $invoiceDate->copy()->addDays(15),
                'is_inter_state' => $isInterState,
                'is_printed' => $i <= 5,
                'status' => $i <= 6 ? 'confirmed' : 'draft',
                'created_by' => $user->id,
                'updated_by' => null,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);

            $lineItems = $items->random(rand(1, 3));
            $totalTaxable = $cgstTotal = $sgstTotal = $igstTotal = 0;

            foreach ($lineItems as $item) {
                $qty = rand(1, 20);
                $rate = $item->selling_price ?? rand(100, 2000);
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

                SalesInvoiceLine::create([
                    'sales_invoice_id' => $invoice->id,
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

                // Stock out
                StockLedger::create([
                    'company_id' => $company->id,
                    'item_id' => $item->id,
                    'godown_id' => $godown->id,
                    'type' => 'sale',
                    'reference_type' => SalesInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => -$qty,
                    'rate' => $rate,
                    'value' => $qty * $rate,
                    'narration' => "Sale to {$customer->name}",
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
            $amountPaid = $i <= 3 ? $grandTotal : 0;

            $invoice->update([
                'total_amount' => $totalTaxable,
                'taxable_amount' => $totalTaxable,
                'cgst_total' => $cgstTotal,
                'sgst_total' => $sgstTotal,
                'igst_total' => $igstTotal,
                'grand_total' => $grandTotal,
                'amount_paid' => $amountPaid,
                'balance_due' => $grandTotal - $amountPaid,
            ]);
        }
    }
}
