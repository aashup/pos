<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingGroup;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\FinancialYear;
use App\Models\Godown;
use App\Models\Item;
use App\Models\ItemGroup;
use App\Models\Ledger;
use App\Models\Party;
use App\Models\PaymentReceipt;
use App\Models\PoLine;
use App\Models\PurchaseInvoice;
use App\Models\PurchaseInvoiceLine;
use App\Models\PurchaseOrder;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceLine;
use App\Models\SalesOrder;
use App\Models\SoLine;
use App\Models\Unit;
use App\Models\Voucher;
use App\Models\VoucherLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SyncController extends Controller
{
    /**
     * Models that have a direct company_id column (BelongsToCompany trait).
     */
    private array $companyModels = [
        'items' => Item::class,
        'parties' => Party::class,
        'godowns' => Godown::class,
        'branches' => Branch::class,
        'item_groups' => ItemGroup::class,
        'units' => Unit::class,
        'financial_years' => FinancialYear::class,
        'accounting_groups' => AccountingGroup::class,
        'ledgers' => Ledger::class,
        'purchase_orders' => PurchaseOrder::class,
        'purchase_invoices' => PurchaseInvoice::class,
        'sales_orders' => SalesOrder::class,
        'sales_invoices' => SalesInvoice::class,
        'vouchers' => Voucher::class,
        // 'payment_receipts' => PaymentReceipt::class,
    ];

    /**
     * Models without a direct company_id — scoped through parent relationship.
     * Format: 'api_table' => [ModelClass, 'parentRelationName']
     */
    private array $lineModels = [
        'batches' => [Batch::class,              'item'],
        'po_lines' => [PoLine::class,             'purchaseOrder'],
        'so_lines' => [SoLine::class,             'salesOrder'],
        'purchase_invoice_lines' => [PurchaseInvoiceLine::class, 'purchaseInvoice'],
        'sales_invoice_lines' => [SalesInvoiceLine::class,   'salesInvoice'],
        'voucher_lines' => [VoucherLine::class,        'voucher'],
    ];

    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'changes' => 'required|array',
            'changes.*.table' => 'required|string',
            'changes.*.records' => 'required|array',
        ]);

        // Flat map of all accepted table names for push validation
        $allModels = array_merge(
            $this->companyModels,
            array_map(fn ($v) => $v[0], $this->lineModels)
        );

        $synced = 0;
        $failed = [];

        foreach ($validated['changes'] as $change) {
            $table = $change['table'];
            if (! isset($allModels[$table])) {
                continue;
            }

            $modelClass = $allModels[$table];

            foreach ($change['records'] as $record) {
                try {
                    DB::transaction(function () use ($modelClass, $record) {
                        $modelClass::updateOrCreate(
                            ['id' => $record['id']],
                            array_merge($record, [
                                'sync_status' => 'synced',
                                'synced_at'   => now(),
                            ])
                        );
                    });
                    $synced++;
                } catch (\Throwable $e) {
                    $failed[] = [
                        'table' => $table,
                        'id'    => $record['id'],
                        'error' => $e->getMessage(),
                    ];
                }
            }
        }

        return response()->json([
            'message'      => 'Sync complete',
            'synced_count' => $synced,
            'failed'       => $failed,
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $lastSyncAt = $request->input('last_synced_at');
        $changes = [];

        // Company-scoped models — filter directly by company_id
        foreach ($this->companyModels as $table => $modelClass) {
            $query = $modelClass::withoutGlobalScopes()
                ->where('company_id', $companyId);

            if ($lastSyncAt) {
                $query->where('updated_at', '>', $lastSyncAt);
            }

            $records = $query->limit(2000)->get();

            if ($records->isNotEmpty()) {
                $changes[$table] = $records;
            }
        }

        // Line-item models — scope through the parent relationship
        foreach ($this->lineModels as $table => [$modelClass, $relation]) {
            $query = $modelClass::withoutGlobalScopes()
                ->whereHas($relation, fn ($q) => $q->where('company_id', $companyId));

            if ($lastSyncAt) {
                $query->where('updated_at', '>', $lastSyncAt);
            }

            $records = $query->limit(2000)->get();

            if ($records->isNotEmpty()) {
                $changes[$table] = $records;
            }
        }

        return response()->json([
            'data' => $changes,
            'synced_at' => now()->toISOString(),
        ]);
    }
}
