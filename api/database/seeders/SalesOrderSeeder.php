<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Item;
use App\Models\Party;
use App\Models\SalesOrder;
use App\Models\SoLine;
use App\Models\User;
use Illuminate\Database\Seeder;

class SalesOrderSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $customers = Party::where('company_id', $company->id)->where('type', 'customer')->get();
        $items = Item::where('company_id', $company->id)->get();
        $user = User::where('company_id', $company->id)->first();

        if ($customers->isEmpty() || $items->isEmpty() || ! $user) {
            return;
        }

        foreach (['draft', 'confirmed', 'confirmed', 'delivered', 'cancelled'] as $idx => $status) {
            $customer = $customers->random();
            $soDate = now()->subDays(rand(3, 25));

            $so = SalesOrder::create([
                'company_id' => $company->id,
                'party_id' => $customer->id,
                'so_number' => 'SO-'.str_pad($idx + 1, 6, '0', STR_PAD_LEFT),
                'so_date' => $soDate,
                'expected_delivery_date' => $soDate->copy()->addDays(7),
                'status' => $status,
                'notes' => "Sales order #{$idx}",
                'created_by' => $user->id,
                'updated_by' => null,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);

            $lineItems = $items->random(rand(1, 3));
            $totalAmount = $gstAmount = 0;

            foreach ($lineItems as $item) {
                $qty = rand(1, 30);
                $rate = $item->selling_price ?? rand(100, 2000);
                $taxable = $qty * $rate;

                // Calculate GST rate from item (intra-state: sgst + cgst)
                $gstRate = ($item->sgst ?? 0) + ($item->cgst ?? 0);
                $gst = $taxable * $gstRate / 100;

                SoLine::create([
                    'sales_order_id' => $so->id,
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
                    'delivered_quantity' => $status === 'delivered' ? $qty : 0,
                    'created_by' => $user->id,
                    'updated_by' => null,
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                ]);

                $totalAmount += $taxable;
                $gstAmount += $gst;
            }

            $so->update([
                'total_amount' => $totalAmount,
                'gst_amount' => $gstAmount,
                'grand_total' => $totalAmount + $gstAmount,
            ]);
        }
    }
}
