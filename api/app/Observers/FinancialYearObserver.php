<?php

namespace App\Observers;

use App\Models\DocumentCounter;
use App\Models\FinancialYear;

class FinancialYearObserver
{
    /**
     * When a financial year is created, initialize document counters for all 10 document types.
     */
    public function created(FinancialYear $fy): void
    {
        $documentTypes = [
            // Orders & Invoices
            ['type' => 'purchase_order', 'prefix' => 'PO'],
            ['type' => 'sales_order', 'prefix' => 'SO'],
            ['type' => 'purchase_invoice', 'prefix' => 'PI'],
            ['type' => 'sales_invoice', 'prefix' => 'SI'],
            // Vouchers
            ['type' => 'contra', 'prefix' => 'CON'],
            ['type' => 'payment', 'prefix' => 'PAY'],
            ['type' => 'receipt', 'prefix' => 'REC'],
            ['type' => 'journal', 'prefix' => 'JOU'],
            ['type' => 'purchase', 'prefix' => 'PUR'],
            ['type' => 'sales', 'prefix' => 'SAL'],
        ];
        // Split the string
        [$start, $end] = explode('-', $fy->label);

        // Take last 2 digits of start year
        $startShort = substr($start, -2);

        foreach ($documentTypes as $doc) {
            DocumentCounter::create([
                'company_id' => $fy->company_id,
                'financial_year_id' => $fy->id,
                'document_type' => $doc['type'],
                'prefix' => $doc['prefix'].$startShort.$end,
                'next_number' => 1,
            ]);
        }
    }
}
