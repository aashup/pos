<?php

namespace App\Traits;

use App\Models\FinancialYear;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

trait FiltersByFinancialYear
{
    /**
     * Apply financial year date range filter to a query.
     *
     * @param  Builder  $query  The Eloquent query builder
     * @param  Request  $request  The HTTP request (checks for 'financial_year_id' param)
     * @param  string  $dateColumn  The date column to filter on (e.g. 'invoice_date', 'voucher_date')
     */
    protected function applyFYFilter(Builder $query, Request $request, string $dateColumn = 'financial_year_id'): Builder
    {
        if ($dateColumn == 'financial_year_id') {
            $query->where($dateColumn, $request->financial_year_id);
        } elseif ($request->financial_year_id) {
            $fy = FinancialYear::find($request->financial_year_id);
            if ($fy) {
                $query->whereDate($dateColumn, '>=', $fy->start_date)
                    ->whereDate($dateColumn, '<=', $fy->end_date);
            }
        }

        return $query;
    }
}
