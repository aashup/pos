<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Item;
use App\Models\Party;
use App\Models\PoLine;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Database\Seeder;

class PurchaseOrderSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $vendors = Party::where('company_id', $company->id)->where('type', 'vendor')->get();
        $items = Item::where('company_id', $company->id)->get();
        $user = User::where('company_id', $company->id)->first();

        if ($vendors->isEmpty() || $items->isEmpty() || ! $user) {
            return;
        }

        foreach (['draft', 'confirmed', 'confirmed', 'received'] as $idx => $status) {
            $vendor = $vendors->random();
            $poDate = now()->subDays(rand(5, 30));

            $po = PurchaseOrder::create([
                'company_id' => $company->id,
                'party_id' => $vendor->id,
                'po_number' => 'PO-'.str_pad($idx + 1, 6, '0', STR_PAD_LEFT),
                'po_date' => $poDate,
                'expected_delivery_date' => $poDate->copy()->addDays(14),
                'status' => $status,
                'notes' => "Purchase order #{$idx}",
                'created_by' => $user->id,
                'updated_by' => null,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);

            $lineItems = $items->random(rand(2, 4));
            $totalAmount = $gstAmount = 0;

            foreach ($lineItems as $item) {
                $qty = rand(10, 100);
                $rate = $item->purchase_price ?? rand(50, 500);
                $taxable = $qty * $rate;

                // Calculate GST rate from item (intra-state: sgst + cgst)
                $gstRate = ($item->sgst ?? 0) + ($item->cgst ?? 0);
                $gst = $taxable * $gstRate / 100;

                PoLine::create([
                    'purchase_order_id' => $po->id,
                    'item_id' => $item->id,
                    'quantity' => $qty,
                    'rate' => $rate,
                    'discount_percent' => 0,
                    'taxable_amount' => $taxable,
                    'gst_rate' => $gstRate,
                    'cgst' => $gst / 2,
                    'sgst' => $gst / 2,
                    'igst' => 0,
                    'line_total' => $taxable + $gst,
                    'received_quantity' => $status === 'received' ? $qty : 0,
                    'created_by' => $user->id,
                    'updated_by' => null,
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                ]);

                $totalAmount += $taxable;
                $gstAmount += $gst;
            }

            $po->update([
                'total_amount' => $totalAmount,
                'gst_amount' => $gstAmount,
                'grand_total' => $totalAmount + $gstAmount,
            ]);
        }
    }
}
