<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\Company;
use App\Models\Godown;
use App\Models\Item;
use App\Models\Party;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseInvoiceLine;
use App\Models\StockLedger;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AidwayBiotechInvoiceSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $godown = Godown::where('company_id', $company->id)->first();
        $user = User::where('company_id', $company->id)->first();

        if (! $godown || ! $user) {
            return;
        }

        // Create Aidway Biotech as a vendor
        $vendor = Party::create([
            'company_id' => $company->id,
            'type' => 'vendor',
            'name' => 'Aidway Biotech',
            'gstin' => '06ABTFA4602L1Z8',
            'pan' => 'ABTFA4602L',
            'address' => 'Plot No.1, Near Gurudwara & Kali Mata Mandir, Bilaspur Distt-Yamunanagar(HR)',
            'city' => 'Yamunanagar',
            'state' => 'Haryana',
            'state_code' => '06',
            'pincode' => '135102',
            'phone' => '9729411400',
            'email' => 'info@aidwaybiotech.com',
            'contact_person' => null,
            'credit_limit' => 500000,
            'opening_balance' => 0,
            'balance_type' => 'cr',
            'is_active' => true,
            'sync_status' => 'synced',
            'synced_at' => now(),
            'updated_at_local' => now(),
        ]);

        // Create A P Pharmaceuticals as a customer (the buyer on this invoice)
        Party::create([
            'company_id' => $company->id,
            'type' => 'customer',
            'name' => 'A P Pharmaceuticals',
            'gstin' => '09FBUPP8739K1ZC',
            'pan' => 'FBUPP8739K',
            'address' => 'Near GTL Tower, Khargaura Mod Shemri Road, Khargaura, Patna Khargaura, Shravasti',
            'city' => 'Shravasti',
            'state' => 'Uttar Pradesh',
            'state_code' => '09',
            'pincode' => '271831',
            'phone' => null,
            'email' => null,
            'contact_person' => null,
            'credit_limit' => 100000,
            'opening_balance' => 0,
            'balance_type' => 'dr',
            'is_active' => true,
            'sync_status' => 'synced',
            'synced_at' => now(),
            'updated_at_local' => now(),
        ]);

        // Define pharma items from the invoice
        $invoiceItems = [
            // Free / promo items (GST 18%)
            [
                'name' => 'Diary',
                'sku' => 'PROMO-DIARY',
                'hsn_code' => '4820',
                'unit' => 'pcs',
                'item_group_id' => null,
                'gst_rate' => 18,
                'mrp' => 0,
                'purchase_price' => 0,
                'selling_price' => 0,
                'is_batch_tracked' => false,
                'qty' => 1,
                'rate' => 0,
                'batch_number' => null,
                'expiry_date' => null,
                'pack' => null,
            ],
            [
                'name' => 'Pen New',
                'sku' => 'PROMO-PEN',
                'hsn_code' => '9608',
                'unit' => 'pcs',
                'item_group_id' => null,
                'gst_rate' => 18,
                'mrp' => 0,
                'purchase_price' => 0,
                'selling_price' => 0,
                'is_batch_tracked' => false,
                'qty' => 5,
                'rate' => 0,
                'batch_number' => null,
                'expiry_date' => null,
                'pack' => null,
            ],
            [
                'name' => 'Product Card',
                'sku' => 'PROMO-PCARD',
                'hsn_code' => '370239',
                'unit' => 'pcs',
                'item_group_id' => null,
                'gst_rate' => 18,
                'mrp' => 0,
                'purchase_price' => 0,
                'selling_price' => 0,
                'is_batch_tracked' => false,
                'qty' => 1,
                'rate' => 0,
                'batch_number' => null,
                'expiry_date' => null,
                'pack' => null,
            ],
            [
                'name' => 'Request Card',
                'sku' => 'PROMO-RCARD',
                'hsn_code' => '8442',
                'unit' => 'pcs',
                'item_group_id' => null,
                'gst_rate' => 18,
                'mrp' => 0,
                'purchase_price' => 0,
                'selling_price' => 0,
                'is_batch_tracked' => false,
                'qty' => 8,
                'rate' => 0,
                'batch_number' => null,
                'expiry_date' => null,
                'pack' => null,
            ],
            // Pharmaceutical items (GST 12%)
            [
                'name' => 'Adtrax Inj. 1GM',
                'sku' => 'AID-ADTRAX',
                'hsn_code' => '30042019',
                'unit' => 'vial',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 65.00,
                'purchase_price' => 16.00,
                'selling_price' => 50.00,
                'is_batch_tracked' => true,
                'qty' => 100,
                'rate' => 16.00,
                'batch_number' => 'AX-1519',
                'expiry_date' => '2026-05-31',
                'pack' => '1 GM',
            ],
            [
                'name' => 'Adtrax-S Inj. 1.5GM',
                'sku' => 'AID-ADTRAXS',
                'hsn_code' => '300420',
                'unit' => 'vial',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 155.00,
                'purchase_price' => 21.00,
                'selling_price' => 120.00,
                'is_batch_tracked' => true,
                'qty' => 200,
                'rate' => 21.00,
                'batch_number' => 'CFS-512C',
                'expiry_date' => '2025-09-30',
                'pack' => '1.5 GM',
            ],
            [
                'name' => 'Cefizix-200 Tab.',
                'sku' => 'AID-CEFIZIX',
                'hsn_code' => '30042019',
                'unit' => 'strip',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 1500.00,
                'purchase_price' => 370.00,
                'selling_price' => 1200.00,
                'is_batch_tracked' => true,
                'qty' => 10,
                'rate' => 370.00,
                'batch_number' => 'MBT-24030',
                'expiry_date' => '2026-07-31',
                'pack' => '10x10',
            ],
            [
                'name' => 'Coritex-AM Syp. 100ML',
                'sku' => 'AID-CORITEXAM',
                'hsn_code' => '30049099',
                'unit' => 'bottle',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 85.00,
                'purchase_price' => 12.00,
                'selling_price' => 65.00,
                'is_batch_tracked' => true,
                'qty' => 25,
                'rate' => 12.00,
                'batch_number' => 'UF3124180C',
                'expiry_date' => '2026-02-28',
                'pack' => '100 ML',
            ],
            [
                'name' => 'Coritex-DX Syp. 100ML',
                'sku' => 'AID-CORITEXDX',
                'hsn_code' => '300490',
                'unit' => 'bottle',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 80.00,
                'purchase_price' => 13.00,
                'selling_price' => 60.00,
                'is_batch_tracked' => true,
                'qty' => 25,
                'rate' => 13.00,
                'batch_number' => 'UF2014364G',
                'expiry_date' => '2026-04-30',
                'pack' => '100 ML',
            ],
            [
                'name' => 'Coritex-LS Syp. 100ML',
                'sku' => 'AID-CORITEXLS',
                'hsn_code' => '300490',
                'unit' => 'bottle',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 95.00,
                'purchase_price' => 13.00,
                'selling_price' => 72.00,
                'is_batch_tracked' => true,
                'qty' => 25,
                'rate' => 13.00,
                'batch_number' => 'UF2674020N',
                'expiry_date' => '2025-12-31',
                'pack' => '100 ML',
            ],
            [
                'name' => 'Diconis Inj. 75MG',
                'sku' => 'AID-DICONIS',
                'hsn_code' => '30049066',
                'unit' => 'vial',
                'item_group_id' => null,
                'gst_rate' => 12,
                'mrp' => 19.00,
                'purchase_price' => 2.50,
                'selling_price' => 15.00,
                'is_batch_tracked' => true,
                'qty' => 100,
                'rate' => 2.50,
                'batch_number' => 'DS-0359',
                'expiry_date' => '2026-03-31',
                'pack' => '75 MG',
            ],
            // Nikasin-500 Inj. (GST 5%)
            [
                'name' => 'Nikasin-500 Inj. 2ML',
                'sku' => 'AID-NIKASIN',
                'hsn_code' => '3004',
                'unit' => 'vial',
                'item_group_id' => null,
                'gst_rate' => 5,
                'mrp' => 110.00,
                'purchase_price' => 15.00,
                'selling_price' => 85.00,
                'is_batch_tracked' => true,
                'qty' => 100,
                'rate' => 15.00,
                'batch_number' => 'L-24F-31A',
                'expiry_date' => '2026-05-31',
                'pack' => '2 ML',
            ],
        ];

        // Determine if inter-state (company state vs vendor state)
        // Vendor is from Haryana (06), so if company state_code != '06', it's inter-state
        $isInterState = ($company->state_code ?? '27') !== '06';

        $invoiceDate = Carbon::parse('2024-09-09');

        // Create the purchase invoice
        $invoice = PurchaseInvoice::create([
            'company_id' => $company->id,
            'party_id' => $vendor->id,
            'godown_id' => $godown->id,
            'invoice_number' => 'PI-AID-000467',
            'vendor_invoice_number' => 'A000467',
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

        $totalTaxable = 0;
        $cgstTotal = 0;
        $sgstTotal = 0;
        $igstTotal = 0;

        foreach ($invoiceItems as $lineData) {
            // Create or find the item
            $item = Item::where('company_id', $company->id)
                ->where('sku', $lineData['sku'])
                ->first();

            if (! $item) {
                $item = Item::create([
                    'company_id' => $company->id,
                    'name' => $lineData['name'],
                    'sku' => $lineData['sku'],
                    'hsn_code' => $lineData['hsn_code'],
                    'unit' => $lineData['unit'],
                    'item_group_id' => $lineData['item_group_id'] ?? null,
                    'cgst' => 9,
                    'sgst' => 9,
                    'igst' => 18,
                    'mrp' => $lineData['mrp'],
                    'purchase_price' => $lineData['purchase_price'],
                    'selling_price' => $lineData['selling_price'],
                    'reorder_level' => 50,
                    'is_batch_tracked' => $lineData['is_batch_tracked'],
                    'is_active' => true,
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                ]);
            }

            // Create batch if batch-tracked
            if ($lineData['is_batch_tracked'] && $lineData['batch_number']) {
                Batch::firstOrCreate(
                    [
                        'item_id' => $item->id,
                        'batch_number' => $lineData['batch_number'],
                    ],
                    [
                        'manufacturing_date' => Carbon::parse($lineData['expiry_date'])->subYears(2),
                        'expiry_date' => Carbon::parse($lineData['expiry_date']),
                        'purchase_price' => $lineData['rate'],
                        'selling_price' => $lineData['selling_price'],
                        'sync_status' => 'synced',
                        'synced_at' => now(),
                        'updated_at_local' => now(),
                    ]
                );
            }

            // Calculate GST
            $qty = $lineData['qty'];
            $rate = $lineData['rate'];
            $taxable = $qty * $rate;
            $gstAmt = $taxable * $lineData['gst_rate'] / 100;

            $cgst = $isInterState ? 0 : $gstAmt / 2;
            $sgst = $isInterState ? 0 : $gstAmt / 2;
            $igst = $isInterState ? $gstAmt : 0;

            PurchaseInvoiceLine::create([
                'purchase_invoice_id' => $invoice->id,
                'item_id' => $item->id,
                'quantity' => $qty,
                'rate' => $rate,
                'discount_percent' => 0,
                'taxable_amount' => $taxable,
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

            // Stock in entry (only for items with actual quantity value)
            if ($taxable > 0) {
                StockLedger::create([
                    'company_id' => $company->id,
                    'item_id' => $item->id,
                    'godown_id' => $godown->id,
                    'type' => 'purchase',
                    'reference_type' => PurchaseInvoice::class,
                    'reference_id' => $invoice->id,
                    'quantity' => $qty,
                    'rate' => $rate,
                    'value' => $taxable,
                    'narration' => 'Purchase from Aidway Biotech (Inv: A000467)',
                    'created_by' => $user->id,
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                    'date' => $invoiceDate,
                ]);
            }

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
