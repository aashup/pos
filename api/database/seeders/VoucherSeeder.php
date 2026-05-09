<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\FinancialYear;
use App\Models\Ledger;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherLine;
use Illuminate\Database\Seeder;

class VoucherSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $fy = FinancialYear::where('company_id', $company->id)->where('is_current', true)->first();
        $user = User::where('company_id', $company->id)->first();

        if (! $fy || ! $user) {
            return;
        }

        $cashLedger = Ledger::findBySystemKey($company->id, 'cash');
        $salesLedger = Ledger::findBySystemKey($company->id, 'sales_account');
        $purchaseLedger = Ledger::findBySystemKey($company->id, 'purchase_account');

        if (! $cashLedger || ! $salesLedger || ! $purchaseLedger) {
            return;
        }

        $entries = [
            [
                'voucher_type' => 'receipt',
                'narration' => 'Cash sales collection',
                'lines' => [
                    ['ledger_id' => $cashLedger->id, 'debit' => 25000, 'credit' => 0],
                    ['ledger_id' => $salesLedger->id, 'debit' => 0, 'credit' => 25000],
                ],
            ],
            [
                'voucher_type' => 'payment',
                'narration' => 'Purchase payment via cash',
                'lines' => [
                    ['ledger_id' => $purchaseLedger->id, 'debit' => 35000, 'credit' => 0],
                    ['ledger_id' => $cashLedger->id, 'debit' => 0, 'credit' => 35000],
                ],
            ],
        ];

        foreach ($entries as $idx => $entry) {
            $voucher = Voucher::create([
                'company_id' => $company->id,
                'financial_year_id' => $fy->id,
                'voucher_number' => 'JV-'.str_pad($idx + 1, 6, '0', STR_PAD_LEFT),
                'voucher_date' => now()->subDays(rand(1, 30)),
                'voucher_type' => $entry['voucher_type'],
                'narration' => $entry['narration'],
                'source' => 'manual',
                'is_posted' => true,
                'created_by' => $user->id,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);

            foreach ($entry['lines'] as $line) {
                VoucherLine::create([
                    'voucher_id' => $voucher->id,
                    'ledger_id' => $line['ledger_id'],
                    'debit' => $line['debit'],
                    'credit' => $line['credit'],
                    'sync_status' => 'synced',
                    'synced_at' => now(),
                    'updated_at_local' => now(),
                ]);
            }
        }
    }
}
