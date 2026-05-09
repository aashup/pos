<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Ledger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LedgerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Ledger::class);

        $query = Ledger::with('group')
            ->when($request->group_id, fn ($q, $g) => $q->where('group_id', $g))
            ->when($request->group_system_key, fn ($q, $k) => $q->whereHas('group', fn ($gq) => $gq->whereIn('system_key', explode(',', $k))))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('alias', 'like', "%{$s}%");
            }));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'name' => $query->orderBy('ledgers.name', $sortOrder),
                'group' => $query->join('accounting_groups', 'ledgers.group_id', '=', 'accounting_groups.id')->orderBy('accounting_groups.name', $sortOrder),
                'opening_balance' => $query->orderBy('ledgers.opening_balance', $sortOrder),
                'is_system' => $query->orderBy('ledgers.is_system', $sortOrder),
                default => $query->orderBy('ledgers.name', 'asc'),
            };
        } else {
            $query->orderBy('ledgers.name', 'asc');
        }

        $ledgers = $query->paginate($request->per_page ?? 25);

        return response()->json($ledgers);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Ledger::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'alias' => 'nullable|string|max:255',
            'group_id' => 'required|uuid|exists:accounting_groups,id',
            'opening_balance' => 'nullable|numeric|min:0',
            'opening_type' => 'nullable|in:dr,cr',
            'opening_date' => 'nullable|date',
            'is_bill_wise' => 'boolean',
            'is_cost_center_applicable' => 'boolean',
            'allow_manual_entry' => 'boolean',
        ]);

        $ledger = Ledger::create([
            ...$validated,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $ledger->load('group')], 201);
    }

    public function show(Ledger $ledger): JsonResponse
    {
        $this->authorize('view', $ledger);

        return response()->json(['data' => $ledger->load('group')]);
    }

    public function update(Request $request, Ledger $ledger): JsonResponse
    {
        $this->authorize('update', $ledger);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'alias' => 'nullable|string|max:255',
            'group_id' => 'sometimes|uuid|exists:accounting_groups,id',
            'opening_balance' => 'nullable|numeric|min:0',
            'opening_type' => 'nullable|in:dr,cr',
            'opening_date' => 'nullable|date',
            'is_bill_wise' => 'boolean',
            'is_cost_center_applicable' => 'boolean',
            'allow_manual_entry' => 'boolean',
        ]);

        $ledger->update([
            ...$validated,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $ledger->load('group')]);
    }

    public function balance(Ledger $ledger): JsonResponse
    {
        $this->authorize('view', $ledger);

        $companyId = request()->user()->company_id;

        $txn = DB::table('voucher_lines')
            ->join('vouchers', 'voucher_lines.voucher_id', '=', 'vouchers.id')
            ->where('vouchers.company_id', $companyId)
            ->where('vouchers.is_posted', true)
            ->where('voucher_lines.ledger_id', $ledger->id)
            ->select(
                DB::raw('SUM(voucher_lines.debit) as total_debit'),
                DB::raw('SUM(voucher_lines.credit) as total_credit')
            )
            ->first();

        $openingDebit = $ledger->opening_type === 'dr' ? (float) $ledger->opening_balance : 0;
        $openingCredit = $ledger->opening_type === 'cr' ? (float) $ledger->opening_balance : 0;

        $totalDebit = $openingDebit + (float) ($txn->total_debit ?? 0);
        $totalCredit = $openingCredit + (float) ($txn->total_credit ?? 0);

        $net = $totalDebit - $totalCredit;

        return response()->json([
            'data' => [
                'balance' => round(abs($net), 2),
                'balance_type' => $net >= 0 ? 'dr' : 'cr',
            ],
        ]);
    }

    public function destroy(Ledger $ledger): JsonResponse
    {
        $this->authorize('delete', $ledger);

        if ($ledger->is_system) {
            return response()->json(['message' => 'System ledgers cannot be deleted.'], 422);
        }

        $ledger->delete();

        return response()->json(['message' => 'Ledger deleted']);
    }
}
